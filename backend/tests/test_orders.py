from app.storage.charity_store import add_charity, get_charity
from app.storage.order_store import get_stall_orders
from app.storage.stall_store import get_stall, get_stall_transactions
from app.storage.user_store import get_profile, get_user_transactions, save_user_kids


def test_place_order_creates_pending_order_and_user_view(client, seed_profile, auth_header):
    owner = seed_profile('5551000101', name='Owner')
    customer = seed_profile('5551000102', token_balance=30, name='Customer')

    stall_response = client.post(
        '/api/stalls',
        json={'stallName': 'Pizza Booth', 'stallType': 'food', 'tokensPerItem': 4, 'description': 'Slice'},
        headers=auth_header(owner),
    )
    stall_id = stall_response.get_json()['stallId']

    order_response = client.post(
        f'/api/stalls/{stall_id}/orders',
        json={'items': [{'itemId': 'default', 'qty': 2}]},
        headers=auth_header(customer),
    )

    assert order_response.status_code == 201
    payload = order_response.get_json()
    assert payload['status'] == 'pending'
    assert payload['position'] == 1
    assert payload['newBalance'] == 22
    assert get_profile(customer['userId'])['tokenBalance'] == 22

    stall_orders_response = client.get(f'/api/stalls/{stall_id}/orders', headers=auth_header(owner))
    assert stall_orders_response.status_code == 200
    assert stall_orders_response.get_json()[0]['orderId'] == payload['orderId']

    my_orders_response = client.get('/api/users/orders', headers=auth_header(customer))
    assert my_orders_response.status_code == 200
    assert my_orders_response.get_json()[0]['position'] == 1

    ready_response = client.patch(
        f'/api/stalls/{stall_id}/orders/{payload["orderId"]}',
        json={'status': 'ready'},
        headers=auth_header(owner),
    )
    assert ready_response.status_code == 200
    assert ready_response.get_json()['status'] == 'ready'

    refreshed_orders = client.get('/api/users/orders', headers=auth_header(customer)).get_json()
    assert refreshed_orders[0]['status'] == 'ready'


def test_place_order_honors_kid_limit(client, seed_profile, auth_header):
    owner = seed_profile('5551000103', name='Owner')
    parent = seed_profile('5551000104', token_balance=30, name='Parent')
    save_user_kids(
        parent['userId'],
        [{'kidId': 'kid-1', 'name': 'Kid One', 'spendingLimit': 5, 'spent': 0, 'createdAt': '2026-05-10T10:00:00Z'}],
    )

    stall_response = client.post(
        '/api/stalls',
        json={'stallName': 'Duck Pond', 'stallType': 'game', 'tokensPerItem': 3},
        headers=auth_header(owner),
    )
    stall_id = stall_response.get_json()['stallId']

    order_response = client.post(
        f'/api/stalls/{stall_id}/orders',
        json={'items': [{'itemId': 'default', 'qty': 2}], 'kidId': 'kid-1'},
        headers=auth_header(parent),
    )

    assert order_response.status_code == 400
    assert order_response.get_json()['error'] == "Exceeds kid's spending limit"
    assert get_stall_orders(stall_id) == []



def test_place_order_updates_charities_and_transactions(client, seed_profile, auth_header):
    owner = seed_profile('5551000105', name='Owner')
    customer = seed_profile('5551000106', token_balance=20, name='Customer')
    charity, _ = add_charity('Booster Club', 'Helps the school', '', owner['userId'])

    stall_response = client.post(
        '/api/stalls',
        json={
            'stallName': 'Ring Toss',
            'stallType': 'game',
            'tokensPerItem': 10,
            'charities': [{'charityId': charity['charityId'], 'name': charity['name'], 'percentage': 25}],
        },
        headers=auth_header(owner),
    )
    stall_id = stall_response.get_json()['stallId']

    order_response = client.post(
        f'/api/stalls/{stall_id}/orders',
        json={'items': [{'itemId': 'default', 'qty': 1}]},
        headers=auth_header(customer),
    )

    assert order_response.status_code == 201
    assert get_charity(charity['charityId'])['tokenBalance'] == 2
    assert get_stall(stall_id)['tokenBalance'] == 8
    assert len(get_user_transactions(customer['userId'])) == 1
    assert len(get_stall_transactions(stall_id)) == 1
