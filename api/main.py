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

from flask_caching import Cache

import logging
import secrets

from urllib.parse import urlparse

from flask_session import Session

import base64
import json
from collections import defaultdict


load_dotenv()

# Get the callback URL from environment variables
AUTH0_CALLBACK_URL = os.environ.get('AUTH0_CALLBACK_URL')

DISCIPLINE_GROUPS = {
    'visuales': {
        'pintura', 'escultura', 'cerámica', 'dibujo', 'instalación', 'fotografía',
        'artes visuales', 'visuales', 'grabado', 'arte plástica', 'muralismo',
        'arte urbano', 'arte público', 'nuevos medios', 'arte digital', 'ilustración'
    },
    'música': {
        'música', 'composición', 'piano', 'guitarra', 'vientos', 'electrónica',
        'coral', 'arte sonoro', 'instrumentos', 'multidisciplinar'
    },
    'video': {
        'videoarte', 'cine', 'documental', 'cortos', 'animación', 'cortometrajes',
        'artes audiovisuales', 'multidisciplinar'
    },
    'escénicas': {
        'teatro', 'danza', 'performance', 'circo', 'coreografía', 'artes escénicas',
        'teatro físico', 'danza contemporánea', 'multidisciplinar'
    },
    'literatura': {
        'literatura', 'poesía', 'narrativa', 'ensayo', 'escritura creativa',
        'traducción literaria', 'guion', 'multidisciplinar'
    },
    'diseño': {
        'diseño', 'diseño gráfico', 'diseño industrial', 'diseño textil',
        'diseño editorial', 'gráfica', 'multidisciplinar'
    },
    'investigación': {
        'investigación', 'creación', 'curaduría', 'gestión cultural',
        'teoría artística', 'historia del arte', 'mediación cultural',
        'conservación patrimonial', 'investigación-creación'
    },
    'arquitectura': {
        'arquitectura', 'urbanismo', 'paisajismo', 'intervención urbana',
        'arte ambiental', 'diseño de espacios', 'multidisciplinar'
    },
    'artesanía': {
        'artesanía', 'arte textil', 'cerámica tradicional', 'orfebrería',
        'talla en madera', 'técnicas tradicionales', 'multidisciplinar'
    }
}


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
    PERMANENT_SESSION_LIFETIME=timedelta(hours=24)
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

# Always use development domain locally
if not is_production:
    AUTH0_CUSTOM_DOMAIN = "dev-3klm8ed6qtx4zj6v.us.auth0.com"
    AUTH0_TENANT_DOMAIN = "dev-3klm8ed6qtx4zj6v.us.auth0.com"
    app.logger.info(f"Using development Auth0 domain: {AUTH0_CUSTOM_DOMAIN}")
else:
    AUTH0_CUSTOM_DOMAIN = os.environ.get("AUTH0_CUSTOM_DOMAIN", "login.oportunidades.lat")
    AUTH0_TENANT_DOMAIN = os.environ.get("AUTH0_TENANT_DOMAIN", "login.oportunidades.lat")
    app.logger.info(f"Using production Auth0 domain: {AUTH0_CUSTOM_DOMAIN}")

oauth = OAuth(app)

oauth.register(
    "auth0",
    client_id=AUTH0_CLIENT_ID,
    client_secret=AUTH0_CLIENT_SECRET,
    client_kwargs={
        "scope": "openid profile email",
        "response_type": "code"
    },
    api_base_url=f"https://{AUTH0_TENANT_DOMAIN}",
    access_token_url=f"https://{AUTH0_TENANT_DOMAIN}/oauth/token",
    authorize_url=f"https://{AUTH0_TENANT_DOMAIN}/authorize",
    server_metadata_url=f'https://{AUTH0_TENANT_DOMAIN}/.well-known/openid-configuration',
    audience=f"https://{AUTH0_TENANT_DOMAIN}/userinfo"
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
    
    return oauth.auth0.authorize_redirect(
        redirect_uri=AUTH0_CALLBACK_URL,
        state=state
    )

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
        
        # Get the next URL from session and remove it
        next_url = session.pop('next_url', url_for('index'))
        app.logger.info(f"Next URL from session: {next_url}")
        
        # Force session save before redirect
        session.modified = True
        
        app.logger.info(f"Redirecting to: {next_url}")
        return redirect(next_url)
        
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
    try:
        user_id = session["user"]["sub"]
        opportunity_ids = get_saved_opportunity_ids(user_id)
        opportunities = []
        now_date = datetime.now().date()
        seven_days_from_now = now_date + timedelta(days=7)

        # Get saved opportunities
        for opp_id in opportunity_ids:
            opportunity = get_opportunity_by_id(opp_id)
            if opportunity:
                # Process disciplina into a list
                if opportunity.get("disciplina"):
                    opportunity["disciplinas"] = [d.strip() for d in opportunity["disciplina"].split(',')]
                
                # Add url_base from base_url or url
                base_url = opportunity.get("base_url", "")
                url = opportunity.get("url", "")
                try:
                    parsed = urlparse(base_url if base_url else url)
                    if not parsed.netloc:
                        parsed = urlparse(f"https://{base_url if base_url else url}")
                    opportunity["url_base"] = parsed.netloc.replace('www.', '')
                except Exception as e:
                    app.logger.error(f"Error parsing URL: {e}")
                    opportunity["url_base"] = ""

                opportunities.append(opportunity)

        # Get all closing soon opportunities from main database
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
                    {"property": "Fecha de cierre", "date": {"on_or_before": seven_days_from_now.isoformat()}},
                    {"property": "Fecha de cierre", "date": {"on_or_after": now_date.isoformat()}}
                ]
            }
        }

        response = requests.post(url, headers=headers, json=json_body)
        response.raise_for_status()
        data = response.json()
        
        closing_soon_pages = []
        for result in data.get("results", []):
            try:
                page = {
                    "id": result["id"],
                    "resumen_IA": (
                        result["properties"]["Resumen generado por la IA"]["rich_text"][0]["text"]["content"]
                        if result["properties"]["Resumen generado por la IA"]["rich_text"]
                        else ""
                    ),
                    "url": result["properties"]["URL"].get("url", ""),
                    "base_url": (
                        result["properties"]["Base URL"]["rich_text"][0]["text"]["content"]
                        if result["properties"]["Base URL"]["rich_text"]
                        else ""
                    ),
                    "fecha_de_cierre": (
                        result["properties"]["Fecha de cierre"]["date"]["start"]
                        if result["properties"]["Fecha de cierre"]["date"]
                        else ""
                    )
                }
                closing_soon_pages.append(page)
            except (KeyError, IndexError) as e:
                app.logger.error(f"Error processing closing soon page: {e}")
                continue

        app.logger.info(f"Found {len(closing_soon_pages)} closing soon opportunities")
        
        return render_template(
            "user_opportunities.html",
            opportunities=opportunities,
            closing_soon_pages=closing_soon_pages[:10],
            og_data=get_default_og_data()
        )
    except Exception as e:
        app.logger.error(f"Error in list_saved_opportunities: {str(e)}")
        return render_template(
            "user_opportunities.html",
            opportunities=[],
            closing_soon_pages=[],
            og_data=get_default_og_data()
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

def delete_saved_opportunity(user_id, page_id):
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

    if data["results"]:
        page_id_to_delete = data["results"][0]["id"]
        delete_url = f"https://api.notion.com/v1/pages/{page_id_to_delete}"
        delete_response = requests.patch(
            delete_url, headers=headers, json={"archived": True}
        )
        delete_response.raise_for_status()  # Raise an exception for HTTP errors

@app.route("/delete_opportunity/<page_id>", methods=["DELETE"])
@login_required
def delete_opportunity(page_id):
    user_id = session["user"]["sub"]

    try:
        print("Attempting to delete saved opportunity with ID:", page_id)

        # Delete the saved opportunity from the user's saved opportunities
        delete_saved_opportunity(user_id, page_id)

        # Redirect to /saved_opportunities after deletion
        response = make_response("", 204)
        response.headers["HX-Redirect"] = "/saved_opportunities"
        return response
    except Exception as e:
        print("Error:", str(e))
        return jsonify({"error": str(e)}), 400


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
    print("Current Session Data at Index:", session.get("user"))  # Debug: print session data
    if "user" in session:
        user = session["user"]
        return render_template("home.html", user=user)
    else:
        return render_template("home.html", user=None)

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

    # Existing GET logic starts here
    print("\n=== Starting database route ===")
    
    # Add month mapping
    month_mapping = {
        "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
        "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
        "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12
    }
    
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    
    if force_refresh:
        print("\n=== Force refresh requested ===")
        refresh_response = refresh_database_cache()
        if refresh_response[1] == 200:
            cached_content = get_cached_database_content()
        else:
            print("\n=== Force refresh failed ===")
            cached_content = None
    else:
        cached_content = get_cached_database_content()
        
        if not cached_content:
            print("\n=== Cache miss, attempting refresh ===")
            refresh_response = refresh_database_cache()
            if refresh_response[1] == 200:
                cached_content = get_cached_database_content()
            else:
                print("\n=== Cache refresh failed ===")

    if not cached_content:
        return render_template(
            "database.html",
            pages=[],
            closing_soon_pages=[],
            destacar_pages=[],
            total_opportunities=0,
            og_data={
                "title": "100 ︱ Oportunidades",
                "description": "Convocatorias, Becas y Recursos Globales para Artistas.",
                "url": request.url,
                "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
            }
        )

    total_opportunities = len(cached_content['pages'])

    is_htmx = request.headers.get('HX-Request', 'false').lower() == 'true'
    is_clear = request.args.get("clear", "false").lower() == "true"
    search_query = request.args.get("search", "").lower()
    is_expanded = request.args.get("expanded", "false").lower() == "true"
    
    # Check for month in search query before other processing
    month_number = month_mapping.get(search_query)
    if not month_number:
        # Check if it's a direct month number
        try:
            month_num = int(search_query)
            if 1 <= month_num <= 12:
                month_number = month_num
        except ValueError:
            pass
    
    is_sin_cierre = search_query == "sin cierre"

    pages = cached_content['pages']
    closing_soon_pages = cached_content['closing_soon_pages']
    destacar_pages = cached_content['destacar_pages']

    # Handle clear request
    if is_clear:
        if is_htmx:
            return render_template("_search_results.html", pages=pages)
        return render_template(
            "database.html",
            pages=pages,
            closing_soon_pages=closing_soon_pages[:7],
            destacar_pages=destacar_pages,
            total_opportunities=total_opportunities,
            og_data={
                "title": "100 ︱ Oportunidades",
                "description": "Convocatorias, Becas y Recursos Globales para Artistas.",
                "url": request.url,
                "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
            }
        )

    # Apply filters
    filtered_pages = pages
    
    # Apply month-based or sin_cierre filter
    if month_number or is_sin_cierre:
        filtered_pages = [
            page for page in filtered_pages 
            if (is_sin_cierre and page.get("fecha_de_cierre") == "1900-01-01") or
               (month_number and datetime.strptime(page.get("fecha_de_cierre", "1900-01-01"), '%Y-%m-%d').month == month_number)
        ]
        
        if is_htmx:
            return render_template("_search_results.html", pages=filtered_pages)
    
    # Apply regular search if no month/sin_cierre filter
    elif search_query:
        def normalize_text(text):
            if not isinstance(text, str):
                text = str(text)
            return unicodedata.normalize('NFKD', text.lower()) \
                .encode('ASCII', 'ignore') \
                .decode('ASCII')

        if is_expanded:
            search_terms = search_query.split('|')
            app.logger.debug(f"Expanded search terms: {search_terms}")
            
            filtered_pages = []
            for page in pages:
                # Keep all existing normalized fields
                keywords = normalize_text(str(page.get("ai_keywords", "")))
                nombre = normalize_text(str(page.get("nombre", "")))
                descripcion = normalize_text(str(page.get("descripción", "")))
                disciplina = normalize_text(str(page.get("disciplina", "")))
                
                nombre_prop = normalize_text(
                    page.get("properties", {}).get("Nombre", {}).get("title", [{}])[0].get("text", {}).get("content", "")
                )
                resumen_ia = normalize_text(
                    page.get("properties", {}).get("Resumen generado por la IA", {}).get("rich_text", [{}])[0].get("text", {}).get("content", "")
                )
                
                is_residency = any(term in descripcion for term in [
                    "residencia", "residencia artistica", "residencia para artistas",
                    "artist residency", "residencia de artistas"
                ])
                
                related_terms = ["composicion", "cancion", "opera"]
                
                if any(normalize_text(term) in keywords or 
                      normalize_text(term) in nombre or
                      normalize_text(term) in nombre_prop or
                      normalize_text(term) in resumen_ia or
                      normalize_text(term) in disciplina or
                      (normalize_text(term) in nombre and any(
                          discipline in term for discipline in ["music", "musica", "danza", "teatro", "theater"]
                      )) or
                      (is_residency and "artista" in keywords) or
                      any(rt in keywords for rt in related_terms)
                      for term in search_terms):
                    filtered_pages.append(page)
                    app.logger.debug(f"Matched page: {page.get('nombre', '')}")
        else:
            search_terms = [term.strip() for term in search_query.split(',')]
            
            # Only expand disciplines if it's a single search term
            if len(search_terms) == 1:
                # Expand search terms using DISCIPLINE_GROUPS
                expanded_terms = []
                is_discipline_search = False
                for term in search_terms:
                    normalized_term = normalize_text(term)
                    if normalized_term in DISCIPLINE_GROUPS:
                        app.logger.debug(f"Found main discipline: {normalized_term}")
                        expanded_terms.extend(DISCIPLINE_GROUPS[normalized_term])
                        is_discipline_search = True
                        app.logger.debug(f"Added subdisciplines: {DISCIPLINE_GROUPS[normalized_term]}")
                    else:
                        expanded_terms.append(term)
            else:
                # For comma-separated searches, use terms as-is
                expanded_terms = search_terms
                is_discipline_search = False
                app.logger.debug(f"Multiple search terms, no expansion: {search_terms}")
            
            normalized_terms = [normalize_text(term) for term in expanded_terms]
            app.logger.debug(f"Final search terms: {normalized_terms}")
            
            filtered_pages = []
            for page in pages:
                searchable_fields = {
                    'disciplina': normalize_text(str(page.get("disciplina", ""))),
                    'ai_keywords': normalize_text(str(page.get("ai_keywords", ""))),
                    'nombre': normalize_text(str(page.get("nombre", ""))),
                    'pais': normalize_text(str(page.get("país", ""))),
                    'categoria': normalize_text(str(page.get("categoria", ""))),
                    'nombre_original': normalize_text(str(page.get("nombre_original", ""))),
                    'descripcion': normalize_text(str(page.get("descripción", ""))),
                    'og_resumida': normalize_text(str(page.get("og_resumida", ""))),
                    'nombre_prop': normalize_text(
                        page.get("properties", {}).get("Nombre", {}).get("title", [{}])[0].get("text", {}).get("content", "")
                    ),
                    'resumen_ia': normalize_text(
                        page.get("properties", {}).get("Resumen generado por la IA", {}).get("rich_text", [{}])[0].get("text", {}).get("content", "")
                    )
                }

                # Use ANY for single discipline searches, ALL for everything else
                if is_discipline_search:
                    matches = any(
                        any(term in value for value in searchable_fields.values())
                        for term in normalized_terms
                    )
                else:
                    matches = all(
                        any(term in value for value in searchable_fields.values())
                        for term in normalized_terms
                    )
                
                if matches:
                    filtered_pages.append(page)

            app.logger.debug(f"Found {len(filtered_pages)} matching pages")
        
        if is_htmx:
            return render_template("_search_results.html", pages=filtered_pages)

    # Get discipline counts for sidebar/facets
    discipline_counts = get_discipline_counts()
    main_discipline_counts = {
        main: sum(
            count for disc, count in discipline_counts['main'].items()
            if disc in subs or disc == main
        )
        for main, subs in DISCIPLINE_GROUPS.items()
    }

    return render_template(
        "database.html",
        pages=filtered_pages,
        closing_soon_pages=closing_soon_pages[:7],
        destacar_pages=destacar_pages,
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
    try:
        if not redis:
            print("\n=== Redis not available ===")
            return None

        print("\n=== Checking Redis cache ===")
        sys.stdout.flush()
        
        cached_content = redis.get('database_content')
        if not cached_content:
            print("\n=== CACHE MISS: No cached content found ===")
            return None

        # Decode and parse JSON
        try:
            decoded_content = cached_content.decode('utf-8') if isinstance(cached_content, bytes) else cached_content
            parsed_content = json.loads(decoded_content)
            print(f"\n=== CACHE HIT: Found {len(parsed_content.get('pages', []))} pages ===")
            return parsed_content
        except json.JSONDecodeError as e:
            print(f"\n=== JSON Parse Error: {str(e)} ===")
            return None
            
    except Exception as e:
        print(f"\n=== CACHE ERROR: {str(e)} ===")
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
                                {"property": "Fecha de cierre", "date": {"after": datetime.now().strftime('%Y-%m-%d')}}
                            ]
                        }
                    ]
                },
                "page_size": 100
            }

            all_pages = []
            has_more = True
            start_cursor = None
            request_count = 0
            max_requests = 3

            while has_more and request_count < max_requests:
                request_count += 1
                try:
                    if start_cursor:
                        json_body["start_cursor"] = start_cursor

                    res = requests.post(url, headers=headers, json=json_body, timeout=30)
                    res.raise_for_status()
                    data = res.json()
                    all_pages.extend(data.get("results", []))
                    has_more = data.get("has_more", False)
                    start_cursor = data.get("next_cursor")

                except Exception as e:
                    print(f"Request failed: {str(e)}")
                    break

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
            not page["fecha_de_cierre"] == placeholder_date,
            datetime.strptime(page["fecha_de_cierre"], '%Y-%m-%d') if page["fecha_de_cierre"] != placeholder_date else datetime.max
        ), reverse=True)

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

def get_discipline_counts():
    cached_content = get_cached_database_content()
    if not cached_content:
        return {'main': {}, 'sub': {}}

    # Rebuild counts using the same logic as filtering
    main_counts = defaultdict(int)
    sub_counts = defaultdict(int)
    
    for page in cached_content['pages']:
        page_disciplines = set(
            d.strip().lower() 
            for d in page.get('disciplina', '').split(',')
        )
        
        # Count subdisciplines
        for sub in page_disciplines:
            sub_counts[sub] += 1
        
        # Count main disciplines using actual filtering logic
        for main, subs in DISCIPLINE_GROUPS.items():
            normalized_subs = {s.lower().strip() for s in subs}
            if any(d in normalized_subs for d in page_disciplines):
                main_counts[main] += 1
                break  # Only count once per main category

    return {
        'main': dict(main_counts),
        'sub': dict(sub_counts)
    }

@app.route("/filter_by_discipline/<discipline>")
def filter_by_discipline(discipline):
    try:
        # Normalize the discipline parameter
        def normalize_discipline(text):
            return unicodedata.normalize('NFKD', text.lower()) \
                .encode('ASCII', 'ignore') \
                .decode('ASCII').strip()

        normalized_discipline = normalize_discipline(discipline)
        app.logger.debug(f"Normalized discipline: {normalized_discipline}")

        cached_content = get_cached_database_content()
        is_htmx = request.headers.get('HX-Request', 'false').lower() == 'true'
        
        if not cached_content:
            app.logger.error("No cached content available")
            return render_template("_search_results.html", pages=[])

        # Get required data from cache
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
            app.logger.error(f"Invalid discipline: {discipline} (normalized: {normalized_discipline})")
            return render_template("_search_results.html", pages=[])

        # Get original casing for display
        original_discipline = valid_disciplines[normalized_discipline]
        subdisciplines = DISCIPLINE_GROUPS[original_discipline]

        # Filter pages with normalization
        filtered_pages = []
        for page in pages:
            page_disciplina = normalize_discipline(page.get('disciplina', ''))
            if any(normalize_discipline(sub) in page_disciplina for sub in subdisciplines):
                filtered_pages.append(page)

        app.logger.debug(f"Found {len(filtered_pages)} matches for {original_discipline}")

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

if __name__ == "__main__":
    # Ensure session directory exists
    os.makedirs(os.path.join(app.root_path, 'flask_session'), exist_ok=True)
    
    # Check if running in development or production
    if os.environ.get("RENDER") != "1":
        # Development server
        port = int(os.environ.get("PORT", 5001))
        app.run(host="0.0.0.0", port=port, debug=True)
