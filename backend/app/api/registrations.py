from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.registration import Registration
from app.services.registration_service import RegistrationService

registrations_bp = Blueprint("registrations", __name__)


@registrations_bp.route("/<int:event_id>/register", methods=["POST"])
@jwt_required()
def register_for_event(event_id):
    user_id = int(get_jwt_identity())
    result = RegistrationService.register(user_id=user_id, event_id=event_id)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result), 201


@registrations_bp.route("/<int:event_id>/unregister", methods=["POST"])
@jwt_required()
def unregister_from_event(event_id):
    user_id = int(get_jwt_identity())
    result = RegistrationService.unregister(user_id=user_id, event_id=event_id)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)


@registrations_bp.route("/<int:event_id>/registrations", methods=["GET"])
@jwt_required()
def list_registrations(event_id):
    registrations = RegistrationService.list_for_event(event_id)
    return jsonify(registrations)


@registrations_bp.route("/<int:event_id>/registration-status", methods=["GET"])
@jwt_required()
def registration_status(event_id):
    user_id = int(get_jwt_identity())
    reg = Registration.query.filter_by(
        user_id=user_id, event_id=event_id, status="registered"
    ).first()
    return jsonify({"registered": reg is not None})
