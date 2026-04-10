from elasticsearch import Elasticsearch, NotFoundError
from flask import current_app


class SearchService:
    @staticmethod
    def _get_es():
        return Elasticsearch(current_app.config["ELASTICSEARCH_URL"])

    # --- Index management ---

    @staticmethod
    def ensure_indices():
        es = SearchService._get_es()

        events_mapping = {
            "properties": {
                "id": {"type": "integer"},
                "title": {"type": "text"},
                "description": {"type": "text"},
                "category": {"type": "keyword"},
                "location": {"type": "text"},
                "location_details": {"type": "text"},
                "start_time": {"type": "date"},
                "end_time": {"type": "date"},
                "status": {"type": "keyword"},
                "created_by": {"type": "integer"},
                "tags": {"type": "keyword"},
            }
        }

        if not es.indices.exists(index="events"):
            es.indices.create(index="events", body={"mappings": events_mapping})
        else:
            # Backwards-compatible field addition for existing indices.
            # put_mapping with only new fields is a no-op for fields that
            # already exist, so this is safe to call every startup.
            try:
                es.indices.put_mapping(
                    index="events",
                    body={"properties": {"tags": {"type": "keyword"}}},
                )
            except Exception:
                pass

        if not es.indices.exists(index="comments"):
            es.indices.create(index="comments", body={
                "mappings": {
                    "properties": {
                        "id": {"type": "integer"},
                        "event_id": {"type": "integer"},
                        "event_title": {"type": "text"},
                        "user_id": {"type": "integer"},
                        "user_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                        "body": {"type": "text"},
                        "is_hidden": {"type": "boolean"},
                        "parent_id": {"type": "integer"},
                        "created_at": {"type": "date"},
                    }
                }
            })

    # --- Indexing ---

    @staticmethod
    def index_event(event):
        es = SearchService._get_es()
        doc = {
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
        }
        es.index(index="events", id=event.id, document=doc)

    @staticmethod
    def index_comment(comment, event_title="", user_name=""):
        es = SearchService._get_es()
        doc = {
            "id": comment.id,
            "event_id": comment.event_id,
            "event_title": event_title,
            "user_id": comment.user_id,
            "user_name": user_name,
            "body": comment.body,
            "is_hidden": comment.is_hidden,
            "parent_id": comment.parent_id,
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
        }
        es.index(index="comments", id=comment.id, document=doc)

    @staticmethod
    def update_comment_hidden(comment_id, is_hidden):
        es = SearchService._get_es()
        try:
            es.update(index="comments", id=comment_id, doc={"is_hidden": is_hidden})
        except NotFoundError:
            pass

    # --- Search ---

    @staticmethod
    def search_events(q="", category=None, page=1, per_page=20):
        es = SearchService._get_es()
        body = {"bool": {"must": [], "filter": [{"term": {"status": "published"}}]}}

        if q:
            body["bool"]["must"].append({
                "multi_match": {
                    "query": q,
                    "fields": ["title^3", "description", "category^2", "location"],
                }
            })
        if category:
            body["bool"]["filter"].append({"term": {"category": category}})

        if not body["bool"]["must"]:
            body["bool"]["must"].append({"match_all": {}})

        result = es.search(
            index="events",
            query=body,
            from_=(page - 1) * per_page,
            size=per_page,
        )

        return {
            "items": [hit["_source"] for hit in result["hits"]["hits"]],
            "total": result["hits"]["total"]["value"],
            "page": page,
            "per_page": per_page,
        }

    @staticmethod
    def search_comments(q="", event_id=None, show="all", page=1, per_page=50):
        es = SearchService._get_es()
        body = {"bool": {"must": [], "filter": []}}

        if q:
            body["bool"]["must"].append({
                "multi_match": {
                    "query": q,
                    "fields": ["body^2", "user_name", "event_title"],
                }
            })
        if event_id:
            body["bool"]["filter"].append({"term": {"event_id": event_id}})
        if show == "hidden":
            body["bool"]["filter"].append({"term": {"is_hidden": True}})
        elif show == "visible":
            body["bool"]["filter"].append({"term": {"is_hidden": False}})

        if not body["bool"]["must"]:
            body["bool"]["must"].append({"match_all": {}})

        result = es.search(
            index="comments",
            query=body,
            from_=(page - 1) * per_page,
            size=per_page,
            sort=[{"created_at": {"order": "desc"}}],
        )

        return {
            "items": [hit["_source"] for hit in result["hits"]["hits"]],
            "total": result["hits"]["total"]["value"],
            "page": page,
            "per_page": per_page,
        }
