from config import get_data_dir
from app.storage.user_store import save_vendor_transactions
from app.storage.stall_store import create_stall


def test_add_tokens_increases_balance(client, seed_profile, auth_header):
    admin = seed_profile('5550000001', roles=['admin'])
    user = seed_profile('5550000002', token_balance=10)

    response = client.post(
        '/api/admin/tokens',
        json={'phone': user['phone'], 'amount': 25},
        headers=auth_header(admin),
    )

    assert response.status_code == 200
    assert response.get_json()['tokenBalance'] == 35


def test_set_rate_updates_event(client, seed_profile, auth_header):
    admin = seed_profile('5550000001', roles=['admin'])

    response = client.post('/api/admin/rate', json={'tokenRate': 12}, headers=auth_header(admin))

    assert response.status_code == 200
    assert response.get_json()['tokenRate'] == 12


def test_open_close_event_lifecycle(client, seed_profile, auth_header):
    admin = seed_profile('5550000001', roles=['admin'])
    client.post('/api/admin/rate', json={'tokenRate': 10}, headers=auth_header(admin))

    open_response = client.post(
        '/api/admin/event',
        json={'action': 'open', 'name': 'Carnival 2026'},
        headers=auth_header(admin),
    )
    event = open_response.get_json()
    close_response = client.post('/api/admin/event', json={'action': 'close'}, headers=auth_header(admin))

    assert open_response.status_code == 200
    assert event['status'] == 'open'
    assert close_response.status_code == 200
    assert close_response.get_json()['status'] == 'closed'
    # event lifecycle now recorded in admin.json audit log (not separate history files)
    admin_file = get_data_dir() / 'admin.json'
    assert admin_file.exists()


def test_stats_returns_expected_shape(client, seed_profile, auth_header):
    admin = seed_profile('5550000001', roles=['admin'])
    user = seed_profile('5550000002', token_balance=50, name='Parent')
    vendor = seed_profile('5550000003', roles=['vendor'], name='Snack Shack')
    save_vendor_transactions(
        vendor['userId'],
        [
            {
                'txId': 'tx-1',
                'userId': user['userId'],
                'userName': 'Parent',
                'kidId': None,
                'kidName': None,
                'itemId': 'item-1',
                'itemName': 'Popcorn',
                'qty': 1,
                'amount': 5,
                'timestamp': '2026-05-10T10:00:00Z',
            }
        ],
    )

    response = client.get('/api/admin/stats', headers=auth_header(admin))

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['totalTokensIssued'] == 50
    assert payload['totalTokensSpent'] == 5
    assert payload['vendors'][0]['vendorName'] == 'Snack Shack'
    assert payload['users'][0]['phone'] == '5550000002'


# ── Admin stalls endpoint ──────────────────────────────────────────────────────

def test_admin_list_stalls_requires_admin_role(client, seed_profile, auth_header):
    user = seed_profile('5550001001')

    response = client.get('/api/admin/stalls', headers=auth_header(user))

    assert response.status_code == 403


def test_admin_list_stalls_returns_empty_list(client, seed_profile, auth_header):
    admin = seed_profile('5550001002', roles=['admin'])

    response = client.get('/api/admin/stalls', headers=auth_header(admin))

    assert response.status_code == 200
    assert response.get_json() == []


def test_admin_list_stalls_returns_all_stalls(client, seed_profile, auth_header):
    admin = seed_profile('5550001003', roles=['admin'])
    creator = seed_profile('5550001004', name='Stall Owner')

    create_stall('Ring Toss', 'game', 3, 'A fun game', creator['userId'], creator_name='Stall Owner')
    create_stall('Hot Dogs', 'food', 5, 'Tasty food', creator['userId'], creator_name='Stall Owner')

    response = client.get('/api/admin/stalls', headers=auth_header(admin))

    assert response.status_code == 200
    stalls = response.get_json()
    assert len(stalls) == 2
    names = {s['stallName'] for s in stalls}
    assert names == {'Ring Toss', 'Hot Dogs'}


def test_admin_list_stalls_includes_members_and_admins(client, seed_profile, auth_header):
    admin = seed_profile('5550001005', roles=['admin'])
    creator = seed_profile('5550001006', name='Creator')
    member = seed_profile('5550001007', name='Member')

    stall_response = client.post(
        '/api/stalls',
        json={'stallName': 'Balloon Pop', 'stallType': 'game', 'tokensPerItem': 2},
        headers=auth_header(creator),
    )
    stall_id = stall_response.get_json()['stallId']

    client.post(
        f'/api/stalls/{stall_id}/members',
        json={'memberId': member['userId'], 'isAdmin': False},
        headers=auth_header(creator),
    )

    response = client.get('/api/admin/stalls', headers=auth_header(admin))

    assert response.status_code == 200
    stall = response.get_json()[0]
    assert 'members' in stall
    assert 'stallAdmins' in stall
    assert 'memberNames' in stall
    assert creator['userId'] in stall['members']
    assert member['userId'] in stall['members']
    assert creator['userId'] in stall['stallAdmins']
    assert member['userId'] not in stall['stallAdmins']


def test_admin_list_stalls_creator_is_stall_admin(client, seed_profile, auth_header):
    admin = seed_profile('5550001008', roles=['admin'])
    creator = seed_profile('5550001009', name='Founder')

    client.post(
        '/api/stalls',
        json={'stallName': 'Dunk Tank', 'stallType': 'game', 'tokensPerItem': 4},
        headers=auth_header(creator),
    )

    response = client.get('/api/admin/stalls', headers=auth_header(admin))

    assert response.status_code == 200
    stall = response.get_json()[0]
    assert creator['userId'] in stall['stallAdmins']
    assert stall['memberNames'][creator['userId']] == 'Founder'


def test_admin_list_stalls_member_count_is_correct(client, seed_profile, auth_header):
    admin = seed_profile('5550001010', roles=['admin'])
    creator = seed_profile('5550001011', name='Owner')
    extra1 = seed_profile('5550001012', name='Extra One')
    extra2 = seed_profile('5550001013', name='Extra Two')

    stall_response = client.post(
        '/api/stalls',
        json={'stallName': 'Wheel Spin', 'stallType': 'game', 'tokensPerItem': 1},
        headers=auth_header(creator),
    )
    stall_id = stall_response.get_json()['stallId']

    client.post(f'/api/stalls/{stall_id}/members', json={'memberId': extra1['userId']}, headers=auth_header(creator))
    client.post(f'/api/stalls/{stall_id}/members', json={'memberId': extra2['userId']}, headers=auth_header(creator))

    response = client.get('/api/admin/stalls', headers=auth_header(admin))

    assert response.status_code == 200
    stall = response.get_json()[0]
    assert stall['memberCount'] == 3


def test_admin_list_stalls_unauthenticated_rejected(client):
    response = client.get('/api/admin/stalls')

    assert response.status_code == 401
