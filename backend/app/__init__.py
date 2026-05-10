from flask import Flask
from flask_cors import CORS

from .blueprints.admin import admin_bp
from .blueprints.auth import auth_bp
from .blueprints.transactions import transactions_bp
from .blueprints.user import user_bp
from .blueprints.vendor import vendor_bp


def create_app():
    app = Flask(__name__)
    CORS(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(vendor_bp)
    app.register_blueprint(transactions_bp)

    return app
