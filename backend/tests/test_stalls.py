from app.storage.charity_store import add_charity, get_charity
from app.storage.stall_store import get_stall
from app.storage.user_store import save_user_kids


def test_create_stall_sets_creator_name_and_admin(client, seed_profile, auth_header):
    creator = seed_profile('5551000001', name='Creator Name')

    response = client.post(
        '/api/stalls',
        json={'stallName': 'Ring Toss', 'stallType': 'game', 'tokensPerItem': 3, 'description': 'Fun'},
        headers=auth_header(creator),
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload['stallAdmins'] == [creator['userId']]
    assert payload['memberNames'][creator['userId']] == 'Creator Name'


def test_adding_kid_as_admin_auto_adds_parent_admin(client, seed_profile, auth_header):
    creator = seed_profile('5551000001', name='Creator')
    parent = seed_profile('5551000002', name='Parent User')
    save_user_kids(
        parent['userId'],
        [{'kidId': 'kid-1', 'name': 'Kid One', 'spendingLimit': 25, 'spent': 0, 'createdAt': '2026-05-10T10:00:00Z'}],
    )

    stall_response = client.post(
        '/api/stalls',
        json={'stallName': 'Duck Pond', 'stallType': 'game', 'tokensPerItem': 2},
        headers=auth_header(creator),
    )
    stall_id = stall_response.get_json()['stallId']

    add_response = client.post(
        f'/api/stalls/{stall_id}/members',
        json={'memberId': f"KID:{parent['userId']}:kid-1", 'isAdmin': True},
        headers=auth_header(creator),
    )

    assert add_response.status_code == 200
    payload = add_response.get_json()
    assert f"KID:{parent['userId']}:kid-1" in payload['members']
    assert parent['userId'] in payload['members']
    assert f"KID:{parent['userId']}:kid-1" in payload['stallAdmins']
    assert parent['userId'] in payload['stallAdmins']


def test_toggle_stall_admin_updates_membership(client, seed_profile, auth_header):
    creator = seed_profile('5551000001', name='Creator')
    member = seed_profile('5551000002', name='Member')

    stall_response = client.post(
        '/api/stalls',
        json={'stallName': 'Snack Shack', 'stallType': 'food', 'tokensPerItem': 4},
        headers=auth_header(creator),
    )
    stall_id = stall_response.get_json()['stallId']

    client.post(
        f'/api/stalls/{stall_id}/members',
        json={'memberId': member['userId']},
        headers=auth_header(creator),
    )

    promote_response = client.put(
        f'/api/stalls/{stall_id}/members/{member["userId"]}/admin',
        json={'admin': True},
        headers=auth_header(creator),
    )
    demote_response = client.put(
        f'/api/stalls/{stall_id}/members/{member["userId"]}/admin',
        json={'admin': False},
        headers=auth_header(creator),
    )

    assert promote_response.status_code == 200
    assert member['userId'] in promote_response.get_json()['stallAdmins']
    assert demote_response.status_code == 200
    assert member['userId'] not in demote_response.get_json()['stallAdmins']



def test_stall_charge_splits_tokens_to_charities(client, seed_profile, auth_header):
    creator = seed_profile('5551000003', name='Creator')
    customer = seed_profile('5551000004', token_balance=40, name='Customer', birth_year='1990')
    charity, _ = add_charity('School Fund', 'Books', '', creator['userId'])

    stall_response = client.post(
        '/api/stalls',
        json={
            'stallName': 'Ring Toss',
            'stallType': 'game',
            'tokensPerItem': 10,
            'charities': [{'charityId': charity['charityId'], 'name': charity['name'], 'percentage': 25}],
        },
        headers=auth_header(creator),
    )
    stall_id = stall_response.get_json()['stallId']

    charge_response = client.post(
        f'/api/stalls/{stall_id}/charge',
        json={'userId': customer['userId'], 'items': [{'itemId': 'default', 'qty': 2}], 'pin': '1990'},
        headers=auth_header(creator),
    )

    assert charge_response.status_code == 200
    assert charge_response.get_json()['stallBalance'] == 15
    assert get_charity(charity['charityId'])['tokenBalance'] == 5
    assert get_stall(stall_id)['tokenBalance'] == 15



def test_stall_charge_rejects_invalid_birth_year_pin(client, seed_profile, auth_header):
    creator = seed_profile('5551000003', name='Creator')
    customer = seed_profile('5551000004', token_balance=40, name='Customer', birth_year='1990')

    stall_response = client.post(
        '/api/stalls',
        json={'stallName': 'Ring Toss', 'stallType': 'game', 'tokensPerItem': 10},
        headers=auth_header(creator),
    )
    stall_id = stall_response.get_json()['stallId']

    charge_response = client.post(
        f'/api/stalls/{stall_id}/charge',
        json={'userId': customer['userId'], 'items': [{'itemId': 'default', 'qty': 1}], 'pin': '0000'},
        headers=auth_header(creator),
    )

    assert charge_response.status_code == 403
    assert charge_response.get_json()['error'] == 'Invalid PIN'
