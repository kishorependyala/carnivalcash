import os

from flask import Blueprint, jsonify, request

from app.storage.user_store import find_profile_by_phone, save_profile


bootstrap_bp = Blueprint('bootstrap', __name__)


@bootstrap_bp.post('/api/bootstrap/admin')
def seed_admin():
    """
    Seed the first admin user by phone number. Protected by BOOTSTRAP_SECRET env var.
    ---
    tags: [Bootstrap]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [secret, phone]
            properties:
              secret:
                type: string
                description: Must match BOOTSTRAP_SECRET env var
              phone:
                type: string
                example: "7327184414"
    responses:
      200:
        description: User granted admin role
      403:
        description: Invalid secret
      404:
        description: Phone not found — user must request-code first
    """
    expected = os.environ.get('BOOTSTRAP_SECRET', '')
    if not expected:
        return jsonify({'error': 'Bootstrap is disabled (BOOTSTRAP_SECRET not set)'}), 403

    payload = request.get_json(silent=True) or {}
    if payload.get('secret') != expected:
        return jsonify({'error': 'Invalid secret'}), 403

    phone = str(payload.get('phone', '')).strip()
    profile = find_profile_by_phone(phone)
    if profile is None:
        return jsonify({'error': 'Phone not found. User must log in first to create a profile.'}), 404

    roles = list(set(profile.get('roles', []) + ['admin']))
    profile['roles'] = roles
    save_profile(profile['userId'], profile)

    return jsonify({
        'status': 'ok',
        'userId': profile['userId'],
        'phone': profile['phone'],
        'roles': profile['roles'],
    })
