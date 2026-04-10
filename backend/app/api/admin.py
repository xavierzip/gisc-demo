from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from app import db
from app.models.event import Event
from app.models.registration import Registration
from app.models.comment import Comment
from app.models.user import User
from app.services.cache_service import CacheService
from app.services.search_service import SearchService

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    cached = CacheService.get("dashboard:stats")
    if cached:
        return jsonify(cached)

    events_by_status = (
        db.session.query(Event.status, db.func.count(Event.id))
        .group_by(Event.status)
        .all()
    )
    total_registrations = Registration.query.filter_by(status="registered").count()
    total_comments = Comment.query.count()
    pending_comments = Comment.query.filter_by(is_hidden=False).count()
    total_users = User.query.filter_by(role="user").count()

    result = {
        "events_by_status": {status: count for status, count in events_by_status},
        "total_registrations": total_registrations,
        "total_comments": total_comments,
        "visible_comments": pending_comments,
        "total_users": total_users,
    }
    CacheService.set("dashboard:stats", result, ttl=30)

    return jsonify(result)


@admin_bp.route("/comments", methods=["GET"])
@jwt_required()
def list_all_comments():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    q = request.args.get("q", "")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    show = request.args.get("show", "all")  # all, hidden, visible

    results = SearchService.search_comments(q=q, show=show, page=page, per_page=per_page)
    return jsonify(results)
