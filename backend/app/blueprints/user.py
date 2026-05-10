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
    profile = get_profile(g.user['userId'])
    if profile is None:
        return jsonify({'error': 'Profile not found'}), 404
    return jsonify(profile)


@user_bp.put('/api/user/profile')
@require_auth
def update_profile():
    profile = get_profile(g.user['userId'])
    if profile is None:
        return jsonify({'error': 'Profile not found'}), 404

    payload = request.get_json(silent=True) or {}
    archive_profile(profile['userId'], archive_timestamp(), profile)
    profile['name'] = payload.get('name', profile.get('name', ''))
    profile['emails'] = payload.get('emails', profile.get('emails', []))
    save_profile(profile['userId'], profile)
    return jsonify(profile)


@user_bp.get('/api/user/balance')
@require_auth
def get_balance():
    profile = get_profile(g.user['userId'])
    if profile is None:
        return jsonify({'error': 'Profile not found'}), 404
    return jsonify({'tokenBalance': profile.get('tokenBalance', 0), 'pin': profile.get('pin', '')})


@user_bp.get('/api/user/transactions')
@require_auth
def list_transactions():
    return jsonify(get_user_transactions(g.user['userId']))


@user_bp.get('/api/user/kids')
@require_auth
def list_kids():
    return jsonify(get_user_kids(g.user['userId']))


@user_bp.post('/api/user/kids')
@require_auth
def create_kid_profile():
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
    kids = get_user_kids(g.user['userId'])
    next_kids = [kid for kid in kids if kid.get('kidId') != kid_id]
    save_user_kids(g.user['userId'], next_kids)
    return jsonify({'status': 'ok'})
