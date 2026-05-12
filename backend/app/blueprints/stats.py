import json

from flask import Blueprint, jsonify

from app.storage.charity_store import list_charities
from app.storage.stall_store import list_stalls
from app.storage.user_store import list_profiles, users_dir
from app.utils.auth_middleware import require_auth

stats_bp = Blueprint('stats', __name__)


@stats_bp.get('/api/stats')
@require_auth
def get_stats():
    """Return aggregate event statistics."""
    profiles = list_profiles()
    stalls = list_stalls()
    charities = list_charities()

    total_users = len(profiles)
    total_tokens_in_circulation = sum(int(profile.get('tokenBalance', 0)) for profile in profiles)
    total_stall_tokens = sum(int(stall.get('tokenBalance', 0)) for stall in stalls)
    total_charity_tokens = sum(int(charity.get('tokenBalance', 0)) for charity in charities)
    total_active_stalls = len(stalls)

    total_txns = 0
    try:
        for profile in profiles:
            txn_file = users_dir() / profile['userId'] / 'transactions.json'
            if txn_file.exists():
                txns = json.loads(txn_file.read_text(encoding='utf-8')) or []
                total_txns += len(txns)
    except Exception:
        pass

    return jsonify(
        {
            'totalUsers': total_users,
            'totalStalls': total_active_stalls,
            'totalTransactions': total_txns,
            'tokensInCirculation': total_tokens_in_circulation,
            'stallTokensEarned': total_stall_tokens,
            'charityTokensDonated': total_charity_tokens,
            'topStalls': sorted(
                [{'name': stall['stallName'], 'tokens': int(stall.get('tokenBalance', 0))} for stall in stalls],
                key=lambda entry: entry['tokens'],
                reverse=True,
            )[:5],
            'topCharities': sorted(
                [{'name': charity['name'], 'tokens': int(charity.get('tokenBalance', 0))} for charity in charities],
                key=lambda entry: entry['tokens'],
                reverse=True,
            )[:5],
        }
    )
