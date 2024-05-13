from flask import Flask, flash, redirect, url_for, render_template, request, session, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required, verify_jwt_in_request, JWTManager
from dotenv import find_dotenv, load_dotenv
from flask_session import Session
from functools import wraps

from typing_extensions import LiteralString
from werkzeug.wrappers import response
import requests
import json
import os

from os import environ as env
from urllib.parse import quote_plus, urlencode
from authlib.integrations.flask_client import OAuth


load_dotenv()
print("Loaded AUTH0_DOMAIN:", os.environ.get("AUTH0_DOMAIN"))


app: Flask = Flask(__name__)

app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'default_fallback_secret_key')

app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_PERMANENT'] = True  # Ensure sessions don't expire immediately
app.config['SESSION_USE_SIGNER'] = True  # Optionally, enhance security by signing the session cookie


Session(app)  # Initialize session

# Role-Base Access Mgmt 
app.config['JWT_SECRET_KEY'] = 'daleboquita'  # Change this to your actual secret key
jwt = JWTManager(app)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session or 'Admin' not in session['user'].get('https://127.0.0.1:5000/roles', []):
            return redirect(url_for('login'))  # or some other unauthorized page
        return f(*args, **kwargs)
    return decorated_function


# Notion Integration

NOTION_TOKEN = "secret_IVjx7fzy1C08BK3tecE3utwikJte72Mmgwhd5mUtzWv"
DATABASE_ID = "b267157879d54cfc8f7106039d4ab221"

headers = {
    "Authorization": "Bearer " + NOTION_TOKEN,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
}

# Auth0 Integration

oauth = OAuth(app)

oauth.register(
    "auth0",
    client_id=os.environ.get("AUTH0_CLIENT_ID"),
    client_secret=os.environ.get("AUTH0_CLIENT_SECRET"),
    client_kwargs={
        "scope": "openid profile email",
    },
    server_metadata_url=f'https://{os.environ.get("AUTH0_DOMAIN")}/.well-known/openid-configuration'
)

@app.route("/login")
def login():
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
        print("Session Data Set:", session["user"]) 
        # Redirect to the dashboard or another appropriate page
        return redirect(url_for('index'))
    except Exception as e:
        # Handle errors and provide feedback
        print(f"Error during callback processing: {str(e)}")
        return f"An error occurred: {str(e)}"

@app.route("/logout")
def logout():
    session.clear()
    return redirect(
        "https://" + env.get("AUTH0_DOMAIN")
        + "/v2/logout?"
        + urlencode(
            {
                "returnTo": url_for("all_pages", _external=True),
                "client_id": env.get("AUTH0_CLIENT_ID"),
            },
            quote_via=quote_plus,
        )
    )

# App Logic

@app.route("/")
def index():
    print("Current Session Data at Index:", session.get('user'))  # Debug: print session data
    if 'user' in session:
        user = session['user']
        return render_template("index.html", user=user, pretty=json.dumps(user, indent=4))
    else:
        return render_template("index.html", user=None, pretty="No user data")

@app.route('/create', methods=['GET', 'POST'])
@login_required
def handle_create():
    if request.method == 'POST':
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


@app.route('/database', methods=['GET'])
@login_required
def all_pages():
    search_query = request.args.get('search', '')  # Get search query from URL parameters
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
                    {"property": "Nombre", "title": {"contains": search_query}},
                    {"property": "País", "rich_text": {"contains": search_query}},
                    {"property": "Destinatarios", "rich_text": {"contains": search_query}},
                ]
            }
        ]
    }
    } if search_query else {}

    
    print("Session Data:", session.get('user'))
    
    res = requests.post(url, headers=headers, json=json_body)
    data = res.json()
    if not data or not data.get('results'):
        return render_template("database.html", pages=[])

    pages = []
    for page in data['results']:
        # Check if the 'Publicar' property exists and if it is checked
        if "Publicar" in page['properties'] and page['properties']['Publicar']['checkbox']:
            page_data = {
                'id': page['id'],
                'created_time': page['created_time']
            }
            # Extracting 'Nombre' assuming it is a 'title'
            if "Nombre" in page['properties']:
                page_data['nombre'] = page['properties']['Nombre']['title'][0]['text']['content'] if page['properties']['Nombre']['title'] else ''

            # Extracting 'País' assuming it is 'rich_text'
            if "País" in page['properties']:
                page_data['país'] = page['properties']['País']['rich_text'][0]['text']['content'] if page['properties']['País']['rich_text'] else ''

            # Extracting 'Destinatarios' assuming it is 'rich_text'
            if "Destinatarios" in page['properties']:
                page_data['destinatarios'] = page['properties']['Destinatarios']['rich_text'][0]['text']['content'] if page['properties']['Destinatarios']['rich_text'] else ''

            # Extracting 'URL' assuming it is a 'URL' type
            if "URL" in page['properties']:
                page_data['url'] = page['properties']['URL']['url'] if page['properties']['URL'].get('url') else ''

            pages.append(page_data)

    sorted_pages = sorted(pages, key=lambda page: page['created_time'], reverse=True)
    return render_template("database.html", pages=sorted_pages)


@app.route('/update/<page_id>', methods=['GET', 'POST'])
@admin_required
def update_page(page_id):
    if request.method == 'POST':
        # Update the page with the form data
        data = request.form.to_dict()
        update_url = f"https://api.notion.com/v1/pages/{page_id}"
        res = requests.patch(update_url, headers=headers, json=data)

        if res.status_code != 200:
            return "Failed to update page", 400

        # Fetch the updated data for the page
        url = f"https://api.notion.com/v1/pages/{page_id}"
        res = requests.get(url, headers=headers)
        page = res.json()

        # Extract the properties from the page
        properties = page['properties']

        # Redirect to the form.html template with the updated properties
        return render_template("form.html", properties=properties, page_id=page_id)

    # Fetch the current data for the page
    url = f"https://api.notion.com/v1/pages/{page_id}"
    res = requests.get(url, headers=headers)
    page = res.json()

    # Extract the properties from the page
    properties = page['properties']

    return render_template("form.html", properties=properties, page_id=page_id)

@app.route('/save', methods=['POST'])
@app.route('/save/<page_id>', methods=['POST'])
@admin_required
def save_page(page_id=None):
    data = request.form.to_dict()

    properties = {
        "Nombre": {"title": [{"text": {"content": data.get('name', '')}}]},
        "País": {"rich_text": [{"text": {"content": data.get('country', '')}}]},
        "URL": {"url": data.get('url', '')},
        "Destinatarios": {"rich_text": [{"text": {"content": data.get('recipients', '')}}]}
    }

    headers = {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }

    if page_id:
        update_url = f"https://api.notion.com/v1/pages/{page_id}"
        response = requests.patch(update_url, headers=headers, json={"properties": properties})
    else:
        create_url = "https://api.notion.com/v1/pages"
        parent = {"database_id": DATABASE_ID}
        response = requests.post(create_url, headers=headers, json={"parent": parent, "properties": properties})

    if response.status_code not in [200, 201]:  # 200 OK for update, 201 Created for create
        print(f"Failed to process page: {response.status_code}, {response.text}")  # Debugging
        return "Failed to process page", 400

    # Redirect to the /database route to display all pages
    return redirect(url_for('all_pages'))








