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


KEYWORD_BINDINGS = {
    # Educational/Academic terms that should map to artistic disciplines
    'academic': {
        'triggers': [
            # Academic institutions and levels
            'universidad', 'university', 'uni ', 'univ',
            'facultad', 'faculty',
            'instituto', 'institute',
            'escuela', 'school',
            'conservatorio', 'conservatory',
            
            # Academic programs
            'maestría', 'maestria', 'master',
            'doctorado', 'doctorate', 'phd',
            'posgrado', 'postgrad',
            'licenciatura', 'bachelor',
            
            # Research and study
            'investigación', 'investigacion', 'research',
            'formación', 'formacion', 'formation',
            'estudios', 'studies',
            
            # Funding and opportunities
            'beca', 'scholarship',
            'residencia académica', 'academic residency'
        ],
        'maps_to': ['música', 'musica', 'danza', 'teatro']
    },

    # Specific artistic terms should only match their own discipline
    'música': {
        'triggers': [
            # Direct music terms
            'música', 'musica', 'musical',
            
            # Performance
            'composición', 'composition',
            'concierto', 'concert',
            'orquesta', 'orchestra',
            'ópera', 'opera',
            
            # Instruments and voice
            'instrumento', 'instrument',
            'piano', 'violin',
            'canción', 'cancion', 'song',
            'canto', 'singing',
            
            # Programs and institutions
            'ibermúsicas', 'ibermusicas',
            'conservatorio', 'conservatory',
            
            # General music terms
            'sonoro', 'sound',
            'opera', 'ópera',
            'interpretación', 'music performance',
        ],
        'maps_to': ['música', 'musica']
    },
    'teatro': {
        'triggers': [
            'dramaturgia', 'dramaturgy',
            'iberescena', 'actuación', 'performance',
            'artes escénicas', 'scenic arts', 'escenografía',
            'scenic design', 'textos', 'libretto'
        ],
        'maps_to': ['teatro']
    },
    'danza': {
        'triggers': [
            'coreografía', 'choreography',
            'ballet',
            'videodanza', 'videodance'
        ],
        'maps_to': ['danza']
    }
}

load_dotenv()
print("Loaded AUTH0_DOMAIN:", os.environ.get("AUTH0_DOMAIN"))

logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='../static', static_url_path='/static', template_folder='../templates')
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "default_fallback_secret_key")

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

# Remove dependency on flask_session
# Session(app)  # Comment this out if using the default Flask session management

app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_COOKIE_SECURE"] = True  # Ensure cookies are sent over HTTPS
app.config["SESSION_COOKIE_HTTPONLY"] = True  # Prevent JavaScript from accessing the cookies
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"  # Add CSRF protection by allowing cookies to be sent only on same-site requests
app.config["SESSION_PERMANENT"] = True  # Ensure sessions don't expire immediately
app.config["SESSION_USE_SIGNER"] = (
    True  # Optionally, enhance security by signing the session cookie
)

# Role-Base Access Mgmt
app.config["JWT_SECRET_KEY"] = "daleboquita"  # Change this to your actual secret key
jwt = JWTManager(app)

p = inflect.engine()



def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            session["next"] = request.url
            return redirect(url_for("login"))
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
    },
    server_metadata_url=f'https://{os.environ.get("AUTH0_DOMAIN")}/.well-known/openid-configuration',
)

@app.route("/login")
def login():
    # Store the original URL the user was trying to access before logging in
    session["original_url"] = request.args.get("next") or url_for("index")
    return oauth.auth0.authorize_redirect(
        redirect_uri=url_for("callback", _external=True)
    )

@app.route("/callback", methods=["GET", "POST"])
def callback():
    try:
        # Obtain the access token from Auth0
        token = oauth.auth0.authorize_access_token()

        # Store the token in the session
        session["jwt"] = token

        # User info endpoint - manually specified
        user_info_endpoint = "https://dev-3klm8ed6qtx4zj6v.us.auth0.com/userinfo"
        user_info_response = oauth.auth0.get(user_info_endpoint)

        # Extract user information from the response
        user_info = user_info_response.json()
        session["user"] = user_info
        
        # Redirect to the originally requested URL, or default to the index page
        next_url = session.get("next", url_for("index"))
        session.pop("next", None)  # Clear the stored URL
        return redirect(next_url)
    except Exception as e:
        # Handle errors and provide feedback
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

    # Define text processing functions
    def normalize_text(text):
        return ''.join(
            c for c in unicodedata.normalize('NFD', text)
            if unicodedata.category(c) != 'Mn'
        )

    def singularize_text(text):
        words = text.split()
        return ' '.join(p.singular_noun(word) or word for word in words)

    def preprocess_text(text, expand_terms=False):
        """Preprocesses text for searching, including keyword expansion if requested"""
        if not isinstance(text, str):
            text = str(text)
        
        # Basic preprocessing
        text = text.lower()
        normalized = normalize_text(text)
        singularized = singularize_text(normalized)
        
        # Only expand terms for música, teatro, danza searches
        if expand_terms:
            # Start with the original processed text
            expanded_terms = {singularized}
            
            # Check each category's triggers
            for category, bindings in KEYWORD_BINDINGS.items():
                # If any trigger matches our search term
                if any(trigger in singularized for trigger in bindings['triggers']):
                    # Add all triggers from this category
                    expanded_terms.update(bindings['triggers'])
                    expanded_terms.update(bindings['maps_to'])
            
            result = ' '.join(expanded_terms)
            print(f"Expanded '{text}' to: {result}")
            sys.stdout.flush()
            return result
        
        return singularized

    # Month mapping
    month_mapping = {
        "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
        "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
        "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12
    }

    # Check for month or "sin cierre" before preprocessing the search query
    month_number = month_mapping.get(search_query)
    is_sin_cierre = search_query == "sin cierre"
    placeholder_date = '1900-01-01'

    # Get cached content
    cached_content = get_cached_database_content()
    
    if cached_content:
        print(f"\n=== Using cached content with {len(cached_content['pages'])} pages ===")
        sys.stdout.flush()
        
        pages = cached_content['pages']

        # Handle clear request
        if is_clear:
            if is_htmx:
                return render_template("_search_results.html", pages=pages)
            else:
                return render_template(
                    "database.html", 
                    pages=pages,
                    closing_soon_pages=cached_content['closing_soon_pages'][:7],
                    destacar_pages=cached_content['destacar_pages'],
                    og_data={
                        "title": "100 ︱ Oportunidades",
                        "description": "Convocatorias, Becas y Recursos Globales para Artistas.",
                        "url": request.url,
                        "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
                    }
                )
        
        # Handle search
        if search_query:
            if month_number is not None or is_sin_cierre:
                filtered_pages = [
                    page for page in pages
                    if (is_sin_cierre and page.get("fecha_de_cierre") == placeholder_date)
                    or (month_number and datetime.strptime(page.get("fecha_de_cierre", placeholder_date), '%Y-%m-%d').month == month_number)
                ]
            else:
                # Determine if we should expand terms (only for música, teatro, danza)
                search_lower = normalize_text(search_query.lower())
                should_expand = any(term in search_lower for term in ['musica', 'música', 'teatro', 'danza'])
                
                # Preprocess search query
                processed_query = preprocess_text(search_query, expand_terms=should_expand)
                
                # If we expanded terms, split them into a list
                search_terms = processed_query.split() if should_expand else [processed_query]
                
                def check_page_content(page):
                    # Combine all searchable content from the page
                    page_content = ' '.join([
                        page.get("nombre", ""),
                        page.get("país", ""),
                        page.get("destinatarios", ""),
                        page.get("ai_keywords", ""),
                        page.get("nombre_original", ""),
                        page.get("entidad", "")
                    ])
                    processed_content = preprocess_text(page_content, expand_terms=False).lower()
                    
                    # For artistic disciplines, check both content and educational terms
                    if should_expand:
                        # Check for direct artistic terms
                        artistic_match = any(term in processed_content for term in search_terms)
                        
                        # Check for educational terms using KEYWORD_BINDINGS
                        educational_terms = [term.lower() for term in KEYWORD_BINDINGS['academic']['triggers']]
                        educational_match = any(term in processed_content for term in educational_terms)
                        
                        # Check if the educational terms map to the current artistic discipline
                        maps_to_terms = [term.lower() for term in KEYWORD_BINDINGS['academic']['maps_to']]
                        music_match = any(term in maps_to_terms for term in ['musica', 'música'])
                        
                        # Debug output
                        if artistic_match or (educational_match and music_match):
                            print(f"\nChecking page: {page.get('nombre', '')}")
                            print(f"Content: {processed_content}")
                            print(f"Artistic match: {artistic_match}")
                            print(f"Educational match: {educational_match}")
                            print(f"Music match: {music_match}")
                            sys.stdout.flush()
                        
                        return artistic_match or (educational_match and music_match)
                    
                    # For non-artistic searches (like "investigacion")
                    return processed_query in processed_content
                
                filtered_pages = [
                    page for page in pages
                    if check_page_content(page)
                ]
            
            if is_htmx:
                return render_template("_search_results.html", pages=filtered_pages)
        
        # If not searching and not clearing, return full cached content
        return render_template(
            "database.html", 
            pages=pages,
            closing_soon_pages=cached_content['closing_soon_pages'][:7],
            destacar_pages=cached_content['destacar_pages'],
            og_data={
                "title": "100 ︱ Oportunidades",
                "description": "Convocatorias, Becas y Recursos Globales para Artistas.",
                "url": request.url,
                "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
            }
        )

    # If no cache or cache miss, proceed with original logic
    print("\n=== No cache or cache miss, proceeding with original logic ===")
    sys.stdout.flush()

    def fetch_notion_pages():
        cache_key = 'notion_pages'
        
        try:
            # Try cache first
            cached_data = redis.get(cache_key)
            if cached_data:
                print("\n=== CACHE HIT: Serving from Upstash KV ===")
                return json.loads(cached_data)
        except Exception as e:
            print(f"\n=== CACHE ERROR: {str(e)} ===")
        
        print("\n=== CACHE MISS: Fetching from Notion API ===")
        fetch_start_time = time.time()
        
        # Your existing code stays exactly the same, including all logging
        url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
        headers = {
            "Authorization": "Bearer " + NOTION_TOKEN,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        }
        print(f"Headers: {headers}")
        sys.stdout.flush()
        
        now_date_str = datetime.now().strftime('%Y-%m-%d')
            # 1. Reduce the number of properties we request
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
            # 2. Only request the properties we actually use
            "page_size": 100  # 3. Increase page size to reduce number of requests
        }

        print(f"Request body: {json.dumps(json_body, indent=2)}")
        sys.stdout.flush()

        response = requests.post(url, headers=headers, json=json_body, timeout=60)
        data = response.json()

        # Add size check for raw response
        raw_json = json.dumps(data)
        response_size = sys.getsizeof(raw_json)
        print(f"\nRaw response size: {response_size / 1024:.2f} KB")
        
        all_pages = []
        has_more = True
        start_cursor = None
        request_count = 0
        max_requests = 3  # Limit maximum number of requests

        while has_more and request_count < max_requests:
            request_count += 1
            request_start = time.time()
            try:
                if start_cursor:
                    json_body["start_cursor"] = start_cursor

                print(f"Making request with start_cursor: {start_cursor}")
                res = requests.post(url, headers=headers, json=json_body, timeout=30)
                res.raise_for_status()
                data = res.json()
                print(f"Response status: {res.status_code}")
                print(f"Response body: {res.text}")
                print(f"Received {len(data.get('results', []))} results")
                sys.stdout.flush()
                res.raise_for_status()
                all_pages.extend(data.get("results", []))
                has_more = data.get("has_more", False)
                start_cursor = data.get("next_cursor")
                
                print(f"has_more: {has_more}, next_cursor: {start_cursor}")

                logger.info(f"Notion API request #{request_count} took {time.time() - request_start:.2f}s")  # Add this line

            except requests.exceptions.Timeout:
                print("Request timed out")
                break

            except requests.exceptions.RequestException as e:
                print(f"Request failed: {str(e)}")
                break

            if not has_more:
                break

        print(f"Finished fetching, total pages: {len(all_pages)}")
        print(f"Total fetch time: {time.time() - fetch_start_time:.2f} seconds")
        raw_json = json.dumps(data)
        response_size = sys.getsizeof(raw_json)
        print(f"\nRaw response size: {response_size / 1024:.2f} KB")
        processed_json = json.dumps(all_pages)
        processed_size = sys.getsizeof(processed_json)
        print(f"Processed data size: {processed_size / 1024:.2f} KB")
        
        try:
            redis.set(cache_key, json.dumps(all_pages), ex=21600)  # Cache for 30 minutes
            print("\n=== CACHE UPDATE: Stored new data in Upstash KV ===")
        except Exception as e:
            print(f"\n=== CACHE ERROR: {str(e)} ===")
        
        return all_pages
    
    if request.args.get("clear", "false").lower() == "true":
        cache.delete('notion_pages')
        print("Cache cleared due to clear search request")
        sys.stdout.flush()

    # Rest of the existing code remains exactly the same
    search_query = request.args.get("search", "").lower()
    
    def normalize_text(text):
        return ''.join(
            c for c in unicodedata.normalize('NFD', text)
            if unicodedata.category(c) != 'Mn'
        )
    print("Defined normalize_text function")
    sys.stdout.flush()

    def singularize_text(text):
        words = text.split()
        return ' '.join(p.singular_noun(word) or word for word in words)
    print("Defined singularize_text function")
    sys.stdout.flush()

    def preprocess_text(text, expand_terms=False):
        """Preprocesses text for searching, including keyword expansion if requested"""
        if not isinstance(text, str):
            text = str(text)
        
        # Basic preprocessing
        text = text.lower()
        normalized = normalize_text(text)
        singularized = singularize_text(normalized)
        
        # Only expand terms for música, teatro, danza searches
        if expand_terms:
            # Start with the original processed text
            expanded_terms = {singularized}
            
            # Check each category's triggers
            for category, bindings in KEYWORD_BINDINGS.items():
                # If any trigger matches our search term
                if any(trigger in singularized for trigger in bindings['triggers']):
                    # Add all triggers from this category
                    expanded_terms.update(bindings['triggers'])
                    expanded_terms.update(bindings['maps_to'])
            
            result = ' '.join(expanded_terms)
            print(f"Expanded '{text}' to: {result}")
            sys.stdout.flush()
            return result
        
        return singularized
    print("Defined preprocess_text function")
    sys.stdout.flush()

    search_query = preprocess_text(request.args.get("search", "").strip())
    print(f"Processed search query: {search_query}")
    sys.stdout.flush()

    print("About to call fetch_notion_pages")
    sys.stdout.flush()
    all_pages = fetch_notion_pages()
    print(f"Received {len(all_pages) if all_pages else 0} pages")
    sys.stdout.flush()
    
    
    now_date = datetime.now()
    seven_days_from_now = now_date + timedelta(days=7)
    fifteen_days_from_now = now_date + timedelta(days=15)
    placeholder_date = '1900-01-01'  # Placeholder date for pages without fecha_de_cierre

    # Month mapping
    month_mapping = {
        "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
        "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
        "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12
    }

    # Check for month or "sin cierre" before preprocessing the search query
    month_number = month_mapping.get(search_query)
    is_sin_cierre = search_query == "sin cierre"

       # Only preprocess search query if it's not a month or "sin cierre"
    if not month_number and not is_sin_cierre:
        search_query = preprocess_text(search_query)

    closing_soon_pages = []
    pages = []
    destacar_pages = []

    for page in all_pages:

        print(f"\nProcessing page: {page['id']}")
        sys.stdout.flush()

        if "Publicar" in page["properties"] and page["properties"]["Publicar"]["checkbox"]:


            print("Page is published")
            sys.stdout.flush()

            page_data = {"id": page["id"], "created_time": page["created_time"]}

            if "Resumen generado por la IA" in page["properties"]:
                page_data["nombre"] = (
                    page["properties"]["Resumen generado por la IA"]["rich_text"][0]["text"]["content"]
                    if page["properties"]["Resumen generado por la IA"]["rich_text"]
                    else ""
                )

                print(f"Nombre: {page_data['nombre']}")
                sys.stdout.flush()

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

            # Check if "Fecha de cierre" property exists and has a date
            fecha_de_cierre_prop = page["properties"].get("Fecha de cierre", None)
            fecha_de_cierre = None
            if fecha_de_cierre_prop and "date" in fecha_de_cierre_prop and fecha_de_cierre_prop["date"]:
                fecha_de_cierre = fecha_de_cierre_prop["date"].get("start", None)

            print("Page ID:", page["id"], "Fecha de Cierre:", fecha_de_cierre if fecha_de_cierre else "None")

            # Check if "Fecha de cierre" property exists and has a date
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

            # Add to destacar_pages if "destacar" is in "destinatarios" and fecha_de_cierre is empty or not past today
            if page_data.get("destinatarios", "").lower() == "destacar":
                if not fecha_de_cierre or cierre_date >= now_date:
                    destacar_pages.append(page_data)

            # Ensure each page is added to pages only once
            pages.append(page_data)
            print("Added to pages list")
            sys.stdout.flush()

    print(f"\nFinal counts:")
    print(f"Total pages: {len(pages)}")
    print(f"Closing soon: {len(closing_soon_pages)}")
    print(f"Destacar: {len(destacar_pages)}")
    sys.stdout.flush()

    # If less than 5 pages, extend to 15 days
    if len(closing_soon_pages) < 5:
        for page in pages:
            if "fecha_de_cierre" in page:
                cierre_date = datetime.strptime(page["fecha_de_cierre"], '%Y-%m-%d')
                if seven_days_from_now < cierre_date <= fifteen_days_from_now:
                    closing_soon_pages.append(page)
                    if len(closing_soon_pages) >= 7:
                        break

    # Apply month-based filter first
    if month_number is not None or is_sin_cierre:
        pages = [
            page for page in pages 
            if (is_sin_cierre and page.get("fecha_de_cierre") == placeholder_date)
            or (month_number and datetime.strptime(page.get("fecha_de_cierre", placeholder_date), '%Y-%m-%d').month == month_number)
        ]
    # Then apply regular search filter if needed
    elif search_query:
        pages = [
            page for page in pages 
            if search_query in preprocess_text(page.get("nombre", ""))
            or search_query in preprocess_text(page.get("país", ""))
            or search_query in preprocess_text(page.get("destinatarios", ""))
            or search_query in preprocess_text(page.get("ai_keywords", ""))
            or search_query in preprocess_text(page.get("nombre_original", ""))
            or search_query in preprocess_text(page.get("entidad", ""))
        ]

    closing_soon_pages = sorted(closing_soon_pages, key=lambda page: page["fecha_de_cierre"])
    sorted_pages = sorted(pages, key=lambda page: (
        not page["fecha_de_cierre"] == placeholder_date,  # Cambiado: negamos la condición para invertir el orden
        datetime.strptime(page["fecha_de_cierre"], '%Y-%m-%d') if page["fecha_de_cierre"] != placeholder_date else datetime.max  # Segundo: orden por fecha
    ), reverse=True)

    og_data = {
        "title": "100 ︱ Oportunidades",
        "description": "Convocatorias, Becas y Recursos Globales para Artistas.",
        "url": request.url,
        "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_100_mediano.png"
    }

    if is_htmx:
        print("HTMX request - bypassing cache")
        return render_template("_search_results.html", pages=sorted_pages)
    else:
        print("Regular request")
        response = render_template(
            "database.html", 
            pages=sorted_pages, 
            closing_soon_pages=closing_soon_pages[:7],
            destacar_pages=destacar_pages,
            og_data=og_data
        )
        
        # Only cache non-HTMX, non-clear responses
        if not is_clear:
            cache.set('all_pages_response', response, timeout=7200)
        
        return response


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
        # Use the specific page ID for the "Total" page
        page_id = "1519dd874b3a8033a633f021cec697ce"
        url = f"https://api.notion.com/v1/pages/{page_id}"
        headers = {
            "Authorization": "Bearer " + NOTION_TOKEN,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raise an error for bad responses
        data = response.json()

        # Log the response for debugging
        print("Notion API response:", json.dumps(data, indent=2))

        # Extract the "Total de nuevas" value
        total_nuevas = data["properties"]["Total de nuevas"]["rollup"]["number"]

        # Store the value in Redis with a TTL of 6 days, 23 hours, and 55 minutes (604500 seconds)
        redis.set('total_nuevas', total_nuevas, ex=604500)
        print(f"Updated total_nuevas: {total_nuevas}")

        return "Total nuevas updated successfully", 200
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
    except requests.exceptions.RequestException as req_err:
        print(f"Request error occurred: {req_err}")
    except KeyError as key_err:
        print(f"Key error: {key_err} - Check if the JSON structure has changed.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    return "Failed to update total nuevas", 500

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
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
