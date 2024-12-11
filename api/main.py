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

from flask_socketio import SocketIO
import socket as py_socket

from concurrent.futures import ThreadPoolExecutor

from flask_caching import Cache

import unicodedata
import inflect

from flask_caching import Cache

import logging
import secrets

from flask_session import Session
import redis


load_dotenv()
print("Loaded AUTH0_DOMAIN:", os.environ.get("AUTH0_DOMAIN"))

logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='../static', static_url_path='/static', template_folder='../templates')
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "default_fallback_secret_key")

# Session configuration
if os.environ.get('VERCEL_ENV'):
    # Production (Vercel) - use Redis
    app.config.update(
        SESSION_TYPE='redis',
        SESSION_REDIS=redis.from_url(os.environ.get('REDIS_URL')),
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        PERMANENT_SESSION_LIFETIME=timedelta(hours=24),
        SESSION_REFRESH_EACH_REQUEST=True
    )
else:
    # Development - use filesystem
    app.config.update(
        SESSION_TYPE='filesystem',
        SESSION_FILE_DIR=os.path.join(app.root_path, 'flask_session'),
        SESSION_COOKIE_SECURE=False,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        SESSION_COOKIE_PATH='/',
        SESSION_COOKIE_NAME='oportunidades_session',
        PERMANENT_SESSION_LIFETIME=timedelta(hours=24),
        SESSION_REFRESH_EACH_REQUEST=True
    )

# Initialize Session
Session(app)

# Only create session directory in development
if not os.environ.get('VERCEL_ENV'):
    os.makedirs(os.path.join(app.root_path, 'flask_session'), exist_ok=True)

# Configure caching with longer timeout
cache = Cache(app, config={
    'CACHE_TYPE': 'simple',
    'CACHE_DEFAULT_TIMEOUT': 7200  # Increase to 2 hours
})

# Initialize Redis with your Upstash credentials
redis = Redis(url=os.environ.get('KV_REST_API_URL'),
              token=os.environ.get('KV_REST_API_TOKEN'))

# Environment-specific configuration
if os.getenv("FLASK_ENV") == "development":
    app.config["ENV"] = "development"
    app.config["DEBUG"] = True
else:
    app.config["ENV"] = "production"
    app.config["DEBUG"] = False

# Role-Base Access Mgmt
app.config["JWT_SECRET_KEY"] = "daleboquita"  # Change this to your actual secret key
jwt = JWTManager(app)

p = inflect.engine()



def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            original_url = request.url
            # Store URL in both session and query parameter
            session["next"] = original_url
            session.modified = True
            logger.info(f"Login required: Storing original URL: {original_url}")
            return redirect(url_for("login", next=original_url))
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
AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID")
AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET")
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")

if os.getenv("FLASK_ENV") == "production":
    AUTH0_CALLBACK_URL = "https://oportunidades.onrender.com/callback"
else:
    AUTH0_CALLBACK_URL = "http://localhost:5000/callback"

oauth = OAuth(app)

oauth.register(
    "auth0",
    client_id=os.environ.get("AUTH0_CLIENT_ID"),
    client_secret=os.environ.get("AUTH0_CLIENT_SECRET"),
    client_kwargs={
        "scope": "openid profile email",
        "response_type": "code"
    },
    server_metadata_url=f'https://{os.environ.get("AUTH0_DOMAIN")}/.well-known/openid-configuration',
)

@app.route("/login")
def login():
    session["original_url"] = request.args.get("next") or url_for("index")
    return oauth.auth0.authorize_redirect(
        redirect_uri=url_for("callback", _external=True)
    )

@app.route("/callback", methods=["GET", "POST"])
def callback():
    try:
        token = oauth.auth0.authorize_access_token()
        session["jwt"] = token
        user_info_endpoint = "https://dev-3klm8ed6qtx4zj6v.us.auth0.com/userinfo"
        user_info_response = oauth.auth0.get(user_info_endpoint)
        user_info = user_info_response.json()
        session["user"] = user_info
        next_url = session.get("next", url_for("index"))
        session.pop("next", None)
        return redirect(next_url)
    except Exception as e:
        print(f"Error during callback processing: {str(e)}")
        return f"An error occurred: {str(e)}"


@app.route("/logout")
def logout():
    session.clear()
    return redirect(
        "https://"
        + env.get("AUTH0_DOMAIN")
        + "/v2/logout?"
        + urlencode(
            {
                "returnTo": url_for("index", _external=True),
                "client_id": env.get("AUTH0_CLIENT_ID"),
            },
            quote_via=quote_plus,
        )
    )

# User Opportunities save

def save_to_notion(user_id, page_id):
    url = "https://api.notion.com/v1/pages"
    headers = {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }
    json_body = {
        "parent": {"database_id": OPORTUNIDADES_ID},
        "properties": {
            "User ID": {"title": [{"text": {"content": user_id}}]},
            "Opportunity ID": {"rich_text": [{"text": {"content": page_id}}]},
        },
    }

    response = requests.post(url, headers=headers, json=json_body)
    response.raise_for_status()  # Raise an exception for HTTP errors

@app.route("/save_user_opportunity", methods=["POST"])
@login_required
def save_user_opportunity():
    user_id = session["user"]["sub"]

    try:
        selected_pages = request.form.getlist("selected_pages")  # Get selected page IDs from form data
        """ print("Selected pages:", selected_pages)  # Debugging line """

        if not selected_pages:
            return jsonify({"error": "No pages selected"}), 400

        for page_id in selected_pages:
            # Check if the opportunity is already saved
            if is_opportunity_already_saved(user_id, page_id):
                continue  # Skip already saved opportunities

            # Save the opportunity to the user's saved opportunities in Notion
            save_to_notion(user_id, page_id)

        success_message = """
        <div role="alert" class="flex items-center alert alert-success p-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
        """

        return success_message, 200
    except Exception as e:
        print("Error:", str(e))
        return jsonify({"error": str(e)}), 400

def fetch_opportunity_details(opportunity_id):
    return get_opportunity_by_id(opportunity_id)

@app.route("/saved_opportunities", methods=["GET"])
@login_required
def list_saved_opportunities():
    user_id = session["user"]["sub"]

    # Fetch saved opportunity IDs from Notion
    opportunity_ids = get_saved_opportunity_ids(user_id)

    # Fetch detailed information for each opportunity concurrently
    with ThreadPoolExecutor() as executor:
        opportunities = list(executor.map(fetch_opportunity_details, opportunity_ids))

    # Generate og_data based on the first saved opportunity or use default values
    if opportunities:
        first_opportunity = opportunities[0]
        og_data = {
            "title": first_opportunity["nombre"],
            "description": first_opportunity["resumen_IA"],
            "url": request.url,
            "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
        }
    else:
        og_data = {
            "title": "100 ︱ Oportunidades",
            "description": "Convocatorias, Becas y Recursos Globales para Artistas.",
            "url": request.url,
            "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
        }

    return render_template("user_opportunities.html", opportunities=opportunities, og_data=og_data)


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
    url = f"https://api.notion.com/v1/databases/{OPORTUNIDADES_ID}/query"
    headers = {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }
    json_body = {"filter": {"property": "User ID", "title": {"equals": user_id}}}

    response = requests.post(url, headers=headers, json=json_body)
    response.raise_for_status()  # Raise an exception for HTTP errors
    data = response.json()

    opportunity_ids = [
        result["properties"]["Opportunity ID"]["rich_text"][0]["text"]["content"]
        for result in data["results"]
    ]
    """ print("Opportunity IDs from Notion:", opportunity_ids)  # Debugging statement """
    return opportunity_ids

def get_opportunity_by_id(opportunity_id):
    url = f"https://api.notion.com/v1/pages/{opportunity_id}"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }

    response = requests.get(url, headers=headers)
    response.raise_for_status()  # Raise an exception for HTTP errors
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

def get_similar_opportunities(keywords, exclude_ids):
    url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
    headers = {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }

    # Create a filter for each keyword
    keyword_filters = [
        {"property": "AI keywords", "multi_select": {"contains": keyword}}
        for keyword in keywords
    ]

    json_body = {
        "filter": {"or": keyword_filters},
        "page_size": 10,  # Limit the number of results
    }

    # Log the payload for debugging
    print("Query Payload:", json_body)

    response = requests.post(url, headers=headers, json=json_body)
    response.raise_for_status()  # Raise an exception for HTTP errors
    data = response.json()

    opportunities = []
    for result in data["results"]:
        if result["id"] not in exclude_ids:  # Exclude already saved opportunities
            opportunity = {
                "id": result["id"],
                "nombre": (
                    result["properties"]["Nombre"]["title"][0]["text"]["content"]
                    if result["properties"]["Nombre"]["title"]
                    else ""
                ),
                "país": (
                    result["properties"]["País"]["rich_text"][0]["text"]["content"]
                    if result["properties"]["País"]["rich_text"]
                    else ""
                ),
                "destinatarios": (
                    result["properties"]["Destinatarios"]["rich_text"][0]["text"][
                        "content"
                    ]
                    if result["properties"]["Destinatarios"]["rich_text"]
                    else ""
                ),
                "url": (
                    result["properties"]["URL"]["url"]
                    if result["properties"]["URL"].get("url")
                    else ""
                ),
            }
            opportunities.append(opportunity)

    return opportunities

@app.route("/find_similar_opportunities", methods=["GET"])
@login_required
def find_similar_opportunities():
    user_id = session["user"]["sub"]

    # Fetch saved opportunity IDs from Notion
    opportunity_ids = get_saved_opportunity_ids(user_id)

    # Fetch AI keywords from user's saved opportunities
    keywords = set()
    for opportunity_id in opportunity_ids:
        opportunity = get_opportunity_by_id(opportunity_id)
        keywords.update(
            [
                tag["name"]
                for tag in opportunity.get("properties", {})
                .get("AI keywords", {})
                .get("multi_select", [])
            ]
        )

    # Fetch similar opportunities based on AI keywords
    similar_opportunities = get_similar_opportunities(keywords, opportunity_ids)

    return render_template(
        "_similar_opportunities.html", similar_opportunities=similar_opportunities
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



@app.route("/database", methods=["GET"])
@login_required
def all_pages():
    print("\n=== Starting database route ===")
    sys.stdout.flush()
    
    is_htmx = request.headers.get('HX-Request', 'false').lower() == 'true'
    is_clear = request.args.get("clear", "false").lower() == "true"
    search_query = request.args.get("search", "").lower()
    is_expanded = request.args.get("expanded", "false").lower() == "true"
    month_number = request.args.get("month", type=int)
    is_sin_cierre = request.args.get("sin_cierre", "false").lower() == "true"

    # Get cached content
    cached_content = get_cached_database_content()
    
    if cached_content:
        print(f"\n=== Using cached content with {len(cached_content['pages'])} pages ===")
        sys.stdout.flush()
        
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
                og_data={
                    "title": "100 ︱ Oportunidades",
                    "description": "Convocatorias, Becas y Recursos Globales para Artistas.",
                    "url": request.url,
                    "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
                }
            )

        # Apply filters
        filtered_pages = pages
        
        # Apply month-based filter first
        if month_number is not None or is_sin_cierre:
            filtered_pages = [
                page for page in filtered_pages 
                if (is_sin_cierre and page.get("fecha_de_cierre") == "1900-01-01")
                or (month_number and datetime.strptime(page.get("fecha_de_cierre", "1900-01-01"), '%Y-%m-%d').month == month_number)
            ]
        
        # Then apply search filter if needed
        elif search_query:
            def normalize_text(text):
                if not isinstance(text, str):
                    text = str(text)
                return unicodedata.normalize('NFKD', text.lower()) \
                    .encode('ASCII', 'ignore') \
                    .decode('ASCII')

            if is_expanded:
                search_terms = search_query.split('|')
                print(f"Expanded search terms: {search_terms}")  # Debug log
                
                filtered_pages = []
                for page in pages:
                    keywords = normalize_text(str(page.get("ai_keywords", "")))
                    nombre = normalize_text(str(page.get("nombre", "")))
                    descripcion = normalize_text(str(page.get("descripción", "")))
                    is_residency = any(term in descripcion for term in [
                        "residencia", "residencia artistica", "residencia para artistas",
                        "artist residency", "residencia de artistas"
                    ])
                    
                    if any(normalize_text(term) in keywords or 
                          (normalize_text(term) in nombre and any(
                              discipline in term for discipline in ["music", "musica", "danza", "teatro", "theater"]
                          )) or
                          (is_residency and "artista" in keywords)
                          for term in search_terms):
                        filtered_pages.append(page)
                        print(f"Matched page: {page.get('nombre', '')}")  # Debug log
            else:
                normalized_query = normalize_text(search_query)
                filtered_pages = [
                    page for page in pages
                    if normalized_query in normalize_text(str(page.get("ai_keywords", "")))
                    or normalized_query in normalize_text(str(page.get("nombre", "")))
                ]

            print(f"Found {len(filtered_pages)} matching pages")  # Debug log
            
            if is_htmx:
                return render_template("_search_results.html", pages=filtered_pages)

        return render_template(
            "database.html",
            pages=filtered_pages,
            closing_soon_pages=closing_soon_pages[:7],
            destacar_pages=destacar_pages,
            og_data={
                "title": "100 ︱ Oportunidades",
                "description": "Convocatorias, Becas y Recursos Globales para Artistas.",
                "url": request.url,
                "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
            }
        )

    # If no cached content, return empty template
    return render_template(
        "database.html",
        pages=[],
        closing_soon_pages=[],
        destacar_pages=[],
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
        # Add debug logging
        print("Starting update_total_nuevas process")
        
        # Use the specific page ID for the "Total" page
        page_id = "1519dd874b3a8033a633f021cec697ce"
        url = f"https://api.notion.com/v1/pages/{page_id}"
        headers = {
            "Authorization": "Bearer " + NOTION_TOKEN,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        }
        
        print("Fetching data from Notion...")
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()

        # Extract the "Total de nuevas" value
        total_nuevas = data["properties"]["Total de nuevas"]["rollup"]["number"]
        print(f"Extracted total_nuevas value: {total_nuevas}")

        # Store in Redis
        redis.set('total_nuevas', total_nuevas, ex=604500)
        print(f"Stored in Redis: {total_nuevas}")

        # Return the value in the response
        return jsonify({
            "status": "success",
            "total_nuevas": total_nuevas,
            "message": "Total nuevas updated successfully"
        }), 200

    except Exception as e:
        error_message = f"Error updating total_nuevas: {str(e)}"
        print(error_message)
        return jsonify({
            "status": "error",
            "error": error_message
        }), 500

def get_cached_database_content():
    try:
        print("\n=== Checking Redis cache ===")
        sys.stdout.flush()
        
        # Try to get cached content from Redis
        cached_content = redis.get('database_content')
        print(f"Raw cached data exists: {cached_content is not None}")
        sys.stdout.flush()
        
        if cached_content:
            print("\n=== CACHE HIT: Found data in Redis ===")
            sys.stdout.flush()
            return json.loads(cached_content)
            
        print("\n=== CACHE MISS: No cached content found ===")
        sys.stdout.flush()
        return None
    except Exception as e:
        print(f"\n=== CACHE ERROR: {str(e)} ===")
        sys.stdout.flush()
        return None

@app.route("/refresh_database_cache", methods=["POST"])
def refresh_database_cache():
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
            if "Publicar" in page["properties"] and page["properties"]["Publicar"]["checkbox"]:
                page_data = {"id": page["id"], "created_time": page["created_time"]}

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
                    page_data["ai_keywords"] = (
                        page["properties"]["AI keywords"]["multi_select"][0]["name"]
                        if page["properties"]["AI keywords"]["multi_select"]
                        else ""
                    )

                if "URL" in page["properties"]:
                    page_data["url"] = (
                        page["properties"]["URL"]["url"]
                        if page["properties"]["URL"].get("url")
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

                pages.append(page_data)

        # Sort pages
        sorted_pages = sorted(pages, key=lambda page: (
            not page["fecha_de_cierre"] == placeholder_date,
            datetime.strptime(page["fecha_de_cierre"], '%Y-%m-%d') if page["fecha_de_cierre"] != placeholder_date else datetime.max
        ), reverse=True)

        # Store the processed data
        cache_data = {
            'pages': sorted_pages,
            'closing_soon_pages': closing_soon_pages[:7],
            'destacar_pages': destacar_pages,
            'timestamp': datetime.now().isoformat()
        }
        
        # Store for 7 days (604800 seconds)
        redis.set('database_content', json.dumps(cache_data), ex=604800)
        
        return jsonify({"status": "success", "message": "Cache refreshed"}), 200
    except Exception as e:
        print(f"Cache refresh error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    # Ensure session directory exists
    os.makedirs(os.path.join(app.root_path, 'flask_session'), exist_ok=True)
    
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
