from flask import Blueprint, request, jsonify

from app.services.search_service import SearchService

search_bp = Blueprint("search", __name__)


@search_bp.route("/events", methods=["GET"])
def search_events():
    q = request.args.get("q", "")
    category = request.args.get("category")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    results = SearchService.search_events(q=q, category=category, page=page, per_page=per_page)
    return jsonify(results)


@search_bp.route("/comments", methods=["GET"])
def search_comments():
    q = request.args.get("q", "")
    event_id = request.args.get("event_id", type=int)
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    results = SearchService.search_comments(q=q, event_id=event_id, page=page, per_page=per_page)
    return jsonify(results)
