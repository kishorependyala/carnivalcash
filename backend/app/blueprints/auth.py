from datetime import datetime, timedelta, timezone

import jwt
from flask import Blueprint, jsonify, request

from app.storage.user_store import ensure_user_storage, find_profile_by_phone, get_profile, normalize_phone, save_profile
from app.utils.email_sender import send_email
from app.utils.id_generator import generate_user_id
from app.utils.login_logger import log_login
from app.utils.pin_generator import generate_pin
from app.utils.pin_reset_codes import generate_code, verify_code
from config import get_jwt_secret


auth_bp = Blueprint('auth', __name__)


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


@auth_bp.get('/api/auth/check-phone')
def check_phone():
    phone = normalize_phone(str(request.args.get('phone', '')).strip())
    if not phone:
        return jsonify({'error': 'Phone required'}), 400
    exists = find_profile_by_phone(phone) is not None
    return jsonify({'exists': exists})


@auth_bp.post('/api/auth/login-with-pin')
def login_with_pin():
    """Login with phone + PIN. New users (no name set) skip PIN check and go to onboarding."""
    payload = request.get_json(silent=True) or {}
    phone = normalize_phone(str(payload.get('phone', '')).strip())
    pin = str(payload.get('pin', '')).strip()

    if not phone:
        return jsonify({'error': 'Phone is required'}), 400

    # Create profile if first time
    profile = find_profile_by_phone(phone)
    if profile is None:
        user_id = generate_user_id()
        profile = {
            'userId': user_id,
            'phone': phone,
            'name': '',
            'emails': [],
            'roles': ['user'],
            'pin': '0000',
            'birthYear': '0000',
            'tokenBalance': 0,
            'createdAt': utc_now(),
        }
        save_profile(user_id, profile)
        ensure_user_storage(user_id)

    is_new = not bool(profile.get('name', '').strip())

    # Existing users must supply correct PIN
    if not is_new:
        stored_pin = profile.get('pin', '0000')
        if not pin or pin != stored_pin:
            log_login(phone, 'login_with_pin', False, 'incorrect_pin', request)
            return jsonify({'error': 'Incorrect PIN. If you forgot your PIN, contact an admin to reset it.'}), 401

    log_login(phone, 'login_with_pin', True, 'new' if is_new else 'existing', request)

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

    return jsonify({
        'token': token,
        'user': {
            'userId': profile['userId'],
            'phone': profile['phone'],
            'roles': profile.get('roles', []),
            'name': profile.get('name', ''),
            'pin': profile.get('pin', ''),
            'isNew': is_new,
        },
    })


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

@auth_bp.post('/api/auth/request-admin-pin-reset')
def request_admin_pin_reset():
    """Mark user as needing admin PIN reset. Body: {phone}"""
    payload = request.get_json(silent=True) or {}
    phone = normalize_phone(str(payload.get('phone', '')).strip())
    if not phone:
        return jsonify({'error': 'Phone required'}), 400

    profile = find_profile_by_phone(phone)
    if profile:
        profile['pinResetRequested'] = True
        save_profile(profile['userId'], profile)

    log_login(phone, 'request_admin_pin_reset', True, '', request)
    # Always respond the same way — don't reveal whether the account exists
    return jsonify({'sent': True, 'message': 'Reset request submitted. Admin will reset your PIN to 0000 shortly.'})


@auth_bp.post('/api/auth/request-pin-reset-code')
def request_pin_reset_code():
    """Send a 4-digit reset code to user's email(s). Body: {phone}"""
    payload = request.get_json(silent=True) or {}
    phone = normalize_phone(str(payload.get('phone', '')).strip())
    if not phone:
        return jsonify({'error': 'Phone required'}), 400

    profile = find_profile_by_phone(phone)
    if not profile:
        return jsonify({'sent': True, 'message': 'If an account exists, a code was sent.'})

    emails = profile.get('emails', [])
    if not emails:
        return jsonify({'error': 'No email on file. Ask admin to reset your PIN to 0000.'}), 400

    code = generate_code(phone)
    subject = 'CarnivalCash PIN Reset Code'
    body = f"Your CarnivalCash PIN reset code is: {code}\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, ignore this email."

    sent_count = 0
    for email in emails:
        if send_email(email, subject, body):
            sent_count += 1

    return jsonify({'sent': True, 'emailCount': len(emails), 'message': f'Code sent to {len(emails)} email(s) on file.'})


@auth_bp.post('/api/auth/verify-pin-reset-code')
def verify_pin_reset_code():
    """Verify code and set new PIN. Body: {phone, code, newPin}"""
    payload = request.get_json(silent=True) or {}
    phone = normalize_phone(str(payload.get('phone', '')).strip())
    code = str(payload.get('code', '')).strip()
    new_pin = str(payload.get('newPin', '')).strip()

    if not phone or not code or not new_pin:
        return jsonify({'error': 'Phone, code and newPin are required'}), 400
    if len(new_pin) != 4 or not new_pin.isdigit():
        return jsonify({'error': 'PIN must be exactly 4 digits'}), 400

    if not verify_code(phone, code):
        log_login(phone, 'verify_pin_reset_code', False, 'invalid_or_expired_code', request)
        return jsonify({'error': 'Invalid or expired code. Request a new one.'}), 400

    profile = find_profile_by_phone(phone)
    if not profile:
        return jsonify({'error': 'User not found'}), 404

    profile['pin'] = new_pin
    profile['pinResetRequested'] = False
    save_profile(profile['userId'], profile)

    log_login(phone, 'verify_pin_reset_code', True, '', request)
    return jsonify({'status': 'ok', 'message': 'PIN updated successfully.'})

