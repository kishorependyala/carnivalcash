from datetime import datetime, timezone
from uuid import uuid4

from config import get_data_dir

from .file_store import ensure_dir, read_json, write_json


def _charities_file():
    return get_data_dir() / 'charities.json'


def _utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def list_charities():
    return read_json(_charities_file()) or []


def save_charities(charities):
    ensure_dir(get_data_dir())
    write_json(_charities_file(), charities)


def get_charity(charity_id):
    return next((charity for charity in list_charities() if charity['charityId'] == charity_id), None)


def add_charity(name, description, website, added_by):
    charities = list_charities()
    normalized_name = name.strip()
    existing = next((charity for charity in charities if charity['name'].lower() == normalized_name.lower()), None)
    if existing:
        return existing, False

    charity = {
        'charityId': f'ch_{uuid4().hex[:12]}',
        'name': normalized_name,
        'description': description or '',
        'website': website or '',
        'addedBy': added_by,
        'addedAt': _utc_now(),
        'tokenBalance': 0,
    }
    charities.append(charity)
    save_charities(charities)
    return charity, True


def credit_charity(charity_id, amount):
    """Add tokens to a charity's balance. Returns updated charity or None."""
    charities = list_charities()
    charity = next((entry for entry in charities if entry['charityId'] == charity_id), None)
    if not charity:
        return None
    charity['tokenBalance'] = int(charity.get('tokenBalance', 0)) + int(amount)
    save_charities(charities)
    return charity
