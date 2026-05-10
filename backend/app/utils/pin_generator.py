import hashlib


def generate_pin(phone):
    return hashlib.sha256(phone.encode('utf-8')).hexdigest()[:6].upper()
