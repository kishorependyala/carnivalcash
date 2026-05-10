from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, g, jsonify, request

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
from app.utils.auth_middleware import require_auth


transactions_bp = Blueprint('transactions', __name__)


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


@transactions_bp.get('/api/transactions/catalog/<vendor_id>')
@require_auth
def vendor_catalog(vendor_id):
    items = [item for item in get_vendor_items(vendor_id) if item.get('active', True)]
    return jsonify({'vendorId': vendor_id, 'items': items})


@transactions_bp.post('/api/transactions/transfer')
@require_auth
def transfer():
    payload = request.get_json(silent=True) or {}
    vendor_id = payload.get('vendorId')
    requested_items = payload.get('items', [])
    kid_id = payload.get('kidId')

    user_profile = get_profile(g.user['userId'])
    vendor_profile = get_profile(vendor_id)
    if user_profile is None or vendor_profile is None:
        return jsonify({'error': 'Profile not found'}), 404

    vendor_items = {item['itemId']: item for item in get_vendor_items(vendor_id) if item.get('active', True)}
    line_items = []
    total_tokens = 0

    for requested in requested_items:
        item_id = requested.get('itemId')
        qty = int(requested.get('qty', 0))
        if qty <= 0:
            continue
        item = vendor_items.get(item_id)
        if item is None:
            return jsonify({'error': 'Item not found'}), 404
        amount = int(item.get('tokenPrice', 0)) * qty
        total_tokens += amount
        line_items.append({'item': item, 'qty': qty, 'amount': amount})

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
    user_transactions = get_user_transactions(g.user['userId'])
    vendor_transactions = get_vendor_transactions(vendor_id)
    vendor_name = vendor_profile.get('name') or vendor_profile.get('phone', '')
    user_name = user_profile.get('name') or user_profile.get('phone', '')
    kid_name = kid.get('name') if kid else None

    for line_item in line_items:
        item = line_item['item']
        qty = line_item['qty']
        amount = line_item['amount']
        user_transactions.append(
            {
                'txId': tx_id,
                'type': 'debit',
                'amount': amount,
                'vendorId': vendor_id,
                'vendorName': vendor_name,
                'itemId': item['itemId'],
                'itemName': item['name'],
                'qty': qty,
                'kidId': kid_id,
                'kidName': kid_name,
                'timestamp': timestamp,
            }
        )
        vendor_transactions.append(
            {
                'txId': tx_id,
                'userId': user_profile['userId'],
                'userName': user_name,
                'kidId': kid_id,
                'kidName': kid_name,
                'itemId': item['itemId'],
                'itemName': item['name'],
                'qty': qty,
                'amount': amount,
                'timestamp': timestamp,
            }
        )

    save_user_transactions(user_profile['userId'], user_transactions)
    save_vendor_transactions(vendor_id, vendor_transactions)

    return jsonify({'txId': tx_id, 'totalTokens': total_tokens, 'newBalance': user_profile['tokenBalance']})
