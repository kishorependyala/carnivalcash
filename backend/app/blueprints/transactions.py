from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, g, jsonify, request

from app.storage.stall_store import get_stall, get_stall_transactions, save_stall, save_stall_transactions
from app.storage.user_store import (
    get_profile,
    get_user_kids,
    get_user_transactions,
    get_vendor_items,
    get_vendor_transactions,
    save_profile,
    save_user_kids,
    save_user_transactions,
    save_vendor_transactions,
)
from app.utils.auth_middleware import require_auth, require_role


transactions_bp = Blueprint('transactions', __name__)


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


@transactions_bp.get('/api/transactions/catalog/<vendor_id>')
@require_auth
def vendor_catalog(vendor_id):
    """
    Get a vendor's active items and stall info (for the scan/pay flow).
    ---
    tags: [Transactions]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: vendor_id
        required: true
        schema: {type: string}
    responses:
      200:
        description: Vendor ID, stall info, and active item list
    """
    vendor_profile = get_profile(vendor_id) or {}
    items = [item for item in get_vendor_items(vendor_id) if item.get('active', True)]
    stall = vendor_profile.get('stall') or {}
    return jsonify({
        'vendorId': vendor_id,
        'vendorName': vendor_profile.get('name') or vendor_profile.get('phone', ''),
        'stall': stall,
        'items': items,
    })


@transactions_bp.get('/api/transactions/vendor-catalog')
@require_auth
@require_role('vendor')
def my_vendor_catalog():
    """
    Get the logged-in vendor's own active items and stall info (for charging a user by QR scan).
    ---
    tags: [Transactions]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Vendor's own stall and item list
    """
    vendor_profile = get_profile(g.user['userId']) or {}
    items = [item for item in get_vendor_items(g.user['userId']) if item.get('active', True)]
    stall = vendor_profile.get('stall') or {}
    return jsonify({
        'vendorId': g.user['userId'],
        'vendorName': vendor_profile.get('name') or vendor_profile.get('phone', ''),
        'stall': stall,
        'items': items,
    })


@transactions_bp.post('/api/transactions/vendor-charge')
@require_auth
@require_role('vendor')
def vendor_charge():
    """
    Vendor charges a user after scanning their QR code.
    ---
    tags: [Transactions]
    security: [{BearerAuth: []}]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [userId, items]
            properties:
              userId:
                type: string
                example: "20260510000000000002"
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
      404:
        description: User or item not found
    """
    payload = request.get_json(silent=True) or {}
    user_id = payload.get('userId')
    requested_items = payload.get('items', [])
    vendor_id = g.user['userId']

    user_profile = get_profile(user_id)
    vendor_profile = get_profile(vendor_id)
    if user_profile is None:
        return jsonify({'error': 'User not found'}), 404
    if vendor_profile is None:
        return jsonify({'error': 'Vendor not found'}), 404

    # vendor's own items catalog
    vendor_items = {item['itemId']: item for item in get_vendor_items(vendor_id) if item.get('active', True)}
    line_items, total_tokens = _resolve_line_items(requested_items, vendor_items)
    if line_items is None:
        return jsonify({'error': total_tokens}), 404
    if not line_items:
        return jsonify({'error': 'No items selected'}), 400

    if int(user_profile.get('tokenBalance', 0)) < total_tokens:
        return jsonify({'error': 'Insufficient balance'}), 400

    user_profile['tokenBalance'] = int(user_profile.get('tokenBalance', 0)) - total_tokens
    save_profile(user_id, user_profile)

    _record_transaction(
        tx_id=str(uuid4()),
        timestamp=utc_now(),
        vendor_id=vendor_id,
        vendor_profile=vendor_profile,
        user_profile=user_profile,
        line_items=line_items,
        kid_id=None,
        kid=None,
    )

    return jsonify({'txId': str(uuid4()), 'totalTokens': total_tokens, 'newBalance': user_profile['tokenBalance']})


@transactions_bp.post('/api/transactions/transfer')
@require_auth
def transfer():
    """
    Transfer tokens from user to vendor or stall. Optionally attribute to a kid token.
    Vendors without the user role cannot initiate spending.
    ---
    tags: [Transactions]
    security: [{BearerAuth: []}]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              vendorId:
                type: string
                description: Legacy vendor user ID
              stallId:
                type: string
                description: Stall ID (preferred, new model)
              items:
                type: array
                items:
                  type: object
                  properties:
                    itemId: {type: string}
                    qty: {type: integer}
              kidId:
                type: string
                nullable: true
    responses:
      200:
        description: Transfer result
      400:
        description: No items / insufficient balance / kid limit exceeded
      403:
        description: Vendor-only accounts cannot spend tokens
      404:
        description: Profile or item not found
    """
    roles = g.user.get('roles', [])
    if 'user' not in roles:
        return jsonify({'error': 'Stall owners cannot spend tokens'}), 403

    payload = request.get_json(silent=True) or {}
    stall_id = payload.get('stallId')
    vendor_id = payload.get('vendorId')
    requested_items = payload.get('items', [])
    kid_id = payload.get('kidId')

    user_profile = get_profile(g.user['userId'])
    if user_profile is None:
        return jsonify({'error': 'Profile not found'}), 404

    # ── Stall-based payment (new model) ──
    if stall_id:
        stall = get_stall(stall_id)
        if not stall:
            return jsonify({'error': 'Stall not found'}), 404

        stall_items = {item['itemId']: item for item in stall.get('items', []) if item.get('active', True)}
        default_item = {
            'itemId': 'default',
            'name': stall.get('description') or ('1 Play' if stall.get('stallType') == 'game' else '1 Serving'),
            'tokenPrice': stall.get('tokensPerItem', 1),
        }
        stall_items['default'] = default_item

        line_items = []
        total_tokens = 0
        for req in requested_items:
            i_id = req.get('itemId')
            qty = int(req.get('qty', 0))
            if qty <= 0:
                continue
            item = stall_items.get(i_id)
            if not item:
                return jsonify({'error': f'Item {i_id} not found'}), 404
            amount = int(item.get('tokenPrice', 0)) * qty
            total_tokens += amount
            line_items.append({'item': item, 'qty': qty, 'amount': amount})

        if not line_items:
            return jsonify({'error': 'No items selected'}), 400

        kid = None
        kids = get_user_kids(g.user['userId'])
        if kid_id:
            kid = next((k for k in kids if k.get('kidId') == kid_id), None)
            if kid is None:
                return jsonify({'error': 'Kid not found'}), 404
            if int(kid.get('spent', 0)) + total_tokens > int(kid.get('spendingLimit', 0)):
                return jsonify({'error': 'Kid spending limit exceeded'}), 400

        if int(user_profile.get('tokenBalance', 0)) < total_tokens:
            return jsonify({'error': 'Insufficient balance'}), 400

        user_profile['tokenBalance'] = int(user_profile.get('tokenBalance', 0)) - total_tokens
        save_profile(user_profile['userId'], user_profile)

        if kid is not None:
            kid['spent'] = int(kid.get('spent', 0)) + total_tokens
            save_user_kids(g.user['userId'], kids)

        stall['tokenBalance'] = int(stall.get('tokenBalance', 0)) + total_tokens
        save_stall(stall_id, stall)

        tx_id = str(uuid4())
        timestamp = utc_now()
        stall_name = stall.get('stallName', '')
        user_name = user_profile.get('name') or user_profile.get('phone', '')
        kid_name = kid.get('name') if kid else None

        user_txns = get_user_transactions(g.user['userId'])
        stall_txns = get_stall_transactions(stall_id)
        for li in line_items:
            item = li['item']
            user_txns.append({
                'txId': tx_id, 'type': 'debit', 'amount': li['amount'],
                'stallId': stall_id, 'stallName': stall_name,
                'itemId': item['itemId'], 'itemName': item['name'],
                'qty': li['qty'], 'kidId': kid_id, 'kidName': kid_name, 'timestamp': timestamp,
            })
            stall_txns.append({
                'txId': tx_id, 'userId': g.user['userId'], 'userName': user_name,
                'kidId': kid_id, 'kidName': kid_name,
                'itemId': item['itemId'], 'itemName': item['name'],
                'qty': li['qty'], 'amount': li['amount'], 'timestamp': timestamp,
            })
        save_user_transactions(g.user['userId'], user_txns)
        save_stall_transactions(stall_id, stall_txns)
        return jsonify({'txId': tx_id, 'totalTokens': total_tokens, 'newBalance': user_profile['tokenBalance']})

    # ── Legacy vendor-user payment ──
    vendor_profile = get_profile(vendor_id)
    if vendor_profile is None:
        return jsonify({'error': 'Profile not found'}), 404

    vendor_items = {item['itemId']: item for item in get_vendor_items(vendor_id) if item.get('active', True)}
    line_items, total_tokens = _resolve_line_items(requested_items, vendor_items)
    if line_items is None:
        return jsonify({'error': total_tokens}), 404
    if not line_items:
        return jsonify({'error': 'No items selected'}), 400

    kid = None
    kids = get_user_kids(g.user['userId'])
    if kid_id:
        kid = next((entry for entry in kids if entry.get('kidId') == kid_id), None)
        if kid is None:
            return jsonify({'error': 'Kid not found'}), 404
        if int(kid.get('spent', 0)) + total_tokens > int(kid.get('spendingLimit', 0)):
            return jsonify({'error': 'Kid spending limit exceeded'}), 400

    if int(user_profile.get('tokenBalance', 0)) < total_tokens:
        return jsonify({'error': 'Insufficient balance'}), 400

    user_profile['tokenBalance'] = int(user_profile.get('tokenBalance', 0)) - total_tokens
    save_profile(user_profile['userId'], user_profile)

    if kid is not None:
        kid['spent'] = int(kid.get('spent', 0)) + total_tokens
        save_user_kids(g.user['userId'], kids)

    tx_id = str(uuid4())
    timestamp = utc_now()
    _record_transaction(tx_id, timestamp, vendor_id, vendor_profile, user_profile, line_items, kid_id, kid)

    return jsonify({'txId': tx_id, 'totalTokens': total_tokens, 'newBalance': user_profile['tokenBalance']})


# ── helpers ───────────────────────────────────────────────────────────────────

def _resolve_line_items(requested_items, vendor_items_map):
    """Returns (line_items, total) on success; (None, error_msg) on item-not-found."""
    line_items = []
    total = 0
    for req in requested_items:
        item_id = req.get('itemId')
        qty = int(req.get('qty', 0))
        if qty <= 0:
            continue
        item = vendor_items_map.get(item_id)
        if item is None:
            return None, 'Item not found'
        amount = int(item.get('tokenPrice', 0)) * qty
        total += amount
        line_items.append({'item': item, 'qty': qty, 'amount': amount})
    return line_items, total


def _record_transaction(tx_id, timestamp, vendor_id, vendor_profile, user_profile, line_items, kid_id, kid):
    user_txns = get_user_transactions(user_profile['userId'])
    vendor_txns = get_vendor_transactions(vendor_id)
    vendor_name = vendor_profile.get('name') or vendor_profile.get('phone', '')
    user_name = user_profile.get('name') or user_profile.get('phone', '')
    kid_name = kid.get('name') if kid else None

    for li in line_items:
        item = li['item']
        user_txns.append({
            'txId': tx_id, 'type': 'debit', 'amount': li['amount'],
            'vendorId': vendor_id, 'vendorName': vendor_name,
            'itemId': item['itemId'], 'itemName': item['name'],
            'qty': li['qty'], 'kidId': kid_id, 'kidName': kid_name, 'timestamp': timestamp,
        })
        vendor_txns.append({
            'txId': tx_id, 'userId': user_profile['userId'], 'userName': user_name,
            'kidId': kid_id, 'kidName': kid_name,
            'itemId': item['itemId'], 'itemName': item['name'],
            'qty': li['qty'], 'amount': li['amount'], 'timestamp': timestamp,
        })

    save_user_transactions(user_profile['userId'], user_txns)
    save_vendor_transactions(vendor_id, vendor_txns)

