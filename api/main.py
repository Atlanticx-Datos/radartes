from flask import (
    Flask,
    flash,
    redirect,
    url_for,
    render_template,
    request,
    session,
    jsonify,
    make_response,
    send_from_directory
)
from flask_jwt_extended import (
    get_jwt,
    get_jwt_identity,
    jwt_required,
    verify_jwt_in_request,
    JWTManager,
)
from dotenv import find_dotenv, load_dotenv
from functools import wraps
import time
import sys
from typing_extensions import LiteralString
from werkzeug.wrappers import response

import requests
import json
import os
from upstash_redis import Redis

from os import environ as env
from urllib.parse import quote_plus, urlencode
from authlib.integrations.flask_client import OAuth

from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from concurrent.futures import ThreadPoolExecutor, as_completed

from flask_caching import Cache

import unicodedata
import inflect
import re
import traceback

from flask_caching import Cache

import logging
import secrets

from urllib.parse import urlparse

from flask_session import Session

import base64
import json
from collections import defaultdict
from html import escape

from werkzeug.urls import url_parse  # Add to existing imports


load_dotenv()

# Get the callback URL from environment variables
AUTH0_CALLBACK_URL = os.environ.get('AUTH0_CALLBACK_URL')

DISCIPLINE_GROUPS = {
    'visuales': {
        'pintura', 'escultura', 'cerámica', 'dibujo', 'instalación', 'fotografía',
        'artes visuales', 'visuales', 'grabado', 'arte plástica', 'muralismo',
        'arte urbano', 'arte público', 'nuevos medios', 'arte digital', 'ilustración', 
        'cerámica', 'orfebrería', 'talla en madera', 'técnicas tradicionales', 
        'digital', 'arte digital', 'nft', '3d', 'grabado', 'estampa', 'medios mixtos', 'digitales'
    },
    'música': {
        'música', 'composición', 'piano', 'guitarra', 'vientos', 'electrónica', 'ópera'
        'coral', 'arte sonoro', 'instrumentos', 'multidisciplinar', 'experimental', 'canto', 'contemporánea'
    },
    'video': {
        'videoarte', 'cine', 'documental', 'cortos', 'animación', 'cortometrajes', 'mapping'
        'artes audiovisuales', 'multidisciplinar', 'largometraje', 'corto', 'televisión',
    },
    'escénicas': {
        'teatro', 'danza', 'performance', 'circo', 'coreografía', 'artes escénicas',
        'teatro físico', 'danza contemporánea', 'multidisciplinar', 'performance',
        'happening', 'intervención', 'inmersiva',
    },
    'literatura': {
        'literatura', 'poesía', 'narrativa', 'ensayo', 'escritura', 'edición', 'publicaciones',
        'traducción', 'guion', 'multidisciplinar', 'libretto', 'libreto', 'cuento', 'cuentos'
    },
    'diseño': {
        'diseño', 'gráfico', 'industrial', 'textil',
        'editorial', 'gráfica', 'multidisciplinar', 'ilustración',
        'moda', 'interiores', 'tipografía',
    },
    'investigación': {
        'investigación', 'creación', 'curaduría', 'gestión cultural', 'comisariado', 'comisario'
        'teoría artística', 'historia del arte', 'mediación cultural', 'mediación', 'patrimonio',
        'conservación patrimonial', 'investigación-creación', 'multidisciplinar', 'restauración', 
        'restaurador', 'conservación', 'archivo', 'creación', 'crítica', 'ecología', 'feminismo',
        'cultura', 'curaduría', 'documentación', 'comunidad', 'público', 'audiencia'
    },
    'arquitectura': {
        'arquitectura', 'urbanismo', 'paisajismo', 'intervención urbana',
        'arte ambiental', 'diseño de espacios', 'multidisciplinar'
    }
}

MAIN_DISCIPLINES = [
    'visuales',
    'música',
    'video',
    'escénicas',
    'literatura',
    'diseño',
    'investigación',
    'arquitectura'
]

class RedisWrapper:
    def __init__(self, redis_client):
        self.redis_client = redis_client

    def setex(self, name, time, value):
        # Convert bytes to base64 string for JSON serialization
        if isinstance(value, bytes):
            value = {
                "_type": "bytes",
                "data": base64.b64encode(value).decode('utf-8')
            }
        return self.redis_client.set(name, json.dumps(value), ex=time)

    def get(self, name):
        # Retrieve and convert back from base64 if necessary
        value = self.redis_client.get(name)
        if value:
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict) and parsed.get("_type") == "bytes":
                    return base64.b64decode(parsed["data"].encode('utf-8'))
                return value
            except json.JSONDecodeError:
                return value
        return value

    def __getattr__(self, name):
        # Delegate other methods to the original Redis client
        return getattr(self.redis_client, name)

# Initialize Redis with Upstash credentials
try:
    original_redis = Redis(url=os.environ.get('KV_REST_API_URL'),
                           token=os.environ.get('KV_REST_API_TOKEN'))
    redis = RedisWrapper(original_redis)
    redis.set('test', 'test')  # Test connection
    print("Redis connection successful")
except Exception as e:
    print(f"Redis connection error: {str(e)}")
    redis = None  # Set to None so we can check if Redis is available

# Debug print to verify environment variable
secret_key = os.getenv("FLASK_SECRET_KEY")
print(f"Secret key exists: {bool(secret_key)}")

app = Flask(__name__, static_folder='../static', static_url_path='/static', template_folder='../templates')

# Set secret key first
app.secret_key = os.getenv("FLASK_SECRET_KEY", "default_fallback_secret_key")

# Determine if the app is in production
is_production = os.getenv("FLASK_ENV") == "production" or os.environ.get("RENDER") == "1"
app.logger.info(f"Is Production: {is_production}")

# Environment-specific configuration
if is_production:
    app.config.update(
        ENV="production",
        DEBUG=False,
        SESSION_COOKIE_SECURE=True  # Ensure cookies are sent over HTTPS in production
    )
    app.logger.info("Production environment configured.")
else:
    app.config.update(
        ENV="development",
        DEBUG=True,
        SESSION_COOKIE_SECURE=False
    )
    app.logger.info("Development environment configured.")

# Get the current domain from the request
def get_current_domain():
    if not is_production:
        return "localhost:5001"
    
    # For production, always use the main domain
    return "oportunidades.lat"

# Update URLs based on environment
if not is_production:
    AUTH0_CALLBACK_URL = "http://localhost:5001/callback"
    BASE_URL = "http://localhost:5001"
    SESSION_COOKIE_DOMAIN = None
    app.logger.info("Using development URLs")
else:
    current_domain = get_current_domain()
    AUTH0_CALLBACK_URL = f"https://{current_domain}/callback"
    BASE_URL = f"https://{current_domain}"
    SESSION_COOKIE_DOMAIN = current_domain
    app.logger.info(f"Using production URLs with domain: {current_domain}")

app.logger.info(f"Configured callback URL: {AUTH0_CALLBACK_URL}")

# Session configuration
app.config.update(
    SESSION_TYPE="redis",
    SESSION_REDIS=redis,
    SESSION_COOKIE_SECURE=True if is_production else False,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_DOMAIN=SESSION_COOKIE_DOMAIN,
    SESSION_USE_SIGNER=True,
    PERMANENT_SESSION_LIFETIME=timedelta(days=30)
)

# Mark all sessions as permanent and set cookie policy
@app.before_request
def before_request():
    session.permanent = True
    # In production, always use the main domain for cookies
    if is_production:
        session.cookie_domain = "oportunidades.lat"
        app.logger.info(f"Setting cookie domain to: {session.cookie_domain}")

# Initialize the Session extension
Session(app)

# Role-Base Access Mgmt
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "daleboquita")
jwt = JWTManager(app)

p = inflect.engine()


# Add this custom filter
@app.template_filter('is_today')
def is_today_filter(date_str):
    """Check if a date string matches today's date"""
    try:
        input_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        return input_date == datetime.today().date()
    except (ValueError, TypeError):
        return False

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            if "user" not in session:
                # Store the full URL of the current request
                current_url = request.url
                app.logger.info(f"Protected route accessed: {current_url}")
                app.logger.info(f"Redirecting to login with next={current_url}")
                return redirect(url_for("login", next=current_url))
            return f(*args, **kwargs)
        except RuntimeError as e:
            app.logger.error(f"Session error: {str(e)}")
            return redirect(url_for("login"))
    return decorated_function


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session or "Admin" not in session["user"].get(
            "https://127.0.0.1:5000/roles", []
        ):
            return redirect(url_for("login"))  # or some other unauthorized page
        return f(*args, **kwargs)
    return decorated_function

# Notion Integration
NOTION_TOKEN = "secret_IVjx7fzy1C08BK3tecE3utwikJte72Mmgwhd5mUtzWv"
DATABASE_ID = "b267157879d54cfc8f7106039d4ab221"
OPORTUNIDADES_ID = "24112623fb4546238a2d907b40f1c2b5"

headers = {
    "Authorization": "Bearer " + NOTION_TOKEN,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
}

# Auth0 Integration
AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID")
AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET")

# Update Auth0 configuration to fully use custom domain
if not is_production:
    # Development configuration remains the same
    AUTH0_CUSTOM_DOMAIN = "dev-3klm8ed6qtx4zj6v.us.auth0.com"
    AUTH0_TENANT_DOMAIN = "dev-3klm8ed6qtx4zj6v.us.auth0.com"
    app.logger.info(f"Using development Auth0 domain: {AUTH0_CUSTOM_DOMAIN}")
else:
    # Production configuration using custom domain
    AUTH0_CUSTOM_DOMAIN = "login.oportunidades.lat"
    AUTH0_TENANT_DOMAIN = AUTH0_CUSTOM_DOMAIN  # Use same domain for tenant
    app.logger.info(f"Using production Auth0 domain: {AUTH0_CUSTOM_DOMAIN}")

oauth = OAuth(app)

# Update all Auth0 endpoints to use custom domain
oauth.register(
    "auth0",
    client_id=AUTH0_CLIENT_ID,
    client_secret=AUTH0_CLIENT_SECRET,
    client_kwargs={
        "scope": "openid profile email",
        "response_type": "code"
    },
    api_base_url=f"https://{AUTH0_CUSTOM_DOMAIN}",
    access_token_url=f"https://{AUTH0_CUSTOM_DOMAIN}/oauth/token",
    authorize_url=f"https://{AUTH0_CUSTOM_DOMAIN}/authorize",
    server_metadata_url=f'https://{AUTH0_CUSTOM_DOMAIN}/.well-known/openid-configuration',
    audience=f"https://{AUTH0_CUSTOM_DOMAIN}/userinfo"  # Use custom domain for audience
)

@app.route("/login")
def login():
    app.logger.info(f"Auth0 Configuration:")
    app.logger.info(f"Custom Domain: {AUTH0_CUSTOM_DOMAIN}")
    app.logger.info(f"Callback URL configured: {AUTH0_CALLBACK_URL}")
    
    # Log all request args
    app.logger.info(f"Login request args: {request.args}")
    
    # Store the next URL in session
    next_url = request.args.get('next')
    app.logger.info(f"Next URL from request: {next_url}")
    
    if next_url:
        session['next_url'] = next_url
        app.logger.info(f"Stored next_url in session: {next_url}")
    
    # Generate and store state in session
    state = secrets.token_urlsafe(32)
    session['state'] = state
    session.modified = True
    
    app.logger.info(f"Session before redirect: {session}")
    
    # Check if user is first time visitor by looking up their preferences
    user_id = session.get('user', {}).get('sub')
    if user_id:
        has_preferences = check_user_preferences(user_id)
        if not has_preferences:
            session['needs_preferences'] = True
            session.modified = True
    
    return oauth.auth0.authorize_redirect(
        redirect_uri=AUTH0_CALLBACK_URL,
        state=state
    )

def safe_next_url(next_url):
    """Validate next URL to prevent open redirects"""
    if next_url and url_parse(next_url).netloc == '':
        return next_url
    return None

def check_user_preferences(user_id):
    """Check if user has any preferences stored"""
    url = f"https://api.notion.com/v1/databases/{OPORTUNIDADES_ID}/query"
    headers = {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }
    
    # Ensure we're using the full Auth0 user ID
    if not user_id.startswith('auth0|'):
        app.logger.warning(f"User ID {user_id} doesn't have Auth0 prefix")
        user_id = f"auth0|{user_id}"
    
    # Query for any preference entries
    json_body = {
        "filter": {
            "and": [
                {"property": "User ID", "title": {"equals": user_id}},
                {"property": "Opportunity ID", "rich_text": {"is_empty": True}},
                {"property": "Preferences", "rich_text": {"is_not_empty": True}}
            ]
        },
        "page_size": 1
    }
    
    try:
        app.logger.info(f"Checking preferences for Auth0 user {user_id}")
        app.logger.info(f"Query: {json.dumps(json_body, indent=2)}")
        
        response = requests.post(url, headers=headers, json=json_body)
        response.raise_for_status()
        data = response.json()
        
        has_preferences = len(data.get("results", [])) > 0
        app.logger.info(f"Auth0 user {user_id} has preferences: {has_preferences}")
        app.logger.debug(f"Query results: {json.dumps(data.get('results', []), indent=2)}")
        
        return has_preferences
    except Exception as e:
        app.logger.error(f"Error checking user preferences: {str(e)}")
        app.logger.error(f"Response content: {response.content if 'response' in locals() else 'No response'}")
        return False

@app.route("/callback", methods=["GET", "POST"])
def callback():
    try:
        app.logger.info("Starting callback processing")
        app.logger.info(f"Current environment: {'Production' if is_production else 'Development'}")
        app.logger.info(f"Configured AUTH0_CALLBACK_URL: {AUTH0_CALLBACK_URL}")
        app.logger.info(f"Request URL: {request.url}")
        app.logger.info(f"Session contents at callback start: {session}")
        app.logger.info(f"Request args: {request.args}")
        
        # Check for error in callback
        if 'error' in request.args:
            error_desc = request.args.get('error_description', 'Unknown error')
            app.logger.error(f"Auth0 callback error: {error_desc}")
            session.clear()
            return redirect(url_for("login"))
        
        # Verify state before proceeding
        request_state = request.args.get('state')
        session_state = session.get('state')
        
        if not session_state:
            app.logger.error("No state in session")
            return redirect(url_for("login"))
            
        if request_state != session_state:
            app.logger.error(f"State mismatch: {request_state} != {session_state}")
            return redirect(url_for("login"))
        
        app.logger.info("Getting access token...")
        token = oauth.auth0.authorize_access_token()
        session["jwt"] = token
        app.logger.info("Token obtained successfully")
        
        app.logger.info("Getting user info...")
        user_info_response = oauth.auth0.get("userinfo")
        user_info = user_info_response.json()
        session["user"] = user_info
        app.logger.info(f"User info stored in session: {user_info}")
        
        # Clear the state after successful verification
        session.pop('state', None)
        
        # Check if user has preferences
        user_id = user_info['sub']
        app.logger.info(f"Checking preferences for user: {user_id}")
        
        preferences = get_existing_preferences(user_id)
        app.logger.debug(f"Retrieved preferences: {preferences}")
        
        # Determine redirect target
        if not preferences.get('disciplines'):
            app.logger.info(f"User {user_id} needs preferences setup")
            target = url_for('mi_espacio', first_time=1)
        else:
            app.logger.info(f"User {user_id} has existing preferences")
            target = url_for('index')
        
        # Final redirect with proper session commit
        response = redirect(target)
        session.modified = True  # Force session save
        return response
        
    except Exception as e:
        app.logger.error(f"Error during callback processing: {str(e)}")
        app.logger.exception("Full traceback:")
        session.clear()
        return redirect(url_for("login"))


@app.route("/logout")
def logout():
    app.logger.info("Starting logout process")
    session.clear()
    
    # Use the Auth0 tenant domain instead of custom domain for logout
    auth0_logout_url = f"https://{AUTH0_TENANT_DOMAIN}/v2/logout?"
    
    params = urlencode(
        {
            "returnTo": "https://www.oportunidades.lat/",  # Direct URL instead of url_for
            "client_id": AUTH0_CLIENT_ID,
        },
        quote_via=quote_plus,
    )
    
    logout_url = auth0_logout_url + params
    app.logger.info(f"Redirecting to logout URL: {logout_url}")
    
    return redirect(logout_url)

# User Opportunities save

def save_to_notion(user_id, page_id):
    url = "https://api.notion.com/v1/pages"
    headers = {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }
    
    data = {
        "parent": {"database_id": OPORTUNIDADES_ID},
        "properties": {
            "User ID": {
                "title": [{"text": {"content": user_id}}]
            },
            "Opportunity ID": {
                "rich_text": [{"text": {"content": page_id}}]
            }
        }
    }
    
    app.logger.info(f"Saving opportunity {page_id} for user {user_id}")
    
    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        app.logger.info(f"Successfully saved opportunity {page_id}")
        return response.json()
    except Exception as e:
        app.logger.error(f"Error saving opportunity: {str(e)}")
        raise

@app.route("/save_user_opportunity", methods=["POST"])
@login_required
def save_user_opportunity():
    user_id = session["user"]["sub"]
    app.logger.info(f"Saving opportunities for user {user_id}")

    try:
        selected_pages = request.form.getlist("selected_pages")
        app.logger.info(f"Selected pages to save: {selected_pages}")

        if not selected_pages:
            app.logger.warning("No pages selected")
            return jsonify({"error": "No pages selected"}), 400

        saved_count = 0
        for page_id in selected_pages:
            try:
                if not is_opportunity_already_saved(user_id, page_id):
                    save_to_notion(user_id, page_id)
                    saved_count += 1
                    app.logger.info(f"Saved opportunity {page_id}")
                else:
                    app.logger.info(f"Opportunity {page_id} already saved")
            except Exception as e:
                app.logger.error(f"Error saving opportunity {page_id}: {str(e)}")

        success_message = f"""
        <div role="alert" class="flex items-center justify-center alert alert-success p-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
        """
        return success_message, 200

    except Exception as e:
        app.logger.error(f"Error in save_user_opportunity: {str(e)}")
        return jsonify({"error": str(e)}), 400

def fetch_opportunity_details(opportunity_id):
    return get_opportunity_by_id(opportunity_id)

@app.route("/saved_opportunities")
@login_required
def list_saved_opportunities():
    user_id = session["user"]["sub"]
    opportunity_ids = get_saved_opportunity_ids(user_id)
    opportunities = [get_opportunity_by_id(opp_id) for opp_id in opportunity_ids if opp_id]
    
    # Get closing_soon_pages from cached content
    cached_content = get_cached_database_content()
    closing_soon_pages = cached_content.get('closing_soon_pages', [])[:3] if cached_content else []

    return render_template(
        "user_opportunities.html",
        opportunities=opportunities,
        closing_soon_pages=closing_soon_pages
    )

def get_default_og_data():
    return {
        "title": "100 ︱ Oportunidades",
        "description": "Convocatorias, Becas y Recursos Globales para Artistas.",
        "url": request.url,
        "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
    }

def is_opportunity_already_saved(user_id, page_id):
    url = f"https://api.notion.com/v1/databases/{OPORTUNIDADES_ID}/query"
    headers = {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }
    json_body = {
        "filter": {
            "and": [
                {"property": "User ID", "title": {"equals": user_id}},
                {"property": "Opportunity ID", "rich_text": {"equals": page_id}},
            ]
        }
    }

    response = requests.post(url, headers=headers, json=json_body)
    response.raise_for_status()  # Raise an exception for HTTP errors
    data = response.json()

    return bool(data["results"])

def get_saved_opportunity_ids(user_id):
    app.logger.info(f"Fetching saved opportunities for user {user_id}")
    
    url = f"https://api.notion.com/v1/databases/{OPORTUNIDADES_ID}/query"
    headers = {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }
    json_body = {
        "filter": {
            "and": [
                {"property": "User ID", "title": {"equals": user_id}},
                {"property": "Opportunity ID", "rich_text": {"contains": ""}}
            ]
        }
    }

    try:
        response = requests.post(url, headers=headers, json=json_body)
        response.raise_for_status()
        data = response.json()
        
        opportunity_ids = []
        for result in data.get("results", []):
            try:
                opp_id = result["properties"]["Opportunity ID"]["rich_text"][0]["text"]["content"]
                if len(opp_id) == 36:  # Only add valid UUIDs
                    app.logger.info(f"Found valid opportunity ID: {opp_id}")
                    opportunity_ids.append(opp_id)
                else:
                    app.logger.warning(f"Skipping invalid opportunity ID: {opp_id}")
            except (KeyError, IndexError) as e:
                app.logger.error(f"Error extracting opportunity ID from result: {e}")
                continue

        return opportunity_ids
    except Exception as e:
        app.logger.error(f"Error fetching saved opportunities: {str(e)}")
        return []

def get_opportunity_by_id(opportunity_id):
    if not opportunity_id or not isinstance(opportunity_id, str) or len(opportunity_id) < 2:
        print(f"Invalid opportunity ID received: {opportunity_id}")
        return None

    url = f"https://api.notion.com/v1/pages/{opportunity_id}"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }

    print(f"Fetching opportunity details for ID: {opportunity_id}")
    response = requests.get(url, headers=headers)
    
    try:
        response.raise_for_status()
        data = response.json()
        
        opportunity = {
            "id": data["id"],
            "nombre": (
                data["properties"]["Nombre"]["title"][0]["text"]["content"]
                if data["properties"]["Nombre"]["title"]
                else ""
            ),
            "país": (
                data["properties"]["País"]["rich_text"][0]["text"]["content"]
                if data["properties"]["País"]["rich_text"]
                else ""
            ),
            "destinatarios": (
                data["properties"]["Destinatarios"]["rich_text"][0]["text"]["content"]
                if data["properties"]["Destinatarios"]["rich_text"]
                else ""
            ),
            "resumen_IA": (
                data["properties"]["Resumen generado por la IA"]["rich_text"][0]["text"]["content"]
                if data["properties"]["Resumen generado por la IA"]["rich_text"]
                else ""
            ),
            "url": (
                data["properties"]["URL"].get("url", "")
                if data["properties"]["URL"]
                else ""
            ),
            "base_url": (
                data["properties"]["Base URL"]["rich_text"][0]["text"]["content"]
                if data["properties"]["Base URL"]["rich_text"]
                else ""
            ),
            "ai_keywords": (
                data["properties"]["AI keywords"]["multi_select"][0]["name"]
                if data["properties"]["AI keywords"]["multi_select"]
                else ""
            ),
            "fecha_de_cierre": (
                data["properties"]["Fecha de cierre"]["date"]["start"]
                if data["properties"]["Fecha de cierre"]["date"]
                else ""
            ),
        }
        return opportunity
    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error fetching opportunity {opportunity_id}: {str(e)}")
        print(f"Response content: {response.text}")
        return None
    except Exception as e:
        print(f"Error processing opportunity {opportunity_id}: {str(e)}")
        return None

@app.route("/delete_opportunity/<page_id>", methods=["DELETE"])
@login_required
def delete_opportunity(page_id):
    """Delete a saved opportunity from user's space"""
    user_id = session["user"]["sub"]
    
    try:
        # Archive the page directly since we have its ID
        archive_url = f"https://api.notion.com/v1/pages/{page_id}"
        archive_data = {
            "archived": True
        }
        
        app.logger.debug(f"Archiving record {page_id}")
        archive_response = requests.patch(archive_url, headers=headers, json=archive_data)
        archive_response.raise_for_status()
        
        app.logger.debug(f"Archive response status: {archive_response.status_code}")
        
        # Return the updated list partial
        saved_opportunities = get_saved_opportunities(user_id)
        return render_template("_saved_opportunities_list.html", 
                             saved_opportunities=saved_opportunities)
        
    except Exception as e:
        app.logger.error(f"Error deleting opportunity: {str(e)}")
        app.logger.error(f"Response content: {archive_response.content if 'archive_response' in locals() else 'No response'}")
        return "Error deleting opportunity", 500


@app.route("/find_similar_opportunities")
def find_similar_opportunities():
    keyword = request.args.get("keyword", "").strip().lower()
    is_htmx = request.headers.get('HX-Request', 'false').lower() == 'true'

    similar_opportunities = []
    if keyword:
        all_pages = get_cached_database_content().get('pages', [])
        search_terms = [term.strip() for term in keyword.split(',')]
        
        similar_opportunities = [
            page for page in all_pages
            if any(
                term in page.get('disciplina', '').lower()
                for term in search_terms
            )
        ]

    if is_htmx:
        print("HTMX RESPONSE: Returning _search_results.html partial")
        return render_template("_search_results.html", pages=similar_opportunities)
    else:
        cached_content = get_cached_database_content()
        return render_template(
            "database.html",
            pages=similar_opportunities,
            closing_soon_pages=cached_content.get('cierran_pronto_pages', [])[:3],
            destacar_pages=cached_content.get('destacar_pages', []),
            search_term=keyword
        )

# Context

@app.context_processor
def inject_og_data():
    def get_og_data(title="100 ︱ Oportunidades", description="Convocatorias, Becas y Recursos Globales para Artistas.", url="http://oportunidades-vercel.vercel.app", image="http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"):
        return {
            "title": title,
            "description": description,
            "url": url,
            "image": image
        }
    return dict(get_og_data=get_og_data)

@app.context_processor
def inject_total_nuevas():
    try:
        total_nuevas = int(redis.get('total_nuevas') or 0)
    except:
        total_nuevas = 0
    return dict(total_nuevas=total_nuevas)

@app.route("/")
def index():
    try:
        cached_content = get_cached_database_content()
        if not cached_content:
            return render_template("error.html", 
                                message="No cached content available",
                                total_opportunities=0,
                                DISCIPLINE_GROUPS=DISCIPLINE_GROUPS,
                                og_data=get_default_og_data())

        pages = cached_content.get('pages', [])
        destacar_pages = cached_content.get('destacar_pages', [])
        
        # Check for user preferences
        user_prefs = set()
        if 'user' in session:
            preferences = get_existing_preferences(session["user"]["sub"])
            user_prefs = preferences.get('disciplines', set())
            app.logger.debug(f"Found user preferences: {user_prefs}")

            # Apply preference-based sorting if user has preferences
            if user_prefs:
                scored_pages = []
                for page in pages:
                    pref_score = calculate_preference_score(page, user_prefs)  # Fixed this line
                    scored_pages.append((pref_score, page))
                
                # Sort by preference score (descending) and then by closing date
                pages = [
                    page for _, page in sorted(
                        scored_pages,
                        key=lambda x: (-x[0], x[1].get('fecha_de_cierre', ''))
                    )
                ]
        
        # Pre-filter pages for each main discipline
        prefiltered_results = {}
        for main_discipline in DISCIPLINE_GROUPS.keys():
            scored_pages = []
            for page in pages:
                score = calculate_relevance_score(page, [main_discipline], DISCIPLINE_GROUPS)
                if score > 0:
                    scored_pages.append((score, page))
            
            prefiltered_results[main_discipline] = [
                page for score, page in sorted(
                    scored_pages,
                    key=lambda x: x[0],
                    reverse=True
                )
            ]

        month_mapping = {
            "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
            "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
            "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12
        }
        
        return render_template(
            "index.html",
            prefiltered_results=prefiltered_results,
            discipline_groups=DISCIPLINE_GROUPS,
            month_mapping=month_mapping,
            pages=pages,
            destacar_pages=destacar_pages,
            total_opportunities=len(pages),
            DISCIPLINE_GROUPS=DISCIPLINE_GROUPS,
            og_data=get_default_og_data()
        )
        
    except Exception as e:
        app.logger.error(f"Error in main index: {str(e)}")
        return render_template("error.html", 
                             message=str(e),
                             total_opportunities=0,
                             DISCIPLINE_GROUPS=DISCIPLINE_GROUPS,
                             og_data=get_default_og_data())

@app.route("/_legacy_admin")
def legacy_admin():
    print("Current Session Data at Legacy Admin:", session.get("user"))
    if "user" in session:
        user = session["user"]
        return render_template("index.html", user=user, pretty=json.dumps(user, indent=4))
    else:
        return render_template("index.html", user=None, pretty="No user data")

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

@app.route('/sitemap.xml', methods=['GET'])
def sitemap():
    pages = []
    seven_days_ago = (datetime.now() - timedelta(days=7)).date().isoformat()
    # Add static pages
    static_pages = [
        '/',
        '/database',
        '/user_opportunities',
    ]
    for page in static_pages:
        pages.append([page, seven_days_ago])

    # Add dynamic pages from your database or other sources here
    # Example: Assuming you have a database of blog posts
    # posts = Post.query.all()
    # for post in posts:
    #     url = f"/post/{post.slug}"
    #     lastmod = post.updated_at.date().isoformat()
    #     pages.append([url, lastmod])

    sitemap_xml = render_template('sitemap_template.xml', pages=pages)
    response = make_response(sitemap_xml)
    response.headers["Content-Type"] = "application/xml"
    return response

@app.route("/create", methods=["GET", "POST"])
@login_required
def handle_create():
    if request.method == "POST":
        # Handle form submission
        data = request.form.to_dict()
        required_fields = ["Nombre", "País", "URL", "Destinatarios"]
        if not data or any(field not in data for field in required_fields):
            return "Invalid data: all fields are required", 400

        # Assuming create_page returns a response or redirect
        response = create_page(data)
        return response

    # For GET request, just show the form
    return render_template("form.html", properties={}, page_id=None)

def create_page(data: dict):
    create_url = "https://api.notion.com/v1/pages"
    payload = {"parent": {"database_id": DATABASE_ID}, "properties": data}
    res = requests.post(create_url, headers=headers, json=payload)
    return res.text

@app.route("/share/<opportunity_id>")
def share_opportunity(opportunity_id):
    opportunity = get_opportunity_by_id(opportunity_id)
    og_data = {
        "title": opportunity["nombre"],
        "description": opportunity["resumen_IA"],
        "url": opportunity["url"],
        "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
    }
    return render_template("share.html", opportunity=opportunity, og_data=og_data)



@app.route("/database", methods=["GET", "POST"])
def all_pages():
    # Handle POST requests (for saving opportunities)
    if request.method == "POST":
        if not session.get('user'):
            return redirect(url_for('login', next=request.url))
        return redirect(url_for('all_pages'))

    # Get cached content and pages
    cached_content = get_cached_database_content()
    pages = cached_content.get('pages', []) if cached_content else []
    
    # Define HTMX and scroll variables early
    is_htmx = request.headers.get('HX-Request', 'false').lower() == 'true'
    scroll_id = request.args.get('scroll_id')
    
    # Define month mapping (keep this for filtering)
    month_mapping = {
        "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
        "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
        "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12
    }
    
    # Get month filter from request
    month_filter = request.args.get("month")
    
    # Original search implementation
    search_query = request.args.get("search", "").strip().lower()
    print(f"Search query: {search_query}")  # Debug print
    
    filtered_pages = []
    if search_query:
        # Normalize and split search terms
        search_terms = [
            normalize_discipline(term.strip())
            for term in search_query.split(',')
        ]
        
        # Score and filter pages
        scored_pages = []
        for page in pages:
            score = calculate_relevance_score(page, search_terms, DISCIPLINE_GROUPS)
            if score > 0:  # Only include pages with matches
                scored_pages.append((score, page))
        
        # Sort by score (descending) and extract just the pages
        filtered_pages = [
            page for score, page in sorted(
                scored_pages, 
                key=lambda x: x[0], 
                reverse=True
            )
        ]
        
        app.logger.debug(f"Found {len(filtered_pages)} relevant pages")
        
    else:
        filtered_pages = pages

    # Apply month filter if present (restore this functionality)
    if month_filter:
        try:
            month_number = int(month_filter)
            filtered_pages = [
                page for page in filtered_pages
                if page.get('fecha_de_cierre') 
                and page['fecha_de_cierre'] != '1900-01-01'
                and datetime.strptime(page['fecha_de_cierre'], '%Y-%m-%d').month == month_number
            ]
        except (ValueError, TypeError) as e:
            app.logger.error(f"Error filtering by month: {str(e)}")

    # Handle ALL HTMX requests first
    if is_htmx:
        print(f"HTMX: Returning {len(filtered_pages)} results")
        return render_template("_search_results.html", 
                            pages=filtered_pages,
                            no_results=not filtered_pages)

    # Optimized point: Cache discipline counts
    discipline_counts = get_discipline_counts()  # Ensure this uses Redis
    
    # Get discipline counts for sidebar/facets
    main_discipline_counts = {
        main: sum(
            count for disc, count in discipline_counts['main'].items()
            if disc in subs or disc == main
        )
        for main, subs in DISCIPLINE_GROUPS.items()
    }

    total_opportunities = len(filtered_pages)

    # Final return for full page requests
    return render_template(
        "database.html",
        pages=filtered_pages,
        closing_soon_pages=get_cached_database_content()['closing_soon_pages'][:7],
        destacar_pages=get_cached_database_content()['destacar_pages'],
        total_opportunities=total_opportunities,
        search_meta={
            'total_results': len(filtered_pages),
            'main_discipline_counts': main_discipline_counts,
            'original_search': search_query
        },
        og_data={
            "title": "100 ︱ Oportunidades",
            "description": "Convocatorias, Becas y Recursos Globales para Artistas.",
            "url": request.url,
            "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
        }
    )

# Custom Jinja2 filter for date
@app.template_filter('format_date')
def format_date(value):
    placeholder_date = '1900-01-01'
    if not value or value == placeholder_date:
        return 'Sin Cierre'
    try:
        date_obj = datetime.strptime(value, '%Y-%m-%d')
        return date_obj.strftime('%d/%m')
    except ValueError:
        return value  # Return the original value if it cannot be parsed

@app.route("/update/<page_id>", methods=["GET", "POST"])
@admin_required
def update_page(page_id):
    if request.method == "POST":
        # Update the page with the form data
        data = request.form.to_dict()

        # Prepare properties for the Notion API
        properties = {
            "Nombre": {"title": [{"text": {"content": data.get("name", "")}}]},
            "País": {"rich_text": [{"text": {"content": data.get("country", "")}}]},
            "URL": {"url": data.get("url", "")},
            "Destinatarios": {
                "rich_text": [{"text": {"content": data.get("recipients", "")}}]
            },
        }

        if "fecha_de_cierre" in data and data["fecha_de_cierre"]:
            properties["Fecha de cierre"] = {
                "date": {"start": data.get("fecha_de_cierre")}
            }

        update_url = f"https://api.notion.com/v1/pages/{page_id}"
        res = requests.patch(
            update_url, headers=headers, json={"properties": properties}
        )

        if res.status_code != 200:
            return "Failed to update page", 400

        # Fetch the updated data for the page
        url = f"https://api.notion.com/v1/pages/{page_id}"
        res = requests.get(url, headers=headers)
        page = res.json()

        # Extract the properties from the page
        properties = page["properties"]

        # Redirect to the form.html template with the updated properties
        return render_template("form.html", properties=properties, page_id=page_id)

    # Fetch the current data for the page
    url = f"https://api.notion.com/v1/pages/{page_id}"
    res = requests.get(url, headers=headers)
    page = res.json()

    # Extract the properties from the page
    properties = page["properties"]

    return render_template("form.html", properties=properties, page_id=page_id)

@app.route("/save", methods=["POST"])
@app.route("/save/<page_id>", methods=["POST"])
@admin_required
def save_page(page_id=None):
    data = request.form.to_dict()

    properties = {
        "Nombre": {"title": [{"text": {"content": data.get("name", "")}}]},
        "País": {"rich_text": [{"text": {"content": data.get("country", "")}}]},
        "URL": {"url": data.get("url", "")},
        "Destinatarios": {
            "rich_text": [{"text": {"content": data.get("recipients", "")}}]
        },
    }

    if "fecha_de_cierre" in data and data["fecha_de_cierre"]:
        properties["Fecha de cierre"] = {"date": {"start": data.get("fecha_de_cierre")}}

    headers = {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }

    if page_id:
        update_url = f"https://api.notion.com/v1/pages/{page_id}"
        response = requests.patch(
            update_url, headers=headers, json={"properties": properties}
        )
    else:
        create_url = "https://api.notion.com/v1/pages"
        parent = {"database_id": DATABASE_ID}
        response = requests.post(
            create_url,
            headers=headers,
            json={"parent": parent, "properties": properties},
        )

    if response.status_code not in [
        200,
        201,
    ]:  # 200 OK for update, 201 Created for create
        print(
            f"Failed to process page: {response.status_code}, {response.text}"
        )  # Debugging
        return "Failed to process page", 400

    # Redirect to the /database route to display all pages
    return redirect(url_for("all_pages"))

@app.route("/update_total_nuevas", methods=["GET"])
def update_total_nuevas():
    try:
        app.logger.info("Starting update_total_nuevas process")
        
        # Use the original page ID for the "Total" page
        page_id = "1519dd874b3a8033a633f021cec697ce"
        url = f"https://api.notion.com/v1/pages/{page_id}"
        headers = {
            "Authorization": "Bearer " + NOTION_TOKEN,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        }
        
        app.logger.info("Fetching data from Notion...")
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()

        # Log the full properties for debugging
        app.logger.debug(f"Notion API properties: {data['properties']}")

        # Extract the "Nueva Manual" value
        nueva_manual_value = data["properties"]["Nueva Manual"]["number"]
        if nueva_manual_value is None:
            app.logger.error("Nueva Manual returned None")
            return jsonify({
                "status": "error",
                "message": "Nueva Manual returned None"
            }), 400

        app.logger.info(f"Extracted nueva_manual_value: {nueva_manual_value}")

        # Store in Redis
        redis.set('total_nuevas', nueva_manual_value, ex=604500)
        app.logger.info(f"Stored in Redis: {nueva_manual_value}")

        return jsonify({
            "status": "success",
            "total_nuevas": nueva_manual_value,
            "message": "Total nuevas updated successfully"
        }), 200

    except Exception as e:
        error_message = f"Error updating total_nuevas: {str(e)}"
        app.logger.error(error_message)
        return jsonify({
            "status": "error",
            "error": error_message
        }), 500

def get_cached_database_content():
    cached = redis.get('database_content')
    if cached:
        data = json.loads(cached)
        # Return pre-filtered sections
        return {
            'pages': data['pages'],
            'closing_soon_pages': data['closing_soon_pages'],
            'destacar_pages': data['destacar_pages']
        }
    return None

@app.route("/refresh_database_cache", methods=["POST"])
def refresh_database_cache():
    if not redis:
        return jsonify({"status": "error", "message": "Redis not available"}), 500

    try:
        # Fetch all pages from Notion
        def fetch_notion_pages():
            url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
            headers = {
                "Authorization": "Bearer " + NOTION_TOKEN,
                "Content-Type": "application/json",
                "Notion-Version": "2022-06-28",
            }
            
            json_body = {
                "filter": {
                    "and": [
                        {"property": "Publicar", "checkbox": {"equals": True}},
                        {
                            "or": [
                                {"property": "Fecha de cierre", "date": {"is_empty": True}},
                                {"property": "Fecha de cierre", "date": {"on_or_after": datetime.now().strftime('%Y-%m-%d')}}
                            ]
                        }
                    ]
                },
                "page_size": 100
            }

            all_pages = []
            while True:
                response = requests.post(url, headers=headers, json=json_body)
                data = response.json()
                all_pages.extend(data.get("results", []))
                
                if not data.get("has_more"):
                    break
                    
                json_body["start_cursor"] = data.get("next_cursor")
            
            return all_pages

        all_pages = fetch_notion_pages()
        
        # Process pages using existing logic
        now_date = datetime.now()
        seven_days_from_now = now_date + timedelta(days=7)
        placeholder_date = '1900-01-01'

        closing_soon_pages = []
        pages = []
        destacar_pages = []

        for page in all_pages:
            try:
                if "Publicar" in page["properties"] and page["properties"]["Publicar"]["checkbox"]:
                    page_data = {"id": page["id"], "created_time": page["created_time"]}

                    # Add Og_Resumida to the page_data
                    if "Og_Resumida" in page["properties"]:
                        page_data["og_resumida"] = (
                            page["properties"]["Og_Resumida"]["rich_text"][0]["text"]["content"]
                            if page["properties"]["Og_Resumida"]["rich_text"]
                            else ""
                        )

                    if "Resumen generado por la IA" in page["properties"]:
                        page_data["nombre"] = (
                            page["properties"]["Resumen generado por la IA"]["rich_text"][0]["text"]["content"]
                            if page["properties"]["Resumen generado por la IA"]["rich_text"]
                            else ""
                        )

                    if "País" in page["properties"]:
                        page_data["país"] = (
                            page["properties"]["País"]["rich_text"][0]["text"]["content"]
                            if page["properties"]["País"]["rich_text"]
                            else ""
                        )

                    if "Destinatarios" in page["properties"]:
                        page_data["destinatarios"] = (
                            page["properties"]["Destinatarios"]["rich_text"][0]["text"]["content"]
                            if page["properties"]["Destinatarios"]["rich_text"]
                            else ""
                        )

                    if "AI keywords" in page["properties"]:
                        first_keyword_name = (
                            page["properties"]["AI keywords"]["multi_select"][0]["name"]
                            if page["properties"]["AI keywords"]["multi_select"]
                            else ""
                        )
                        # Split the keyword name and take the first word
                        page_data["ai_keywords"] = first_keyword_name.split()[0] if first_keyword_name else ""

                    if "URL" in page["properties"]:
                        page_data["url"] = (
                            page["properties"]["URL"]["url"]
                            if page["properties"]["URL"].get("url")
                            else ""
                        )

                    if "Base URL" in page["properties"]:
                        page_data["base_url"] = (
                            page["properties"]["Base URL"]["rich_text"][0]["text"]["content"]
                            if page["properties"]["Base URL"]["rich_text"]
                            else ""
                        )

                    if "Nombre" in page["properties"]:
                        page_data["nombre_original"] = (
                            page["properties"]["Nombre"]["title"][0]["text"]["content"]
                            if page["properties"]["Nombre"]["title"]
                            else ""
                        )

                    if "Entidad" in page["properties"]:
                        page_data["entidad"] = (
                            page["properties"]["Entidad"]["rich_text"][0]["text"]["content"]
                            if page["properties"]["Entidad"]["rich_text"]
                            else ""
                        )
                    
                    if "Categoría" in page["properties"]:
                        page_data["categoria"] = (
                            page["properties"]["Categoría"]["rich_text"][0]["text"]["content"]
                            if page["properties"]["Categoría"]["rich_text"]
                            else ""
                        )

                    if "Disciplina" in page["properties"]:
                        page_data["disciplina"] = (
                            page["properties"]["Disciplina"]["rich_text"][0]["text"]["content"]
                            if page["properties"]["Disciplina"]["rich_text"]
                            else ""
                        )
                        app.logger.info(f"Disciplina encontrada para {page_data.get('nombre', 'Unknown')}: {page_data['disciplina']}")

                    # Handle fecha_de_cierre
                    fecha_de_cierre_prop = page["properties"].get("Fecha de cierre", None)
                    fecha_de_cierre = None
                    if fecha_de_cierre_prop and "date" in fecha_de_cierre_prop and fecha_de_cierre_prop["date"]:
                        fecha_de_cierre = fecha_de_cierre_prop["date"].get("start", None)
                        page_data["fecha_de_cierre"] = fecha_de_cierre
                        cierre_date = datetime.strptime(fecha_de_cierre, '%Y-%m-%d')

                        if now_date <= cierre_date <= seven_days_from_now:
                            closing_soon_pages.append(page_data)
                    else:
                        page_data["fecha_de_cierre"] = placeholder_date

                    # Handle destacar pages
                    if page_data.get("destinatarios", "").lower() == "destacar":
                        if not fecha_de_cierre or cierre_date >= now_date:
                            destacar_pages.append(page_data)

                    # Extract base URL and URL from the already processed page_data
                    base_url = page_data.get("base_url", "")
                    url = page_data.get("url", "")

                    # Parse and extract the full domain (not just the subdomain)
                    def extract_domain(url_string):
                        if not url_string:
                            return ""
                        try:
                            parsed = urlparse(url_string)
                            # If the URL doesn't start with http/https, add it
                            if not parsed.netloc:
                                parsed = urlparse(f"https://{url_string}")
                            # Get the full domain (e.g., "arteinformado.com" or "argentina.gob.ar")
                            return parsed.netloc.replace('www.', '')
                        except Exception as e:
                            logging.error(f"Error parsing URL {url_string}: {e}")
                            return ""

                    base_url_domain = extract_domain(base_url)
                    url_domain = extract_domain(url)

                    # Use base_url_domain if available, otherwise fallback to url_domain
                    page_data["url_base"] = base_url_domain if base_url_domain else url_domain

                    # Log the extracted domains for debugging
                    logging.debug(f"Page: {page_data.get('nombre', 'Unknown')}, Base URL Domain: {base_url_domain}, URL Domain: {url_domain}")

                    pages.append(page_data)
            except KeyError as e:
                logging.error(f"Missing key in page data: {e}")
            except Exception as e:
                logging.error(f"Error processing page: {e}")

        # Sort pages
        sorted_pages = sorted(pages, key=lambda page: (
            page["fecha_de_cierre"] == placeholder_date,  # First sort by whether it's a placeholder date
            datetime.strptime(page["fecha_de_cierre"], '%Y-%m-%d') if page["fecha_de_cierre"] != placeholder_date else datetime.max,  # Then by closing date
            -datetime.fromisoformat(page["created_time"].replace('Z', '+00:00')).timestamp()  # Finally by creation time (newest first)
        ))

        # Store the processed data in Redis
        cache_data = {
            'pages': sorted_pages,
            'closing_soon_pages': closing_soon_pages[:7],
            'destacar_pages': destacar_pages,
            'timestamp': datetime.now().isoformat()
        }
        
        # Convert to JSON string
        cache_json = json.dumps(cache_data, ensure_ascii=False)
        
        # Store in Redis
        redis.set('database_content', cache_json, ex=604800)  # 7 days

        # Debug: Log the cached content
        cached_content = redis.get('database_content')
        if cached_content:
            if isinstance(cached_content, bytes):
                cached_content = cached_content.decode('utf-8')
            app.logger.debug("Cached Content: %s", cached_content)

        app.logger.info(f"Cache refreshed with {len(sorted_pages)} pages")
        return jsonify({
            "status": "success", 
            "message": f"Cache refreshed with {len(sorted_pages)} pages"
        }), 200
    except Exception as e:
        app.logger.error(f"Cache refresh error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/politica-privacidad")
def privacy_policy():
    return render_template("privacy_policy.html")

@app.route('/home')
def home():
    return render_template('home.html')

@app.context_processor
def utility_processor():
    def versioned_static(filename):
        return url_for('static', filename=filename, v=1.0)  # Incrementa este número cuando hagas cambios
    return dict(versioned_static=versioned_static)

@app.route('/proxy')
def proxy():
    url = request.args.get('url')
    if not url:
        return 'No URL provided', 400
    
    try:
        response = requests.get(url)
        return response.text
    except Exception as e:
        return str(e), 500

# Add this context processor to make function available in all templates
@app.context_processor
def inject_utilities():
    return {
        'get_discipline_counts': get_discipline_counts,
        'DISCIPLINE_GROUPS': DISCIPLINE_GROUPS
    }

# Update the get_discipline_counts function
def get_discipline_counts():
    cached_content = get_cached_database_content()
    if not cached_content:
        return {'main': {}, 'sub': {}}
    
    main_counts = defaultdict(int)
    sub_counts = defaultdict(int)
    
    for page in cached_content['pages']:
        raw_disciplines = page.get('disciplina', '')
        page_disciplines = set(
            normalize_discipline(d.strip())
            for d in raw_disciplines.split(',')
            if d.strip()
        )
        
        # Count subdisciplines
        for sub in page_disciplines:
            sub_counts[sub] += 1
        
        # Count main disciplines
        for main, subs in DISCIPLINE_GROUPS.items():
            normalized_subs = {normalize_discipline(s) for s in subs}
            if any(d in normalized_subs for d in page_disciplines):
                main_counts[main] += 1
                # Remove break to allow multidisciplinar in multiple categories
                # break

    return {
        'main': dict(main_counts),
        'sub': dict(sub_counts)
    }

# Add this normalization function if not already present
def normalize_discipline(text):
    return unicodedata.normalize('NFKD', text.lower()) \
        .encode('ASCII', 'ignore') \
        .decode('ASCII').strip()

@app.route("/filter_by_discipline/<discipline>")
def filter_by_discipline(discipline):
    try:
        is_clear = request.args.get("clear", "false").lower() == "true"
        is_htmx = request.headers.get('HX-Request', 'false').lower() == 'true'
        
        if is_clear:
            return redirect(url_for('all_pages', clear='true'))
            
        # Normalize the discipline parameter
        normalized_discipline = normalize_discipline(discipline)
        app.logger.debug(f"Normalized discipline: {normalized_discipline}")

        cached_content = get_cached_database_content()
        if not cached_content:
            app.logger.error("No cached content available")
            return render_template("_search_results.html", pages=[])

        pages = cached_content['pages']
        closing_soon_pages = cached_content['closing_soon_pages']
        destacar_pages = cached_content['destacar_pages']
        total_opportunities = len(pages)
        
        # Validate against normalized discipline names
        valid_disciplines = {
            normalize_discipline(d): d 
            for d in DISCIPLINE_GROUPS.keys()
        }
        
        if normalized_discipline not in valid_disciplines:
            app.logger.error(f"Invalid discipline: {discipline}")
            return render_template("_search_results.html", pages=[])

        # Get original casing for display
        original_discipline = valid_disciplines[normalized_discipline]
        subdisciplines = DISCIPLINE_GROUPS[original_discipline]

        # Score and filter pages
        scored_pages = []
        for page in pages:
            score = calculate_relevance_score(page, [original_discipline], DISCIPLINE_GROUPS)
            
            if score > 0:
                scored_pages.append((score, page))

        # Sort by score and extract pages
        filtered_pages = [
            page for score, page in sorted(
                scored_pages, 
                key=lambda x: x[0], 
                reverse=True
            )
        ]

        app.logger.debug(f"Found {len(filtered_pages)} matches for {original_discipline}")

        # Debug logging for top results
        if app.debug:
            for score, page in sorted(scored_pages, key=lambda x: x[0], reverse=True)[:5]:
                app.logger.debug(f"Score {score}: {page.get('nombre_original', '')}")

        # Prepare template context
        og_data = {
            "title": f"Oportunidades en {original_discipline.capitalize()}",
            "description": f"Convocatorias y becas relacionadas con {original_discipline}",
            "url": request.url,
            "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
        }

        if is_htmx:
            return render_template("_search_results.html", pages=filtered_pages)
        else:
            return render_template(
                "database.html",
                pages=filtered_pages,
                closing_soon_pages=closing_soon_pages,
                destacar_pages=destacar_pages,
                total_opportunities=total_opportunities,
                search_meta={
                    'total_results': len(filtered_pages),
                    'main_discipline_counts': get_discipline_counts()['main'],
                    'current_discipline': original_discipline
                },
                og_data=og_data
            )

    except Exception as e:
        app.logger.error(f"Discipline filter error: {str(e)}", exc_info=True)
        if is_htmx:
            return render_template("_search_results.html", pages=[])
        return render_template("error.html"), 500

@app.context_processor
def inject_discipline_data():
    return {
        'DISCIPLINE_GROUPS': DISCIPLINE_GROUPS,
        'main_discipline_counts': get_discipline_counts()['main']
    }

def normalize_text(text):
    """
    Normalize text by removing accents and converting to lowercase
    """
    return unicodedata.normalize('NFKD', str(text).lower()) \
        .encode('ASCII', 'ignore') \
        .decode('ASCII')

@app.context_processor
def inject_total_opportunities():
    def get_total_opportunities():
        cached_content = get_cached_database_content()
        if cached_content and 'pages' in cached_content:
            return len(cached_content['pages'])
        return 0
    
    return dict(total_opportunities=get_total_opportunities())

def calculate_relevance_score(page, search_terms, discipline_groups):
    """Calculate relevance score with field-specific weighting"""
    score = 0
    field_weights = {
        'disciplina': 4,        # ↑ From 2 → 4 (primary relevance signal)
        'og_resumida': 3,       # ↑ From 1 → 3 (rich secondary context)
        'resumen_generado_por_la_ia': 2,  # ↓ From 3 → 2 (contains redundant info)
        'nombre': 1,            # ↓ From 2 → 1 (English, less critical)
        'entidad': 1,
        'categoría': 1,
        'país': 1
    }

    # Normalize all page fields
    normalized_fields = {
        field: normalize_discipline(page.get(field, ''))
        for field in field_weights
    }

    # Check each search term against all fields
    for term in search_terms:
        normalized_term = normalize_discipline(term)
        
        # 1. Check discipline groups first
        if normalized_term in discipline_groups:
            page_disciplines = set(normalized_fields['disciplina'].split(','))
            group_keywords = discipline_groups[normalized_term]
            score += len(page_disciplines.intersection(group_keywords)) * 3
        
        # 2. Check weighted field matches
        for field, weight in field_weights.items():
            field_value = normalized_fields[field]
            if normalized_term in field_value:
                # Add bonus for exact match
                if normalized_term == field_value.strip():
                    score += weight * 2
                else:
                    score += weight

    return score

def normalize_discipline(text):
    """Normalize text for comparison: lowercase, remove accents/special chars"""
    if not text:
        return ''
    # Remove accents
    text = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8')
    # Remove special characters and extra spaces
    return re.sub(r'[^a-z0-9\s]', '', text.lower()).strip()

@app.route("/test-filters")
def test_filters():
    """Test page for client-side discipline filtering"""
    try:
        cached_content = get_cached_database_content()
        if not cached_content:
            return render_template("error.html", 
                                message="No cached content available",
                                total_opportunities=0,
                                DISCIPLINE_GROUPS=DISCIPLINE_GROUPS,
                                og_data=get_default_og_data())

        pages = cached_content.get('pages', [])
        
        # Pre-filter pages for each main discipline
        prefiltered_results = {}
        for main_discipline in DISCIPLINE_GROUPS.keys():
            scored_pages = []
            for page in pages:
                score = calculate_relevance_score(page, [main_discipline], DISCIPLINE_GROUPS)
                if score > 0:
                    scored_pages.append((score, page))
            
            prefiltered_results[main_discipline] = [
                page for score, page in sorted(
                    scored_pages,
                    key=lambda x: x[0],
                    reverse=True
                )
            ]

        month_mapping = {
            "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
            "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
            "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12
        }
        
        # Debug logging
        app.logger.info(f"Prefiltered results keys: {list(prefiltered_results.keys())}")
        app.logger.info(f"Sample discipline data: {list(prefiltered_results.values())[0][0] if prefiltered_results else 'None'}")
        app.logger.info(f"Total pages passed to template: {len(pages)}")
        
        return render_template(
            "test_filters.html",
            prefiltered_results=prefiltered_results,
            discipline_groups=DISCIPLINE_GROUPS,
            month_mapping=month_mapping,
            pages=pages,
            total_opportunities=len(pages),
            DISCIPLINE_GROUPS=DISCIPLINE_GROUPS,
            og_data=get_default_og_data()
        )
        
    except Exception as e:
        app.logger.error(f"Error in test-filters: {str(e)}")
        return render_template("error.html", 
                             message=str(e),
                             total_opportunities=0,
                             DISCIPLINE_GROUPS=DISCIPLINE_GROUPS,
                             og_data=get_default_og_data())

def get_saved_opportunities(user_id):
    """Get saved opportunities with specific fields for display"""
    try:
        url = f"https://api.notion.com/v1/databases/{OPORTUNIDADES_ID}/query"
        query = {
            "filter": {
                "and": [
                    {"property": "User ID", "title": {"equals": user_id}},
                    {"property": "Opportunity ID", "rich_text": {"is_not_empty": True}}
                ]
            }
        }
        
        response = requests.post(url, headers=headers, json=query)
        response.raise_for_status()
        saved_items = []
        
        for item in response.json().get("results", []):
            try:
                opp_id = item.get("properties", {}).get("Opportunity ID", {}).get("rich_text", [{}])[0].get("text", {}).get("content", "")
                if not opp_id:
                    continue
                
                # Fetch full opportunity details from main database
                opp_url = f"https://api.notion.com/v1/pages/{opp_id}"
                opp_response = requests.get(opp_url, headers=headers)
                opp_response.raise_for_status()
                opp_data = opp_response.json()
                
                # Get only the specific fields we need
                props = opp_data.get("properties", {})
                saved_items.append({
                    "id": item["id"],  # Save ID for deletion
                    "resumen_generado_por_la_ia": get_prop_value(props.get("Resumen generado por la IA", {})),
                    "categoría": get_prop_value(props.get("Categoría", {})),
                    "país": get_prop_value(props.get("País", {})),
                    "fecha_de_cierre": get_date_value(props.get("Fecha de cierre", {}))
                })
                
            except Exception as e:
                app.logger.error(f"Error processing opportunity {opp_id}: {str(e)}")
                continue
        
        app.logger.debug(f"Retrieved {len(saved_items)} saved opportunities")
        return saved_items
        
    except Exception as e:
        app.logger.error(f"Error getting saved opportunities: {str(e)}")
        return []

def parse_opportunity(page):
    """Parse Notion page into opportunity dict"""
    # Properties are now a dictionary in the response
    props = page.get("properties", {})
    
    return {
        "id": page["id"],  # Root level ID
        "nombre": get_prop_value(props.get("Nombre", {})),
        "resumen_IA": get_prop_value(props.get("Resumen generado por la IA", {})),
        "país": get_prop_value(props.get("País", {})),
        "ai_keywords": get_prop_value(props.get("AI keywords", {})),
        "fecha_de_cierre": get_date_value(props.get("Fecha de cierre", {})),
        "url": props.get("URL", {}).get("url", ""),
        "entidad": get_prop_value(props.get("Entidad", {}))
    }

def get_prop_value(prop):
    """Helper function to extract values from different property types"""
    prop_type = prop.get("type", "")
    
    if prop_type == "title":
        title_array = prop.get("title", [])
        return title_array[0].get("plain_text", "") if title_array else ""
    
    elif prop_type == "rich_text":
        rich_text_array = prop.get("rich_text", [])
        return rich_text_array[0].get("plain_text", "") if rich_text_array else ""
    
    elif prop_type == "multi_select":
        return [option.get("name", "") for option in prop.get("multi_select", [])]
    
    return ""

def get_date_value(prop):
    """Helper function to extract date values"""
    if prop.get("type") == "date":
        date_value = prop.get("date", {})
        return date_value.get("start", "") if date_value else ""
    return ""

@app.route("/mi_espacio", methods=["GET", "POST"])
@login_required
def mi_espacio():
    try:
        # Get user_id from sub field
        user_id = session["user"].get("sub")
        if not user_id:
            app.logger.error("No user sub in session")
            return redirect(url_for("login"))

        app.logger.debug(f"Processing mi_espacio for user: {user_id}")
        
        if request.method == "POST":
            disciplines = request.form.getlist('disciplines')
            email = request.form.get('email', '').strip()
            
            if not disciplines:
                flash("Debes seleccionar al menos una disciplina", "error")
                return redirect(url_for('mi_espacio'))
            
            save_user_preferences(user_id, disciplines, email)
            flash("Preferencias guardadas correctamente", "success")
            return redirect(url_for('index'))
            
        # GET request
        preferences = get_existing_preferences(user_id)
        app.logger.debug(f"Retrieved preferences for display: {preferences}")
        
        # Fetch saved opportunities
        saved_opportunities = get_saved_opportunities(user_id)
        app.logger.debug(f"Retrieved saved opportunities: {saved_opportunities}")
        
        return render_template(
            "mi_espacio.html",
            disciplines=MAIN_DISCIPLINES,
            selected_disciplines=preferences['disciplines'],
            existing_email=preferences['email'],
            saved_opportunities=saved_opportunities  # Add saved opportunities to template
        )

    except Exception as e:
        app.logger.error(f"mi_espacio error: {str(e)}")
        flash("Error al procesar tus preferencias", "error")
        return redirect(url_for('index'))

# Maintain existing preferences route
@app.route("/preferences", methods=["GET", "POST"])
@login_required
def preferences():
    return redirect(url_for("mi_espacio"))

# Maintain existing saved_opportunities route 
@app.route("/saved_opportunities")
@login_required
def saved_opportunities():
    return redirect(url_for("mi_espacio"))

def save_user_preferences(user_id, disciplines, email):
    """Save to OPORTUNIDADES_ID with proper Notion property formats"""
    try:
        page_id = get_existing_preferences_page_id(user_id)
        url = f"https://api.notion.com/v1/pages/{page_id}" if page_id else "https://api.notion.com/v1/pages"
        
        # Base properties structure
        data = {
            "parent": {"database_id": OPORTUNIDADES_ID},
            "properties": {
                "User ID": {
                    "title": [{"text": {"content": user_id}}]
                },
                "Preferences": {
                    "rich_text": [{"text": {"content": ", ".join(disciplines)}}]
                },
                "Contact Email": {
                    "email": email if email else None  # Must be null, not empty string
                },
                "Opportunity ID": {
                    "rich_text": []  # Empty array for no content
                }
            }
        }
        
        # If creating new page
        if not page_id:
            response = requests.post(url, headers=headers, json=data)
        # If updating existing page
        else:
            response = requests.patch(url, headers=headers, json=data)
            
        response.raise_for_status()
        app.logger.debug(f"Successfully saved preferences for user {user_id}")
        return response.json()
        
    except Exception as e:
        app.logger.error(f"Notion API Error: {response.status_code}")
        app.logger.error(f"Response body: {response.text}")
        raise Exception(f"Notion API Error: {response.text}")

import traceback  # Add this at the top with other imports

def get_existing_preferences(user_id):
    """Get preferences with normalized disciplines"""
    try:
        app.logger.debug(f"Querying preferences for user: {user_id}")
        url = f"https://api.notion.com/v1/databases/{OPORTUNIDADES_ID}/query"
        
        # Modified query to handle both ID formats
        query = {
            "filter": {
                "and": [
                    {
                        "or": [
                            {"property": "User ID", "title": {"equals": user_id}},
                            {"property": "User ID", "title": {"equals": f"auth0|{user_id}"}}
                        ]
                    },
                    {"property": "Opportunity ID", "rich_text": {"is_empty": True}}
                ]
            },
            "page_size": 1
        }
        
        app.logger.debug(f"Notion query: {json.dumps(query, indent=2)}")
        
        response = requests.post(url, headers=headers, json=query)
        response.raise_for_status()
        
        result = response.json().get("results", [])
        app.logger.debug(f"Raw API response: {json.dumps(result, indent=2)}")
        
        if not result:
            app.logger.info(f"No preferences found for user {user_id}")
            return {'disciplines': set(), 'email': ''}

        properties = result[0].get('properties', {})
        
        # Extract preferences with detailed logging
        preferences_prop = properties.get('Preferences', {})
        app.logger.debug(f"Raw preferences property: {json.dumps(preferences_prop, indent=2)}")
        
        raw_disciplines = ""
        if preferences_prop.get('rich_text'):
            if len(preferences_prop['rich_text']) > 0:
                raw_disciplines = preferences_prop['rich_text'][0].get('text', {}).get('content', '')
        
        email_prop = properties.get('Contact Email', {})
        raw_email = email_prop.get('email', '')
        
        normalized_disciplines = set()
        for d in raw_disciplines.split(','):
            cleaned = d.strip()
            if cleaned:
                normalized = normalize_discipline(cleaned)
                if normalized:
                    normalized_disciplines.add(normalized)
        
        app.logger.debug(f"Normalized preferences: {normalized_disciplines}")
        
        return {
            'disciplines': normalized_disciplines,
            'email': raw_email,
            'page_id': result[0]['id']
        }

    except Exception as e:
        app.logger.error(f"Error in get_existing_preferences: {str(e)}")
        app.logger.error(f"Traceback: {traceback.format_exc()}")
        return {'disciplines': set(), 'email': ''}
def get_existing_preferences_page_id(user_id):
    """Get existing preferences page ID with debug logging"""
    try:
        app.logger.debug(f"Querying preferences for user: {user_id}")
        url = f"https://api.notion.com/v1/databases/{OPORTUNIDADES_ID}/query"
        query = {
            "filter": {
                "and": [
                    {"property": "User ID", "title": {"equals": user_id}},
                    {"property": "Opportunity ID", "rich_text": {"is_empty": True}}
                ]
            },
            "page_size": 1
        }
        
        response = requests.post(url, headers=headers, json=query)
        response.raise_for_status()
        result = response.json().get("results", [])
        app.logger.debug(f"Query response: {json.dumps(result, indent=2)}")
        
        return result[0]["id"] if result else None
    except Exception as e:
        app.logger.error(f"Error fetching preferences page: {str(e)}")
        return None

def calculate_preference_score(page, user_preferences):
    """Calculate match score between opportunity and user preferences"""
    opportunity_disciplines = set(page.get('disciplina', '').lower().split(', '))
    preference_match = len(opportunity_disciplines & user_preferences)
    return min(preference_match * 2, 10)  # Boost matches with 2x weight, cap at 10



if __name__ == "__main__":
    # Ensure session directory exists
    os.makedirs(os.path.join(app.root_path, 'flask_session'), exist_ok=True)
    
    # Check if running in development or production
    if os.environ.get("RENDER") != "1":
        # Development server
        port = int(os.environ.get("PORT", 5001))
        app.run(host="0.0.0.0", port=port, debug=True)

