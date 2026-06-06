from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4
import io
import json
import os
import threading
import zipfile

from flask import Blueprint, Response, g, jsonify, request, send_file

from app.storage.admin_store import get_admin_data, get_event, get_settings, log_admin_action, save_admin_data, save_event, save_settings
from app.storage.stall_store import list_stalls, save_stall, delete_stall
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
    save_user_transactions,
    save_vendor_transactions,
    users_dir,
    vendors_dir,
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


@admin_bp.get('/api/settings')
def public_settings():
    """Public app settings (no auth required). Used by clients on load."""
    data = get_settings()
    data['appEnv'] = os.environ.get('APP_ENV', 'dev')
    data['appRegion'] = os.environ.get('APP_REGION', 'local')
    return jsonify(data)


@admin_bp.post('/api/admin/settings')
@require_auth
@require_role('admin')
def update_settings():
    """Update app settings (admin only)."""
    payload = request.get_json(silent=True) or {}
    settings = get_settings()
    if 'pollIntervalSec' in payload:
        val = int(payload['pollIntervalSec'])
        if val < 1:
            return jsonify({'error': 'pollIntervalSec must be at least 1'}), 400
        settings['pollIntervalSec'] = val
    save_settings(settings, admin_id=g.user['userId'])
    return jsonify(settings)


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
    admin_id = g.user['userId']
    details = {'phone': phone, 'amount': amount, 'newBalance': profile['tokenBalance']}
    threading.Thread(target=log_admin_action, args=(admin_id, 'add_tokens', details), daemon=True).start()
    return jsonify({'userId': profile['userId'], 'tokenBalance': profile['tokenBalance']})


@admin_bp.post('/api/admin/reset-tokens')
@require_auth
@require_role('admin')
def reset_tokens():
    """Zero all user token balances and clear token-loading audit history."""
    profiles = list_profiles()
    zeroed = 0
    for profile in profiles:
        if 'user' in profile.get('roles', []) and int(profile.get('tokenBalance', 0)) != 0:
            profile['tokenBalance'] = 0
            save_profile(profile['userId'], profile)
            zeroed += 1

    data = get_admin_data()
    removed = sum(1 for e in data.get('auditLog', []) if e.get('action') == 'add_tokens')
    data['auditLog'] = [e for e in data.get('auditLog', []) if e.get('action') != 'add_tokens']
    save_admin_data(data)

    log_admin_action(g.user['userId'], 'reset_tokens', {'usersZeroed': zeroed, 'logsRemoved': removed})
    return jsonify({'usersZeroed': zeroed, 'logsRemoved': removed})


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
    log_admin_action(g.user['userId'], 'zero_balance',
                     {'targetUserId': user_id})
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
    user_profiles = [
        profile for profile in profiles if 'user' in profile.get('roles', [])]
    vendor_profiles = [
        profile for profile in profiles if 'vendor' in profile.get('roles', [])]

    vendors = []
    total_tokens_spent = 0

    def _fetch_vendor(vendor):
        transactions = get_vendor_transactions(vendor['userId'])
        total_received = sum(int(tx.get('amount', 0)) for tx in transactions)
        return {
            'vendorId': vendor['userId'],
            'vendorName': vendor.get('name') or vendor.get('phone', ''),
            'totalReceived': total_received,
            'transactionCount': len(transactions),
            'transactions': transactions,
        }

    with ThreadPoolExecutor() as executor:
        vendors = list(executor.map(_fetch_vendor, vendor_profiles))

    total_tokens_spent = sum(v['totalReceived'] for v in vendors)

    users = [
        {
            'userId': profile['userId'],
            'name': profile.get('name', ''),
            'phone': profile.get('phone', ''),
            'tokenBalance': int(profile.get('tokenBalance', 0)),
        }
        for profile in user_profiles
    ]

    # Aggregate token-loading activity by admin from the audit log
    admin_data = get_admin_data()
    token_rate = admin_data.get('event', {}).get('tokenRate', 2) or 2
    token_loads = [e for e in admin_data.get('auditLog', []) if e.get('action') == 'add_tokens']

    admin_load_map = {}
    for entry in token_loads:
        aid = entry.get('adminId', 'unknown')
        amount = int(entry.get('details', {}).get('amount', 0))
        if aid not in admin_load_map:
            admin_load_map[aid] = {'adminId': aid, 'loadCount': 0, 'tokensLoaded': 0}
        admin_load_map[aid]['loadCount'] += 1
        admin_load_map[aid]['tokensLoaded'] += amount

    # Resolve admin names from profiles
    all_profiles = {p['userId']: p for p in profiles}
    token_loading_by_admin = []
    for aid, row in admin_load_map.items():
        p = all_profiles.get(aid, {})
        row['adminName'] = p.get('name') or p.get('phone') or aid
        row['dollarsCollected'] = round(row['tokensLoaded'] / token_rate, 2)
        token_loading_by_admin.append(row)
    token_loading_by_admin.sort(key=lambda r: r['tokensLoaded'], reverse=True)

    return jsonify(
        {
            'totalTokensIssued': sum(user['tokenBalance'] for user in users),
            'totalTokensSpent': total_tokens_spent,
            'vendors': vendors,
            'users': users,
            'tokenLoadingByAdmin': token_loading_by_admin,
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
    log_admin_action(g.user['userId'], 'set_roles', {
                     'targetUserId': user_id, 'roles': profile['roles']})
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
    user_profiles = [p for p in profiles if 'user' in p.get('roles', [])]
    other_profiles = [p for p in profiles if 'user' not in p.get('roles', [])]

    with ThreadPoolExecutor() as executor:
        kids_list = list(executor.map(
            lambda p: get_user_kids(p['userId']), user_profiles))
    kids_map = {p['userId']: k for p, k in zip(user_profiles, kids_list)}

    return jsonify([
        {
            'userId': p['userId'],
            'phone': p.get('phone', ''),
            'name': p.get('name', ''),
            'roles': p.get('roles', []),
            'tokenBalance': int(p.get('tokenBalance', 0)),
            'kids': kids_map.get(p['userId'], []) if 'user' in p.get('roles', []) else [],
        }
        for p in profiles
    ])


@admin_bp.get('/api/admin/pin-reset-requests')
@require_auth
@require_role('admin')
def get_pin_reset_requests():
    users = list_profiles()
    requests_list = [
        {'userId': u['userId'], 'name': u.get(
            'name', ''), 'phone': u.get('phone', '')}
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
    log_admin_action(g.user['userId'], 'delete_user', {
                     'targetUserId': user_id, 'phone': profile.get('phone')})
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

    def _fetch_vendor_data(v):
        transactions = get_vendor_transactions(v['userId'])
        items = get_vendor_items(v['userId'])
        return {
            'userId': v['userId'],
            'phone': v.get('phone', ''),
            'name': v.get('name', ''),
            'roles': v.get('roles', []),
            'socials': v.get('socials', {}),
            'totalReceived': sum(int(tx.get('amount', 0)) for tx in transactions),
            'transactionCount': len(transactions),
            'items': items,
            'recentTransactions': transactions[-10:],
        }

    with ThreadPoolExecutor() as executor:
        result = list(executor.map(_fetch_vendor_data, vendor_profiles))
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


@admin_bp.get('/api/admin/files/download')
@require_auth
@require_role('admin')
def download_files():
    rel = request.args.get('path', '').lstrip('/')
    target = (DATA_DIR / rel).resolve() if rel else DATA_DIR.resolve()

    if not str(target).startswith(str(DATA_DIR.resolve())):
        return jsonify({'error': 'Invalid path'}), 400
    if not target.exists():
        return jsonify({'error': 'Not found'}), 404

    if target.is_file():
        return send_file(target, as_attachment=True, download_name=target.name)

    folder_name = target.name if rel else 'carnivalcash-data'
    exclude_names = {e.strip() for e in request.args.get('exclude', '').split(',') if e.strip()}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file in target.rglob('*'):
            if file.is_file():
                rel_parts = file.relative_to(target).parts
                if exclude_names and rel_parts and rel_parts[0] in exclude_names:
                    continue
                zf.write(file, file.relative_to(target.parent))
    buf.seek(0)
    return Response(
        buf,
        mimetype='application/zip',
        headers={'Content-Disposition': f'attachment; filename={folder_name}.zip'},
    )


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


@admin_bp.post('/api/admin/clear-transactions')
@require_auth
@require_role('admin')
def clear_transactions():
    """
    Clear all user and vendor transaction histories, preserving token balances.
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
        description: Transactions cleared
      403:
        description: Invalid code
    """
    payload = request.get_json(silent=True) or {}
    if str(payload.get('code', '')) != RESET_CODE:
        return jsonify({'error': 'Invalid code'}), 403

    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    archive_path = DATA_DIR / 'archive' / timestamp
    archive_path.mkdir(parents=True, exist_ok=True)

    users_cleared = 0
    vendors_cleared = 0

    # Archive & clear user transactions
    user_ids = [p.name for p in users_dir().iterdir() if p.is_dir()] if users_dir().exists() else []
    user_archive = {}
    for uid in user_ids:
        tx_file = users_dir() / uid / 'transactions.json'
        if tx_file.exists():
            txs = json.loads(tx_file.read_text(encoding='utf-8')) if tx_file.exists() else []
            if txs:
                user_archive[uid] = txs
                save_user_transactions(uid, [])
                users_cleared += 1

    if user_archive:
        (archive_path / 'user_transactions.json').write_text(json.dumps(user_archive, indent=2), encoding='utf-8')

    # Archive & clear vendor transactions
    vendor_ids = [p.name for p in vendors_dir().iterdir() if p.is_dir()] if vendors_dir().exists() else []
    vendor_archive = {}
    for vid in vendor_ids:
        tx_file = vendors_dir() / vid / 'transactions.json'
        if tx_file.exists():
            txs = json.loads(tx_file.read_text(encoding='utf-8')) if tx_file.exists() else []
            if txs:
                vendor_archive[vid] = txs
                save_vendor_transactions(vid, [])
                vendors_cleared += 1

    if vendor_archive:
        (archive_path / 'vendor_transactions.json').write_text(json.dumps(vendor_archive, indent=2), encoding='utf-8')

    log_admin_action(g.user['userId'], 'clear_transactions', {
        'archive': timestamp,
        'usersCleared': users_cleared,
        'vendorsCleared': vendors_cleared,
    })

    return jsonify({
        'archive': timestamp,
        'usersCleared': users_cleared,
        'vendorsCleared': vendors_cleared,
    })


@admin_bp.get('/api/admin/stalls')
@require_auth
@require_role('admin')
def admin_list_stalls():
    """
    List all stalls with full member data (admin only).
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Full stall list including members and stallAdmins
    """
    stalls = list_stalls()
    result = []
    for s in stalls:
        result.append({
            'stallId': s['stallId'],
            'stallName': s['stallName'],
            'stallType': s.get('stallType', 'game'),
            'description': s.get('description', ''),
            'tokensPerItem': s.get('tokensPerItem', 0),
            'memberCount': len(s.get('members', [])),
            'tokenBalance': s.get('tokenBalance', 0),
            'members': s.get('members', []),
            'stallAdmins': s.get('stallAdmins', []),
            'memberNames': s.get('memberNames', {}),
            'createdAt': s.get('createdAt', ''),
        })
    return jsonify(result)


@admin_bp.delete('/api/admin/stalls/<stall_id>')
@require_auth
@require_role('admin')
def admin_delete_stall(stall_id):
    """
    Delete a stall. Requires confirmation code.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: stall_id
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
        description: Stall deleted
      403:
        description: Invalid code
      404:
        description: Stall not found
    """
    payload = request.get_json(silent=True) or {}
    if str(payload.get('code', '')) != RESET_CODE:
        return jsonify({'error': 'Invalid code'}), 403
    all_stalls = list_stalls()
    stall_data = next((s for s in all_stalls if s['stallId'] == stall_id), None)
    if stall_data is None:
        return jsonify({'error': 'Stall not found'}), 404
    log_admin_action(g.user['userId'], 'delete_stall', {'stallId': stall_id, 'stallName': stall_data.get('stallName')})
    delete_stall(stall_id)
    return jsonify({'deleted': stall_id})
