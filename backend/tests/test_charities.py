from app.storage.charity_store import get_charity


def test_create_charity_lists_and_deduplicates(client, seed_profile, auth_header):
    user = seed_profile('5557000001', name='Helper')

    first_response = client.post(
        '/api/charities',
        json={'name': 'School Fund', 'description': 'Books and supplies', 'website': 'https://example.org/fund'},
        headers=auth_header(user),
    )
    second_response = client.post(
        '/api/charities',
        json={'name': 'school fund', 'description': 'Ignored duplicate'},
        headers=auth_header(user),
    )
    list_response = client.get('/api/charities', headers=auth_header(user))

    assert first_response.status_code == 201
    assert second_response.status_code == 200
    created = first_response.get_json()
    assert second_response.get_json()['charityId'] == created['charityId']
    assert get_charity(created['charityId'])['tokenBalance'] == 0
    assert list_response.status_code == 200
    assert [charity['name'] for charity in list_response.get_json()] == ['School Fund']
