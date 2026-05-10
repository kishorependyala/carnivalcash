from config import get_data_dir
from app.storage.user_store import save_user_kids


def test_get_profile_returns_correct_data(client, seed_profile, auth_header):
    user = seed_profile('5551000001', name='Parent')

    response = client.get('/api/user/profile', headers=auth_header(user))

    assert response.status_code == 200
    assert response.get_json()['name'] == 'Parent'


def test_update_profile_archives_old_version(client, seed_profile, auth_header):
    user = seed_profile('5551000001', name='Old Name')

    response = client.put(
        '/api/user/profile',
        json={'name': 'New Name', 'emails': ['parent@example.com']},
        headers=auth_header(user),
    )

    assert response.status_code == 200
    archive_dir = get_data_dir() / 'archive' / user['userId']
    archived_files = list(archive_dir.glob('*.json'))
    assert archived_files
    assert response.get_json()['name'] == 'New Name'


def test_add_kid_creates_kid_with_qr_payload(client, seed_profile, auth_header):
    user = seed_profile('5551000001')

    response = client.post(
        '/api/user/kids',
        json={'name': 'Alice', 'spendingLimit': 50},
        headers=auth_header(user),
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload['name'] == 'Alice'
    assert payload['qrPayload'] == f"CARNIVAL_KID:{user['userId']}:{payload['kidId']}"


def test_delete_kid_removes_it(client, seed_profile, auth_header):
    user = seed_profile('5551000001')
    save_user_kids(
        user['userId'],
        [{'kidId': 'kid-1', 'name': 'Alice', 'spendingLimit': 50, 'spent': 0, 'createdAt': '2026-05-10T10:00:00Z'}],
    )

    response = client.delete('/api/user/kids/kid-1', headers=auth_header(user))
    kids_response = client.get('/api/user/kids', headers=auth_header(user))

    assert response.status_code == 200
    assert kids_response.get_json() == []
