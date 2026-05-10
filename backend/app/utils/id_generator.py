from datetime import datetime

from config import get_data_dir

from app.storage.file_store import read_json, write_json


SEQUENCE_FILE_NAME = 'sequence.json'


def generate_user_id():
    today = datetime.now().strftime('%Y%m%d')
    sequence_path = get_data_dir() / SEQUENCE_FILE_NAME
    current = read_json(sequence_path) or {'date': '', 'seq': 0}

    if current.get('date') != today:
        seq = 1
    else:
        seq = current.get('seq', 0) + 1

    write_json(sequence_path, {'date': today, 'seq': seq})
    return f'{today}{seq:010d}'
