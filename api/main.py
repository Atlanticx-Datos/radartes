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

from flask_wtf.csrf import CSRFProtect

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


load_dotenv()

# Get the callback URL from environment variables
AUTH0_CALLBACK_URL = os.environ.get('AUTH0_CALLBACK_URL')

DISCIPLINE_GROUPS = {
    'Visuales': {
        'pintura', 'dibujo', 'grabado', 'escultura', 'fotografía', 'arte digital',
        'instalación', 'performance', 'visuales', 'artes visuales', 'arte contemporáneo',
        'arte urbano', 'street art', 'litografía', 'serigrafía', 'textiles'
    },
    'Música': {
        'música', 'composición', 'interpretación musical', 'dirección musical',
        'canto', 'ópera', 'jazz', 'música clásica', 'música contemporánea',
        'música experimental', 'sonido', 'arte sonoro'
    },
    'Escénicas': {
        'teatro', 'danza', 'circo', 'performance', 'artes vivas',
        'artes escénicas', 'dramaturgia', 'coreografía', 'dirección escénica'
    },
    'Literatura': {
        'literatura', 'poesía', 'narrativa', 'ensayo', 'escritura creativa',
        'novela', 'cuento', 'traducción', 'edición'
    },
    'Diseño': {
        'diseño', 'diseño gráfico', 'diseño industrial', 'diseño de producto',
        'diseño web', 'diseño digital', 'diseño editorial', 'diseño de moda',
        'diseño textil', 'ilustración', 'tipografía',
        # Former Arquitectura subdisciplines
        'arquitectura', 'urbanismo', 'paisajismo', 'diseño de interiores',
        'arquitectura efímera', 'diseño espacial'
    },
    'Cine': {
        'video', 'cine', 'audiovisual', 'documental', 'animación',
        'videojuegos', 'nuevos medios', 'multimedia', 'transmedia'
    },
    'Otras': {
        'multidisciplinar', 'investigación', 'beca', 'creación', 'curaduría', 
        'gestión cultural', 'comisariado', 'comisario', 'teoría', 'historia', 
        'mediación cultural', 'mediación', 'patrimonio', 'conservación', 
        'investigación-creación', 'restauración', 'restaurador', 'archivo', 
        'crítica', 'ecología', 'feminismo', 'cultura', 'documentación', 
        'comunidad', 'público', 'audiencia', 'pensamiento', 'medioambiente'
    }
}


MAIN_DISCIPLINES = [
    'visuales',
    'música',
    'escénicas',
    'cine',
    'literatura',
    'diseño',
    'otras'
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
    # Check if we're in development mode
    is_dev = os.getenv("FLASK_ENV") != "production" and os.environ.get("RENDER") != "1"
    
    # Skip Redis in development mode if environment variable is set
    if is_dev and os.environ.get("SKIP_REDIS", "false").lower() == "true":
        print("Skipping Redis in development mode")
        redis = None
    else:
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

# Initialize rate limiter
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri=os.environ.get("REDIS_URL", "memory://"),
)

# Determine if the app is in production
is_production = os.getenv("FLASK_ENV") == "production" or os.environ.get("RENDER") == "1"
app.logger.info(f"Is Production: {is_production}")

# Configure session depending on Redis availability
if redis is None:
    # Use filesystem session if Redis is not available
    app.config.update(
        SESSION_TYPE="filesystem",
        SESSION_FILE_DIR=os.path.join(os.getcwd(), "flask_session"),
        SESSION_PERMANENT=False,
        SESSION_USE_SIGNER=True,
    )
    if not os.path.exists(os.path.join(os.getcwd(), "flask_session")):
        os.makedirs(os.path.join(os.getcwd(), "flask_session"))
    app.logger.info("Using filesystem sessions (Redis not available)")
else:
    app.config.update(
        SESSION_TYPE="redis",
        SESSION_REDIS=redis,
        SESSION_PERMANENT=False,
        SESSION_USE_SIGNER=True,
    )
    app.logger.info("Using Redis sessions")

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

# Add to app configuration
app.config.update(
    WTF_CSRF_ENABLED=True,
    WTF_CSRF_CHECK_DEFAULT=True,
    WTF_CSRF_HEADERS=['X-CSRFToken'],
    WTF_CSRF_TIME_LIMIT=3600
)

# Get the current domain from the request
def get_current_domain():
    if not is_production:
        return "localhost:5001"
    
    # Check if the request is coming from a specific domain
    if request and request.headers.get('Host'):
        host = request.headers.get('Host')
        app.logger.info(f"Current request host: {host}")
        
        # List of supported domains
        supported_domains = ['oportunidades.lat', 'www.oportunidades.lat', 'radartes.org', 'www.radartes.org']
        
        # Extract the base domain from the host
        base_domain = host.split(':')[0]  # Remove port if present
        
        # If it's one of our supported domains, return it
        for domain in supported_domains:
            if base_domain == domain or base_domain.endswith('.' + domain):
                app.logger.info(f"Detected supported domain: {base_domain}")
                return base_domain
    
    # For production, default to radartes.org if unable to determine
    return "radartes.org"

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
    
    # Set the cookie domain based on the current domain
    if 'oportunidades.lat' in current_domain:
        SESSION_COOKIE_DOMAIN = ".oportunidades.lat"  # Allow oportunidades.lat subdomains
    else:
        SESSION_COOKIE_DOMAIN = ".radartes.org"  # Allow radartes.org subdomains
    
    app.logger.info(f"Using production URLs with domain: {current_domain}")
    app.logger.info(f"Using session cookie domain: {SESSION_COOKIE_DOMAIN}")

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
    if is_production:
        current_domain = get_current_domain()
        
        # Set cookie domain based on the current request
        if 'oportunidades.lat' in current_domain:
            session.cookie_domain = ".oportunidades.lat"
        else:
            session.cookie_domain = ".radartes.org"
            
        app.logger.info(f"Setting cookie domain to: {session.cookie_domain}")

# Initialize the Session extension
Session(app)

# Initialize after app creation
csrf = CSRFProtect(app)

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
        if "user" not in session:
            app.logger.info(f"No user in session, redirecting to login. Requested URL: {request.url}")
            
            if request.headers.get('HX-Request'):
                return """
                <script>
                    window.location.href = '/login';
                </script>
                """, 401
            
            # Store the full path (not just the URL) in the session
            session['next'] = request.path
            session.modified = True
            
            return redirect(url_for('login'))
        return f(*args, **kwargs)
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
    # Production configuration using custom domain from env
    # Use env variable or fallback to auth0 tenant domain
    AUTH0_TENANT_DOMAIN = os.environ.get("AUTH0_TENANT_DOMAIN", "dev-3klm8ed6qtx4zj6v.us.auth0.com")
    
    # For the custom domain, always use what's set in env
    AUTH0_CUSTOM_DOMAIN = os.environ.get("AUTH0_CUSTOM_DOMAIN")
    
    # If custom domain is not set, use the tenant domain
    if not AUTH0_CUSTOM_DOMAIN:
        AUTH0_CUSTOM_DOMAIN = AUTH0_TENANT_DOMAIN
        app.logger.warning(f"AUTH0_CUSTOM_DOMAIN not set, falling back to tenant domain: {AUTH0_CUSTOM_DOMAIN}")
    
    app.logger.info(f"Using production Auth0 domain: {AUTH0_CUSTOM_DOMAIN}")
    app.logger.info(f"Using Auth0 tenant domain: {AUTH0_TENANT_DOMAIN}")

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
    app.logger.info(f"Login route accessed. Session contents: {session}")
    app.logger.info(f"Current domain: {get_current_domain()}")
    app.logger.info(f"Callback URL: {AUTH0_CALLBACK_URL}")
    app.logger.info(f"Using Auth0 custom domain: {AUTH0_CUSTOM_DOMAIN}")
    app.logger.info(f"Request headers: {dict(request.headers)}")
    
    try:
        # Generate and store state in session
        state = secrets.token_urlsafe(32)
        session['state'] = state
        session.modified = True
        
        redirect_response = oauth.auth0.authorize_redirect(
            redirect_uri=AUTH0_CALLBACK_URL,
            state=state
        )
        app.logger.info(f"Auth0 redirect URL: {redirect_response.location}")
        return redirect_response
    except Exception as e:
        app.logger.error(f"Login error: {str(e)}")
        app.logger.error(f"Traceback: {traceback.format_exc()}")
        return render_template("error.html", error="Login service temporarily unavailable. Please try again later.")

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
        app.logger.info(f"Session contents at callback start: {session}")
        app.logger.info(f"Callback request args: {request.args}")
        app.logger.info(f"Current domain: {get_current_domain()}")
        app.logger.info(f"Using Auth0 custom domain: {AUTH0_CUSTOM_DOMAIN}")
        
        # Basic error handling
        if 'error' in request.args:
            error_msg = request.args.get('error_description', 'Unknown error')
            app.logger.error(f"Auth0 callback error: {error_msg}")
            flash(f"Login error: {error_msg}", "error")
            return redirect(url_for("login"))
        
        # State verification
        state_from_auth0 = request.args.get('state')
        state_from_session = session.get('state')
        app.logger.info(f"State from Auth0: {state_from_auth0}")
        app.logger.info(f"State from session: {state_from_session}")
        
        if state_from_auth0 != state_from_session:
            app.logger.error("State mismatch")
            flash("Authentication session expired. Please try again.", "error")
            return redirect(url_for("login"))
        
        # Get token and user info
        app.logger.info("Attempting to authorize access token...")
        token = oauth.auth0.authorize_access_token()
        app.logger.info("Access token authorized. Fetching user info...")
        user_info = oauth.auth0.get("userinfo").json()
        app.logger.info(f"User info retrieved: {json.dumps(user_info, default=str)}")
        
        # Store in session
        session["jwt"] = token
        session["user"] = user_info
        session.modified = True
        app.logger.info("Session updated with user data")
        
        # Get next URL from session
        next_url = session.pop('next', None)
        app.logger.info(f"Next URL from session: {next_url}")
        
        # Clear state
        session.pop('state', None)
        
        # Determine where to redirect
        if next_url:
            app.logger.info(f"Redirecting to stored URL: {next_url}")
            return redirect(next_url)
        else:
            app.logger.info("No stored URL, redirecting to index")
            return redirect(url_for('index'))
            
    except Exception as e:
        app.logger.error(f"Callback error: {str(e)}")
        app.logger.error(f"Full traceback: {traceback.format_exc()}")
        session.clear()
        flash("An error occurred during login. Please try again.", "error")
        return redirect(url_for("login"))


@app.route("/logout")
def logout():
    app.logger.info("Starting logout process")
    session.clear()
    
    # Use the Auth0 tenant domain instead of custom domain for logout
    auth0_logout_url = f"https://{AUTH0_TENANT_DOMAIN}/v2/logout?"
    
    # Get the current domain for returnTo URL
    current_domain = get_current_domain()
    
    # Check if the domain already has www prefix to avoid www.www.domain
    if current_domain.startswith('www.'):
        return_to_url = f"https://{current_domain}/"
    else:
        return_to_url = f"https://www.{current_domain}/"
    
    if current_domain == "localhost:5001":
        return_to_url = "http://localhost:5001/"
    
    app.logger.info(f"Logout returnTo URL: {return_to_url}")
    
    params = urlencode(
        {
            "returnTo": return_to_url,  # Dynamic URL based on current domain
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
    try:
        selected_pages = request.form.getlist('selected_pages')
        # Get user ID from Auth0 session structure
        user_id = session['user']['sub']  # Direct access without 'profile' key
        
        # Get existing saves using your existing pattern
        existing_ids = get_saved_opportunity_ids(user_id)
        
        # Save new opportunities
        new_saves = 0
        for page_id in selected_pages:
            if page_id not in existing_ids:
                save_to_notion(user_id, page_id)
                new_saves += 1

        # Add a small delay to ensure spinner is visible
        time.sleep(0.5)  # 500ms delay for better UX

        if new_saves == 0:
            return """
            <div class="flex items-center text-yellow-500">
                Already saved
            </div>
            """

        return """
        <div class="flex items-center text-green-500">
            Saved successfully
        </div>
        """
    except Exception as e:
        app.logger.error(f"Save error: {str(e)}", exc_info=True)
        return f"""
        <div class="text-red-500">
            Error: {str(e)}
        </div>
        """, 500

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
        "title": "Radartes",
        "description": "Convocatorias, Becas y Recursos Globales para Artistas.",
        "url": "https://radartes.org",
        "image": "https://radartes.org/static/public/nuevoLogo.png"
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
    """Get saved opportunity IDs for a user"""
    url = f"https://api.notion.com/v1/databases/{OPORTUNIDADES_ID}/query"
    
    # Define headers locally to avoid relying on global variable
    headers = {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }
    
    json_body = {
        "filter": {
            "and": [
                {"property": "User ID", "title": {"equals": user_id}},
                {"property": "Opportunity ID", "rich_text": {"is_not_empty": True}}
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
                if len(opp_id) == 36:  # UUID validation
                    opportunity_ids.append(opp_id)
            except (KeyError, IndexError):
                continue

        return set(opportunity_ids)
    except Exception as e:
        app.logger.error(f"Error fetching saved opportunities: {str(e)}")
        return set()

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
            "nombre_original": (  # Changed from 'nombre' to 'nombre_original'
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
            "top": (
                data["properties"]["Top"]["checkbox"]
                if data["properties"].get("Top")
                else False
            ),
            "inscripcion": (
                data["properties"]["Inscripcion"]["select"]["name"]
                if data["properties"].get("Inscripcion", {}).get("select")
                else ""
            ),
            "disciplina": (  # Added missing disciplina field
                data["properties"]["Disciplina"]["rich_text"][0]["text"]["content"]
                if data["properties"]["Disciplina"]["rich_text"]
                else ""
            ),
            "categoría": (  # Added missing categoría field
                data["properties"]["Categoría"]["rich_text"][0]["text"]["content"]
                if data["properties"]["Categoría"]["rich_text"]
                else ""
            )
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
        # First find the saved opportunity record
        url = f"https://api.notion.com/v1/databases/{OPORTUNIDADES_ID}/query"
        query = {
            "filter": {
                "and": [
                    {"property": "User ID", "title": {"equals": user_id}},
                    {"property": "Opportunity ID", "rich_text": {"equals": page_id}}
                ]
            }
        }
        
        response = requests.post(url, headers=headers, json=query)
        response.raise_for_status()
        results = response.json().get("results", [])
        
        if not results:
            app.logger.error(f"No saved opportunity found for user {user_id} and page {page_id}")
            return "Record not found", 404
            
        # Get the ID of the saved opportunity record
        saved_record_id = results[0]["id"]
        
        # Archive the saved opportunity record
        archive_url = f"https://api.notion.com/v1/pages/{saved_record_id}"
        archive_data = {
            "archived": True
        }
        
        app.logger.debug(f"Archiving saved opportunity record {saved_record_id}")
        archive_response = requests.patch(archive_url, headers=headers, json=archive_data)
        archive_response.raise_for_status()
        
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
    def get_og_data(title="Radartes", description="Convocatorias, Becas y Recursos Globales para Artistas.", url="https://radartes.org", image="https://radartes.org/static/public/nuevoLogo.png"):
        return {
            "title": title,
            "description": description,
            "url": url,
            "image": image
        }
    return {"og_data": get_og_data}

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
            app.logger.error("No cached content available")
            return render_template("error.html", 
                                message="No cached content available",
                                total_opportunities=0,
                                DISCIPLINE_GROUPS=DISCIPLINE_GROUPS,
                                og_data=get_default_og_data())

        pages = cached_content.get('pages', [])
        destacar_pages = cached_content.get('destacar_pages', [])
        
        # Add more detailed logging
        app.logger.info(f"Index route - Total pages: {len(pages)}")
        app.logger.info(f"Index route - Total destacar pages: {len(destacar_pages)}")
        
        if len(pages) > 0:
            app.logger.info(f"Index route - First page sample: {pages[0].get('nombre_original', 'No name')}")
        
        if len(destacar_pages) > 0:
            app.logger.info(f"Index route - First destacar page sample: {destacar_pages[0].get('nombre_original', 'No name')}")
        
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
                    pref_score = calculate_preference_score(page, user_prefs)
                    scored_pages.append((pref_score, page))
                
                # Sort by: 1) preference score (descending), 
                #         2) date (ascending, but 1900-01-01 at end)
                def sort_key(item):
                    score, page = item
                    date = page.get('fecha_de_cierre', '')
                    # Put 1900-01-01 dates at the end
                    if date == '1900-01-01':
                        date = '9999-12-31'  # Far future date to sort last
                    return (-score, date or '9999-12-31')  # Handle empty dates too
                
                pages = [page for _, page in sorted(scored_pages, key=sort_key)]
        
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
        
        # Add debug logging
        app.logger.debug(f"Destacar pages count: {len(destacar_pages)}")
        app.logger.debug(f"First destacar page: {destacar_pages[0] if destacar_pages else 'None'}")
        
        return render_template(
            "index.html",
            prefiltered_results=prefiltered_results,
            discipline_groups=DISCIPLINE_GROUPS,
            month_mapping=month_mapping,
            pages=pages,
            destacar_pages=destacar_pages,  # This is being passed correctly
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

@app.route("/share/<opportunity_id>")
def share_opportunity(opportunity_id):
    opportunity = get_opportunity_by_id(opportunity_id)
    og_data = {
        "title": opportunity["nombre_original"],
        "description": opportunity["resumen_IA"],
        "url": opportunity["url"],
        "image": "https://oportunidades.lat/static/public/dgpapng.png"
    }
    return render_template("share.html", opportunity=opportunity, og_data=og_data)

# Custom Jinja2 filter for date
@app.template_filter('format_date')
def format_date(value, date_format='%d/%m/%Y'):
    placeholder_date = '1900-01-01'
    app.logger.debug(f"format_date filter called with value: '{value}', type: {type(value)}")
    
    # Handle empty values or placeholder date
    if not value or value == placeholder_date or value == 'null' or value == 'undefined':
        app.logger.debug(f"format_date: Empty or placeholder date, returning 'Confirmar en bases'")
        return 'Confirmar en bases'
    
    # Handle already formatted dates (to avoid double formatting)
    if isinstance(value, str) and '/' in value and any(month in value for month in ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']):
        app.logger.debug(f"format_date: Already formatted date: '{value}', returning as is")
        return value
    
    try:
        # Try to parse the date in ISO format (YYYY-MM-DD)
        date_obj = datetime.strptime(value, '%Y-%m-%d')
        formatted = date_obj.strftime(date_format)  # Use the provided format
        app.logger.debug(f"format_date: Successfully formatted date to: '{formatted}'")
        return formatted
    except ValueError as e:
        app.logger.debug(f"format_date: ValueError: {e}, returning original value: '{value}'")
        
        # Try to parse the date in other formats
        try:
            # Try DD/MM/YYYY format
            if '/' in value:
                parts = value.split('/')
                if len(parts) == 3:
                    day, month, year = parts
                    date_obj = datetime.strptime(f"{year}-{month}-{day}", '%Y-%m-%d')
                    formatted = date_obj.strftime(date_format)
                    app.logger.debug(f"format_date: Successfully formatted DD/MM/YYYY date to: '{formatted}'")
                    return formatted
            
            # Try DD-MM-YYYY format
            if '-' in value and len(value.split('-')) == 3:
                day, month, year = value.split('-')
                if len(year) == 4:  # Ensure it's not YYYY-MM-DD
                    date_obj = datetime.strptime(f"{year}-{month}-{day}", '%Y-%m-%d')
                    formatted = date_obj.strftime(date_format)
                    app.logger.debug(f"format_date: Successfully formatted DD-MM-YYYY date to: '{formatted}'")
                    return formatted
        except ValueError:
            app.logger.debug(f"format_date: Failed to parse in alternative formats, returning original value: '{value}'")
        
        return value

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
    if redis is None:
        app.logger.warning("Redis is not available for caching")
        return None
        
    cached = redis.get('database_content')
    if cached:
        try:
            if isinstance(cached, bytes):
                cached = cached.decode('utf-8')
            
            data = json.loads(cached)
            
            # Add detailed logging
            app.logger.info(f"get_cached_database_content - Retrieved data from Redis")
            app.logger.info(f"get_cached_database_content - Pages count: {len(data.get('pages', []))}")
            app.logger.info(f"get_cached_database_content - Destacar pages count: {len(data.get('destacar_pages', []))}")
            app.logger.info(f"get_cached_database_content - Closing soon pages count: {len(data.get('closing_soon_pages', []))}")
            
            # Return pre-filtered sections
            return {
                'pages': data['pages'],
                'closing_soon_pages': data['closing_soon_pages'],
                'destacar_pages': data['destacar_pages']
            }
        except Exception as e:
            app.logger.error(f"Error parsing cached database content: {str(e)}")
            return None
    
    app.logger.error("No cached database content found in Redis")
    return None

@app.route("/refresh_database_cache", methods=["POST"])
@csrf.exempt
@limiter.limit("1/hour")  # Rate limit to prevent abuse
def refresh_database_cache():
    # Check for API key authentication
    api_key = request.headers.get('X-API-Key')
    expected_api_key = os.getenv('CACHE_REFRESH_API_KEY')
    
    # If API key is set in environment and doesn't match, return unauthorized
    if expected_api_key and api_key != expected_api_key:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    
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
            
            app.logger.debug("Starting Notion database query")
            
            try:
                response = requests.get(f"https://api.notion.com/v1/databases/{DATABASE_ID}", headers=headers)
                db_info = response.json()
                app.logger.debug(f"Database schema: {json.dumps(db_info.get('properties', {}), indent=2)}")
            except Exception as e:
                app.logger.error(f"Error fetching database schema: {str(e)}")

            json_body = {
                "filter": {
                    "and": [
                        {"property": "Publicar", "checkbox": {"equals": True}},
                        {
                            "or": [
                                {"property": "Fecha de cierre", "date": {"is_empty": True}},
                                {"property": "Fecha de cierre", "date": {"on_or_after": datetime.utcnow().strftime('%Y-%m-%d')}}
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
                
                # Log the first page's properties to check for Top
                try:
                    if 'results' not in data:
                        app.logger.error(f"No results in response: {json.dumps(data)}")
                        raise ValueError("No results in Notion API response")
                        
                    # Log details about the first page
                    if data['results']:
                        first_page = data['results'][0]
                        app.logger.debug(f"First page ID: {first_page.get('id')}")
                        app.logger.debug(f"First page properties keys: {list(first_page.get('properties', {}).keys())}")
                        
                        if 'Top' in first_page.get('properties', {}):
                            top_prop = first_page['properties']['Top']
                            app.logger.debug(f"Top property structure: {json.dumps(top_prop)}")
                            
                except Exception as e:
                    app.logger.error(f"Error processing Notion API response: {str(e)}")
                    raise
                
                all_pages.extend(data.get("results", []))
                
                if not data.get("has_more"):
                    break
                    
                json_body["start_cursor"] = data.get("next_cursor")
            
            return all_pages

        all_pages = fetch_notion_pages()
        
        # Process pages using existing logic
        now_date = datetime.utcnow()
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

                    # Add Top checkbox field
                    if "Top" in page["properties"]:
                        top_value = page["properties"]["Top"]["checkbox"] if page["properties"]["Top"] else False
                        page_data["top"] = top_value
                        app.logger.info(f"Top property for {page_data.get('nombre_original', 'Unknown')}: {top_value}")
                        app.logger.info(f"Top property type: {type(top_value).__name__}")
                        
                        # Log when a page has top=true
                        if top_value:
                            app.logger.info(f"Found page with top=true: {page_data.get('nombre_original', 'Unknown')}")
                            app.logger.info(f"Top property value: {page['properties']['Top']}")
                    else:
                        app.logger.debug(f"No Top property found for page: {page_data.get('nombre_original', 'Unknown')}")
                        page_data["top"] = False

                    # Add Inscripcion select field
                    if "Inscripcion" in page["properties"]:
                        page_data["inscripcion"] = (
                            page["properties"]["Inscripcion"]["select"]["name"]
                            if page["properties"]["Inscripcion"]["select"]
                            else ""
                        )

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

        # LIMIT destacar_pages to a maximum of 6
        destacar_pages = destacar_pages[:6]
        
        # Store the processed data in Redis
        cache_data = {
            'pages': sorted_pages,
            'closing_soon_pages': closing_soon_pages[:7],
            'destacar_pages': destacar_pages,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Count and log pages with top=true
        top_pages = [page for page in sorted_pages if page.get('top') == True]
        app.logger.info(f"Found {len(top_pages)} pages with top=true")
        if top_pages:
            app.logger.info(f"First top page: {top_pages[0].get('nombre_original', 'Unknown')}")
        
        # Convert to JSON string
        cache_json = json.dumps(cache_data, ensure_ascii=False)
        
        # Store in Redis
        redis.set('database_content', cache_json, ex=7776000)  # 3 months (90 days)

        # Debug: Log the cached content
        cached_content = redis.get('database_content')
        if cached_content:
            if isinstance(cached_content, bytes):
                cached_content = cached_content.decode('utf-8')
            app.logger.debug("Cached Content: %s", cached_content)

        app.logger.info(f"Cache refreshed with {len(sorted_pages)} pages")
        app.logger.info(f"API response - Total pages: {len(pages)}")
        return jsonify({
            "status": "success", 
            "message": f"Cache refreshed with {len(sorted_pages)} pages"
        }), 200
    except Exception as e:
        app.logger.error(f"Cache refresh error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/politica-privacidad")
def privacy_policy():
    return render_template("politica-privacidad.html")

@app.route("/sobre_nosotros")
def sobre_nosotros():
    return render_template("sobre_nosotros.html")

@app.context_processor
def utility_processor():
    def versioned_static(filename):
        return url_for('static', filename=filename, v=1.0)  # Incrementa este número cuando hagas cambios
    def template_normalize_discipline(text):
        """Template helper to normalize disciplines for comparison"""
        return normalize_discipline(text)
    return dict(
        versioned_static=versioned_static,
        normalize_discipline=template_normalize_discipline
    )
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
            "image": "https://radartes.org/static/public/nuevoLogo.png"
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
                if not opp_id or len(opp_id) != 36:  # Validate UUID length
                    app.logger.warning(f"Invalid opportunity ID: {opp_id}")
                    continue
                
                # Fetch full opportunity details from main database
                opp_url = f"https://api.notion.com/v1/pages/{opp_id}"
                opp_response = requests.get(opp_url, headers=headers)
                
                # Log response status and content for debugging
                app.logger.debug(f"Opportunity {opp_id} response status: {opp_response.status_code}")
                
                if opp_response.status_code != 200:
                    app.logger.warning(f"Could not fetch opportunity {opp_id}: {opp_response.status_code}")
                    app.logger.warning(f"Response content: {opp_response.text}")
                    continue
                
                opp_data = opp_response.json()
                if not opp_data:
                    app.logger.warning(f"Empty response data for opportunity {opp_id}")
                    continue
                    
                if "properties" not in opp_data:
                    app.logger.warning(f"No properties found in opportunity {opp_id}")
                    app.logger.debug(f"Response data: {json.dumps(opp_data, indent=2)}")
                    continue
                
                # Get all the fields we need to match the index display
                props = opp_data.get("properties", {})
                
                # Handle inscripcion field safely
                inscripcion_prop = props.get("Inscripcion", {})
                inscripcion_value = ""
                if inscripcion_prop and isinstance(inscripcion_prop, dict):
                    select_data = inscripcion_prop.get("select")
                    if select_data and isinstance(select_data, dict):
                        inscripcion_value = select_data.get("name", "")
                
                saved_items.append({
                    "id": opp_id,
                    "nombre_original": get_prop_value(props.get("Nombre", {})),
                    "og_resumida": get_prop_value(props.get("Og_Resumida", {})),
                    "disciplina": get_prop_value(props.get("Disciplina", {})),
                    "país": get_prop_value(props.get("País", {})),
                    "categoría": get_prop_value(props.get("Categoría", {})),
                    "fecha_de_cierre": get_date_value(props.get("Fecha de cierre", {})),
                    "url": props.get("URL", {}).get("url", ""),
                    "base_url": get_prop_value(props.get("Base URL", {})),
                    "inscripcion": inscripcion_value
                })
                
            except Exception as e:
                app.logger.error(f"Error processing opportunity {opp_id if 'opp_id' in locals() else 'unknown'}: {str(e)}")
                app.logger.error(f"Full error details: {traceback.format_exc()}")
                continue
        
        app.logger.debug(f"Retrieved {len(saved_items)} saved opportunities")
        return saved_items
        
    except Exception as e:
        app.logger.error(f"Error getting saved opportunities: {str(e)}")
        app.logger.error(f"Full error details: {traceback.format_exc()}")
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
        "entidad": get_prop_value(props.get("Entidad", {})),
        "top": props.get("Top", {}).get("checkbox", False),
        "inscripcion": props.get("Inscripcion", {}).get("select", {}).get("name", "")
    }

def get_prop_value(prop):
    """Helper function to extract values from different property types"""
    if not prop:
        return ""
        
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
            suscripcion = request.form.get('suscripcion')
            action_type = request.form.get('action_type', 'save_preferences')
            
            # Get existing preferences to preserve data if needed
            existing_preferences = get_existing_preferences(user_id)
            
            # Handle "Ninguna" option - clear disciplines but preserve email
            if "ninguna" in disciplines:
                disciplines = []  # Clear all disciplines
            
            # Only require disciplines when saving preferences (not for subscription)
            # And don't require them if "Ninguna" was selected
            if not disciplines and action_type == 'save_preferences' and "ninguna" not in request.form.getlist('disciplines'):
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({"error": "Debes seleccionar al menos una disciplina"}), 400
                flash("Debes seleccionar al menos una disciplina", "error")
                return redirect(url_for('mi_espacio'))
            
            # For subscription action, ensure we have an email
            if action_type == 'subscribe' and not email:
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({"error": "Debes ingresar un correo electrónico"}), 400
                flash("Debes ingresar un correo electrónico", "error")
                return redirect(url_for('mi_espacio'))
            
            # If it's a subscription action but no disciplines selected, use existing ones
            if action_type == 'subscribe' and not disciplines:
                # Get existing disciplines if available (don't overwrite with empty)
                existing_disciplines = list(existing_preferences.get('disciplines', set()))
                # If the user doesn't have disciplines and this is just a newsletter subscription
                # use the special newsletter_subscriber value
                disciplines = existing_disciplines if existing_disciplines else ["newsletter_subscriber"]
            
            # If no email provided but there is an existing one, preserve it
            if not email and existing_preferences.get('email'):
                email = existing_preferences.get('email')
            
            # Save the user preferences
            save_user_preferences(user_id, disciplines, email, suscripcion)
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                # For AJAX requests, fetch the updated preferences to return accurate data
                updated_preferences = get_existing_preferences(user_id)
                return jsonify({
                    "success": True,
                    "email": updated_preferences.get('email', email),
                    "redirect": url_for('index')
                })
            
            flash("Preferencias guardadas correctamente", "success")
            return redirect(url_for('mi_espacio'))  # Redirect back to mi_espacio to see changes
            
        # GET request
        preferences = get_existing_preferences(user_id)
        app.logger.debug(f"Retrieved preferences for display: {preferences}")
        
        saved_opportunities = get_saved_opportunities(user_id)
        app.logger.debug(f"Retrieved saved opportunities: {saved_opportunities}")
        
        # Log the email we're going to display
        app.logger.debug(f"Displaying email: {preferences.get('email', '')}")
        
        return render_template(
            "mi_espacio.html",
            disciplines=MAIN_DISCIPLINES,
            selected_disciplines=list(preferences.get('disciplines', set())),
            existing_email=preferences.get('email', ''),
            suscripcion=preferences.get('suscripcion', 'Quincenal'),
            saved_opportunities=saved_opportunities,
            user_name=session["user"].get("name")
        )

    except Exception as e:
        app.logger.error(f"mi_espacio error: {str(e)}")
        app.logger.exception("Full traceback:")
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({"error": str(e)}), 500
            
        flash("Error al cargar tu espacio personal. Por favor intenta nuevamente.", "error")
        return render_template(
            "mi_espacio.html",
            disciplines=MAIN_DISCIPLINES,
            selected_disciplines=[],
            existing_email='',
            suscripcion='Quincenal',
            saved_opportunities=[]
        )

def save_user_preferences(user_id, disciplines, email, suscripcion=None):
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
        
        # Add subscription frequency if provided and email exists
        if email and suscripcion:
            data["properties"]["Suscripcion"] = {
                "rich_text": [{"text": {"content": suscripcion}}]
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
        
        # Query for user preferences, including newsletter subscribers
        # Remove the filter for "newsletter_subscriber" to retrieve all user records
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
            return {'disciplines': set(), 'email': '', 'suscripcion': 'Quincenal'}

        properties = result[0].get('properties', {})
        
        # Extract preferences with detailed logging
        preferences_prop = properties.get('Preferences', {})
        app.logger.debug(f"Raw preferences property: {json.dumps(preferences_prop, indent=2)}")
        
        raw_disciplines = ""
        if preferences_prop.get('rich_text'):
            if len(preferences_prop['rich_text']) > 0:
                raw_disciplines = preferences_prop['rich_text'][0].get('text', {}).get('content', '')
        
        # Get email - we always return this regardless of discipline preferences
        email_prop = properties.get('Contact Email', {})
        raw_email = email_prop.get('email', '')
        
        # Extract subscription frequency
        suscripcion_prop = properties.get('Suscripcion', {})
        raw_suscripcion = ''
        if suscripcion_prop.get('rich_text'):
            if len(suscripcion_prop['rich_text']) > 0:
                raw_suscripcion = suscripcion_prop['rich_text'][0].get('text', {}).get('content', '')
        
        # Default to Quincenal if not specified
        if not raw_suscripcion:
            raw_suscripcion = 'Quincenal'
        
        normalized_disciplines = set()
        # Only process disciplines if it's not a newsletter-only subscription
        if raw_disciplines and raw_disciplines != "newsletter_subscriber":
            for d in raw_disciplines.split(','):
                cleaned = d.strip()
                if cleaned:
                    normalized = normalize_discipline(cleaned)
                    if normalized:
                        normalized_disciplines.add(normalized)
        
        app.logger.debug(f"Normalized preferences: {normalized_disciplines}")
        app.logger.debug(f"Retrieved email: {raw_email}")
        app.logger.debug(f"Subscription type: {raw_suscripcion}")
        
        return {
            'disciplines': normalized_disciplines,
            'email': raw_email,
            'suscripcion': raw_suscripcion,
            'page_id': result[0]['id'],
            'is_newsletter_only': raw_disciplines == "newsletter_subscriber"
        }

    except Exception as e:
        app.logger.error(f"Error in get_existing_preferences: {str(e)}")
        app.logger.error(f"Traceback: {traceback.format_exc()}")
        return {'disciplines': set(), 'email': '', 'suscripcion': 'Quincenal'}

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
    score = 0
    page_disciplines = set(d.strip() for d in page.get('disciplina', '').split(',') if d.strip())
    
    # Normalize page disciplines
    normalized_page_disciplines = {normalize_discipline(d) for d in page_disciplines}
    
    # For each user preference, check both direct matches and group membership
    for pref in user_preferences:
        # Check if preference is a main discipline
        if pref in DISCIPLINE_GROUPS:
            # If it's a main discipline, check if any page discipline belongs to its group
            group_keywords = {normalize_discipline(k) for k in DISCIPLINE_GROUPS[pref]}
            matches = len(normalized_page_disciplines.intersection(group_keywords))
            if matches > 0:
                score += matches * 3  # Higher weight for group matches
        
        # Also check for direct matches
        if pref in normalized_page_disciplines:
            score += 2  # Direct match bonus
    
    return min(score, 10)  # Cap at 10 to avoid extreme scores

@app.route("/save_from_modal", methods=["POST"])
@login_required
def save_from_modal():
    try:
        app.logger.debug(f"Request headers: {dict(request.headers)}")
        app.logger.debug(f"Request form data: {request.form}")
        app.logger.debug(f"Session data: {dict(session)}")
        
        user_id = session["user"]["sub"]
        page_id = request.form.get("page_id")
        app.logger.info(f"Attempting save - User: {user_id}, Page: {page_id}")

        if not page_id:
            app.logger.warning("No page ID provided")
            return jsonify({"error": "Missing opportunity ID"}), 400

        if not is_opportunity_already_saved(user_id, page_id):
            save_to_notion(user_id, page_id)
            app.logger.info(f"Saved opportunity {page_id} from modal")
            success_message = """
            <div role="alert" class="flex items-center justify-center alert alert-success p-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            """
            return success_message, 200
        else:
            app.logger.info(f"Opportunity {page_id} already saved")
            return jsonify({"info": "Opportunity already saved"}), 200

    except Exception as e:
        app.logger.error(f"Error in save_from_modal: {str(e)}")
        return jsonify({"error": str(e)}), 400

@app.route("/is_opportunity_saved", methods=["GET"])
@login_required
def is_opportunity_saved():
    try:
        user_id = session["user"]["sub"]
        page_id = request.args.get("page_id")
        
        if not page_id:
            return jsonify({"error": "Missing opportunity ID"}), 400
        
        # Define headers here to avoid relying on global variable    
        headers = {
            "Authorization": "Bearer " + NOTION_TOKEN,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        }
        
        # Query Notion directly here instead of calling is_opportunity_already_saved
        url = f"https://api.notion.com/v1/databases/{OPORTUNIDADES_ID}/query"
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
        
        return jsonify({"is_saved": bool(data["results"])}), 200
        
    except Exception as e:
        app.logger.error(f"Error in is_opportunity_saved: {str(e)}")
        return jsonify({"error": str(e)}), 400

@app.route("/subscribe", methods=["POST"])
def subscribe():
    try:
        data = request.get_json() if request.is_json else None
        
        if data:
            # Handle JSON request (API)
            email = data.get('email')
            suscripcion = data.get('suscripcion', 'Quincenal')
        else:
            # Handle form submission
            email = request.form.get('email')
            suscripcion = request.form.get('suscripcion', 'Quincenal')
        
        if not email:
            if request.is_json:
                return jsonify({"error": "Email is required"}), 400
            flash("El email es requerido", "error")
            return redirect(url_for('mi_espacio'))

        # Check if email already exists in database
        url = f"https://api.notion.com/v1/databases/{OPORTUNIDADES_ID}/query"
        query = {
            "filter": {
                "and": [
                    {
                        "property": "Contact Email",
                        "email": {"equals": email}
                    },
                    {
                        "property": "Preferences",
                        "rich_text": {"contains": "newsletter_subscriber"}
                    }
                ]
            }
        }
        
        response = requests.post(url, headers=headers, json=query)
        if response.status_code != 200:
            app.logger.error(f"Notion API Error during email check: {response.text}")
            if request.is_json:
                return jsonify({"error": "Failed to check subscription status"}), 500
            flash("Error al verificar el estado de suscripción", "error")
            return redirect(url_for('mi_espacio'))

        existing_subscription = response.json().get("results", [])
        
        if existing_subscription:
            # Email already subscribed, update subscription frequency
            page_id = existing_subscription[0]['id']
            url = f"https://api.notion.com/v1/pages/{page_id}"
            payload = {
                "properties": {
                    "Suscripcion": {
                        "rich_text": [{"text": {"content": suscripcion}}]
                    }
                }
            }
            
            response = requests.patch(url, headers=headers, json=payload)
            if response.status_code != 200:
                app.logger.error(f"Notion API Error updating subscription: {response.text}")
                if request.is_json:
                    return jsonify({"error": "Failed to update subscription"}), 500
                flash("Error al actualizar la suscripción", "error")
                return redirect(url_for('mi_espacio'))
                
            # Email already subscribed
            app.logger.info(f"Email {email} already subscribed, updated frequency to {suscripcion}")
            if request.is_json:
                return jsonify({
                    "message": "Suscripción actualizada correctamente",
                    "email": email,
                    "already_subscribed": True
                }), 200
            flash("Suscripción actualizada correctamente", "success")
            return redirect(url_for('mi_espacio'))

        # If we get here, email is not subscribed yet
        user_id = session.get('user', {}).get('sub')
        
        if user_id:
            # Check if user already has preferences
            existing_prefs = get_existing_preferences(user_id)
            if existing_prefs.get('page_id'):
                # Update existing preferences
                url = f"https://api.notion.com/v1/pages/{existing_prefs['page_id']}"
                payload = {
                    "properties": {
                        "Contact Email": {
                            "email": email
                        },
                        "Preferences": {
                            "rich_text": [{"text": {"content": "newsletter_subscriber"}}]
                        },
                        "Suscripcion": {
                            "rich_text": [{"text": {"content": suscripcion}}]
                        }
                    }
                }
                method = "PATCH"
            else:
                # Create new preferences
                url = "https://api.notion.com/v1/pages"
                payload = {
                    "parent": {"database_id": OPORTUNIDADES_ID},
                    "properties": {
                        "User ID": {
                            "title": [{"text": {"content": user_id}}]
                        },
                        "Contact Email": {
                            "email": email
                        },
                        "Opportunity ID": {
                            "rich_text": []
                        },
                        "Preferences": {
                            "rich_text": [{"text": {"content": "newsletter_subscriber"}}]
                        },
                        "Suscripcion": {
                            "rich_text": [{"text": {"content": suscripcion}}]
                        }
                    }
                }
                method = "POST"
        else:
            # Handle anonymous subscription
            anonymous_id = f"anon_{secrets.token_hex(8)}"
            url = "https://api.notion.com/v1/pages"
            payload = {
                "parent": {"database_id": OPORTUNIDADES_ID},
                "properties": {
                    "User ID": {
                        "title": [{"text": {"content": anonymous_id}}]
                    },
                    "Contact Email": {
                        "email": email
                    },
                    "Opportunity ID": {
                        "rich_text": []
                    },
                    "Preferences": {
                        "rich_text": [{"text": {"content": "newsletter_subscriber"}}]
                    },
                    "Suscripcion": {
                        "rich_text": [{"text": {"content": suscripcion}}]
                    }
                }
            }
            method = "POST"

        response = requests.request(
            method,
            url,
            headers=headers,
            json=payload
        )
        
        if response.status_code not in [200, 201]:
            app.logger.error(f"Notion API Error: {response.text}")
            if request.is_json:
                return jsonify({"error": "Failed to save subscription"}), 500
            flash("Error al guardar la suscripción", "error")
            return redirect(url_for('mi_espacio'))
            
        app.logger.info(f"Successfully subscribed {email} with frequency {suscripcion}")
        
        if request.is_json:
            return jsonify({
                "message": "Suscripción exitosa",
                "email": email
            }), 201
        
        flash("Te has suscrito exitosamente al newsletter", "success")
        return redirect(url_for('mi_espacio'))
        
    except Exception as e:
        app.logger.error(f"Subscribe error: {str(e)}")
        if request.is_json:
            return jsonify({"error": str(e)}), 500
        flash("Error al procesar la suscripción", "error")
        return redirect(url_for('mi_espacio'))

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(e):
    return render_template('500.html'), 500

@app.errorhandler(Exception)
def handle_exception(e):
    # For any other exception, use the generic error template
    return render_template('error.html', 
                          code=500, 
                          message="Error Inesperado", 
                          description="Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo más tarde."), 500

@app.route("/debug/destacar")
def debug_destacar():
    try:
        cached_content = get_cached_database_content()
        if not cached_content:
            return jsonify({"error": "No cached content available"})
        
        destacar_pages = cached_content.get('destacar_pages', [])
        return jsonify({
            "count": len(destacar_pages),
            "data": destacar_pages,
            "cache_timestamp": cached_content.get('timestamp', 'unknown')
        })
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/terminos")
def terminos():
    return render_template("terminos.html")

@app.route("/privacidad")
def privacidad():
    return render_template("privacidad.html")

if __name__ == "__main__":
    # Ensure session directory exists
    os.makedirs(os.path.join(app.root_path, 'flask_session'), exist_ok=True)
    
    # Check if running in development or production
    if os.environ.get("RENDER") != "1":
        # Development server
        port = int(os.environ.get("PORT", 5001))
        app.run(host="0.0.0.0", port=port, debug=True)

if not is_production:
    @app.after_request
    def add_cors_headers(response):
        response.headers['Access-Control-Allow-Origin'] = 'http://localhost:5001'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'HX-Request, Content-Type'
        return response

@app.after_request
def add_cors_headers(response):
    if is_production:
        response.headers['Access-Control-Allow-Origin'] = 'https://oportunidades.lat'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

