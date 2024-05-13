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
                "returnTo": url_for("index", _external=True),
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

@app.route('/create', methods=['POST'])
@login_required
def handle_create():
    data = request.get_json()
    required_fields = ["Nombre", "País", "URL", "Destinatarios"]

    # Check if data is None or if any required field is missing
    if not data or any(field not in data for field in required_fields):
        return "Invalid data: all fields are required", 400

    # Check if each field is a dict (this requieres a middleware integration with the form frontend)
    for field, value in data.items():
        if not isinstance(value, dict):
            return f"Invalid data: {field} should be a dictionary", 400
        response = create_page(data)
        return response

def create_page(data: dict):
    create_url = "https://api.notion.com/v1/pages"
    payload = {"parent": {"database_id": DATABASE_ID}, "properties": data}
    res = requests.post(create_url, headers=headers, json=payload)
    return res.text


@app.route('/database', methods=['GET'])
@login_required
def all_pages():
    print("Session Data:", session.get('user'))
    url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
    res = requests.post(url, headers=headers)
    data = res.json()

    if not data or not data.get('results'):
        return render_template("database.html", pages=[])

    property_name = "Nombre" 
    pages = [{'id': page['id'], 'name': page['properties'][property_name]['title'][0]['text']['content'], 'created_time': page['created_time']} for page in data['results'] if property_name in page['properties']]
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

@app.route('/save/<page_id>', methods=['POST'])
@admin_required
def save_page(page_id):
    # Update the page with the form data
    data = request.form.to_dict()
    properties = {"Nombre": {"title": [{"text": {"content": data['name']}}]}}
    update_url = f"https://api.notion.com/v1/pages/{page_id}"
    payload = {"properties": properties}
    res = requests.patch(update_url, headers=headers, json=payload)

    if res.status_code != 200:
        return "Failed to update page", 400

    # Redirect to the /database route to display all pages
    return redirect(url_for('all_pages'))








