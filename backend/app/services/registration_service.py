from datetime import datetime, timezone

from app import db
from app.models.event import Event
from app.models.registration import Registration
from app.events.producer import KafkaProducer
from app.services.cache_service import CacheService


class RegistrationService:
    @staticmethod
    def register(user_id, event_id):
        event = db.session.get(Event, event_id)
        if not event:
            return {"error": "Event not found"}
        if event.status != "published":
            return {"error": "Event is not open for registration"}

        existing = Registration.query.filter_by(user_id=user_id, event_id=event_id).first()
        if existing and existing.status == "registered":
            return {"error": "Already registered"}

        if event.capacity is not None:
            current_count = Registration.query.filter_by(
                event_id=event_id, status="registered"
            ).count()
            if current_count >= event.capacity:
                return {"error": "Event is at full capacity"}

        if existing:
            existing.status = "registered"
            existing.registered_at = datetime.now(timezone.utc)
            existing.cancelled_at = None
        else:
            existing = Registration(user_id=user_id, event_id=event_id)
            db.session.add(existing)

        db.session.commit()

        KafkaProducer.publish("registration.created", existing.id, {
            "id": existing.id,
            "user_id": user_id,
            "event_id": event_id,
            "event_title": event.title,
        })
        RegistrationService._try_invalidate(event_id)

        return {"status": "registered", "event_id": event_id}

    @staticmethod
    def unregister(user_id, event_id):
        reg = Registration.query.filter_by(
            user_id=user_id, event_id=event_id, status="registered"
        ).first()
        if not reg:
            return {"error": "Registration not found"}

        reg.status = "cancelled"
        reg.cancelled_at = datetime.now(timezone.utc)
        db.session.commit()

        KafkaProducer.publish("registration.cancelled", reg.id, {
            "id": reg.id,
            "user_id": user_id,
            "event_id": event_id,
        })
        RegistrationService._try_invalidate(event_id)

        return {"status": "cancelled", "event_id": event_id}

    @staticmethod
    def invalidate_caches(event_id):
        """Clear registration-related caches. Called directly or by Kafka consumer."""
        CacheService.delete(f"events:regcount:{event_id}")
        CacheService.delete("dashboard:stats")

    @staticmethod
    def _try_invalidate(event_id):
        """Try direct cache invalidation. If it fails, Kafka consumer will handle it."""
        try:
            RegistrationService.invalidate_caches(event_id)
        except Exception:
            pass  # Kafka consumer will retry

    @staticmethod
    def list_for_event(event_id):
        registrations = Registration.query.filter_by(
            event_id=event_id, status="registered"
        ).all()
        return [
            {
                "id": r.id,
                "user_id": r.user_id,
                "event_id": r.event_id,
                "registered_at": r.registered_at.isoformat(),
            }
            for r in registrations
        ]
