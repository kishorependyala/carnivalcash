import json
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import jwt
import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app import create_app
from app.storage.file_store import ensure_dir
from app.storage.user_store import ensure_user_storage, ensure_vendor_storage, save_profile
from app.utils.pin_generator import generate_pin
from config import get_jwt_secret


RUNTIME_DATA_ROOT = Path(__file__).resolve().parent / '_runtime_data'


@pytest.fixture
def app(monkeypatch):
    data_dir = RUNTIME_DATA_ROOT / str(uuid4())
    ensure_dir(data_dir)
    monkeypatch.setenv('DATA_DIR', str(data_dir))
    monkeypatch.setenv('JWT_SECRET', 'test-secret-that-is-long-enough-32')

    flask_app = create_app()
    flask_app.config.update(TESTING=True)
    yield flask_app

    shutil.rmtree(data_dir, ignore_errors=True)


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def seed_profile():
    created = {'value': 0}

    def _seed_profile(phone, roles=None, token_balance=0, name='', user_id=None):
        roles = roles or ['user']
        created['value'] += 1
        user_id = user_id or f"20260510{created['value']:010d}"
        profile = {
            'userId': user_id,
            'phone': phone,
            'name': name,
            'emails': [],
            'roles': roles,
            'pin': generate_pin(phone),
            'tokenBalance': token_balance,
            'createdAt': '2026-05-10T10:00:00Z',
        }
        save_profile(user_id, profile)
        ensure_user_storage(user_id)
        if 'vendor' in roles:
            ensure_vendor_storage(user_id)
        return profile

    return _seed_profile


@pytest.fixture
def auth_header():
    def _auth_header(profile):
        token = jwt.encode(
            {
                'userId': profile['userId'],
                'phone': profile['phone'],
                'roles': profile['roles'],
                'exp': datetime.now(timezone.utc) + timedelta(hours=8),
            },
            get_jwt_secret(),
            algorithm='HS256',
        )
        return {'Authorization': f'Bearer {token}'}

    return _auth_header


@pytest.fixture
def read_data():
    def _read_data(path):
        with Path(path).open('r', encoding='utf-8') as file:
            return json.load(file)

    return _read_data
