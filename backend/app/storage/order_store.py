from config import get_data_dir

from .file_store import ensure_dir, read_json, write_json


def _orders_path(stall_id):
    path = get_data_dir() / 'stalls' / stall_id / 'orders.json'
    ensure_dir(path.parent)
    return path


def get_stall_orders(stall_id, status=None):
    orders = read_json(_orders_path(stall_id)) or []
    if status:
        orders = [order for order in orders if order.get('status') == status]
    return orders


def save_order(stall_id, order):
    path = _orders_path(stall_id)
    orders = read_json(path) or []
    idx = next((i for i, existing in enumerate(orders) if existing.get('orderId') == order.get('orderId')), -1)
    if idx >= 0:
        orders[idx] = order
    else:
        orders.append(order)
    write_json(path, orders)
    return order


def get_user_orders(user_id):
    stalls_dir = get_data_dir() / 'stalls'
    if not stalls_dir.exists():
        return []

    result = []
    for stall_dir in stalls_dir.iterdir():
        if not stall_dir.is_dir():
            continue
        orders = read_json(stall_dir / 'orders.json') or []
        for order in orders:
            if order.get('userId') == user_id and order.get('status') in ('pending', 'ready'):
                result.append(order)
    return sorted(result, key=lambda order: order.get('createdAt', ''))
