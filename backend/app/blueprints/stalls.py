from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, g, jsonify, request

from app.storage.charity_store import credit_charity
from app.storage.stall_store import (
    create_stall,
    get_stall,
    get_stall_transactions,
    list_stalls,
    list_user_stalls,
    save_stall,
    save_stall_transactions,
)
from app.storage.user_store import find_profile_by_phone, get_profile, get_user_kids, get_user_transactions, save_user_transactions
from app.utils.auth_middleware import require_auth

stalls_bp = Blueprint('stalls', __name__)


# ── List ALL stalls (public browse) ──────────────────────────────────────────

@stalls_bp.get('/api/stalls')
@require_auth
def list_all_stalls():
    """
    List all stalls (for browsing). Any authenticated user can see this.
    ---
    tags: [Stalls]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Summary list of all stalls
    """
    stalls = list_stalls()
    caller = g.user['userId']
    result = []
    for s in stalls:
        pending = any(
            r['userId'] == caller and r['status'] == 'pending'
            for r in s.get('joinRequests', [])
        )
        result.append({
            'stallId': s['stallId'],
            'stallName': s['stallName'],
            'stallType': s['stallType'],
            'description': s['description'],
            'tokensPerItem': s['tokensPerItem'],
            'memberCount': len(s.get('members', [])),
            'tokenBalance': s.get('tokenBalance', 0),
            'charities': s.get('charities', []),
            'isMember': caller in s.get('members', []),
            'hasPendingRequest': pending,
            'createdAt': s.get('createdAt', ''),
        })
    return jsonify(result)


def _utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _is_member(stall, user_id):
    return user_id in stall.get('members', [])


def _normalize_charities(charities):
    normalized = []
    for charity in charities or []:
        charity_id = (charity.get('charityId') or '').strip()
        name = (charity.get('name') or '').strip()
        if not charity_id or not name:
            continue
        try:
            percentage = int(charity.get('percentage', 0))
        except (TypeError, ValueError):
            percentage = 0
        normalized.append({
            'charityId': charity_id,
            'name': name,
            'percentage': max(0, min(100, percentage)),
        })
    return normalized


# ── Create stall ──────────────────────────────────────────────────────────────

@stalls_bp.post('/api/stalls')
@require_auth
def create_stall_route():
    """
    Create a new stall. Any authenticated user can create a stall and becomes its first member.
    ---
    tags: [Stalls]
    security: [{BearerAuth: []}]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [stallName, stallType, tokensPerItem]
            properties:
              stallName: {type: string}
              stallType: {type: string, enum: [food, game]}
              tokensPerItem: {type: integer}
              description: {type: string}
    responses:
      201:
        description: Created stall
    """
    body = request.get_json(silent=True) or {}
    stall_name = (body.get('stallName') or '').strip()
    stall_type = body.get('stallType') or 'game'
    tokens_per_item = int(body.get('tokensPerItem') or 1)
    description = (body.get('description') or '').strip()
    charities = _normalize_charities(body.get('charities'))

    if not stall_name:
        return jsonify({'error': 'stallName is required'}), 400
    if stall_type not in ('food', 'game'):
        return jsonify({'error': 'stallType must be food or game'}), 400

    creator_id = g.user['userId']
    creator_profile = get_profile(creator_id) or {}
    creator_name = creator_profile.get('name') or creator_profile.get('phone', '')
    stall = create_stall(stall_name, stall_type, tokens_per_item, description, creator_id, creator_name, charities)
    return jsonify(stall), 201


# ── List my stalls ────────────────────────────────────────────────────────────

@stalls_bp.get('/api/stalls/mine')
@require_auth
def my_stalls():
    """
    List all stalls where the current user is a member.
    ---
    tags: [Stalls]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: List of stalls
    """
    stalls = list_user_stalls(g.user['userId'])
    return jsonify(stalls)



@stalls_bp.put('/api/stalls/<stall_id>/members/<member_id>/admin')
@require_auth
def toggle_stall_admin(stall_id, member_id):
    """Toggle admin status for a stall member. Caller must be a stall admin."""
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404

    caller = g.user['userId']
    caller_is_admin = caller in stall.get('stallAdmins', [stall.get('createdBy')]) or 'admin' in (g.user.get('roles') or [])
    if not caller_is_admin:
        return jsonify({'error': 'Must be a stall admin'}), 403
    if member_id not in stall.get('members', []):
        return jsonify({'error': 'Not a stall member'}), 404

    if 'stallAdmins' not in stall:
        stall['stallAdmins'] = [stall.get('createdBy', '')]

    body = request.get_json(silent=True) or {}
    make_admin = body.get('admin', True)
    if make_admin:
        if member_id not in stall['stallAdmins']:
            stall['stallAdmins'].append(member_id)
        if member_id.startswith('KID:'):
            parts = member_id.split(':')
            parent_id = parts[1] if len(parts) == 3 else None
            if parent_id and parent_id not in stall['stallAdmins']:
                stall['stallAdmins'].append(parent_id)
                if parent_id not in stall['members']:
                    stall['members'].append(parent_id)
                    parent_prof = get_profile(parent_id)
                    if parent_prof:
                        stall.setdefault('memberNames', {})[parent_id] = parent_prof.get('name') or parent_prof.get('phone', '')
    else:
        if member_id == stall.get('createdBy'):
            return jsonify({'error': 'Cannot remove stall creator admin status'}), 400
        stall['stallAdmins'] = [admin_id for admin_id in stall['stallAdmins'] if admin_id != member_id]

    save_stall(stall_id, stall)
    return jsonify(stall)


# ── Public catalog (for scanning) ─────────────────────────────────────────────

@stalls_bp.get('/api/stalls/<stall_id>/catalog')
@require_auth
def stall_catalog(stall_id):
    """
    Get a stall's public catalog (items, stall info). Used by users scanning a stall QR.
    ---
    tags: [Stalls]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: stall_id
        required: true
        schema: {type: string}
    responses:
      200:
        description: Stall catalog
      404:
        description: Stall not found
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404

    # Resolve member names for display
    items = [item for item in stall.get('items', []) if item.get('active', True)]
    # If no explicit items, expose default item from tokensPerItem
    if not items:
        items = [{
            'itemId': 'default',
            'name': stall.get('description') or ('1 Play' if stall.get('stallType') == 'game' else '1 Serving'),
            'tokenPrice': stall.get('tokensPerItem', 1),
            'active': True,
        }]

    return jsonify({
        'stallId': stall_id,
        'stallName': stall.get('stallName', ''),
        'stallType': stall.get('stallType', ''),
        'description': stall.get('description', ''),
        'tokensPerItem': stall.get('tokensPerItem', 1),
        'stall': stall,
        'items': items,
    })


# ── Update stall ──────────────────────────────────────────────────────────────

@stalls_bp.put('/api/stalls/<stall_id>')
@require_auth
def update_stall(stall_id):
    """
    Update stall info. Only stall members can update.
    ---
    tags: [Stalls]
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
            properties:
              stallName: {type: string}
              stallType: {type: string}
              tokensPerItem: {type: integer}
              description: {type: string}
    responses:
      200:
        description: Updated stall
      403:
        description: Not a stall member
      404:
        description: Stall not found
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    if not _is_member(stall, g.user['userId']):
        return jsonify({'error': 'Not a stall member'}), 403

    body = request.get_json(silent=True) or {}
    if 'stallName' in body:
        stall['stallName'] = body['stallName'].strip()
    if 'stallType' in body and body['stallType'] in ('food', 'game'):
        stall['stallType'] = body['stallType']
    if 'tokensPerItem' in body:
        stall['tokensPerItem'] = int(body['tokensPerItem'])
    if 'description' in body:
        stall['description'] = body['description'].strip()
    if 'charities' in body:
        stall['charities'] = _normalize_charities(body.get('charities'))

    save_stall(stall_id, stall)
    return jsonify(stall)


# ── Member management ─────────────────────────────────────────────────────────

@stalls_bp.post('/api/stalls/<stall_id>/members')
@require_auth
def add_member(stall_id):
    """
    Add a user to the stall by phone number. Only members can add others.
    ---
    tags: [Stalls]
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
            required: [phone]
            properties:
              phone: {type: string}
    responses:
      200:
        description: Updated stall
      404:
        description: Stall or user not found
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    if not _is_member(stall, g.user['userId']):
        return jsonify({'error': 'Not a stall member'}), 403

    from app.storage.user_store import get_user_kids
    body = request.get_json(silent=True) or {}
    member_id = (body.get('memberId') or '').strip()
    phone = (body.get('phone') or '').strip()

    display_name = ''
    if member_id.startswith('KID:'):
        # KID:<parentUserId>:<kidId>
        parts = member_id.split(':')
        if len(parts) != 3:
            return jsonify({'error': 'Invalid kid member ID'}), 400
        parent_id, kid_id = parts[1], parts[2]
        parent = get_profile(parent_id)
        if not parent:
            return jsonify({'error': 'Parent user not found'}), 404
        kids = get_user_kids(parent_id)
        kid = next((k for k in kids if k.get('kidId') == kid_id), None)
        if not kid:
            return jsonify({'error': 'Kid not found'}), 404
        parent_name = parent.get('name') or parent.get('phone', '')
        display_name = f"{kid['name']} (child of {parent_name})"
        new_user_id = member_id
    elif member_id:
        new_user = get_profile(member_id)
        if not new_user:
            return jsonify({'error': 'User not found'}), 404
        new_user_id = member_id
        display_name = new_user.get('name') or new_user.get('phone', '')
    elif phone:
        # fallback: look up by phone
        new_user = find_profile_by_phone(phone)
        if not new_user:
            return jsonify({'error': 'User with that phone not found'}), 404
        new_user_id = new_user['userId']
        display_name = new_user.get('name') or phone
    else:
        return jsonify({'error': 'memberId or phone required'}), 400

    if 'memberNames' not in stall:
        stall['memberNames'] = {}
    if 'stallAdmins' not in stall:
        stall['stallAdmins'] = [stall.get('createdBy', '')]

    if new_user_id not in stall['members']:
        stall['members'].append(new_user_id)
    stall['memberNames'][new_user_id] = display_name

    is_admin = body.get('isAdmin', False)
    if is_admin and new_user_id not in stall['stallAdmins']:
        stall['stallAdmins'].append(new_user_id)
        if new_user_id.startswith('KID:'):
            parts = new_user_id.split(':')
            parent_id = parts[1] if len(parts) == 3 else None
            if parent_id and parent_id not in stall['stallAdmins']:
                stall['stallAdmins'].append(parent_id)
                if parent_id not in stall['members']:
                    stall['members'].append(parent_id)
                    parent_prof = get_profile(parent_id)
                    if parent_prof:
                        stall['memberNames'][parent_id] = parent_prof.get('name') or parent_prof.get('phone', '')

    save_stall(stall_id, stall)
    return jsonify(stall)


@stalls_bp.delete('/api/stalls/<stall_id>/members/<user_id>')
@require_auth
def remove_member(stall_id, user_id):
    """
    Remove a user from the stall. Members can remove themselves; the creator can remove anyone.
    ---
    tags: [Stalls]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: stall_id
        required: true
        schema: {type: string}
      - in: path
        name: user_id
        required: true
        schema: {type: string}
    responses:
      200:
        description: Updated stall
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404

    caller = g.user['userId']
    is_creator = (stall.get('createdBy') == caller)
    if not _is_member(stall, caller):
        return jsonify({'error': 'Not a stall member'}), 403
    # Only creator can remove others; anyone can remove themselves
    if user_id != caller and not is_creator:
        return jsonify({'error': 'Only the stall creator can remove other members'}), 403

    stall['members'] = [m for m in stall['members'] if m != user_id]
    if 'stallAdmins' in stall:
        stall['stallAdmins'] = [admin_id for admin_id in stall['stallAdmins'] if admin_id != user_id]
    save_stall(stall_id, stall)
    return jsonify(stall)


# ── Item management ───────────────────────────────────────────────────────────

@stalls_bp.post('/api/stalls/<stall_id>/items')
@require_auth
def add_item(stall_id):
    """
    Add an item to a stall. Member only.
    ---
    tags: [Stalls]
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
            required: [name, tokenPrice]
            properties:
              name: {type: string}
              tokenPrice: {type: integer}
    responses:
      200:
        description: Updated stall
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    if not _is_member(stall, g.user['userId']):
        return jsonify({'error': 'Not a stall member'}), 403

    body = request.get_json(silent=True) or {}
    item = {
        'itemId': str(uuid4()),
        'name': (body.get('name') or '').strip(),
        'tokenPrice': int(body.get('tokenPrice') or stall.get('tokensPerItem', 1)),
        'active': True,
    }
    if not item['name']:
        return jsonify({'error': 'item name required'}), 400

    stall.setdefault('items', []).append(item)
    save_stall(stall_id, stall)
    return jsonify(stall)


@stalls_bp.put('/api/stalls/<stall_id>/items/<item_id>')
@require_auth
def update_item(stall_id, item_id):
    """
    Update or deactivate an item. Member only.
    ---
    tags: [Stalls]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: stall_id
        required: true
        schema: {type: string}
      - in: path
        name: item_id
        required: true
        schema: {type: string}
    responses:
      200:
        description: Updated stall
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    if not _is_member(stall, g.user['userId']):
        return jsonify({'error': 'Not a stall member'}), 403

    body = request.get_json(silent=True) or {}
    item = next((i for i in stall.get('items', []) if i['itemId'] == item_id), None)
    if not item:
        return jsonify({'error': 'Item not found'}), 404

    if 'name' in body:
        item['name'] = body['name'].strip()
    if 'tokenPrice' in body:
        item['tokenPrice'] = int(body['tokenPrice'])
    if 'active' in body:
        item['active'] = bool(body['active'])

    save_stall(stall_id, stall)
    return jsonify(stall)


# ── Stall charges a user ──────────────────────────────────────────────────────

@stalls_bp.post('/api/stalls/<stall_id>/charge')
@require_auth
def charge_user(stall_id):
    """
    A stall member charges a user by their userId (after scanning their QR code).
    ---
    tags: [Stalls]
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
            required: [userId, items]
            properties:
              userId: {type: string}
              items:
                type: array
                items:
                  type: object
                  properties:
                    itemId: {type: string}
                    qty: {type: integer}
    responses:
      200:
        description: Charge result
      400:
        description: No items / insufficient balance
      403:
        description: Not a stall member
      404:
        description: Stall or user not found
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    if not _is_member(stall, g.user['userId']):
        return jsonify({'error': 'Not a stall member'}), 403

    body = request.get_json(silent=True) or {}
    target_user_id = body.get('userId')
    requested_items = body.get('items', [])

    user_profile = get_profile(target_user_id)
    if not user_profile:
        return jsonify({'error': 'User not found'}), 404

    pin = (body.get('pin') or '').strip()
    user_birth_year = str(user_profile.get('birthYear', '0000'))
    if pin != user_birth_year:
        return jsonify({'error': 'Invalid PIN'}), 403

    # Build item map from stall catalog (including default item)
    stall_items = {item['itemId']: item for item in stall.get('items', []) if item.get('active', True)}
    # Always allow the default item
    default_item = {
        'itemId': 'default',
        'name': stall.get('description') or ('1 Play' if stall.get('stallType') == 'game' else '1 Serving'),
        'tokenPrice': stall.get('tokensPerItem', 1),
    }
    stall_items['default'] = default_item

    line_items = []
    total_tokens = 0
    for req in requested_items:
        item_id = req.get('itemId')
        qty = int(req.get('qty', 0))
        if qty <= 0:
            continue
        item = stall_items.get(item_id)
        if not item:
            return jsonify({'error': f'Item {item_id} not found in stall'}), 404
        amount = int(item.get('tokenPrice', 0)) * qty
        total_tokens += amount
        line_items.append({'item': item, 'qty': qty, 'amount': amount})

    if not line_items:
        return jsonify({'error': 'No items selected'}), 400
    if int(user_profile.get('tokenBalance', 0)) < total_tokens:
        return jsonify({'error': 'Insufficient balance'}), 400

    # Deduct from user
    user_profile['tokenBalance'] = int(user_profile.get('tokenBalance', 0)) - total_tokens
    from app.storage.user_store import save_profile
    save_profile(target_user_id, user_profile)

    # Split tokens to configured charities
    charity_total = 0
    for charity in stall.get('charities', []):
        pct = int(charity.get('percentage', 0))
        if pct > 0:
            charity_tokens = max(1, int(total_tokens * pct / 100)) if total_tokens > 0 else 0
            if charity_tokens > 0 and credit_charity(charity['charityId'], charity_tokens):
                charity_total += charity_tokens
    stall['tokenBalance'] = int(stall.get('tokenBalance', 0)) + (total_tokens - charity_total)
    save_stall(stall_id, stall)

    # Record transactions
    tx_id = str(uuid4())
    timestamp = _utc_now()
    member_profile = get_profile(g.user['userId']) or {}
    member_name = member_profile.get('name') or member_profile.get('phone', '')
    user_name = user_profile.get('name') or user_profile.get('phone', '')

    user_txns = get_user_transactions(target_user_id)
    stall_txns = get_stall_transactions(stall_id)

    for li in line_items:
        item = li['item']
        user_txns.append({
            'txId': tx_id, 'type': 'debit', 'amount': li['amount'],
            'stallId': stall_id, 'stallName': stall.get('stallName', ''),
            'chargedBy': g.user['userId'], 'chargedByName': member_name,
            'itemId': item['itemId'], 'itemName': item['name'],
            'qty': li['qty'], 'timestamp': timestamp,
        })
        stall_txns.append({
            'txId': tx_id, 'userId': target_user_id, 'userName': user_name,
            'chargedBy': g.user['userId'], 'chargedByName': member_name,
            'itemId': item['itemId'], 'itemName': item['name'],
            'qty': li['qty'], 'amount': li['amount'], 'timestamp': timestamp,
        })

    save_user_transactions(target_user_id, user_txns)
    save_stall_transactions(stall_id, stall_txns)

    return jsonify({
        'txId': tx_id,
        'totalTokens': total_tokens,
        'newBalance': user_profile['tokenBalance'],
        'stallBalance': stall['tokenBalance'],
    })


# ── Stall transactions ────────────────────────────────────────────────────────

@stalls_bp.get('/api/stalls/<stall_id>/transactions')
@require_auth
def stall_transactions(stall_id):
    """
    Get a stall's transaction history. Members only.
    ---
    tags: [Stalls]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: stall_id
        required: true
        schema: {type: string}
    responses:
      200:
        description: Transaction list
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    if not _is_member(stall, g.user['userId']):
        return jsonify({'error': 'Not a stall member'}), 403

    txns = get_stall_transactions(stall_id)
    return jsonify(list(reversed(txns)))

# ── Join request ──────────────────────────────────────────────────────────────

@stalls_bp.post('/api/stalls/<stall_id>/join-request')
@require_auth
def request_join(stall_id):
    """
    Request to join a stall. Stall admins must approve.
    ---
    tags: [Stalls]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: stall_id
        required: true
        schema: {type: string}
    responses:
      200:
        description: Request submitted
      400:
        description: Already a member or request pending
      404:
        description: Stall not found
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404

    caller = g.user['userId']
    if caller in stall.get('members', []):
        return jsonify({'error': 'Already a member'}), 400

    requests = stall.get('joinRequests', [])
    if any(r['userId'] == caller and r['status'] == 'pending' for r in requests):
        return jsonify({'error': 'Join request already pending'}), 400

    profile = get_profile(caller) or {}
    requests.append({
        'userId': caller,
        'userName': profile.get('name') or profile.get('phone', ''),
        'requestedAt': _utc_now(),
        'status': 'pending',
    })
    stall['joinRequests'] = requests
    save_stall(stall_id, stall)
    return jsonify({'message': 'Join request submitted'})


@stalls_bp.get('/api/stalls/<stall_id>/join-requests')
@require_auth
def list_join_requests(stall_id):
    """
    List pending join requests for a stall. Members only.
    ---
    tags: [Stalls]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: stall_id
        required: true
        schema: {type: string}
    responses:
      200:
        description: Pending requests
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    if not _is_member(stall, g.user['userId']):
        return jsonify({'error': 'Not a stall member'}), 403
    pending = [r for r in stall.get('joinRequests', []) if r['status'] == 'pending']
    return jsonify(pending)


@stalls_bp.put('/api/stalls/<stall_id>/join-requests/<user_id>')
@require_auth
def handle_join_request(stall_id, user_id):
    """
    Approve or reject a join request. Members only.
    ---
    tags: [Stalls]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: stall_id
        required: true
        schema: {type: string}
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
            required: [action]
            properties:
              action:
                type: string
                enum: [approve, reject]
    responses:
      200:
        description: Updated stall
      400:
        description: Invalid action
      403:
        description: Not a stall member
      404:
        description: Stall or request not found
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    if not _is_member(stall, g.user['userId']):
        return jsonify({'error': 'Not a stall member'}), 403

    body = request.get_json(silent=True) or {}
    action = body.get('action')
    if action not in ('approve', 'reject'):
        return jsonify({'error': 'action must be approve or reject'}), 400

    requests = stall.get('joinRequests', [])
    req = next((r for r in requests if r['userId'] == user_id and r['status'] == 'pending'), None)
    if not req:
        return jsonify({'error': 'Pending join request not found'}), 404

    req['status'] = action + 'd'
    req['handledBy'] = g.user['userId']
    req['handledAt'] = _utc_now()

    if action == 'approve' and user_id not in stall['members']:
        stall['members'].append(user_id)

    stall['joinRequests'] = requests
    save_stall(stall_id, stall)
    return jsonify(stall)


# ── Search users for typeahead ────────────────────────────────────────────────

@stalls_bp.get('/api/stalls/search-users')
@require_auth
def search_users():
    """
    Search users by phone prefix for typeahead (adding stall members).
    ---
    tags: [Stalls]
    security: [{BearerAuth: []}]
    parameters:
      - in: query
        name: q
        required: true
        schema: {type: string}
    responses:
      200:
        description: Matching users (phone + name)
    """
    from app.storage.user_store import list_profiles, get_user_kids
    q = (request.args.get('q') or '').strip()
    if len(q) < 3:
        return jsonify([])
    results = []
    for p in list_profiles():
        phone = p.get('phone', '')
        name = p.get('name', '')
        parent_id = p['userId']
        # match adult user
        if q in phone or q.lower() in name.lower():
            results.append({'userId': parent_id, 'phone': phone, 'name': name or phone, 'isKid': False})
        # match kids belonging to this user
        for kid in get_user_kids(parent_id):
            kid_name = kid.get('name', '')
            if q.lower() in kid_name.lower() or q in phone:
                display = f"{kid_name} (child of {name or phone})"
                results.append({
                    'userId': f"KID:{parent_id}:{kid['kidId']}",
                    'phone': phone,
                    'name': display,
                    'isKid': True,
                })
        if len(results) >= 15:
            break
    return jsonify(results[:15])


# ── Get stall ─────────────────────────────────────────────────────────────────

@stalls_bp.get('/api/stalls/<stall_id>')
@require_auth
def get_stall_route(stall_id):
    """
    Get stall details.
    ---
    tags: [Stalls]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: stall_id
        required: true
        schema: {type: string}
    responses:
      200:
        description: Stall details
      404:
        description: Stall not found
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    return jsonify(stall)


