from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.services.storage_service import StorageService

uploads_bp = Blueprint("uploads", __name__)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_FOLDERS = {"uploads", "event-covers"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@uploads_bp.route("", methods=["POST"])
@jwt_required()
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        return jsonify({"error": f"File type not allowed. Accepted: {', '.join(ALLOWED_TYPES)}"}), 400

    # Validate file size
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_FILE_SIZE:
        return jsonify({"error": f"File too large. Maximum: {MAX_FILE_SIZE // 1024 // 1024}MB"}), 400

    # Restrict folder
    folder = request.form.get("folder", "uploads")
    if folder not in ALLOWED_FOLDERS:
        return jsonify({"error": "Invalid upload folder"}), 400

    key = StorageService.upload(file, folder=folder)
    url = StorageService.get_url(key)

    return jsonify({"key": key, "url": url}), 201


@uploads_bp.route("/url", methods=["GET"])
@jwt_required()
def get_file_url():
    key = request.args.get("key")
    if not key:
        return jsonify({"error": "Missing key parameter"}), 400

    # Prevent path traversal
    if ".." in key or key.startswith("/"):
        return jsonify({"error": "Invalid key"}), 400

    url = StorageService.get_url(key)
    return jsonify({"key": key, "url": url})
