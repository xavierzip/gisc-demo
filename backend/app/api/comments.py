from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app import db
from app.models.comment import Comment
from app.models.event import Event
from app.models.user import User
from app.events.producer import KafkaProducer

comments_bp = Blueprint("comments", __name__)


def _serialize_comment(c, user_names):
    return {
        "id": c.id,
        "event_id": c.event_id,
        "user_id": c.user_id,
        "user_name": user_names.get(c.user_id, "Unknown"),
        "parent_id": c.parent_id,
        "body": c.body,
        "is_hidden": c.is_hidden,
        "created_at": c.created_at.isoformat(),
    }


@comments_bp.route("/<int:event_id>/comments", methods=["GET"])
def list_comments(event_id):
    include_hidden = request.args.get("include_hidden", "false").lower() == "true"
    query = Comment.query.filter_by(event_id=event_id)
    if not include_hidden:
        query = query.filter_by(is_hidden=False)
    comments = query.order_by(Comment.created_at.asc()).all()

    user_ids = list({c.user_id for c in comments})
    users = User.query.filter(User.id.in_(user_ids)).all() if user_ids else []
    user_names = {u.id: u.full_name for u in users}

    return jsonify([_serialize_comment(c, user_names) for c in comments])


MAX_COMMENT_LENGTH = 5000


@comments_bp.route("/<int:event_id>/comments", methods=["POST"])
@jwt_required()
def create_comment(event_id):
    data = request.get_json(silent=True)
    if not data or not data.get("body") or not isinstance(data["body"], str):
        return jsonify({"error": "Comment body is required"}), 400
    if len(data["body"]) > MAX_COMMENT_LENGTH:
        return jsonify({"error": f"Comment too long. Maximum {MAX_COMMENT_LENGTH} characters"}), 400

    user_id = int(get_jwt_identity())
    comment = Comment(
        event_id=event_id,
        user_id=user_id,
        parent_id=data.get("parent_id"),
        body=data["body"].strip(),
    )
    db.session.add(comment)
    db.session.commit()

    user = db.session.get(User, user_id)
    user_name = user.full_name if user else "Unknown"
    user_names = {user_id: user_name}

    event = db.session.get(Event, event_id)
    KafkaProducer.publish("comment.created", comment.id, {
        "id": comment.id,
        "event_id": comment.event_id,
        "event_title": event.title if event else "",
        "user_id": comment.user_id,
        "user_name": user_name,
        "body": comment.body,
        "is_hidden": comment.is_hidden,
        "parent_id": comment.parent_id,
        "created_at": comment.created_at.isoformat(),
    })

    return jsonify(_serialize_comment(comment, user_names)), 201


@comments_bp.route("/<int:event_id>/comments/<int:comment_id>/hide", methods=["POST"])
@jwt_required()
def hide_comment(event_id, comment_id):
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    comment = Comment.query.filter_by(id=comment_id, event_id=event_id).first()
    if not comment:
        return jsonify({"error": "Comment not found"}), 404

    comment.is_hidden = True
    db.session.commit()

    KafkaProducer.publish("comment.hidden", comment.id, {
        "id": comment.id,
        "is_hidden": True,
    })

    return jsonify({"status": "hidden"})


@comments_bp.route("/<int:event_id>/comments/<int:comment_id>/unhide", methods=["POST"])
@jwt_required()
def unhide_comment(event_id, comment_id):
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    comment = Comment.query.filter_by(id=comment_id, event_id=event_id).first()
    if not comment:
        return jsonify({"error": "Comment not found"}), 404

    comment.is_hidden = False
    db.session.commit()

    KafkaProducer.publish("comment.hidden", comment.id, {
        "id": comment.id,
        "is_hidden": False,
    })

    return jsonify({"status": "visible"})
