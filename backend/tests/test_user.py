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


def test_get_balance_returns_birth_year(client, seed_profile, auth_header):
    user = seed_profile('5551000001', birth_year='1990')

    response = client.get('/api/user/balance', headers=auth_header(user))

    assert response.status_code == 200
    assert response.get_json()['birthYear'] == '1990'



def test_update_birth_year_updates_profile(client, seed_profile, auth_header):
    user = seed_profile('5551000001')

    response = client.put(
        '/api/users/birth-year',
        json={'birthYear': '1988'},
        headers=auth_header(user),
    )
    balance_response = client.get('/api/user/balance', headers=auth_header(user))

    assert response.status_code == 200
    assert response.get_json() == {'birthYear': '1988'}
    assert balance_response.get_json()['birthYear'] == '1988'



def test_update_birth_year_rejects_invalid_year(client, seed_profile, auth_header):
    user = seed_profile('5551000001')

    response = client.put(
        '/api/users/birth-year',
        json={'birthYear': 'ninety'},
        headers=auth_header(user),
    )

    assert response.status_code == 400
    assert response.get_json()['error'] == 'birthYear must be a 4-digit year or 0000'


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



def test_update_kid_updates_name_and_limit(client, seed_profile, auth_header):
    user = seed_profile('5551000001')
    save_user_kids(
        user['userId'],
        [{'kidId': 'kid-1', 'name': 'Alice', 'spendingLimit': 50, 'spent': 0, 'createdAt': '2026-05-10T10:00:00Z'}],
    )

    response = client.put(
        '/api/users/kids/kid-1',
        json={'name': 'Alice Updated', 'spendingLimit': 75},
        headers=auth_header(user),
    )

    assert response.status_code == 200
    assert response.get_json()['name'] == 'Alice Updated'
    assert response.get_json()['spendingLimit'] == 75


def test_family_link_and_unlink_updates_both_profiles(client, seed_profile, auth_header):
    user = seed_profile('5551000001', name='Parent One')
    other = seed_profile('5551000002', name='Parent Two')

    link_response = client.post(
        '/api/users/link-family',
        json={'phone': other['phone']},
        headers=auth_header(user),
    )
    family_response = client.get('/api/users/family', headers=auth_header(user))

    assert link_response.status_code == 200
    assert family_response.status_code == 200
    assert family_response.get_json() == [{'userId': other['userId'], 'name': 'Parent Two', 'phone': other['phone']}]

    unlink_response = client.delete(f"/api/users/link-family/{other['userId']}", headers=auth_header(user))
    family_after_unlink = client.get('/api/users/family', headers=auth_header(user))

    assert unlink_response.status_code == 200
    assert family_after_unlink.get_json() == []
