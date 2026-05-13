from datetime import datetime, timedelta, timezone

import jwt
from flask import Blueprint, jsonify, request

from app.storage.user_store import ensure_user_storage, find_profile_by_phone, normalize_phone, save_profile
from app.utils.id_generator import generate_user_id
from app.utils.pin_generator import generate_pin
from config import get_jwt_secret


auth_bp = Blueprint('auth', __name__)


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


@auth_bp.post('/api/auth/request-code')
def request_code():
    """
    Request a login code (no-op — code equals phone number).
    ---
    tags: [Auth]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [phone]
            properties:
              phone:
                type: string
                example: "5551234567"
    responses:
      200:
        description: Code sent (creates account if new phone)
        content:
          application/json:
            schema:
              type: object
              properties:
                status: {type: string, example: ok}
                message: {type: string, example: Code sent}
      400:
        description: Phone is required
    """
    payload = request.get_json(silent=True) or {}
    phone = normalize_phone(str(payload.get('phone', '')).strip())

    if not phone:
        return jsonify({'error': 'Phone is required'}), 400

    profile = find_profile_by_phone(phone)
    if profile is None:
        user_id = generate_user_id()
        profile = {
            'userId': user_id,
            'phone': phone,
            'name': '',
            'emails': [],
            'roles': ['user'],
            'pin': generate_pin(phone),
            'birthYear': '0000',
            'tokenBalance': 0,
            'createdAt': utc_now(),
        }
        save_profile(user_id, profile)
        ensure_user_storage(user_id)

    return jsonify({'status': 'ok', 'message': 'Code sent'})


@auth_bp.post('/api/auth/verify')
def verify():
    """
    Verify code and receive JWT token. Code must equal the phone number.
    ---
    tags: [Auth]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [phone, code]
            properties:
              phone:
                type: string
                example: "5551234567"
              code:
                type: string
                example: "5551234567"
    responses:
      200:
        description: JWT token and user info
        content:
          application/json:
            schema:
              type: object
              properties:
                token: {type: string}
                user:
                  type: object
                  properties:
                    userId: {type: string}
                    phone: {type: string}
                    roles: {type: array, items: {type: string}}
                    name: {type: string}
                    pin: {type: string}
      401:
        description: Invalid code
      404:
        description: Profile not found
    """
    payload = request.get_json(silent=True) or {}
    phone = normalize_phone(str(payload.get('phone', '')).strip())
    code = normalize_phone(str(payload.get('code', '')).strip())

    if phone != code:
        return jsonify({'error': 'Invalid code'}), 401

    profile = find_profile_by_phone(phone)
    if profile is None:
        return jsonify({'error': 'Profile not found'}), 404

    token = jwt.encode(
        {
            'userId': profile['userId'],
            'phone': profile['phone'],
            'roles': profile.get('roles', []),
            'exp': datetime.now(timezone.utc) + timedelta(hours=8),
        },
        get_jwt_secret(),
        algorithm='HS256',
    )

    return jsonify(
        {
            'token': token,
            'user': {
                'userId': profile['userId'],
                'phone': profile['phone'],
                'roles': profile.get('roles', []),
                'name': profile.get('name', ''),
                'pin': profile.get('pin', ''),
                'isNew': not bool(profile.get('name', '').strip()),
            },
        }
    )
