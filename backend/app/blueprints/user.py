from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, g, jsonify, request

from app.storage.user_store import (
    archive_profile,
    get_profile,
    get_user_kids,
    get_user_transactions,
    save_profile,
    save_user_kids,
)
from app.utils.auth_middleware import require_auth


user_bp = Blueprint('user', __name__)


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def archive_timestamp():
    return datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')


@user_bp.get('/api/user/profile')
@require_auth
def get_user_profile():
    """
    Get logged-in user's profile.
    ---
    tags: [User]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: User profile
      404:
        description: Profile not found
    """
    profile = get_profile(g.user['userId'])
    if profile is None:
        return jsonify({'error': 'Profile not found'}), 404
    return jsonify(profile)


@user_bp.get('/api/user/qr')
@require_auth
def get_user_qr():
    """
    Get the logged-in user's QR payload for vendors to scan.
    ---
    tags: [User]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: QR payload string
        content:
          application/json:
            schema:
              type: object
              properties:
                qrPayload: {type: string, example: "CARNIVAL_USER:20260510000000000001"}
    """
    return jsonify({'qrPayload': f"CARNIVAL_USER:{g.user['userId']}"})


@user_bp.put('/api/user/profile')
@require_auth
def update_profile():
    """
    Update user profile (name, emails, socials). Archives previous version.
    ---
    tags: [User]
    security: [{BearerAuth: []}]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name: {type: string, example: "Kishore"}
              emails: {type: array, items: {type: string}, example: ["k@example.com"]}
              socials:
                type: object
                properties:
                  gmail: {type: string}
                  yahoo: {type: string}
                  instagram: {type: string}
                  facebook: {type: string}
    responses:
      200:
        description: Updated profile
      404:
        description: Profile not found
    """
    profile = get_profile(g.user['userId'])
    if profile is None:
        return jsonify({'error': 'Profile not found'}), 404

    payload = request.get_json(silent=True) or {}
    archive_profile(profile['userId'], archive_timestamp(), profile)
    profile['name'] = payload.get('name', profile.get('name', ''))
    profile['emails'] = payload.get('emails', profile.get('emails', []))
    if 'socials' in payload:
        allowed = {'gmail', 'yahoo', 'instagram', 'facebook'}
        incoming = payload['socials'] or {}
        profile['socials'] = {k: str(v).strip() for k, v in incoming.items() if k in allowed}
    save_profile(profile['userId'], profile)
    return jsonify(profile)


@user_bp.get('/api/user/balance')
@require_auth
def get_balance():
    """
    Get logged-in user's token balance and PIN.
    ---
    tags: [User]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Balance and PIN
        content:
          application/json:
            schema:
              type: object
              properties:
                tokenBalance: {type: integer}
                pin: {type: string}
      404:
        description: Profile not found
    """
    profile = get_profile(g.user['userId'])
    if profile is None:
        return jsonify({'error': 'Profile not found'}), 404
    return jsonify({'tokenBalance': profile.get('tokenBalance', 0), 'pin': profile.get('pin', '')})


@user_bp.get('/api/user/transactions')
@require_auth
def list_transactions():
    """
    List all transactions for the logged-in user (includes kid transactions).
    ---
    tags: [User]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: List of transactions
    """
    return jsonify(get_user_transactions(g.user['userId']))


@user_bp.get('/api/user/kids')
@require_auth
def list_kids():
    """
    List all kid QR tokens for the logged-in user.
    ---
    tags: [User]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: List of kid tokens
    """
    return jsonify(get_user_kids(g.user['userId']))


@user_bp.post('/api/user/kids')
@require_auth
def create_kid_profile():
    """
    Create a new kid QR token with a spending limit.
    ---
    tags: [User]
    security: [{BearerAuth: []}]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [name, spendingLimit]
            properties:
              name: {type: string, example: "Alice"}
              spendingLimit: {type: integer, example: 50}
    responses:
      201:
        description: Kid token created with QR payload
    """
    payload = request.get_json(silent=True) or {}
    kids = get_user_kids(g.user['userId'])
    kid = {
        'kidId': str(uuid4()),
        'name': payload.get('name', ''),
        'spendingLimit': int(payload.get('spendingLimit', 0)),
        'spent': 0,
        'createdAt': utc_now(),
    }
    kids.append(kid)
    save_user_kids(g.user['userId'], kids)
    return jsonify({**kid, 'qrPayload': f"CARNIVAL_KID:{g.user['userId']}:{kid['kidId']}"}), 201


@user_bp.delete('/api/user/kids/<kid_id>')
@require_auth
def delete_kid_profile(kid_id):
    """
    Delete a kid QR token.
    ---
    tags: [User]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: kid_id
        required: true
        schema: {type: string}
    responses:
      200:
        description: Kid token deleted
    """
    kids = get_user_kids(g.user['userId'])
    next_kids = [kid for kid in kids if kid.get('kidId') != kid_id]
    save_user_kids(g.user['userId'], next_kids)
    return jsonify({'status': 'ok'})
