
def test_get_qr_returns_correct_payload(client, seed_profile, auth_header):
    vendor = seed_profile('5552000001', roles=['vendor'])

    response = client.get('/api/vendor/qr', headers=auth_header(vendor))

    assert response.status_code == 200
    assert response.get_json()['qrPayload'] == f"CARNIVAL_VENDOR:{vendor['userId']}"


def test_add_item_adds_to_list(client, seed_profile, auth_header):
    vendor = seed_profile('5552000001', roles=['vendor'])

    create_response = client.post(
        '/api/vendor/items',
        json={'name': 'Cotton Candy', 'tokenPrice': 5, 'stallType': 'food'},
        headers=auth_header(vendor),
    )
    list_response = client.get('/api/vendor/items', headers=auth_header(vendor))

    assert create_response.status_code == 201
    assert len(list_response.get_json()) == 1
    assert list_response.get_json()[0]['name'] == 'Cotton Candy'


def test_deactivate_item_sets_active_false(client, seed_profile, auth_header):
    vendor = seed_profile('5552000001', roles=['vendor'])
    item = client.post(
        '/api/vendor/items',
        json={'name': 'Cotton Candy', 'tokenPrice': 5, 'stallType': 'food'},
        headers=auth_header(vendor),
    ).get_json()

    response = client.delete(f"/api/vendor/items/{item['itemId']}", headers=auth_header(vendor))

    assert response.status_code == 200
    assert response.get_json()['active'] is False
