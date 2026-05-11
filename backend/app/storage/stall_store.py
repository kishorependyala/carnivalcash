from datetime import datetime, timezone

from config import get_data_dir

from .file_store import ensure_dir, read_json, write_json


def _stalls_dir():
    return get_data_dir() / 'stalls'


def _stall_txns_dir():
    return get_data_dir() / 'stalls' / 'transactions'


def _utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _generate_stall_id():
    """Generate yyyyMMdd_stall_XXXX ID (4-digit sequence per day)."""
    date_prefix = datetime.now().strftime('%Y%m%d')
    ensure_dir(_stalls_dir())
    existing = list(_stalls_dir().glob(f'{date_prefix}_stall_*.json'))
    max_seq = 0
    for path in existing:
        try:
            seq = int(path.stem.split('_stall_')[1])
            max_seq = max(max_seq, seq)
        except (IndexError, ValueError):
            pass
    return f'{date_prefix}_stall_{(max_seq + 1):04d}'


def get_stall(stall_id):
    return read_json(_stalls_dir() / f'{stall_id}.json')


def save_stall(stall_id, data):
    ensure_dir(_stalls_dir())
    return write_json(_stalls_dir() / f'{stall_id}.json', data)


def list_stalls():
    ensure_dir(_stalls_dir())
    result = []
    for path in sorted(_stalls_dir().glob('*.json')):
        if path.parent == _stalls_dir():
            data = read_json(path)
            if data:
                result.append(data)
    return result


def list_user_stalls(user_id):
    return [s for s in list_stalls() if user_id in s.get('members', [])]


def create_stall(stall_name, stall_type, tokens_per_item, description, creator_id):
    stall_id = _generate_stall_id()
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
        'joinRequests': [],
    }
    save_stall(stall_id, stall)
    return stall


def get_stall_transactions(stall_id):
    ensure_dir(_stall_txns_dir())
    return read_json(_stall_txns_dir() / f'{stall_id}.json') or []


def save_stall_transactions(stall_id, txns):
    ensure_dir(_stall_txns_dir())
    return write_json(_stall_txns_dir() / f'{stall_id}.json', txns)
