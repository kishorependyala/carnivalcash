from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import json

from flask import Blueprint, g, jsonify, request

from app.storage.admin_store import get_admin_data, get_event, log_admin_action, save_event
from app.storage.stall_store import list_stalls, save_stall
from app.storage.user_store import (
    delete_profile,
    ensure_user_storage,
    find_profile_by_phone,
    get_profile,
    get_user_kids,
    get_vendor_items,
    get_vendor_transactions,
    list_profiles,
    save_profile,
)
from app.utils.auth_middleware import require_auth, require_role
from app.utils.id_generator import generate_user_id
from config import DATA_DIR


admin_bp = Blueprint('admin', __name__)


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def default_event(token_rate=2):
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
    log_admin_action(g.user['userId'], 'add_tokens', {'phone': phone, 'amount': amount, 'newBalance': profile['tokenBalance']})
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
    save_event(event, admin_id=g.user['userId'], action='set_rate')
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
        save_event(event, admin_id=g.user['userId'], action='open_event')
        return jsonify(event)

    if action == 'close':
        if current is None:
            return jsonify({'error': 'No active event'}), 404
        current['status'] = 'closed'
        current['closedAt'] = utc_now()
        save_event(current, admin_id=g.user['userId'], action='close_event')
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
    log_admin_action(g.user['userId'], 'zero_balance', {'targetUserId': user_id})
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


VALID_ROLES = {'admin', 'user', 'vendor'}


@admin_bp.put('/api/admin/users/<user_id>/roles')
@require_auth
@require_role('admin')
def set_user_roles(user_id):
    """
    Set roles for any user. Admin only.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: user_id
        required: true
        schema: {type: string}
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [roles]
            properties:
              roles:
                type: array
                items:
                  type: string
                  enum: [admin, user, vendor]
                example: [admin, user]
    responses:
      200:
        description: Updated profile with new roles
      400:
        description: Invalid roles
      404:
        description: User not found
    """
    payload = request.get_json(silent=True) or {}
    roles = payload.get('roles', [])

    invalid = [r for r in roles if r not in VALID_ROLES]
    if invalid:
        return jsonify({'error': f'Invalid roles: {invalid}. Valid: {sorted(VALID_ROLES)}'}), 400

    profile = get_profile(user_id)
    if profile is None:
        return jsonify({'error': 'User not found'}), 404

    profile['roles'] = list(set(roles))
    save_profile(user_id, profile)
    log_admin_action(g.user['userId'], 'set_roles', {'targetUserId': user_id, 'roles': profile['roles']})
    return jsonify({'userId': user_id, 'phone': profile.get('phone'), 'roles': profile['roles']})


@admin_bp.post('/api/admin/users')
@require_auth
@require_role('admin')
def create_offline_user():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get('name', '')).strip()
    pin = str(payload.get('pin') or '0000').strip() or '0000'

    if not name:
        return jsonify({'error': 'Name is required'}), 400

    user_id = generate_user_id()
    phone = f'OFFLINE-{user_id[:8]}'
    profile = {
        'userId': user_id,
        'phone': phone,
        'name': name,
        'emails': [],
        'roles': ['user'],
        'pin': pin,
        'tokenBalance': 0,
        'createdAt': utc_now(),
    }
    save_profile(user_id, profile)
    ensure_user_storage(user_id)
    log_admin_action(g.user['userId'], 'create_offline_user', {'name': name})
    return jsonify({'userId': user_id, 'name': name, 'phone': phone}), 201


@admin_bp.get('/api/admin/users')
@require_auth
@require_role('admin')
def list_users():
    """
    List all users with their roles.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: List of all user profiles with roles
    """
    profiles = list_profiles()
    return jsonify([
        {
            'userId': p['userId'],
            'phone': p.get('phone', ''),
            'name': p.get('name', ''),
            'roles': p.get('roles', []),
            'tokenBalance': int(p.get('tokenBalance', 0)),
            'kids': get_user_kids(p['userId']) if 'user' in p.get('roles', []) else [],
        }
        for p in profiles
    ])


@admin_bp.get('/api/admin/pin-reset-requests')
@require_auth
@require_role('admin')
def get_pin_reset_requests():
    users = list_profiles()
    requests_list = [
        {'userId': u['userId'], 'name': u.get('name', ''), 'phone': u.get('phone', '')}
        for u in users if u.get('pinResetRequested')
    ]
    return jsonify(requests_list)


@admin_bp.post('/api/admin/users/<user_id>/reset-pin')
@require_auth
@require_role('admin')
def reset_user_pin(user_id):
    profile = get_profile(user_id)
    if not profile:
        return jsonify({'error': 'User not found'}), 404
    profile['pin'] = '0000'
    profile['pinResetRequested'] = False
    save_profile(user_id, profile)
    return jsonify({'status': 'ok'})


@admin_bp.delete('/api/admin/users/<user_id>')
@require_auth
@require_role('admin')
def delete_user(user_id):
    """
    Delete a user account and all associated data. Requires confirmation code.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: user_id
        required: true
        schema: {type: string}
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [code]
            properties:
              code: {type: string, example: "1234567"}
    responses:
      200:
        description: User deleted
      403:
        description: Invalid code or attempt to delete self
      404:
        description: User not found
    """
    payload = request.get_json(silent=True) or {}
    if str(payload.get('code', '')) != RESET_CODE:
        return jsonify({'error': 'Invalid code'}), 403
    if user_id == g.user['userId']:
        return jsonify({'error': 'Cannot delete your own account'}), 403
    profile = get_profile(user_id)
    if profile is None:
        return jsonify({'error': 'User not found'}), 404
    log_admin_action(g.user['userId'], 'delete_user', {'targetUserId': user_id, 'phone': profile.get('phone')})
    delete_profile(user_id)
    return jsonify({'deleted': user_id})


@admin_bp.get('/api/admin/vendors')
@require_auth
@require_role('admin')
def list_vendors():
    """
    List all vendor profiles with items and transaction totals.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: List of vendors with items and stats
    """
    profiles = list_profiles()
    vendor_profiles = [p for p in profiles if 'vendor' in p.get('roles', [])]
    result = []
    for v in vendor_profiles:
        transactions = get_vendor_transactions(v['userId'])
        items = get_vendor_items(v['userId'])
        result.append({
            'userId': v['userId'],
            'phone': v.get('phone', ''),
            'name': v.get('name', ''),
            'roles': v.get('roles', []),
            'socials': v.get('socials', {}),
            'totalReceived': sum(int(tx.get('amount', 0)) for tx in transactions),
            'transactionCount': len(transactions),
            'items': items,
            'recentTransactions': transactions[-10:],
        })
    return jsonify(result)


@admin_bp.get('/api/admin/audit')
@require_auth
@require_role('admin')
def get_audit_log():
    """
    Get the admin audit log (last 100 entries, newest first).
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Audit log entries
    """
    data = get_admin_data()
    log = list(reversed(data.get('auditLog', [])))[:100]
    return jsonify(log)


@admin_bp.get('/api/admin/files')
@require_auth
@require_role('admin')
def browse_files():
    """
    Browse data directory files and folders.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    parameters:
      - in: query
        name: path
        schema: {type: string}
        description: Relative path within the data directory
    responses:
      200:
        description: Directory listing or file content
      400:
        description: Invalid path
      404:
        description: Path not found
    """
    rel = request.args.get('path', '').lstrip('/')
    target = (DATA_DIR / rel).resolve() if rel else DATA_DIR.resolve()

    if not str(target).startswith(str(DATA_DIR.resolve())):
        return jsonify({'error': 'Invalid path'}), 400

    if not target.exists():
        return jsonify({'error': 'Not found'}), 404

    if target.is_file():
        try:
            content = target.read_text(encoding='utf-8')
        except Exception:
            content = '<binary file>'
        return jsonify({
            'type': 'file',
            'name': target.name,
            'path': str(target.relative_to(DATA_DIR)),
            'size': target.stat().st_size,
            'content': content,
        })

    items = []
    for item in sorted(target.iterdir(), key=lambda p: (p.is_file(), p.name)):
        if item.suffix == '.lock':
            continue
        items.append({
            'name': item.name,
            'type': 'dir' if item.is_dir() else 'file',
            'path': str(item.relative_to(DATA_DIR)),
            'size': item.stat().st_size if item.is_file() else None,
        })

    return jsonify({
        'type': 'dir',
        'path': str(target.relative_to(DATA_DIR)) if target != DATA_DIR.resolve() else '',
        'items': items,
    })


RESET_CODE = '1234567'


@admin_bp.post('/api/admin/reset-tokens')
@require_auth
@require_role('admin')
def reset_tokens():
    """
    Reset all user and stall token balances to zero, archiving a snapshot first.
    Requires a confirmation code.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [code]
            properties:
              code: {type: string, example: "1234567"}
    responses:
      200:
        description: Reset complete, archive path returned
      403:
        description: Invalid code
    """
    payload = request.get_json(silent=True) or {}
    if str(payload.get('code', '')) != RESET_CODE:
        return jsonify({'error': 'Invalid code'}), 403

    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    archive_dir = DATA_DIR / 'archive' / timestamp
    archive_dir.mkdir(parents=True, exist_ok=True)

    # Snapshot & reset users
    profiles = list_profiles()
    (archive_dir / 'users.json').write_text(json.dumps(profiles, indent=2), encoding='utf-8')
    for profile in profiles:
        if 'tokenBalance' in profile:
            profile['tokenBalance'] = 0
            save_profile(profile['userId'], profile)

    # Snapshot & reset stalls
    stalls = list_stalls()
    (archive_dir / 'stalls.json').write_text(json.dumps(stalls, indent=2), encoding='utf-8')
    for stall in stalls:
        if 'tokenBalance' in stall:
            stall['tokenBalance'] = 0
            save_stall(stall['stallId'], stall)

    log_admin_action(g.user['userId'], 'reset_tokens', {
        'archive': timestamp,
        'usersReset': len(profiles),
        'stallsReset': len(stalls),
    })

    return jsonify({
        'archive': timestamp,
        'usersReset': len(profiles),
        'stallsReset': len(stalls),
    })
