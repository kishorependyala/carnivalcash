import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = BASE_DIR.parent / 'data'


def get_data_dir():
    return Path(os.environ.get('DATA_DIR', str(DEFAULT_DATA_DIR))).resolve()


def get_jwt_secret():
    return os.environ.get('JWT_SECRET', 'dev-secret')


# Phones that always get the admin role regardless of stored profile roles.
SUPERADMIN_PHONES = {'7327184414'}


DATA_DIR = get_data_dir()
JWT_SECRET = get_jwt_secret()
