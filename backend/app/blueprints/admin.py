from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4
import io
import json
import os
import threading
import zipfile

import jwt
from flask import Blueprint, Response, g, jsonify, request, send_file

from app.storage.admin_store import get_admin_data, get_event, get_settings, log_admin_action, save_admin_data, save_event, save_settings
from app.storage.stall_store import list_stalls, save_stall, delete_stall, get_stall, get_stall_transactions
from app.storage.user_store import (
    delete_profile,
    ensure_user_storage,
    find_profile_by_phone,
    get_profile,
    get_user_kids,
    get_user_transactions,
    get_vendor_items,
    get_vendor_transactions,
    list_profiles,
    save_profile,
    save_user_kids,
    save_user_transactions,
    save_vendor_transactions,
    users_dir,
    vendors_dir,
)
from app.utils.auth_middleware import require_auth, require_role
from app.utils.id_generator import generate_user_id
from config import DATA_DIR, get_jwt_secret


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
    event = get_event()
    data['tokenRate'] = int((event or {}).get('tokenRate') or 2)
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
            'isActive': p.get('isActive', True),
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
        txns = get_stall_transactions(s['stallId']) or []
        digital = int(s.get('tokenBalance', 0))
        physical = int(s.get('physicalTokens', 0))
        total = digital + physical
        # Build kids list from memberNames (keys starting with KID:)
        member_names = s.get('memberNames', {})
        kids = [v for k, v in member_names.items() if k.startswith('KID:')]
        result.append({
            'stallId': s['stallId'],
            'stallName': s['stallName'],
            'stallType': s.get('stallType', 'game'),
            'description': s.get('description', ''),
            'tokensPerItem': s.get('tokensPerItem', 0),
            'memberCount': len(s.get('members', [])),
            'tokenBalance': digital,
            'physicalTokens': physical,
            'totalTokens': total,
            'transactionCount': len(txns),
            'kids': kids,
            'charities': s.get('charities', []),
            'members': s.get('members', []),
            'stallAdmins': s.get('stallAdmins', []),
            'memberNames': member_names,
            'createdAt': s.get('createdAt', ''),
            'createdBy': s.get('createdBy', ''),
            'creatorName': s.get('creatorName', ''),
        })
    return jsonify(result)


@admin_bp.put('/api/admin/stalls/<stall_id>/summary')
@require_auth
@require_role('admin')
def admin_update_stall_summary(stall_id):
    """
    Update stall kids names and/or physicalTokens (admin override, no membership check).
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    body = request.get_json() or {}

    if 'physicalTokens' in body:
        stall['physicalTokens'] = int(body['physicalTokens'])

    if 'tokenBalance' in body:
        stall['tokenBalance'] = int(body['tokenBalance'])

    # kids is list of {memberId, name} to update existing memberNames entries
    if 'kids' in body:
        member_names = stall.get('memberNames', {})
        for item in body['kids']:
            mid = item.get('memberId')
            name = item.get('name', '').strip()
            if mid and mid.startswith('KID:') and name:
                member_names[mid] = name
        stall['memberNames'] = member_names

    # newKids is list of names to add as manual kid entries (no user account required)
    if 'newKids' in body:
        member_names = stall.get('memberNames', {})
        members = stall.get('members', [])
        for name in body['newKids']:
            name = name.strip()
            if not name:
                continue
            kid_key = f'KID:manual:{str(uuid4())}'
            member_names[kid_key] = name
            members.append(kid_key)
        stall['memberNames'] = member_names
        stall['members'] = members

    # charities: list of {charityId, name, percentage} to update existing charity entries
    if 'charities' in body:
        existing = {c['charityId']: c for c in stall.get('charities', [])}
        for item in body['charities']:
            cid = item.get('charityId')
            if cid and cid in existing:
                if 'name' in item and item['name'].strip():
                    existing[cid]['name'] = item['name'].strip()
                if 'percentage' in item:
                    pct = max(0, min(100, int(item['percentage'])))
                    existing[cid]['percentage'] = pct
        stall['charities'] = list(existing.values())

    save_stall(stall_id, stall)
    return jsonify({'status': 'ok'})


@admin_bp.put('/api/admin/stalls/<stall_id>/charities')
@require_auth
@require_role('admin')
def admin_update_stall_charities(stall_id):
    """
    Replace a stall's charity configuration (admin override, no membership check).
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    """
    from app.blueprints.stalls import _normalize_charities
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    body = request.get_json() or {}
    stall['charities'] = _normalize_charities(body.get('charities', []))
    save_stall(stall_id, stall)
    log_admin_action(g.user['userId'], 'update_stall_charities', {
        'stallId': stall_id, 'charities': stall['charities'],
    })
    return jsonify({'status': 'ok', 'charities': stall['charities']})
@require_auth
@require_role('admin')
def admin_update_kid(parent_user_id, kid_id):
    """
    Update a kid's name everywhere: parent's kids.json and all stall memberNames.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    """
    body = request.get_json() or {}
    new_name = body.get('name', '').strip()
    if not new_name:
        return jsonify({'error': 'Name is required'}), 400

    # Update in parent's kids.json
    kids = get_user_kids(parent_user_id) or []
    updated = False
    for kid in kids:
        if kid.get('kidId') == kid_id:
            kid['name'] = new_name
            updated = True
            break
    if not updated:
        return jsonify({'error': 'Kid not found'}), 404
    save_user_kids(parent_user_id, kids)

    # Update in all stall memberNames
    member_key = f'KID:{parent_user_id}:{kid_id}'
    for stall in list_stalls():
        member_names = stall.get('memberNames', {})
        if member_key in member_names:
            member_names[member_key] = new_name
            stall['memberNames'] = member_names
            save_stall(stall['stallId'], stall)

    log_admin_action(g.user['userId'], 'update_kid_name', {
        'parentUserId': parent_user_id, 'kidId': kid_id, 'newName': new_name,
    })
    return jsonify({'status': 'ok', 'name': new_name})


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


@admin_bp.get('/api/admin/maintenance/dedupe-check')
@require_auth
@require_role('admin')
def maintenance_dedupe_check():
    """
    Scan all user transaction files for duplicate txIds and return a summary.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Duplicate transaction report
    """
    affected = []
    total_duplicates = 0

    user_ids = [p.name for p in users_dir().iterdir() if p.is_dir()] if users_dir().exists() else []
    for uid in user_ids:
        tx_file = users_dir() / uid / 'transactions.json'
        if not tx_file.exists():
            continue
        try:
            txns = json.loads(tx_file.read_text(encoding='utf-8'))
        except Exception:
            continue
        if not txns:
            continue
        ids = [t.get('txId') for t in txns]
        dup_ids = {tid for tid in set(ids) if ids.count(tid) > 1}
        if dup_ids:
            profile = get_profile(uid) or {}
            dup_count = sum(ids.count(tid) - 1 for tid in dup_ids)
            total_duplicates += dup_count
            affected.append({
                'userId': uid,
                'name': profile.get('name', ''),
                'phone': profile.get('phone', ''),
                'totalTransactions': len(txns),
                'duplicateCount': dup_count,
            })

    return jsonify({
        'affectedUsers': len(affected),
        'totalDuplicates': total_duplicates,
        'details': affected,
    })


@admin_bp.post('/api/admin/maintenance/dedupe-transactions')
@require_auth
@require_role('admin')
def maintenance_dedupe_transactions():
    """
    Remove duplicate transactions (by txId) from all user transaction files, keeping first occurrence.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Deduplication result
    """
    fixed_users = 0
    total_removed = 0

    user_ids = [p.name for p in users_dir().iterdir() if p.is_dir()] if users_dir().exists() else []
    for uid in user_ids:
        tx_file = users_dir() / uid / 'transactions.json'
        if not tx_file.exists():
            continue
        try:
            txns = json.loads(tx_file.read_text(encoding='utf-8'))
        except Exception:
            continue
        if not txns:
            continue
        seen = set()
        deduped = []
        for tx in txns:
            tid = tx.get('txId')
            if tid not in seen:
                seen.add(tid)
                deduped.append(tx)
        removed = len(txns) - len(deduped)
        if removed > 0:
            save_user_transactions(uid, deduped)
            fixed_users += 1
            total_removed += removed

    log_admin_action(g.user['userId'], 'dedupe_transactions', {
        'fixedUsers': fixed_users,
        'totalRemoved': total_removed,
    })

    return jsonify({
        'fixedUsers': fixed_users,
        'totalRemoved': total_removed,
    })


def _find_duplicate_loads(audit_log, window_secs=3):
    """
    Find add_tokens entries that are near-duplicates: same phone + same amount
    within `window_secs` seconds of each other (rapid double-clicks).
    Returns (kept_entries, duplicate_entries, duplicate_count).
    """
    loads = [(i, e) for i, e in enumerate(audit_log) if e.get('action') == 'add_tokens']
    dup_indices = set()

    for j in range(len(loads)):
        idx_j, e_j = loads[j]
        if idx_j in dup_indices:
            continue
        phone_j = e_j.get('details', {}).get('phone', '')
        amount_j = e_j.get('details', {}).get('amount', 0)
        try:
            ts_j = datetime.fromisoformat(e_j['timestamp'].replace('Z', '+00:00'))
        except Exception:
            continue
        for k in range(j + 1, len(loads)):
            idx_k, e_k = loads[k]
            if idx_k in dup_indices:
                continue
            phone_k = e_k.get('details', {}).get('phone', '')
            amount_k = e_k.get('details', {}).get('amount', 0)
            if phone_k != phone_j or amount_k != amount_j:
                continue
            try:
                ts_k = datetime.fromisoformat(e_k['timestamp'].replace('Z', '+00:00'))
            except Exception:
                continue
            if abs((ts_k - ts_j).total_seconds()) <= window_secs:
                dup_indices.add(idx_k)

    deduped = [e for i, e in enumerate(audit_log) if i not in dup_indices]
    duplicates = [e for i, e in enumerate(audit_log) if i in dup_indices and e.get('action') == 'add_tokens']
    return deduped, duplicates, len(dup_indices)


@admin_bp.get('/api/admin/maintenance/admin-loads-check')
@require_auth
@require_role('admin')
def maintenance_admin_loads_check():
    """
    Check the audit log for near-duplicate add_tokens entries (rapid double-clicks).
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Duplicate admin load report
    """
    data = get_admin_data()
    audit_log = data.get('auditLog', [])
    _, duplicates, dup_count = _find_duplicate_loads(audit_log)

    # Summarise by phone
    from collections import defaultdict
    by_phone = defaultdict(lambda: {'duplicateCount': 0, 'tokensOverloaded': 0})
    for e in duplicates:
        phone = e.get('details', {}).get('phone', '')
        amount = int(e.get('details', {}).get('amount', 0))
        by_phone[phone]['duplicateCount'] += 1
        by_phone[phone]['tokensOverloaded'] += amount

    # Resolve names
    all_profiles = {p.get('phone', ''): p for p in list_profiles()}
    details = []
    for phone, row in by_phone.items():
        profile = all_profiles.get(phone, {})
        details.append({
            'phone': phone,
            'name': profile.get('name', ''),
            'duplicateCount': row['duplicateCount'],
            'tokensOverloaded': row['tokensOverloaded'],
        })
    details.sort(key=lambda r: r['duplicateCount'], reverse=True)

    return jsonify({
        'totalDuplicates': dup_count,
        'affectedUsers': len(by_phone),
        'details': details,
    })


@admin_bp.post('/api/admin/maintenance/dedupe-admin-loads')
@require_auth
@require_role('admin')
def maintenance_dedupe_admin_loads():
    """
    Remove near-duplicate add_tokens audit log entries (rapid double-clicks within 3 s).
    Does NOT adjust token balances — audit log cleanup only.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Cleanup result
    """
    data = get_admin_data()
    original_count = len(data.get('auditLog', []))
    deduped_log, _, removed = _find_duplicate_loads(data.get('auditLog', []))
    data['auditLog'] = deduped_log
    save_admin_data(data)

    log_admin_action(g.user['userId'], 'dedupe_admin_loads', {
        'originalCount': original_count,
        'removed': removed,
        'newCount': len(deduped_log),
    })

    return jsonify({
        'originalCount': original_count,
        'removed': removed,
        'newCount': len(deduped_log),
    })


def _find_empty_users():
    """Return users with 0 token balance, 0 tokens ever allocated, and 0 tokens spent.
    Excludes admins and any user (parent or kid) linked to a stall."""
    profiles = list_profiles()

    # Build set of user IDs protected by stall membership
    stall_protected = set()
    for stall in list_stalls():
        for member_id in stall.get('members', []):
            if member_id.startswith('KID:'):
                # KID:<parentUserId>:<kidId> — protect the parent
                parts = member_id.split(':')
                if len(parts) >= 2:
                    stall_protected.add(parts[1])
            else:
                stall_protected.add(member_id)

    # Build allocated-tokens map from audit log (add_tokens actions)
    admin_data = get_admin_data()
    audit_log = admin_data.get('auditLog', [])
    allocated_map = {}  # userId -> total tokens ever added
    for entry in audit_log:
        if entry.get('action') == 'add_tokens':
            uid = entry.get('details', {}).get('userId') or entry.get('details', {}).get('targetUserId')
            amount = int(entry.get('details', {}).get('amount', 0))
            if uid:
                allocated_map[uid] = allocated_map.get(uid, 0) + amount

    empty = []
    for p in profiles:
        if 'user' not in p.get('roles', []):
            continue
        if 'admin' in p.get('roles', []):
            continue
        uid = p['userId']
        if uid in stall_protected:
            continue
        if int(p.get('tokenBalance', 0)) != 0:
            continue
        if allocated_map.get(uid, 0) != 0:
            continue
        txns = get_user_transactions(uid) or []
        total_spent = sum(int(t.get('amount', t.get('qty', 0))) for t in txns)
        if total_spent != 0:
            continue
        empty.append({
            'userId': uid,
            'phone': p.get('phone', ''),
            'name': p.get('name', ''),
            'txnCount': len(txns),
            'createdAt': p.get('createdAt', ''),
        })
    return empty


@admin_bp.get('/api/admin/maintenance/empty-users-check')
@require_auth
@require_role('admin')
def maintenance_empty_users_check():
    """
    Find user accounts with no name, 0 token balance, and no transactions.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: List of empty/unused user accounts
    """
    empty = _find_empty_users()
    return jsonify({'count': len(empty), 'users': empty})


@admin_bp.post('/api/admin/maintenance/delete-empty-users')
@require_auth
@require_role('admin')
def maintenance_delete_empty_users():
    """
    Delete all user accounts that have no name, 0 balance, and no transactions.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Deletion result
    """
    empty = _find_empty_users()
    deleted_ids = []
    for u in empty:
        delete_profile(u['userId'])
        deleted_ids.append(u['userId'])

    log_admin_action(g.user['userId'], 'delete_empty_users', {
        'deletedCount': len(deleted_ids),
        'deletedIds': deleted_ids,
    })

    return jsonify({'deleted': len(deleted_ids), 'deletedIds': deleted_ids})


@admin_bp.post('/api/admin/maintenance/mark-empty-users-inactive')
@require_auth
@require_role('admin')
def maintenance_mark_empty_users_inactive():
    """
    Mark all empty user accounts as inactive instead of deleting them.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Result with count of marked users
    """
    empty = _find_empty_users()
    marked_ids = []
    for u in empty:
        profile = get_profile(u['userId'])
        if profile:
            profile['isActive'] = False
            save_profile(u['userId'], profile)
            marked_ids.append(u['userId'])

    log_admin_action(g.user['userId'], 'mark_empty_users_inactive', {
        'markedCount': len(marked_ids),
        'markedIds': marked_ids,
    })

    return jsonify({'marked': len(marked_ids), 'markedIds': marked_ids})


DEFAULT_CHARITY_NAME = 'Please pick a charity'


def _get_or_create_default_charity():
    """Return the default placeholder charity, creating it if needed."""
    from app.storage.charity_store import add_charity, list_charities
    charities = list_charities()
    existing = next((c for c in charities if c['name'].strip().lower() == DEFAULT_CHARITY_NAME.lower()), None)
    if existing:
        return existing
    charity, _ = add_charity(
        name=DEFAULT_CHARITY_NAME,
        description='Placeholder — stall owner should update this to a real charity.',
        website='',
        added_by='system',
    )
    return charity


def _find_stalls_without_charities():
    stalls = list_stalls()
    return [
        {'stallId': s['stallId'], 'stallName': s.get('stallName', ''), 'creatorName': s.get('creatorName', '')}
        for s in stalls if not s.get('charities')
    ]


@admin_bp.get('/api/admin/maintenance/no-charity-stalls-check')
@require_auth
@require_role('admin')
def maintenance_no_charity_stalls_check():
    """Find stalls with no charity configured."""
    stalls = _find_stalls_without_charities()
    charity = _get_or_create_default_charity()
    return jsonify({'count': len(stalls), 'stalls': stalls, 'defaultCharity': charity})


@admin_bp.post('/api/admin/maintenance/assign-default-charity')
@require_auth
@require_role('admin')
def maintenance_assign_default_charity():
    """Assign the default placeholder charity to all stalls that have no charity configured."""
    stalls_to_fix = _find_stalls_without_charities()
    charity = _get_or_create_default_charity()
    assigned = []
    for item in stalls_to_fix:
        stall = get_stall(item['stallId'])
        if not stall:
            continue
        stall['charities'] = [{'charityId': charity['charityId'], 'name': charity['name'], 'percentage': 100}]
        save_stall(item['stallId'], stall)
        assigned.append(item['stallId'])

    log_admin_action(g.user['userId'], 'assign_default_charity', {
        'assignedCount': len(assigned),
        'charityId': charity['charityId'],
        'charityName': charity['name'],
        'stallIds': assigned,
    })
    return jsonify({'assigned': len(assigned), 'charity': charity})


def _find_orphaned_charity_balances():
    """Charities in the charity store with tokenBalance > 0 but not linked to any stall."""
    from app.storage.charity_store import list_charities
    stalls = list_stalls()
    stall_charity_ids = {
        c['charityId']
        for s in stalls
        for c in s.get('charities', [])
    }
    return [
        {'charityId': c['charityId'], 'name': c['name'], 'tokenBalance': c.get('tokenBalance', 0)}
        for c in list_charities()
        if c.get('tokenBalance', 0) > 0 and c['charityId'] not in stall_charity_ids
    ]


@admin_bp.get('/api/admin/maintenance/orphaned-charity-balances-check')
@require_auth
@require_role('admin')
def maintenance_orphaned_charity_balances_check():
    """Find charities with a token balance that are no longer linked to any stall."""
    orphaned = _find_orphaned_charity_balances()
    return jsonify({'count': len(orphaned), 'charities': orphaned})


@admin_bp.post('/api/admin/maintenance/clear-orphaned-charity-balances')
@require_auth
@require_role('admin')
def maintenance_clear_orphaned_charity_balances():
    """Zero out token balances for charities no longer linked to any stall."""
    from app.storage.charity_store import list_charities, save_charities
    orphaned = _find_orphaned_charity_balances()
    if not orphaned:
        return jsonify({'cleared': 0})
    orphaned_ids = {c['charityId'] for c in orphaned}
    charities = list_charities()
    cleared = []
    for c in charities:
        if c['charityId'] in orphaned_ids:
            c['tokenBalance'] = 0
            cleared.append(c['charityId'])
    save_charities(charities)
    log_admin_action(g.user['userId'], 'clear_orphaned_charity_balances', {
        'clearedCount': len(cleared), 'clearedIds': cleared,
    })
    return jsonify({'cleared': len(cleared)})


def _find_zero_token_stalls():
    """Stalls with 0 digital and 0 physical tokens that are currently active."""
    return [
        {
            'stallId': s['stallId'],
            'stallName': s.get('stallName', ''),
            'creatorName': s.get('creatorName', ''),
            'digital': int(s.get('tokenBalance', 0)),
            'physical': int(s.get('physicalTokens', 0)),
        }
        for s in list_stalls()
        if int(s.get('tokenBalance', 0)) == 0
        and int(s.get('physicalTokens', 0)) == 0
        and s.get('isActive', True)
    ]


@admin_bp.get('/api/admin/maintenance/zero-token-stalls-check')
@require_auth
@require_role('admin')
def maintenance_zero_token_stalls_check():
    """Find active stalls with 0 digital and 0 physical tokens."""
    stalls = _find_zero_token_stalls()
    return jsonify({'count': len(stalls), 'stalls': stalls})


@admin_bp.post('/api/admin/maintenance/mark-zero-token-stalls-inactive')
@require_auth
@require_role('admin')
def maintenance_mark_zero_token_stalls_inactive():
    """Mark all zero-token active stalls as inactive so they are excluded from donations."""
    stalls_to_mark = _find_zero_token_stalls()
    marked = []
    for item in stalls_to_mark:
        stall = get_stall(item['stallId'])
        if not stall:
            continue
        stall['isActive'] = False
        save_stall(item['stallId'], stall)
        marked.append(item['stallId'])

    log_admin_action(g.user['userId'], 'mark_zero_token_stalls_inactive', {
        'markedCount': len(marked), 'stallIds': marked,
    })
    return jsonify({'marked': len(marked)})
@require_auth
@require_role('admin')
def token_summary():
    """
    Per-user token summary: total spent, current balance, whether balance was manually zeroed.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: List of user token summaries
    """
    profiles = [p for p in list_profiles() if 'user' in p.get('roles', [])]
    admin_data = get_admin_data()
    zeroed_user_ids = {
        e.get('details', {}).get('targetUserId')
        for e in admin_data.get('auditLog', [])
        if e.get('action') == 'zero_balance'
    }

    def _user_row(profile):
        uid = profile['userId']
        txns = get_user_transactions(uid)
        total_spent = sum(int(t.get('amount', 0)) for t in txns if t.get('type') == 'debit')
        balance = int(profile.get('tokenBalance', 0))
        was_zeroed = uid in zeroed_user_ids
        return {
            'userId': uid,
            'name': profile.get('name', ''),
            'phone': profile.get('phone', ''),
            'totalSpent': total_spent,
            'currentBalance': balance,
            'wasZeroed': was_zeroed,
        }

    with ThreadPoolExecutor() as ex:
        rows = list(ex.map(_user_row, profiles))

    rows.sort(key=lambda r: r['totalSpent'], reverse=True)
    return jsonify(rows)


@admin_bp.post('/api/admin/impersonate/<user_id>')
@require_auth
@require_role('admin')
def impersonate_user(user_id):
    """
    Generate a JWT token for another user (admin impersonation).
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
        description: JWT token and user info for the target user
      400:
        description: Cannot impersonate yourself
      404:
        description: User not found
    """
    if user_id == g.user['userId']:
        return jsonify({'error': 'Cannot impersonate yourself'}), 400

    profile = get_profile(user_id)
    if profile is None:
        return jsonify({'error': 'User not found'}), 404

    roles = list(profile.get('roles', []))
    token = jwt.encode(
        {
            'userId': profile['userId'],
            'phone': profile['phone'],
            'roles': roles,
            'exp': datetime.now(timezone.utc) + timedelta(hours=8),
            'impersonatedBy': g.user['userId'],
        },
        get_jwt_secret(),
        algorithm='HS256',
    )

    log_admin_action(g.user['userId'], 'impersonate', {
        'targetUserId': user_id,
        'targetName': profile.get('name', ''),
        'targetPhone': profile.get('phone', ''),
    })

    return jsonify({
        'token': token,
        'user': {
            'userId': profile['userId'],
            'phone': profile['phone'],
            'roles': roles,
            'name': profile.get('name', ''),
            'impersonatedBy': g.user['userId'],
        },
    })


@admin_bp.put('/api/admin/stalls/<stall_id>/members/<member_id>/admin')
@require_auth
@require_role('admin')
def admin_toggle_stall_admin(stall_id, member_id):
    """
    Admin-level toggle of stall admin status for any member.
    ---
    tags: [Admin]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: stall_id
        required: true
        schema: {type: string}
      - in: path
        name: member_id
        required: true
        schema: {type: string}
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [admin]
            properties:
              admin: {type: boolean}
    responses:
      200:
        description: Updated stall
      404:
        description: Stall or member not found
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    if member_id not in stall.get('members', []):
        return jsonify({'error': 'Not a stall member'}), 404

    stall.setdefault('stallAdmins', [stall.get('createdBy', '')])

    body = request.get_json(silent=True) or {}
    make_admin = body.get('admin', True)
    if make_admin:
        if member_id not in stall['stallAdmins']:
            stall['stallAdmins'].append(member_id)
    else:
        stall['stallAdmins'] = [a for a in stall['stallAdmins'] if a != member_id]

    save_stall(stall_id, stall)
    log_admin_action(g.user['userId'], 'toggle_stall_admin', {
        'stallId': stall_id,
        'memberId': member_id,
        'admin': make_admin,
    })
    return jsonify(stall)
