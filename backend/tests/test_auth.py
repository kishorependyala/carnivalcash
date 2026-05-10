from pathlib import Path

import jwt

from config import get_data_dir, get_jwt_secret


def test_request_code_creates_new_user_if_phone_not_found(client):
    response = client.post('/api/auth/request-code', json={'phone': '5551234567'})

    assert response.status_code == 200
    assert response.get_json() == {'status': 'ok', 'message': 'Code sent'}

    profiles = list((get_data_dir() / 'profiles').glob('*.json'))
    assert len(profiles) == 1
    created = profiles[0].read_text(encoding='utf-8')
    assert '5551234567' in created
    assert '"pin":' in created


def test_verify_with_matching_phone_code_returns_jwt(client):
    client.post('/api/auth/request-code', json={'phone': '5551234567'})

    response = client.post('/api/auth/verify', json={'phone': '5551234567', 'code': '5551234567'})

    assert response.status_code == 200
    payload = response.get_json()
    decoded = jwt.decode(payload['token'], get_jwt_secret(), algorithms=['HS256'])

    assert decoded['phone'] == '5551234567'
    assert payload['user']['phone'] == '5551234567'
    assert payload['user']['roles'] == ['user']


def test_verify_with_wrong_code_returns_401(client):
    client.post('/api/auth/request-code', json={'phone': '5551234567'})

    response = client.post('/api/auth/verify', json={'phone': '5551234567', 'code': '0000000000'})

    assert response.status_code == 401
    assert response.get_json()['error'] == 'Invalid code'
