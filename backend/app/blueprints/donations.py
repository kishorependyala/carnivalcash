from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from app.storage.donations_store import get_donations_data, save_donations_data
from app.storage.charity_store import list_charities
from app.storage.stall_store import list_stalls, save_stall
from app.utils.auth_middleware import require_auth, require_role

donations_bp = Blueprint('donations', __name__)


def _build_charity_summary(token_rate=2):
    """Aggregate per-charity donation totals across all stalls, plus unmapped charities."""
    stalls = list_stalls()
    charity_map = {}  # charityId -> { name, stalls: [], totalTokens }
    grand_total_tokens = 0

    for stall in stalls:
        if not stall.get('isActive', True):
            continue
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


@donations_bp.get('/api/donations/public')
def get_donations_public():
    """Return per-charity donation summary — no authentication required (read-only public view)."""
    from app.storage.admin_store import get_event
    try:
        event = get_event()
        token_rate = int(event.get('tokenRate', 2)) if event else 2
    except Exception:
        token_rate = 2

    charities, grand_total_tokens, grand_total_dollars = _build_charity_summary(token_rate)
    data = get_donations_data()
    matches = data.get('employerMatches', [])

    for c in charities:
        cid = c['charityId']
        match_count = sum(1 for m in matches if m.get('charityId') == cid)
        c['employerMatches'] = []   # no personal data in public view
        c['employerMatchCount'] = match_count
        c['myMatch'] = False

    charities.sort(key=lambda c: c['totalTokens'], reverse=True)
    return jsonify({
        'charities': charities,
        'tokenRate': token_rate,
        'grandTotalTokens': grand_total_tokens,
        'grandTotalDollars': grand_total_dollars,
    })


@donations_bp.post('/api/admin/donations/map-employer-matches')
@require_auth
@require_role('admin')
def admin_map_employer_matches():
    """Bulk-register employer matches for a list of users across all charities (100% match)."""
    from app.storage.user_store import get_profile
    from app.storage.admin_store import get_event

    body = request.get_json() or {}
    user_ids = body.get('userIds', [])
    if not user_ids:
        return jsonify({'error': 'userIds required'}), 400

    try:
        event = get_event()
        token_rate = int(event.get('tokenRate', 2)) if event else 2
    except Exception:
        token_rate = 2

    charities, _, _ = _build_charity_summary(token_rate)
    data = get_donations_data()
    matches = data.get('employerMatches', [])

    added = 0
    for uid in user_ids:
        profile = get_profile(uid) or {}
        user_name = profile.get('name', '').strip()
        user_phone = profile.get('phone', '')
        for c in charities:
            cid = c['charityId']
            existing = next((m for m in matches if m['charityId'] == cid and m['userId'] == uid), None)
            if existing:
                existing['amount'] = c['employerMatchTokens']
                existing['updatedAt'] = datetime.now(timezone.utc).isoformat()
            else:
                matches.append({
                    'userId': uid,
                    'userName': user_name,
                    'userPhone': user_phone,
                    'charityId': cid,
                    'charityName': c['name'],
                    'amount': c['employerMatchTokens'],
                    'createdAt': datetime.now(timezone.utc).isoformat(),
                })
                added += 1

    data['employerMatches'] = matches
    save_donations_data(data)
    return jsonify({'status': 'ok', 'added': added, 'usersProcessed': len(user_ids)})


@donations_bp.post('/api/admin/stalls/distribute-charities')
@require_auth
@require_role('admin')
def admin_distribute_charities():
    """
    Distribute charity percentages evenly across all stalls.

    Top stall (highest total tokens): each charity gets equal share (100/N %).
    Remaining stalls: also set to equal share so the overall grand total is
    evenly distributed across all charities.
    """
    stalls = list_stalls()
    active = [s for s in stalls if s.get('isActive', True)]

    all_charity_ids = set()
    for s in active:
        for c in s.get('charities', []):
            all_charity_ids.add(c['charityId'])

    if not all_charity_ids:
        return jsonify({'error': 'No charities configured on any stall'}), 400

    all_charities_list = list_charities()
    charity_names = {c['charityId']: c['name'] for c in all_charities_list}

    n = len(all_charity_ids)
    base_pct = 100 // n
    remainder = 100 - base_pct * n

    def even_split(charity_ids):
        ids = list(charity_ids)
        result = []
        for i, cid in enumerate(ids):
            pct = base_pct + (1 if i < remainder else 0)
            result.append({
                'charityId': cid,
                'name': charity_names.get(cid, cid),
                'percentage': pct,
            })
        return result

    # Sort active stalls: top stall (highest total tokens) first
    def total_tokens(s):
        return int(s.get('tokenBalance', 0)) + int(s.get('physicalTokens', 0))

    sorted_stalls = sorted(active, key=total_tokens, reverse=True)
    updated = 0
    for stall in sorted_stalls:
        stall_charity_ids = {c['charityId'] for c in stall.get('charities', [])}
        if not stall_charity_ids:
            stall_charity_ids = all_charity_ids
        new_charities = even_split(stall_charity_ids)
        stall['charities'] = new_charities
        save_stall(stall['stallId'], stall)
        updated += 1

    return jsonify({'status': 'ok', 'stallsUpdated': updated, 'charitiesPerStall': n})


# ── Receipt storage helpers ──────────────────────────────────────────────────

def _receipts_dir():
    from config import get_data_dir
    d = get_data_dir() / 'receipts'
    d.mkdir(parents=True, exist_ok=True)
    return d

def _load_charity_receipts(charity_id):
    import json
    f = _receipts_dir() / f'{charity_id}.json'
    if not f.exists():
        return []
    try:
        return json.loads(f.read_text(encoding='utf-8'))
    except Exception:
        return []

def _save_charity_receipts(charity_id, receipts):
    import json
    f = _receipts_dir() / f'{charity_id}.json'
    f.write_text(json.dumps(receipts, indent=2), encoding='utf-8')


# ── Receipt endpoints ────────────────────────────────────────────────────────

@donations_bp.get('/api/donations/receipts')
def get_all_receipts():
    """Return all uploaded receipts grouped by charityId — no auth required."""
    receipts_dir = _receipts_dir()
    result = {}
    for f in receipts_dir.glob('*.json'):
        charity_id = f.stem
        try:
            import json
            result[charity_id] = json.loads(f.read_text(encoding='utf-8'))
        except Exception:
            result[charity_id] = []
    return jsonify({'receipts': result})


@donations_bp.post('/api/donations/receipts/<charity_id>')
@require_auth
def add_receipt(charity_id):
    """Upload a receipt for a charity."""
    from uuid import uuid4
    body = request.get_json() or {}
    file_name = body.get('fileName', 'receipt')
    data = body.get('data', '')
    donated_by = body.get('donatedBy', '').strip()

    if not data:
        return jsonify({'error': 'data required'}), 400

    receipts = _load_charity_receipts(charity_id)
    entry = {
        'id': str(uuid4()),
        'charityId': charity_id,
        'fileName': file_name,
        'data': data,
        'donatedBy': donated_by,
        'addedAt': datetime.now(timezone.utc).isoformat(),
        'uploadedBy': g.user.get('userId', ''),
    }
    receipts.append(entry)
    _save_charity_receipts(charity_id, receipts)
    return jsonify({'status': 'ok', 'receipt': entry}), 201


@donations_bp.delete('/api/donations/receipts/<charity_id>/<receipt_id>')
@require_auth
def remove_receipt(charity_id, receipt_id):
    """Delete a receipt. Any authenticated user may remove."""
    receipts = _load_charity_receipts(charity_id)
    new_receipts = [r for r in receipts if r.get('id') != receipt_id]
    if len(new_receipts) == len(receipts):
        return jsonify({'error': 'Not found'}), 404
    _save_charity_receipts(charity_id, new_receipts)
    return jsonify({'status': 'ok'})


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
