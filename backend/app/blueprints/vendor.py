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
    """
    Get the vendor's unique QR payload string.
    ---
    tags: [Vendor]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: QR payload
        content:
          application/json:
            schema:
              type: object
              properties:
                qrPayload: {type: string, example: "CARNIVAL_VENDOR:20260510000000000001"}
    """
    return jsonify({'qrPayload': f"CARNIVAL_VENDOR:{g.user['userId']}"})


@vendor_bp.get('/api/vendor/items')
@require_auth
@require_role('vendor')
def list_items():
    """
    List all stall items for the vendor.
    ---
    tags: [Vendor]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: List of items
    """
    return jsonify(get_vendor_items(g.user['userId']))


@vendor_bp.post('/api/vendor/items')
@require_auth
@require_role('vendor')
def create_item():
    """
    Add a new stall item.
    ---
    tags: [Vendor]
    security: [{BearerAuth: []}]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [name, tokenPrice, stallType]
            properties:
              name: {type: string, example: "Cotton Candy"}
              tokenPrice: {type: integer, example: 5}
              stallType: {type: string, enum: [food, game, both]}
    responses:
      201:
        description: Item created
    """
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
    """
    Update a stall item.
    ---
    tags: [Vendor]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: item_id
        required: true
        schema: {type: string}
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name: {type: string}
              tokenPrice: {type: integer}
              stallType: {type: string, enum: [food, game, both]}
              active: {type: boolean}
    responses:
      200:
        description: Updated item
      404:
        description: Item not found
    """
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
    """
    Deactivate a stall item (sets active=false).
    ---
    tags: [Vendor]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: item_id
        required: true
        schema: {type: string}
    responses:
      200:
        description: Item deactivated
      404:
        description: Item not found
    """
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
    """
    Get all transactions received by the vendor.
    ---
    tags: [Vendor]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: List of transactions
    """
    return jsonify(get_vendor_transactions(g.user['userId']))


@vendor_bp.get('/api/vendor/poll')
@require_auth
@require_role('vendor')
def poll_transactions():
    """
    Poll for new transactions since a given timestamp.
    ---
    tags: [Vendor]
    security: [{BearerAuth: []}]
    parameters:
      - in: query
        name: since
        schema: {type: string}
        description: ISO 8601 timestamp — returns count of transactions after this time
    responses:
      200:
        description: New transaction count
        content:
          application/json:
            schema:
              type: object
              properties:
                newTransactions: {type: integer}
    """
    since = request.args.get('since', '')
    transactions = get_vendor_transactions(g.user['userId'])
    count = len([tx for tx in transactions if tx.get('timestamp', '') > since]) if since else len(transactions)
    return jsonify({'newTransactions': count})
