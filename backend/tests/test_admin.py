from config import get_data_dir
from app.storage.user_store import save_vendor_transactions


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
