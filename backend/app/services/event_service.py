from datetime import datetime

from app import db
from app.models.event import Event  # noqa: F401 — used in db.session.get()
from app.models.event_tag import EventTag
from app.events.producer import KafkaProducer
from app.services.cache_service import CacheService

# Cache key patterns
EVENTS_LIST_KEY = "events:list:p{page}:pp{per_page}:cat:{category}"
EVENT_DETAIL_KEY = "events:detail:{event_id}"
REG_COUNT_KEY = "events:regcount:{event_id}"

# Tag constraints — keep in sync with API validator and frontend.
MAX_TAGS_PER_EVENT = 20
MAX_TAG_LENGTH = 50


class EventService:
    @staticmethod
    def list_events(page=1, per_page=20, category=None, include_all=False):
        # Only cache the public (non-admin) listing
        if not include_all:
            cache_key = EVENTS_LIST_KEY.format(
                page=page, per_page=per_page, category=category or "all"
            )
            cached = CacheService.get(cache_key)
            if cached:
                return cached

        query = Event.query if include_all else Event.query.filter_by(status="published")
        if category:
            query = query.filter_by(category=category)
        query = query.order_by(Event.start_time.asc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        # Batch-fetch tags for all events on this page to avoid N+1.
        ids = [e.id for e in pagination.items]
        tag_map = EventService._bulk_load_tags(ids)

        result = {
            "items": [
                EventService._serialize(e, tags=tag_map.get(e.id, []))
                for e in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
        }

        if not include_all:
            CacheService.set(cache_key, result, ttl=60)

        return result

    @staticmethod
    def get_event(event_id):
        cache_key = EVENT_DETAIL_KEY.format(event_id=event_id)
        cached = CacheService.get(cache_key)
        if cached:
            return cached

        event = db.session.get(Event, event_id)
        if not event:
            return None

        result = EventService._serialize(event)
        CacheService.set(cache_key, result, ttl=120)
        return result

    @staticmethod
    def create_event(data, created_by):
        event = Event(
            title=data["title"],
            description=data.get("description"),
            category=data.get("category"),
            location=data.get("location"),
            location_details=data.get("location_details"),
            start_time=datetime.fromisoformat(data["start_time"]),
            end_time=datetime.fromisoformat(data["end_time"]),
            capacity=data.get("capacity"),
            status=data.get("status", "draft"),
            cover_image=data.get("cover_image"),
            created_by=created_by,
        )
        db.session.add(event)
        db.session.flush()  # Populate event.id before inserting tags.

        tags = EventService._normalize_tags(data.get("tags"))
        EventService._write_tags(event.id, tags)

        db.session.commit()

        KafkaProducer.publish("event.created", event.id, EventService._event_payload(event, tags))
        EventService.try_invalidate_caches(event.id)

        return EventService._serialize(event, tags=tags)

    @staticmethod
    def update_event(event_id, data):
        event = db.session.get(Event, event_id)
        if not event:
            return None

        for field in ["title", "description", "category", "location", "location_details",
                      "capacity", "status", "cover_image"]:
            if field in data:
                setattr(event, field, data[field])
        if "start_time" in data:
            event.start_time = datetime.fromisoformat(data["start_time"])
        if "end_time" in data:
            event.end_time = datetime.fromisoformat(data["end_time"])

        # Tags are an all-or-nothing replace: if "tags" is in the body we
        # treat it as authoritative and swap the set. If it's absent we
        # leave existing tags alone (partial update semantics).
        if "tags" in data:
            tags = EventService._normalize_tags(data.get("tags"))
            EventTag.query.filter_by(event_id=event_id).delete()
            EventService._write_tags(event_id, tags)
        else:
            tags = EventService._load_tags(event_id)

        db.session.commit()

        KafkaProducer.publish("event.updated", event.id, EventService._event_payload(event, tags))
        EventService.try_invalidate_caches(event.id)

        return EventService._serialize(event, tags=tags)

    @staticmethod
    def cancel_event(event_id):
        event = db.session.get(Event, event_id)
        if not event:
            return None

        event.status = "cancelled"
        db.session.commit()

        tags = EventService._load_tags(event_id)
        KafkaProducer.publish("event.cancelled", event.id, EventService._event_payload(event, tags))
        EventService.try_invalidate_caches(event.id)

        return EventService._serialize(event, tags=tags)

    @staticmethod
    def delete_event(event_id):
        """Hard-delete an event and everything that references it. Used
        primarily by E2E test cleanup — admins can wipe test fixtures
        without leaving soft-cancelled events piling up. App-layer cascade
        because this repo uses no FK constraints.
        """
        event = db.session.get(Event, event_id)
        if not event:
            return False

        # Cascade to tables that reference this event by id. We keep
        # notifications because users may want to see historical context
        # even after an event is gone.
        from app.models.registration import Registration
        from app.models.comment import Comment
        from app.models.announcement import Announcement

        EventTag.query.filter_by(event_id=event_id).delete()
        Registration.query.filter_by(event_id=event_id).delete()
        Comment.query.filter_by(event_id=event_id).delete()
        Announcement.query.filter_by(event_id=event_id).delete()

        db.session.delete(event)
        db.session.commit()

        KafkaProducer.publish("event.cancelled", event_id, {"id": event_id, "deleted": True})
        EventService.try_invalidate_caches(event_id)

        return True

    @staticmethod
    def try_invalidate_caches(event_id):
        """Try direct cache invalidation. If it fails, Kafka consumer will handle it."""
        try:
            EventService.invalidate_caches(event_id)
        except Exception:
            pass  # Kafka consumer will retry

    @staticmethod
    def invalidate_caches(event_id):
        """Clear event-related caches. Called directly or by Kafka consumer as fallback."""
        CacheService.delete(EVENT_DETAIL_KEY.format(event_id=event_id))
        CacheService.delete_pattern("events:list:*")
        CacheService.delete("dashboard:stats")

    @staticmethod
    def get_registration_count(event_id):
        """Get registration count, using Redis as a fast counter."""
        cache_key = REG_COUNT_KEY.format(event_id=event_id)
        cached = CacheService.get(cache_key)
        if cached is not None:
            return cached

        from app.models.registration import Registration
        count = Registration.query.filter_by(event_id=event_id, status="registered").count()
        CacheService.set(cache_key, count, ttl=60)
        return count

    # --- Tag helpers ---

    @staticmethod
    def _normalize_tags(raw):
        """Accept a list (or None), strip whitespace, drop empties and
        anything over MAX_TAG_LENGTH, dedupe case-insensitively while
        preserving the first-seen casing, cap at MAX_TAGS_PER_EVENT.
        """
        if not raw:
            return []
        if not isinstance(raw, list):
            return []
        seen = set()
        out = []
        for item in raw:
            if not isinstance(item, str):
                continue
            clean = item.strip()
            if not clean or len(clean) > MAX_TAG_LENGTH:
                continue
            key = clean.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(clean)
            if len(out) >= MAX_TAGS_PER_EVENT:
                break
        return out

    @staticmethod
    def _write_tags(event_id, tags):
        for tag in tags:
            db.session.add(EventTag(event_id=event_id, tag=tag))

    @staticmethod
    def _load_tags(event_id):
        rows = EventTag.query.filter_by(event_id=event_id).all()
        return [r.tag for r in rows]

    @staticmethod
    def _bulk_load_tags(event_ids):
        """Fetch tags for a set of events in one query. Returns
        {event_id: [tag, ...]}.
        """
        if not event_ids:
            return {}
        rows = EventTag.query.filter(EventTag.event_id.in_(event_ids)).all()
        out = {}
        for r in rows:
            out.setdefault(r.event_id, []).append(r.tag)
        return out

    @staticmethod
    def _event_payload(event, tags=None):
        if tags is None:
            tags = EventService._load_tags(event.id)
        return {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "category": event.category,
            "location": event.location,
            "location_details": event.location_details,
            "start_time": event.start_time.isoformat() if event.start_time else None,
            "end_time": event.end_time.isoformat() if event.end_time else None,
            "status": event.status,
            "created_by": event.created_by,
            "tags": tags,
        }

    @staticmethod
    def _serialize(event, tags=None):
        cover_url = None
        if event.cover_image:
            try:
                from app.services.storage_service import StorageService
                cover_url = StorageService.get_url(event.cover_image)
            except Exception:
                cover_url = None

        if tags is None:
            tags = EventService._load_tags(event.id)

        return {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "category": event.category,
            "location": event.location,
            "location_details": event.location_details,
            "start_time": event.start_time.isoformat(),
            "end_time": event.end_time.isoformat(),
            "capacity": event.capacity,
            "status": event.status,
            "cover_image": cover_url,
            "created_by": event.created_by,
            "created_at": event.created_at.isoformat(),
            "updated_at": event.updated_at.isoformat(),
            "tags": tags,
        }
