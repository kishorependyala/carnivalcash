from config import get_data_dir
from .file_store import ensure_dir, read_json, write_json


def _donations_file():
    return get_data_dir() / 'donations.json'


def get_donations_data():
    data = read_json(_donations_file())
    if data is None:
        data = {'employerMatches': []}
    return data


def save_donations_data(data):
    ensure_dir(get_data_dir())
    write_json(_donations_file(), data)
