from pathlib import Path

from config import get_data_dir

from .file_store import ensure_dir, read_json, write_json


def event_dir():
    return get_data_dir() / 'event'


def history_dir():
    return event_dir() / 'history'


def current_event_path():
    return event_dir() / 'current.json'


def get_event():
    return read_json(current_event_path())


def save_event(data):
    ensure_dir(event_dir())
    return write_json(current_event_path(), data)


def archive_event(event):
    ensure_dir(history_dir())
    event_id = event.get('eventId', 'event')
    return write_json(history_dir() / f'{event_id}.json', event)
