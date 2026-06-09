from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from app.storage.donations_store import get_donations_data, save_donations_data
from app.storage.charity_store import list_charities
from app.storage.stall_store import list_stalls
from app.utils.auth_middleware import require_auth

donations_bp = Blueprint('donations', __name__)


def _build_charity_summary(token_rate=2):
    """Aggregate per-charity donation totals across all stalls, plus unmapped charities."""
    stalls = list_stalls()
    charity_map = {}  # charityId -> { name, stalls: [], totalTokens }
    grand_total_tokens = 0

    for stall in stalls:
        digital = int(stall.get('tokenBalance', 0))
        physical = int(stall.get('physicalTokens', 0))
        total = digital + physical
        grand_total_tokens += total
        for c in stall.get('charities', []):
            cid = c['charityId']
            pct = c.get('percentage', 0)
            tokens = round(total * pct / 100)
            dollars = round(tokens / token_rate, 2) if token_rate > 0 else 0
            if cid not in charity_map:
                charity_map[cid] = {'charityId': cid, 'name': c['name'], 'stalls': [], 'totalTokens': 0, 'totalDollars': 0}
            charity_map[cid]['stalls'].append({
                'stallName': stall.get('stallName', ''),
                'tokens': tokens,
                'dollars': dollars,
            })
            charity_map[cid]['totalTokens'] += tokens
            charity_map[cid]['totalDollars'] += dollars

    # Round totals and set employer match values for stall-mapped charities
    for c in charity_map.values():
        c['totalDollars'] = round(c['totalDollars'], 2)
        c['employerMatchTokens'] = c['totalTokens']
        c['employerMatchDollars'] = c['totalDollars']
        c['unmapped'] = False

    # Include unmapped charities (exist in charity store but not linked to any stall)
    for charity in list_charities():
        cid = charity['charityId']
        if cid not in charity_map:
            tokens = int(charity.get('tokenBalance', 0))
            dollars = round(tokens / token_rate, 2) if token_rate > 0 else 0
            if tokens > 0:
                charity_map[cid] = {
                    'charityId': cid,
                    'name': charity['name'],
                    'stalls': [],
                    'totalTokens': tokens,
                    'totalDollars': dollars,
                    'employerMatchTokens': tokens,
                    'employerMatchDollars': dollars,
                    'unmapped': True,
                }

    grand_total_dollars = round(grand_total_tokens / token_rate, 2) if token_rate > 0 else 0
    return list(charity_map.values()), grand_total_tokens, grand_total_dollars


@donations_bp.get('/api/donations')
@require_auth
def get_donations():
    """Return per-charity donation summary with employer match data."""
    from app.storage.admin_store import get_settings, get_event
    from app.storage.user_store import get_profile
    # Get token rate from current event settings
    try:
        event = get_event()
        token_rate = int(event.get('tokenRate', 2)) if event else 2
    except Exception:
        token_rate = 2

    charities, grand_total_tokens, grand_total_dollars = _build_charity_summary(token_rate)
    data = get_donations_data()
    matches = data.get('employerMatches', [])
    uid = g.user['userId']

    # Build a profile cache to avoid repeated lookups
    profile_cache = {}
    def _get_cached_profile(user_id):
        if user_id not in profile_cache:
            profile_cache[user_id] = get_profile(user_id) or {}
        return profile_cache[user_id]

    # Attach employer match info, enriched with live profile name + phone
    for c in charities:
        cid = c['charityId']
        enriched = []
        for m in matches:
            if m.get('charityId') != cid:
                continue
            profile = _get_cached_profile(m['userId'])
            name = profile.get('name', '').strip()
            phone = profile.get('phone', '') or m.get('userPhone', '')
            enriched.append({
                'userId': m['userId'],
                'userName': name,
                'userPhone': phone,
                'amount': m.get('amount', 0),
            })
        c['employerMatches'] = enriched
        c['myMatch'] = any(m['userId'] == uid for m in matches if m.get('charityId') == cid)

    charities.sort(key=lambda c: c['totalTokens'], reverse=True)
    return jsonify({
        'charities': charities,
        'tokenRate': token_rate,
        'grandTotalTokens': grand_total_tokens,
        'grandTotalDollars': grand_total_dollars,
    })


@donations_bp.post('/api/donations/employer-match')
@require_auth
def add_employer_match():
    """Mark the logged-in user's employer as matching a charity."""
    from app.storage.user_store import get_profile
    body = request.get_json() or {}
    charity_id = body.get('charityId')
    charity_name = body.get('charityName', '')
    amount = int(body.get('amount', 0))
    if not charity_id:
        return jsonify({'error': 'charityId required'}), 400

    data = get_donations_data()
    matches = data.get('employerMatches', [])
    uid = g.user['userId']

    profile = get_profile(uid)
    user_name = profile.get('name', '').strip() if profile else ''
    user_phone = g.user.get('phone', '')

    # Idempotent — update if already exists
    existing = next((m for m in matches if m['charityId'] == charity_id and m['userId'] == uid), None)
    if existing:
        existing['amount'] = amount
        existing['userName'] = user_name
        existing['userPhone'] = user_phone
        existing['updatedAt'] = datetime.now(timezone.utc).isoformat()
    else:
        matches.append({
            'userId': uid,
            'userName': user_name,
            'userPhone': user_phone,
            'charityId': charity_id,
            'charityName': charity_name,
            'amount': amount,
            'createdAt': datetime.now(timezone.utc).isoformat(),
        })

    data['employerMatches'] = matches
    save_donations_data(data)
    return jsonify({'status': 'ok'})


@donations_bp.delete('/api/donations/employer-match/<charity_id>')
@require_auth
def remove_employer_match(charity_id):
    """Remove the logged-in user's employer match for a charity."""
    uid = g.user['userId']
    data = get_donations_data()
    data['employerMatches'] = [
        m for m in data.get('employerMatches', [])
        if not (m['charityId'] == charity_id and m['userId'] == uid)
    ]
    save_donations_data(data)
    return jsonify({'status': 'ok'})
