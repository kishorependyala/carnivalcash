from flask import Blueprint, g, jsonify, request

from app.storage.charity_store import add_charity, get_charity, list_charities
from app.utils.auth_middleware import require_auth

charities_bp = Blueprint('charities', __name__)


@charities_bp.get('/api/charities')
@require_auth
def get_charities():
    return jsonify(list_charities())


@charities_bp.post('/api/charities')
@require_auth
def create_charity():
    body = request.get_json(silent=True) or {}
    name = (body.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400

    charity, created = add_charity(
        name=name,
        description=(body.get('description') or '').strip(),
        website=(body.get('website') or '').strip(),
        added_by=g.user['userId'],
    )
    return jsonify(charity), 201 if created else 200


@charities_bp.get('/api/charities/<charity_id>')
@require_auth
def get_charity_route(charity_id):
    charity = get_charity(charity_id)
    if not charity:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(charity)
