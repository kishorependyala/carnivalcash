from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, jsonify, request

from app.storage.event_store import archive_event, get_event, save_event
from app.storage.user_store import (
    find_profile_by_phone,
    get_vendor_transactions,
    get_profile,
    list_profiles,
    save_profile,
)
from app.utils.auth_middleware import require_auth, require_role


admin_bp = Blueprint('admin', __name__)


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def default_event(token_rate=10):
    return {
        'eventId': str(uuid4()),
        'name': 'Carnival Event',
        'status': 'closed',
        'tokenRate': token_rate,
        'openedAt': None,
        'closedAt': None,
    }


@admin_bp.get('/api/admin/event')
@require_auth
@require_role('admin')
def current_event():
    """
    Get the current event.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Current event object
    """
    return jsonify(get_event() or default_event())


@admin_bp.post('/api/admin/tokens')
@require_auth
@require_role('admin')
def create_tokens():
    """
    Add tokens to a user account by phone number.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [phone, amount]
            properties:
              phone: {type: string, example: "5551234567"}
              amount: {type: integer, example: 100}
    responses:
      200:
        description: Updated token balance
      404:
        description: User not found
    """
    payload = request.get_json(silent=True) or {}
    phone = str(payload.get('phone', '')).strip()
    amount = int(payload.get('amount', 0))
    profile = find_profile_by_phone(phone)

    if profile is None:
        return jsonify({'error': 'User not found'}), 404

    profile['tokenBalance'] = int(profile.get('tokenBalance', 0)) + amount
    save_profile(profile['userId'], profile)
    return jsonify({'userId': profile['userId'], 'tokenBalance': profile['tokenBalance']})


@admin_bp.post('/api/admin/rate')
@require_auth
@require_role('admin')
def set_rate():
    """
    Set the token-to-dollar rate for the current event.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [tokenRate]
            properties:
              tokenRate: {type: integer, example: 10}
    responses:
      200:
        description: Updated event with new token rate
    """
    payload = request.get_json(silent=True) or {}
    token_rate = int(payload.get('tokenRate', 0))
    event = get_event() or default_event(token_rate=token_rate or 10)
    event['tokenRate'] = token_rate
    save_event(event)
    return jsonify(event)


@admin_bp.post('/api/admin/event')
@require_auth
@require_role('admin')
def create_event():
    """
    Open or close an event.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [action]
            properties:
              action: {type: string, enum: [open, close]}
              name: {type: string, example: "Carnival 2026"}
    responses:
      200:
        description: Event object
      400:
        description: Unsupported action
      404:
        description: No active event (on close)
    """
    payload = request.get_json(silent=True) or {}
    action = payload.get('action')
    current = get_event()

    if action == 'open':
        token_rate = (current or {}).get('tokenRate', 10)
        event = {
            'eventId': str(uuid4()),
            'name': payload.get('name', 'Carnival Event'),
            'status': 'open',
            'tokenRate': token_rate,
            'openedAt': utc_now(),
            'closedAt': None,
        }
        save_event(event)
        return jsonify(event)

    if action == 'close':
        if current is None:
            return jsonify({'error': 'No active event'}), 404
        current['status'] = 'closed'
        current['closedAt'] = utc_now()
        save_event(current)
        archive_event(current)
        return jsonify(current)

    return jsonify({'error': 'Unsupported action'}), 400


@admin_bp.delete('/api/admin/balance/<user_id>')
@require_auth
@require_role('admin')
def zero_balance(user_id):
    """
    Zero out a user's token balance.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: user_id
        required: true
        schema: {type: string}
    responses:
      200:
        description: Balance zeroed
      404:
        description: User not found
    """
    profile = get_profile(user_id)
    if profile is None:
        return jsonify({'error': 'User not found'}), 404
    profile['tokenBalance'] = 0
    save_profile(user_id, profile)
    return jsonify({'userId': user_id, 'tokenBalance': 0})


@admin_bp.get('/api/admin/stats')
@require_auth
@require_role('admin')
def get_stats():
    """
    Get full stats: tokens issued, spent, per-vendor breakdown, all users.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Stats summary
        content:
          application/json:
            schema:
              type: object
              properties:
                totalTokensIssued: {type: integer}
                totalTokensSpent: {type: integer}
                vendors: {type: array, items: {type: object}}
                users: {type: array, items: {type: object}}
    """
    profiles = list_profiles()
    user_profiles = [profile for profile in profiles if 'user' in profile.get('roles', [])]
    vendor_profiles = [profile for profile in profiles if 'vendor' in profile.get('roles', [])]

    vendors = []
    total_tokens_spent = 0
    for vendor in vendor_profiles:
        transactions = get_vendor_transactions(vendor['userId'])
        total_received = sum(int(tx.get('amount', 0)) for tx in transactions)
        total_tokens_spent += total_received
        vendors.append(
            {
                'vendorId': vendor['userId'],
                'vendorName': vendor.get('name') or vendor.get('phone', ''),
                'totalReceived': total_received,
                'transactionCount': len(transactions),
                'transactions': transactions,
            }
        )

    users = [
        {
            'userId': profile['userId'],
            'name': profile.get('name', ''),
            'phone': profile.get('phone', ''),
            'tokenBalance': int(profile.get('tokenBalance', 0)),
        }
        for profile in user_profiles
    ]

    return jsonify(
        {
            'totalTokensIssued': sum(user['tokenBalance'] for user in users),
            'totalTokensSpent': total_tokens_spent,
            'vendors': vendors,
            'users': users,
        }
    )
