"""Write login audit entries to data/login-logs/<date>.jsonl."""
import json
from datetime import datetime, timezone
from pathlib import Path

from config import get_data_dir


def _log_dir() -> Path:
    d = get_data_dir() / 'login-logs'
    d.mkdir(parents=True, exist_ok=True)
    return d


def _mask_phone(phone: str) -> str:
    """Show only last 4 digits: ******1234"""
    digits = ''.join(c for c in str(phone) if c.isdigit())
    if len(digits) >= 4:
        return '*' * (len(digits) - 4) + digits[-4:]
    return '****'


def log_login(phone: str, action: str, success: bool, detail: str = '', request=None):
    """
    Append one JSON line to today's login log.

    action  — e.g. 'login_with_pin', 'request_admin_reset', 'verify_pin_reset'
    success — True / False
    detail  — optional short note (error message, etc.)
    request — Flask request object (for IP / user-agent)
    """
    now = datetime.now(timezone.utc)
    entry = {
        'ts': now.replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'phone': _mask_phone(phone),
        'action': action,
        'success': success,
    }
    if detail:
        entry['detail'] = detail
    if request is not None:
        entry['ip'] = request.remote_addr or ''
        entry['ua'] = (request.user_agent.string or '')[:120]

    log_file = _log_dir() / f'{now.strftime("%Y-%m-%d")}.jsonl'
    with open(log_file, 'a', encoding='utf-8') as fh:
        fh.write(json.dumps(entry) + '\n')
