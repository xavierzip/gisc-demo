import re

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash

from flask_limiter.util import get_remote_address

from app import db, limiter
from app.models.user import User
from app.models.registration import Registration
from app.models.event import Event
from app.services.event_service import EventService

auth_bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LENGTH = 8
MAX_INPUT_LENGTH = 255

# Dummy hash for timing-safe login (constant-time even when user doesn't exist)
_DUMMY_HASH = generate_password_hash("dummy-password-for-timing", method="pbkdf2:sha256")


def _limit_key_by_email():
    """Rate limit key based on the email in the request body."""
    data = request.get_json(silent=True)
    if data and data.get("email"):
        return data["email"].lower()
    return get_remote_address()


def _validate_register(data):
    if not data or not isinstance(data, dict):
        return "Invalid request body"
    for field in ("email", "password", "full_name"):
        if not data.get(field) or not isinstance(data[field], str):
            return f"Missing or invalid field: {field}"
    if len(data["email"]) > MAX_INPUT_LENGTH:
        return "Email too long"
    if not EMAIL_RE.match(data["email"]):
        return "Invalid email format"
    if len(data["password"]) < MIN_PASSWORD_LENGTH:
        return f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
    if len(data["password"]) > MAX_INPUT_LENGTH:
        return "Password too long"
    if len(data["full_name"]) > MAX_INPUT_LENGTH:
        return "Name too long"
    return None


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("10 per minute", key_func=_limit_key_by_email)
def register():
    data = request.get_json(silent=True)
    error = _validate_register(data)
    if error:
        return jsonify({"error": error}), 400

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(
        email=data["email"],
        password_hash=generate_password_hash(data["password"], method="pbkdf2:sha256"),
        full_name=data["full_name"].strip(),
        phone=data.get("phone", "")[:50] if data.get("phone") else None,
        role="user",
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
    return jsonify({"token": token, "user_id": user.id}), 201


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute", key_func=_limit_key_by_email)
def login():
    data = request.get_json(silent=True)
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Invalid credentials"}), 401

    user = User.query.filter_by(email=data["email"]).first()

    # Timing-safe: always check a hash even if user doesn't exist
    password_hash = user.password_hash if user else _DUMMY_HASH
    password_valid = check_password_hash(password_hash, data["password"])

    if not user or not password_valid:
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
    return jsonify({"token": token, "user_id": user.id})


@auth_bp.route("/me/registrations", methods=["GET"])
@jwt_required()
def my_registrations():
    user_id = int(get_jwt_identity())
    registrations = Registration.query.filter_by(
        user_id=user_id, status="registered"
    ).all()

    results = []
    for reg in registrations:
        event = db.session.get(Event, reg.event_id)
        if not event:
            continue
        event_data = EventService._serialize(event)
        event_data["registered_at"] = reg.registered_at.isoformat()
        results.append(event_data)

    return jsonify(results)
