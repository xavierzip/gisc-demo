from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app import db
from app.models.event import Event
from app.services.event_service import EventService
from app.services.storage_service import StorageService

events_bp = Blueprint("events", __name__)


@events_bp.route("", methods=["GET"])
@jwt_required(optional=True)
def list_events():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    category = request.args.get("category")
    include_all = False
    claims = get_jwt()
    if claims and claims.get("role") == "admin":
        include_all = request.args.get("all", "false").lower() == "true"
    return jsonify(EventService.list_events(page=page, per_page=per_page, category=category, include_all=include_all))


@events_bp.route("/<int:event_id>", methods=["GET"])
def get_event(event_id):
    event = EventService.get_event(event_id)
    if not event:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(event)


def _validate_event_data(data, require_all=True):
    if not data or not isinstance(data, dict):
        return "Invalid request body"
    if require_all:
        if not data.get("title"):
            return "Title is required"
        if not data.get("start_time"):
            return "Start time is required"
        if not data.get("end_time"):
            return "End time is required"
    if data.get("title") and len(data["title"]) > 255:
        return "Title too long"
    if data.get("description") and len(data["description"]) > 10000:
        return "Description too long"
    for field in ("start_time", "end_time"):
        if data.get(field):
            try:
                from datetime import datetime
                datetime.fromisoformat(data[field])
            except (ValueError, TypeError):
                return f"Invalid {field} format"
    if "tags" in data:
        tags = data["tags"]
        if tags is not None and not isinstance(tags, list):
            return "Tags must be a list of strings"
        if isinstance(tags, list):
            from app.services.event_service import MAX_TAGS_PER_EVENT, MAX_TAG_LENGTH
            if len(tags) > MAX_TAGS_PER_EVENT:
                return f"Too many tags (max {MAX_TAGS_PER_EVENT})"
            for tag in tags:
                if not isinstance(tag, str):
                    return "Each tag must be a string"
                if len(tag) > MAX_TAG_LENGTH:
                    return f"Tag too long (max {MAX_TAG_LENGTH} chars)"
    return None


@events_bp.route("", methods=["POST"])
@jwt_required()
def create_event():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json(silent=True)
    error = _validate_event_data(data, require_all=True)
    if error:
        return jsonify({"error": error}), 400

    event = EventService.create_event(data, created_by=int(get_jwt_identity()))
    return jsonify(event), 201


@events_bp.route("/<int:event_id>", methods=["PUT"])
@jwt_required()
def update_event(event_id):
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json(silent=True)
    error = _validate_event_data(data, require_all=False)
    if error:
        return jsonify({"error": error}), 400

    event = EventService.update_event(event_id, data)
    if not event:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(event)


@events_bp.route("/<int:event_id>", methods=["DELETE"])
@jwt_required()
def delete_event(event_id):
    """Hard-delete an event and its tags, registrations, comments,
    announcements. Primarily intended for E2E test cleanup. Soft-cancel
    via POST /events/<id>/cancel is the "normal" path for user-visible
    event cancellation.
    """
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    ok = EventService.delete_event(event_id)
    if not ok:
        return jsonify({"error": "Event not found"}), 404
    return jsonify({"deleted": True})


@events_bp.route("/<int:event_id>/cancel", methods=["POST"])
@jwt_required()
def cancel_event(event_id):
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    result = EventService.cancel_event(event_id)
    if not result:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(result)


@events_bp.route("/<int:event_id>/cover", methods=["POST"])
@jwt_required()
def upload_cover(event_id):
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    event = db.session.get(Event, event_id)
    if not event:
        return jsonify({"error": "Event not found"}), 404

    file = request.files["file"]
    key = StorageService.upload(file, folder="event-covers")
    event.cover_image = key
    db.session.commit()

    return jsonify({"cover_image": StorageService.get_url(key)})
