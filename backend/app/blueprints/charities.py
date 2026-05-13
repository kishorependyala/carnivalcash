from flask import Blueprint, g, jsonify, request

from app.storage.charity_store import add_charity, get_charity, list_charities
from app.utils.auth_middleware import require_auth

charities_bp = Blueprint('charities', __name__)


@charities_bp.get('/api/charities')
@require_auth
def get_charities():
    """
    List all charities.
    ---
    tags: [Charities]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: List of charities
    """
    return jsonify(list_charities())


@charities_bp.post('/api/charities')
@require_auth
def create_charity():
    """
    Create a new charity.
    ---
    tags: [Charities]
    security: [{BearerAuth: []}]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [name]
            properties:
              name: {type: string, example: "Children's Hospital"}
              description: {type: string, example: "Helping kids"}
              website: {type: string, example: "https://example.org"}
    responses:
      200:
        description: Charity already existed, returned existing
      201:
        description: Charity created
      400:
        description: name is required
    """
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
    """
    Get a charity by ID.
    ---
    tags: [Charities]
    security: [{BearerAuth: []}]
    parameters:
      - in: path
        name: charity_id
        required: true
        schema: {type: string}
    responses:
      200:
        description: Charity object
      404:
        description: Not found
    """
    charity = get_charity(charity_id)
    if not charity:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(charity)
