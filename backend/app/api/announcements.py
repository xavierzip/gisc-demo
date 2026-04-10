from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app import db
from app.models.announcement import Announcement
from app.events.producer import KafkaProducer

announcements_bp = Blueprint("announcements", __name__)


@announcements_bp.route("/<int:event_id>/announcements", methods=["GET"])
def list_announcements(event_id):
    announcements = Announcement.query.filter_by(event_id=event_id).order_by(
        Announcement.created_at.desc()
    ).all()
    return jsonify([
        {
            "id": a.id,
            "event_id": a.event_id,
            "author_id": a.author_id,
            "title": a.title,
            "body": a.body,
            "type": a.type,
            "created_at": a.created_at.isoformat(),
        }
        for a in announcements
    ])


@announcements_bp.route("/<int:event_id>/announcements", methods=["POST"])
@jwt_required()
def create_announcement(event_id):
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json()
    announcement = Announcement(
        event_id=event_id,
        author_id=int(get_jwt_identity()),
        title=data["title"],
        body=data["body"],
        type=data.get("type", "info"),
    )
    db.session.add(announcement)
    db.session.commit()

    KafkaProducer.publish("announcement.created", announcement.id, {
        "id": announcement.id,
        "event_id": event_id,
        "title": announcement.title,
        "body": announcement.body,
        "type": announcement.type,
    })

    return jsonify({
        "id": announcement.id,
        "event_id": announcement.event_id,
        "title": announcement.title,
        "type": announcement.type,
        "created_at": announcement.created_at.isoformat(),
    }), 201
