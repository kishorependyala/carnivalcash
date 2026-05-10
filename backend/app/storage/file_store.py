import json
from pathlib import Path

from filelock import FileLock


def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)


def read_json(path):
    file_path = Path(path)
    ensure_dir(file_path.parent)
    lock = FileLock(f'{file_path}.lock')
    with lock:
        if not file_path.exists():
            return None
        with file_path.open('r', encoding='utf-8') as file:
            return json.load(file)


def write_json(path, data):
    file_path = Path(path)
    ensure_dir(file_path.parent)
    lock = FileLock(f'{file_path}.lock')
    with lock:
        with file_path.open('w', encoding='utf-8') as file:
            json.dump(data, file, indent=2)
    return data
