from app.storage.user_store import get_profile, get_user_kids, get_vendor_items, get_vendor_transactions, save_user_kids


def setup_transfer_state(seed_profile, client, auth_header):
    user = seed_profile('5553000001', token_balance=100, name='Parent')
    vendor = seed_profile('5553000002', roles=['vendor'], name='Snack Shack')
    item = client.post(
        '/api/vendor/items',
        json={'name': 'Popcorn', 'tokenPrice': 5, 'stallType': 'food'},
        headers=auth_header(vendor),
    ).get_json()
    return user, vendor, item


def test_transfer_deducts_tokens_from_user(client, seed_profile, auth_header):
    user, vendor, item = setup_transfer_state(seed_profile, client, auth_header)

    response = client.post(
        '/api/transactions/transfer',
        json={'vendorId': vendor['userId'], 'items': [{'itemId': item['itemId'], 'qty': 2}], 'kidId': None},
        headers=auth_header(user),
    )

    assert response.status_code == 200
    assert response.get_json()['newBalance'] == 90
    assert get_profile(user['userId'])['tokenBalance'] == 90


def test_transfer_credits_vendor(client, seed_profile, auth_header):
    user, vendor, item = setup_transfer_state(seed_profile, client, auth_header)

    client.post(
        '/api/transactions/transfer',
        json={'vendorId': vendor['userId'], 'items': [{'itemId': item['itemId'], 'qty': 3}], 'kidId': None},
        headers=auth_header(user),
    )

    vendor_transactions = get_vendor_transactions(vendor['userId'])
    assert len(vendor_transactions) == 1
    assert vendor_transactions[0]['amount'] == 15


def test_transfer_with_kid_checks_limit(client, seed_profile, auth_header):
    user, vendor, item = setup_transfer_state(seed_profile, client, auth_header)
    save_user_kids(
        user['userId'],
        [{'kidId': 'kid-1', 'name': 'Alice', 'spendingLimit': 20, 'spent': 0, 'createdAt': '2026-05-10T10:00:00Z'}],
    )

    response = client.post(
        '/api/transactions/transfer',
        json={'vendorId': vendor['userId'], 'items': [{'itemId': item['itemId'], 'qty': 2}], 'kidId': 'kid-1'},
        headers=auth_header(user),
    )

    assert response.status_code == 200
    assert get_user_kids(user['userId'])[0]['spent'] == 10


def test_transfer_fails_if_insufficient_balance(client, seed_profile, auth_header):
    user = seed_profile('5553000001', token_balance=5, name='Parent')
    vendor = seed_profile('5553000002', roles=['vendor'], name='Snack Shack')
    item = client.post(
        '/api/vendor/items',
        json={'name': 'Popcorn', 'tokenPrice': 10, 'stallType': 'food'},
        headers=auth_header(vendor),
    ).get_json()

    response = client.post(
        '/api/transactions/transfer',
        json={'vendorId': vendor['userId'], 'items': [{'itemId': item['itemId'], 'qty': 1}], 'kidId': None},
        headers=auth_header(user),
    )

    assert response.status_code == 400
    assert response.get_json()['error'] == 'Insufficient balance'


def test_transfer_fails_if_kid_limit_exceeded(client, seed_profile, auth_header):
    user, vendor, item = setup_transfer_state(seed_profile, client, auth_header)
    save_user_kids(
        user['userId'],
        [{'kidId': 'kid-1', 'name': 'Alice', 'spendingLimit': 5, 'spent': 0, 'createdAt': '2026-05-10T10:00:00Z'}],
    )

    response = client.post(
        '/api/transactions/transfer',
        json={'vendorId': vendor['userId'], 'items': [{'itemId': item['itemId'], 'qty': 2}], 'kidId': 'kid-1'},
        headers=auth_header(user),
    )

    assert response.status_code == 400
    assert response.get_json()['error'] == 'Kid spending limit exceeded'
