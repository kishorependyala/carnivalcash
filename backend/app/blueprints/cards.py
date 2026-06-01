import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, g, jsonify, request

from app.storage.user_store import get_profile, get_user_kids, save_profile
from app.storage.stall_store import get_stall, save_stall
from app.utils.auth_middleware import require_auth, require_role
from config import DATA_DIR

cards_bp = Blueprint('cards', __name__)

CARDS_FILE = Path(DATA_DIR) / 'cards.json'


def _load_cards():
    if CARDS_FILE.exists():
        return json.loads(CARDS_FILE.read_text())
    return []


def _save_cards(cards):
    CARDS_FILE.write_text(json.dumps(cards, indent=2))


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


@cards_bp.post('/api/admin/cards/generate')
@require_auth
@require_role('admin')
def generate_cards():
    """Generate N pre-printed QR cards. Body: {count: 100}"""
    body = request.get_json(silent=True) or {}
    count = min(int(body.get('count', 100)), 500)
    cards = _load_cards()
    new_cards = []
    for _ in range(count):
        card = {
            'cardId': str(uuid4()),
            'qrPayload': '',
            'linkedUserId': None,
            'linkedKidId': None,
            'linkedName': None,
            'createdAt': utc_now(),
        }
        card['qrPayload'] = f"CARNIVAL_CARD:{card['cardId']}"
        new_cards.append(card)
        cards.append(card)
    _save_cards(cards)
    return jsonify({'generated': count, 'total': len(cards), 'cards': new_cards}), 201


@cards_bp.get('/api/admin/cards')
@require_auth
@require_role('admin')
def list_cards():
    return jsonify(_load_cards())


@cards_bp.post('/api/admin/cards/<card_id>/link')
@require_auth
@require_role('admin')
def admin_link_card(card_id):
    """Admin links a card to a user or kid. Body: {userId, kidId (optional), name (optional)}"""
    body = request.get_json(silent=True) or {}
    user_id = str(body.get('userId', '')).strip()
    kid_id = str(body.get('kidId', '')).strip()
    name = str(body.get('name', '')).strip()

    cards = _load_cards()
    card = next((c for c in cards if c['cardId'] == card_id), None)
    if not card:
        return jsonify({'error': 'Card not found'}), 404

    if user_id:
        profile = get_profile(user_id)
        if not profile:
            return jsonify({'error': 'User not found'}), 404
        if name:
            profile['name'] = name
            save_profile(user_id, profile)
        card['linkedUserId'] = user_id
        card['linkedName'] = name or profile.get('name') or profile.get('phone', '')
        card['linkedKidId'] = None
        if kid_id:
            kids = get_user_kids(user_id)
            kid = next((k for k in kids if k.get('kidId') == kid_id), None)
            if not kid:
                return jsonify({'error': 'Kid not found'}), 404
            card['linkedKidId'] = kid_id
            card['linkedName'] = kid.get('name', '')

    _save_cards(cards)
    return jsonify(card)


@cards_bp.post('/api/user/link-card/<card_id>')
@require_auth
def user_link_card(card_id):
    """User links a scanned pre-printed card to themselves or a kid. Body: {kidId (optional)}"""
    body = request.get_json(silent=True) or {}
    kid_id = str(body.get('kidId', '')).strip()
    my_id = g.user['userId']

    cards = _load_cards()
    card = next((c for c in cards if c['cardId'] == card_id), None)
    if not card:
        return jsonify({'error': 'Card not found'}), 404
    if card.get('linkedUserId') and card['linkedUserId'] != my_id:
        return jsonify({'error': 'Card already linked to another user'}), 400

    profile = get_profile(my_id)
    if not profile:
        return jsonify({'error': 'User not found'}), 404

    card['linkedUserId'] = my_id
    if kid_id:
        kids = get_user_kids(my_id)
        kid = next((k for k in kids if k.get('kidId') == kid_id), None)
        if not kid:
            return jsonify({'error': 'Kid not found'}), 404
        card['linkedKidId'] = kid_id
        card['linkedName'] = kid.get('name', '')
    else:
        card['linkedName'] = profile.get('name') or profile.get('phone', '')
        card['linkedKidId'] = None

    _save_cards(cards)
    return jsonify(card)


@cards_bp.post('/api/admin/cards/register-external')
@require_auth
@require_role('admin')
def register_external_card():
    """Register an external QR payload as a card entry. Returns existing card if already registered."""
    body = request.get_json(silent=True) or {}
    qr_payload = (body.get('qrPayload') or '').strip()
    if not qr_payload:
        return jsonify({'error': 'qrPayload is required'}), 400

    cards = _load_cards()

    # Check if already registered by qrPayload
    existing = next((c for c in cards if c.get('qrPayload') == qr_payload), None)
    if existing:
        linked_name = existing.get('linkedName') or ''
        linked_user_id = existing.get('linkedUserId')
        msg = 'already_linked' if linked_user_id else 'already_registered'
        return jsonify({**existing, 'status': msg, 'linkedName': linked_name}), 200

    card = {
        'cardId': str(uuid4()),
        'qrPayload': qr_payload,
        'linkedUserId': None,
        'linkedKidId': None,
        'linkedStallId': None,
        'linkedName': None,
        'createdAt': utc_now(),
        'external': True,
    }
    cards.append(card)
    _save_cards(cards)
    return jsonify({**card, 'status': 'registered'}), 201


@cards_bp.post('/api/stalls/<stall_id>/link-card')
@require_auth
def link_card_to_stall(stall_id):
    """Stall admin links a pre-printed card to a stall."""
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404

    my_id = g.user['userId']
    is_stall_admin = my_id in (stall.get('stallAdmins') or []) or stall.get('createdBy') == my_id
    is_system_admin = 'admin' in (g.user.get('roles') or [])
    if not is_stall_admin and not is_system_admin:
        return jsonify({'error': 'Not authorised'}), 403

    body = request.get_json(silent=True) or {}
    card_id = (body.get('cardId') or '').strip()
    if not card_id:
        return jsonify({'error': 'cardId is required'}), 400

    cards = _load_cards()
    card = next((c for c in cards if c['cardId'] == card_id), None)
    if not card:
        return jsonify({'error': 'Card not found'}), 404
    if card.get('linkedStallId') and card['linkedStallId'] != stall_id:
        return jsonify({'error': f"Card already linked to another stall"}), 400

    card['linkedStallId'] = stall_id
    card['linkedName'] = stall.get('stallName', '')
    card['linkedUserId'] = None
    card['linkedKidId'] = None
    _save_cards(cards)

    stall['linkedCardId'] = card_id
    save_stall(stall_id, stall)
    return jsonify({'cardId': card_id, 'stallId': stall_id})


@cards_bp.get('/api/cards/resolve/<card_id>')
def resolve_card(card_id):
    """Resolve a pre-printed card to user/kid or stall info. Used by vendor/user scan."""
    cards = _load_cards()
    card = next((c for c in cards if c['cardId'] == card_id), None)
    if not card:
        return jsonify({'error': 'Card not found'}), 404
    if card.get('linkedStallId'):
        return jsonify({
            'cardId': card_id,
            'linkedStallId': card['linkedStallId'],
            'linkedName': card.get('linkedName', ''),
        })
    if not card.get('linkedUserId'):
        return jsonify({'error': 'Card not yet linked to a user or stall'}), 400
    return jsonify({
        'cardId': card_id,
        'linkedUserId': card['linkedUserId'],
        'linkedKidId': card.get('linkedKidId'),
        'linkedName': card.get('linkedName', ''),
    })
