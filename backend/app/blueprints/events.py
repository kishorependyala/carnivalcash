from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, g, jsonify, request

from app.storage.file_store import ensure_dir, read_json, write_json
from app.utils.auth_middleware import require_auth
from config import get_data_dir

events_bp = Blueprint('events', __name__)


def _events_file():
    return get_data_dir() / 'events.json'


def _utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _load():
    return read_json(_events_file()) or []


def _save(events):
    ensure_dir(get_data_dir())
    write_json(_events_file(), events)


@events_bp.get('/api/events')
@require_auth
def list_events():
    return jsonify(sorted(_load(), key=lambda event: event.get('scheduledFor', event.get('createdAt', ''))))


@events_bp.post('/api/events')
@require_auth
def create_event():
    """Admin only: create an announcement or schedule item."""
    if 'admin' not in (g.user.get('roles') or []):
        return jsonify({'error': 'Admin only'}), 403

    body = request.get_json(silent=True) or {}
    title = (body.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400

    event = {
        'eventId': str(uuid4()),
        'title': title,
        'description': (body.get('description') or '').strip(),
        'type': body.get('type', 'announcement'),
        'scheduledFor': body.get('scheduledFor', ''),
        'createdBy': g.user['userId'],
        'createdAt': _utc_now(),
    }
    events = _load()
    events.append(event)
    _save(events)
    return jsonify(event), 201


@events_bp.delete('/api/events/<event_id>')
@require_auth
def delete_event(event_id):
    if 'admin' not in (g.user.get('roles') or []):
        return jsonify({'error': 'Admin only'}), 403

    events = [event for event in _load() if event['eventId'] != event_id]
    _save(events)
    return jsonify({'message': 'Deleted'})
