from flasgger import Swagger
from flask import Flask, redirect
from flask_cors import CORS

from .blueprints.admin import admin_bp
from .blueprints.auth import auth_bp
from .blueprints.bootstrap import bootstrap_bp
from .blueprints.transactions import transactions_bp
from .blueprints.user import user_bp
from .blueprints.vendor import vendor_bp

SWAGGER_CONFIG = {
    'title': 'CarnivalCash API',
    'uiversion': 3,
    'version': '1.0.0',
    'description': (
        'Digital token system for carnival donation events. '
        'Authenticate via POST /api/auth/verify to get a JWT, '
        'then use it as a Bearer token in the Authorize dialog.'
    ),
    'termsOfService': '',
    'specs_route': '/apidocs/',
    'securityDefinitions': {
        'BearerAuth': {
            'type': 'apiKey',
            'in': 'header',
            'name': 'Authorization',
            'description': 'Enter: **Bearer &lt;your_token&gt;**',
        }
    },
    'security': [{'BearerAuth': []}],
}


def create_app():
    app = Flask(__name__)
    CORS(app)

    Swagger(app, config=SWAGGER_CONFIG, merge=True)

    @app.get('/')
    def index():
        return redirect('/apidocs/')

    app.register_blueprint(auth_bp)
    app.register_blueprint(bootstrap_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(vendor_bp)
    app.register_blueprint(transactions_bp)

    return app
