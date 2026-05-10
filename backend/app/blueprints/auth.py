from datetime import datetime, timedelta, timezone

import jwt
from flask import Blueprint, jsonify, request

from app.storage.user_store import ensure_user_storage, find_profile_by_phone, save_profile
from app.utils.id_generator import generate_user_id
from app.utils.pin_generator import generate_pin
from config import get_jwt_secret


auth_bp = Blueprint('auth', __name__)


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


@auth_bp.post('/api/auth/request-code')
def request_code():
    payload = request.get_json(silent=True) or {}
    phone = str(payload.get('phone', '')).strip()

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
            'tokenBalance': 0,
            'createdAt': utc_now(),
        }
        save_profile(user_id, profile)
        ensure_user_storage(user_id)

    return jsonify({'status': 'ok', 'message': 'Code sent'})


@auth_bp.post('/api/auth/verify')
def verify():
    payload = request.get_json(silent=True) or {}
    phone = str(payload.get('phone', '')).strip()
    code = str(payload.get('code', '')).strip()

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
            },
        }
    )
