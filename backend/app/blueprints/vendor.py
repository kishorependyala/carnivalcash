from flask import Blueprint, g, jsonify, request

from app.storage.user_store import (
    get_vendor_items,
    get_vendor_transactions,
    save_vendor_items,
)
from app.utils.auth_middleware import require_auth, require_role


vendor_bp = Blueprint('vendor', __name__)


@vendor_bp.get('/api/vendor/qr')
@require_auth
@require_role('vendor')
def get_qr():
    return jsonify({'qrPayload': f"CARNIVAL_VENDOR:{g.user['userId']}"})


@vendor_bp.get('/api/vendor/items')
@require_auth
@require_role('vendor')
def list_items():
    return jsonify(get_vendor_items(g.user['userId']))


@vendor_bp.post('/api/vendor/items')
@require_auth
@require_role('vendor')
def create_item():
    from uuid import uuid4

    payload = request.get_json(silent=True) or {}
    items = get_vendor_items(g.user['userId'])
    item = {
        'itemId': str(uuid4()),
        'name': payload.get('name', ''),
        'tokenPrice': int(payload.get('tokenPrice', 0)),
        'stallType': payload.get('stallType', ''),
        'active': True,
    }
    items.append(item)
    save_vendor_items(g.user['userId'], items)
    return jsonify(item), 201


@vendor_bp.put('/api/vendor/items/<item_id>')
@require_auth
@require_role('vendor')
def update_item(item_id):
    payload = request.get_json(silent=True) or {}
    items = get_vendor_items(g.user['userId'])

    for item in items:
        if item.get('itemId') == item_id:
            item.update({key: value for key, value in payload.items() if key in {'name', 'tokenPrice', 'stallType', 'active'}})
            if 'tokenPrice' in item:
                item['tokenPrice'] = int(item['tokenPrice'])
            save_vendor_items(g.user['userId'], items)
            return jsonify(item)

    return jsonify({'error': 'Item not found'}), 404


@vendor_bp.delete('/api/vendor/items/<item_id>')
@require_auth
@require_role('vendor')
def delete_item(item_id):
    items = get_vendor_items(g.user['userId'])

    for item in items:
        if item.get('itemId') == item_id:
            item['active'] = False
            save_vendor_items(g.user['userId'], items)
            return jsonify(item)

    return jsonify({'error': 'Item not found'}), 404


@vendor_bp.get('/api/vendor/transactions')
@require_auth
@require_role('vendor')
def list_transactions():
    return jsonify(get_vendor_transactions(g.user['userId']))


@vendor_bp.get('/api/vendor/poll')
@require_auth
@require_role('vendor')
def poll_transactions():
    since = request.args.get('since', '')
    transactions = get_vendor_transactions(g.user['userId'])
    count = len([tx for tx in transactions if tx.get('timestamp', '') > since]) if since else len(transactions)
    return jsonify({'newTransactions': count})
