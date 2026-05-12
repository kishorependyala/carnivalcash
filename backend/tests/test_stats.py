from app.storage.charity_store import save_charities
from app.storage.stall_store import create_stall, save_stall
from app.storage.user_store import save_user_transactions


def test_stats_returns_expected_aggregate_payload(client, seed_profile, auth_header):
    user = seed_profile('5550000001', token_balance=40, name='Parent One')
    other_user = seed_profile('5550000002', token_balance=15, name='Parent Two')
    admin = seed_profile('5550000003', roles=['admin'])

    stall = create_stall('Snack Shack', 'food', 5, 'Fresh treats', admin['userId'], creator_name='Admin')
    stall['tokenBalance'] = 18
    save_stall(stall['stallId'], stall)

    save_charities(
        [
            {'charityId': 'char-1', 'name': 'Helping Hands', 'tokenBalance': 9},
            {'charityId': 'char-2', 'name': 'Kids First', 'tokenBalance': 4},
        ]
    )
    save_user_transactions(
        user['userId'],
        [
            {'txId': 'tx-1', 'amount': 5, 'timestamp': '2026-05-10T10:00:00Z'},
            {'txId': 'tx-2', 'amount': 3, 'timestamp': '2026-05-10T10:05:00Z'},
        ],
    )
    save_user_transactions(
        other_user['userId'],
        [{'txId': 'tx-3', 'amount': 2, 'timestamp': '2026-05-10T10:10:00Z'}],
    )

    response = client.get('/api/stats', headers=auth_header(user))

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['totalUsers'] == 3
    assert payload['totalStalls'] == 1
    assert payload['totalTransactions'] == 3
    assert payload['tokensInCirculation'] == 55
    assert payload['stallTokensEarned'] == 18
    assert payload['charityTokensDonated'] == 13
    assert payload['topStalls'][0] == {'name': 'Snack Shack', 'tokens': 18}
    assert payload['topCharities'][0] == {'name': 'Helping Hands', 'tokens': 9}
