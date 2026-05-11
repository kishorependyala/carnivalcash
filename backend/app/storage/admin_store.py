"""Single-file admin state: event config + audit log stored in data/admin.json.
Old scattered files (event/current.json) are migrated to data/archive/ on first access.
"""
import shutil
from datetime import datetime, timezone
from pathlib import Path

from config import get_data_dir

from .file_store import ensure_dir, read_json, write_json


def admin_file():
    return get_data_dir() / 'admin.json'


def archive_dir():
    return get_data_dir() / 'archive'


def _utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _default():
    return {
        'event': {
            'eventId': None,
            'name': 'Carnival Event',
            'status': 'closed',
            'tokenRate': 2,
            'openedAt': None,
            'closedAt': None,
        },
        'auditLog': [],
    }


def _migrate_old_files(data_dir):
    """Move legacy event/current.json → archive/ on first run."""
    old = data_dir / 'event' / 'current.json'
    if old.exists():
        ensure_dir(archive_dir())
        dest = archive_dir() / 'event_current_migrated.json'
        if not dest.exists():
            shutil.move(str(old), str(dest))
    # Also move old event history files
    old_history = data_dir / 'event' / 'history'
    if old_history.is_dir():
        ensure_dir(archive_dir())
        for f in old_history.glob('*.json'):
            dest = archive_dir() / f'event_history_{f.name}'
            if not dest.exists():
                shutil.move(str(f), str(dest))


def get_admin_data():
    data_dir = get_data_dir()
    _migrate_old_files(data_dir)
    data = read_json(admin_file())
    if data is None:
        # Seed from legacy event file if migration just ran
        migrated = archive_dir() / 'event_current_migrated.json'
        if migrated.exists():
            legacy = read_json(migrated)
            if legacy:
                d = _default()
                d['event'] = legacy
                return d
        return _default()
    data.setdefault('event', _default()['event'])
    data.setdefault('auditLog', [])
    return data


def save_admin_data(data):
    ensure_dir(get_data_dir())
    write_json(admin_file(), data)
    return data


# ── event helpers ────────────────────────────────────────────────────────────

def get_event():
    return get_admin_data().get('event')


def save_event(event, admin_id=None, action=None):
    data = get_admin_data()
    data['event'] = event
    if action:
        _append_log(data, admin_id, action, {'eventId': event.get('eventId'), 'status': event.get('status')})
    save_admin_data(data)
    return event


# ── audit log helpers ─────────────────────────────────────────────────────────

def log_admin_action(admin_id, action, details=None):
    data = get_admin_data()
    _append_log(data, admin_id, action, details or {})
    save_admin_data(data)


def _append_log(data, admin_id, action, details):
    data['auditLog'].append({
        'timestamp': _utc_now(),
        'adminId': admin_id,
        'action': action,
        'details': details,
    })
    # cap at 1000 entries
    if len(data['auditLog']) > 1000:
        data['auditLog'] = data['auditLog'][-1000:]
