from flasgger import Swagger
from flask import Flask, redirect
from flask_cors import CORS

from .blueprints.admin import admin_bp
from .blueprints.auth import auth_bp
from .blueprints.bootstrap import bootstrap_bp
from .blueprints.charities import charities_bp
from .blueprints.events import events_bp
from .blueprints.orders import orders_bp
from .blueprints.stalls import stalls_bp
from .blueprints.stats import stats_bp
from .blueprints.transactions import transactions_bp
from .blueprints.user import user_bp
from .blueprints.vendor import vendor_bp

SWAGGER_CONFIG = {
    'uiversion': 3,
    'openapi': '3.0.3',
    'specs_route': '/apidocs/',
    'specs': [{
        'endpoint': 'apispec_1',
        'route': '/apispec_1.json',
        'rule_filter': lambda rule: True,
        'model_filter': lambda tag: True,
    }],
    'static_url_path': '/flasgger_static',
    'swagger_ui': True,
}

SWAGGER_TEMPLATE = {
    'openapi': '3.0.3',
    'info': {
        'title': 'CarnivalCash API',
        'version': '1.0.0',
        'description': (
            'Digital token system for carnival donation events. '
            'Authenticate via POST /api/auth/verify to get a JWT, '
            'then use it as a Bearer token in the Authorize dialog.'
        ),
    },
    'components': {
        'securitySchemes': {
            'BearerAuth': {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'JWT',
            }
        }
    },
    'security': [{'BearerAuth': []}],
}


def create_app():
    app = Flask(__name__)
    CORS(app)

    Swagger(app, config=SWAGGER_CONFIG, template=SWAGGER_TEMPLATE, merge=True)

    @app.get('/')
    def index():
        return redirect('/apidocs/')

    app.register_blueprint(auth_bp)
    app.register_blueprint(bootstrap_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(vendor_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(stalls_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(charities_bp)
    app.register_blueprint(stats_bp)
    app.register_blueprint(events_bp)

    return app
