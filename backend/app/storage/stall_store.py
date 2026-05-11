from datetime import datetime, timezone
from uuid import uuid4

from config import get_data_dir

from .file_store import ensure_dir, read_json, write_json


def _stalls_dir():
    return get_data_dir() / 'stalls'


def _stall_txns_dir():
    return get_data_dir() / 'stall_transactions'


def _utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def get_stall(stall_id):
    return read_json(_stalls_dir() / f'{stall_id}.json')


def save_stall(stall_id, data):
    ensure_dir(_stalls_dir())
    return write_json(_stalls_dir() / f'{stall_id}.json', data)


def list_stalls():
    ensure_dir(_stalls_dir())
    result = []
    for path in sorted(_stalls_dir().glob('*.json')):
        data = read_json(path)
        if data:
            result.append(data)
    return result


def list_user_stalls(user_id):
    return [s for s in list_stalls() if user_id in s.get('members', [])]


def create_stall(stall_name, stall_type, tokens_per_item, description, creator_id):
    stall_id = str(uuid4())
    stall = {
        'stallId': stall_id,
        'stallName': stall_name,
        'stallType': stall_type,
        'tokensPerItem': int(tokens_per_item),
        'description': description or '',
        'members': [creator_id],
        'createdBy': creator_id,
        'createdAt': _utc_now(),
        'tokenBalance': 0,
        'items': [],
    }
    save_stall(stall_id, stall)
    return stall


def get_stall_transactions(stall_id):
    ensure_dir(_stall_txns_dir())
    return read_json(_stall_txns_dir() / f'{stall_id}.json') or []


def save_stall_transactions(stall_id, txns):
    ensure_dir(_stall_txns_dir())
    return write_json(_stall_txns_dir() / f'{stall_id}.json', txns)
