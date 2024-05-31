# static_blueprint.py
from flask import Blueprint, send_from_directory
import os
import heroicons

static_bp = Blueprint('static_bp', __name__)

@static_bp.route('/heroicons/<style>/<icon>')
def serve_heroicons(style, icon):
    icon_path = os.path.join(heroicons.__path__[0], style, f"{icon}.svg")
    return send_from_directory(os.path.dirname(icon_path), os.path.basename(icon_path))
