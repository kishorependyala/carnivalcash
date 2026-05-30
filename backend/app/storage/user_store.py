import re
import shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from config import get_data_dir

from .file_store import ensure_dir, read_json, write_json


def profiles_dir():
    return get_data_dir() / 'profiles'


def archive_dir():
    return get_data_dir() / 'archive'


def users_dir():
    return get_data_dir() / 'users'


def vendors_dir():
    return get_data_dir() / 'vendors'


def get_profile(user_id):
    return read_json(profiles_dir() / f'{user_id}.json')


def list_profiles():
    ensure_dir(profiles_dir())
    paths = sorted(profiles_dir().glob('*.json'))
    if not paths:
        return []
    with ThreadPoolExecutor() as executor:
        results = list(executor.map(read_json, paths))
    return [r for r in results if r is not None]


def normalize_phone(phone):
    """Strip all non-digit characters so 862-252-1855, (862) 252-1855, 8622521855 all match."""
    return re.sub(r'\D', '', str(phone))


def find_profile_by_phone(phone):
    normalized = normalize_phone(phone)
    for profile in list_profiles():
        if normalize_phone(profile.get('phone', '')) == normalized:
            return profile
    return None


def save_profile(user_id, data):
    ensure_dir(profiles_dir())
    return write_json(profiles_dir() / f'{user_id}.json', data)


def delete_profile(user_id):
    """Remove a user's profile file and all their user-side data."""
    profile_file = profiles_dir() / f'{user_id}.json'
    if profile_file.exists():
        profile_file.unlink()
    user_data = users_dir() / user_id
    if user_data.exists():
        shutil.rmtree(user_data)


def archive_profile(user_id, timestamp, data):
    target_dir = archive_dir() / user_id
    ensure_dir(target_dir)
    return write_json(target_dir / f'{timestamp}.json', data)


def ensure_user_storage(user_id):
    base_dir = users_dir() / user_id
    ensure_dir(base_dir)
    if read_json(base_dir / 'kids.json') is None:
        write_json(base_dir / 'kids.json', [])
    if read_json(base_dir / 'transactions.json') is None:
        write_json(base_dir / 'transactions.json', [])


def ensure_vendor_storage(user_id):
    base_dir = vendors_dir() / user_id
    ensure_dir(base_dir)
    if read_json(base_dir / 'items.json') is None:
        write_json(base_dir / 'items.json', [])
    if read_json(base_dir / 'transactions.json') is None:
        write_json(base_dir / 'transactions.json', [])


def get_user_kids(user_id):
    return read_json(users_dir() / user_id / 'kids.json') or []


def save_user_kids(user_id, kids):
    return write_json(users_dir() / user_id / 'kids.json', kids)


def get_user_transactions(user_id):
    return read_json(users_dir() / user_id / 'transactions.json') or []


def save_user_transactions(user_id, transactions):
    return write_json(users_dir() / user_id / 'transactions.json', transactions)


def get_vendor_items(user_id):
    return read_json(vendors_dir() / user_id / 'items.json') or []


def save_vendor_items(user_id, items):
    return write_json(vendors_dir() / user_id / 'items.json', items)


def get_vendor_transactions(user_id):
    return read_json(vendors_dir() / user_id / 'transactions.json') or []


def save_vendor_transactions(user_id, transactions):
    return write_json(vendors_dir() / user_id / 'transactions.json', transactions)
