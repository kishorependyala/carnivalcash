from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, g, jsonify, request

from app.storage.charity_store import credit_charity
from app.storage.order_store import get_stall_orders, get_user_orders, save_order
from app.storage.stall_store import get_stall, get_stall_transactions, save_stall, save_stall_transactions
from app.storage.user_store import (
    get_profile,
    get_user_kids,
    get_user_transactions,
    save_profile,
    save_user_kids,
    save_user_transactions,
)
from app.utils.auth_middleware import require_auth

orders_bp = Blueprint('orders', __name__)


def _utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _is_member(stall, user_id):
    return user_id in stall.get('members', [])


@orders_bp.post('/api/stalls/<stall_id>/orders')
@require_auth
def place_order(stall_id):
    """
    Place an order at a stall. Deducts tokens from the user's balance.
    ---
    tags: [Orders]
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
            required: [items]
            properties:
              items:
                type: array
                items:
                  type: object
                  properties:
                    itemId: {type: string, example: default}
                    qty: {type: integer, example: 2}
              kidId: {type: string, description: "Optional kid ID to charge against spending limit"}
    responses:
      201:
        description: Order placed, returns order with updated balances
      400:
        description: No items selected or exceeds spending limit
      404:
        description: Stall or item not found
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404

    body = request.get_json(silent=True) or {}
    items_req = body.get('items', [])
    kid_id = body.get('kidId')

    caller_id = g.user['userId']
    kid_record = None
    if kid_id:
        kids = get_user_kids(caller_id)
        kid_record = next((kid for kid in kids if kid.get('kidId') == kid_id), None)
        if not kid_record:
            return jsonify({'error': 'Kid not found'}), 404

    user_profile = get_profile(caller_id)
    if not user_profile:
        return jsonify({'error': 'User not found'}), 404

    stall_items = {item['itemId']: item for item in stall.get('items', []) if item.get('active', True)}
    stall_items['default'] = {
        'itemId': 'default',
        'name': stall.get('description') or ('1 Play' if stall.get('stallType') == 'game' else '1 Serving'),
        'tokenPrice': stall.get('tokensPerItem', 1),
    }

    line_items = []
    total_tokens = 0
    for req in items_req:
        item_id = req.get('itemId')
        qty = int(req.get('qty', 0))
        if qty <= 0:
            continue
        item = stall_items.get(item_id)
        if not item:
            return jsonify({'error': f'Item {item_id} not found'}), 404
        amount = int(item.get('tokenPrice', 0)) * qty
        total_tokens += amount
        line_items.append({
            'itemId': item_id,
            'itemName': item['name'],
            'qty': qty,
            'tokenPrice': item.get('tokenPrice', 0),
            'amount': amount,
        })

    if not line_items:
        return jsonify({'error': 'No items selected'}), 400

    if kid_record:
        limit = int(kid_record.get('spendingLimit', 0))
        spent = int(kid_record.get('spent', 0))
        if limit > 0 and spent + total_tokens > limit:
            return jsonify({'error': "Exceeds kid's spending limit"}), 400

    if int(user_profile.get('tokenBalance', 0)) < total_tokens:
        return jsonify({'error': 'Insufficient balance'}), 400

    user_profile['tokenBalance'] = int(user_profile.get('tokenBalance', 0)) - total_tokens
    if kid_record:
        kid_record['spent'] = int(kid_record.get('spent', 0)) + total_tokens
        kids = get_user_kids(caller_id)
        save_user_kids(caller_id, [kid if kid.get('kidId') != kid_record['kidId'] else kid_record for kid in kids])
    save_profile(caller_id, user_profile)

    charity_total = 0
    for charity in stall.get('charities', []):
        pct = int(charity.get('percentage', 0))
        if pct > 0:
            charity_tokens = max(1, int(total_tokens * pct / 100)) if total_tokens > 0 else 0
            if charity_tokens > 0 and credit_charity(charity['charityId'], charity_tokens):
                charity_total += charity_tokens
    stall['tokenBalance'] = int(stall.get('tokenBalance', 0)) + (total_tokens - charity_total)
    save_stall(stall_id, stall)

    pending = get_stall_orders(stall_id, status='pending')
    timestamp = _utc_now()
    order = {
        'orderId': str(uuid4()),
        'stallId': stall_id,
        'stallName': stall.get('stallName', ''),
        'stallType': stall.get('stallType', 'game'),
        'userId': caller_id,
        'userName': user_profile.get('name') or user_profile.get('phone', ''),
        'kidId': kid_id,
        'kidName': kid_record['name'] if kid_record else None,
        'items': line_items,
        'totalTokens': total_tokens,
        'status': 'pending',
        'position': len(pending) + 1,
        'createdAt': timestamp,
        'updatedAt': timestamp,
    }
    save_order(stall_id, order)

    tx_id = order['orderId']
    user_txns = get_user_transactions(caller_id)
    stall_txns = get_stall_transactions(stall_id)
    user_name = kid_record['name'] if kid_record else user_profile.get('name') or user_profile.get('phone', '')
    for item in line_items:
        user_txns.append({
            'txId': tx_id,
            'type': 'debit',
            'amount': item['amount'],
            'stallId': stall_id,
            'stallName': stall.get('stallName', ''),
            'chargedBy': caller_id,
            'chargedByName': user_profile.get('name') or user_profile.get('phone', ''),
            'itemId': item['itemId'],
            'itemName': item['itemName'],
            'qty': item['qty'],
            'timestamp': timestamp,
            **({'kidId': kid_record['kidId'], 'kidName': kid_record['name']} if kid_record else {}),
        })
        stall_txns.append({
            'txId': tx_id,
            'userId': caller_id,
            'userName': user_name,
            'chargedBy': caller_id,
            'chargedByName': user_profile.get('name') or user_profile.get('phone', ''),
            'itemId': item['itemId'],
            'itemName': item['itemName'],
            'qty': item['qty'],
            'amount': item['amount'],
            'timestamp': timestamp,
        })
    save_user_transactions(caller_id, user_txns)
    save_stall_transactions(stall_id, stall_txns)

    return jsonify({**order, 'newBalance': user_profile['tokenBalance'], 'stallBalance': stall['tokenBalance']}), 201


@orders_bp.get('/api/stalls/<stall_id>/orders')
@require_auth
def list_stall_orders(stall_id):
    """
    List orders for a stall. Stall members only.
    ---
    tags: [Orders]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: stall_id
        required: true
        schema: {type: string}
      - in: query
        name: status
        schema: {type: string, enum: [pending, ready, complete, cancelled]}
        description: Filter by order status
    responses:
      200:
        description: List of orders
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

    status_filter = request.args.get('status')
    orders = get_stall_orders(stall_id, status=status_filter)
    pending_orders = [order for order in orders if order.get('status') == 'pending']
    pending_positions = {order['orderId']: idx + 1 for idx, order in enumerate(pending_orders)}
    for order in orders:
        if order.get('status') == 'pending':
            order['position'] = pending_positions.get(order['orderId'], 1)
    return jsonify(orders)


@orders_bp.patch('/api/stalls/<stall_id>/orders/<order_id>')
@require_auth
def update_order(stall_id, order_id):
    """
    Update an order status. Stall members only.
    ---
    tags: [Orders]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: stall_id
        required: true
        schema: {type: string}
      - in: path
        name: order_id
        required: true
        schema: {type: string}
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [status]
            properties:
              status: {type: string, enum: [ready, complete, cancelled]}
    responses:
      200:
        description: Updated order
      400:
        description: Invalid status
      403:
        description: Not a stall member
      404:
        description: Stall or order not found
    """
    stall = get_stall(stall_id)
    if not stall:
        return jsonify({'error': 'Stall not found'}), 404
    if not _is_member(stall, g.user['userId']):
        return jsonify({'error': 'Not a stall member'}), 403

    body = request.get_json(silent=True) or {}
    new_status = body.get('status')
    if new_status not in ('ready', 'complete', 'cancelled'):
        return jsonify({'error': 'Invalid status. Use: ready, complete, cancelled'}), 400

    orders = get_stall_orders(stall_id)
    order = next((existing for existing in orders if existing.get('orderId') == order_id), None)
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    order['status'] = new_status
    order['updatedAt'] = _utc_now()
    if new_status == 'complete':
        order['completedAt'] = order['updatedAt']
    save_order(stall_id, order)
    return jsonify(order)


@orders_bp.get('/api/users/orders')
@require_auth
def my_orders():
    """
    Get the current user's order history.
    ---
    tags: [Orders]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: List of orders placed by the current user
    """
    orders = get_user_orders(g.user['userId'])
    for order in orders:
        if order.get('status') == 'pending':
            stall_pending = get_stall_orders(order['stallId'], status='pending')
            positions = [idx + 1 for idx, pending in enumerate(stall_pending) if pending.get('orderId') == order.get('orderId')]
            order['position'] = positions[0] if positions else 1
    return jsonify(orders)
