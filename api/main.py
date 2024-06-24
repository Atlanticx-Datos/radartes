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

from typing_extensions import LiteralString
from werkzeug.wrappers import response

import requests
import json
import os

from os import environ as env
from urllib.parse import quote_plus, urlencode
from authlib.integrations.flask_client import OAuth

from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from flask_socketio import SocketIO
import socket as py_socket

from concurrent.futures import ThreadPoolExecutor

load_dotenv()
print("Loaded AUTH0_DOMAIN:", os.environ.get("AUTH0_DOMAIN"))


app = Flask(__name__, static_folder='../static', static_url_path='/static', template_folder='../templates')
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "default_fallback_secret_key")

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

    return render_template("user_opportunities.html", opportunities=opportunities)

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

# App Logic

@app.context_processor
def inject_og_data():
    og_data = {
        "title": "100 ︱ Oportunidades",
        "description": "Convocatorias, Becas y Recursos Globales para Artistas.",
        "url": "http://oportunidades-vercel.vercel.app",
        "image": "http://oportunidades-vercel.vercel.app/static/public/Logo_Grande_Atx.png"
    }
    return dict(og_data=og_data)

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

@app.route("/database", methods=["GET"])
@login_required
def all_pages():
    search_query = request.args.get("search", "")
    url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
    headers = {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }

    # Calculate the current date and the date 6 months from now
    now = datetime.now().strftime('%Y-%m-%d')
    six_months_from_now = (datetime.now() + relativedelta(months=6)).strftime('%Y-%m-%d')

    # Define the date filter to cover the next 6 months and include empty dates
    dynamic_date_filter = {
        "or": [
            {
                "property": "Fecha de cierre",
                "date": {
                    "after": now,
                    "before": six_months_from_now
                }
            },
            {
                "property": "Fecha de cierre",
                "date": {
                    "is_empty": True
                }
            }
        ]
    }

    # Define the search filter
    search_filter = {
        "or": [
            {"property": "Resumen generado por la IA", "rich_text": {"contains": search_query}},
            {"property": "País", "rich_text": {"contains": search_query}},
            {"property": "Destinatarios", "rich_text": {"contains": search_query}}
        ]
    }

    # Construct the main filter
    main_filter = {
        "and": [
            {"property": "Publicar", "checkbox": {"equals": True}},
            dynamic_date_filter
        ]
    }

    # If there is a search query, add the search filter to the main filter
    if search_query:
        main_filter["and"].append(search_filter)

    json_body = {"filter": main_filter}

    res = requests.post(url, headers=headers, json=json_body)
    data = res.json()

    # Debugging statements to inspect the API response
    print("API Response Results Count:", len(data.get("results", [])))
    # print("API Response Data Structure:", data)

    pages = []
    upcoming_pages = []
    empty_fecha_pages = []

    if data and data.get("results"):
        now_date = datetime.now()
        end_of_month = datetime(now_date.year, now_date.month + 1, 1) - timedelta(days=1)
        placeholder_date = '1900-01-01'  # Placeholder date for pages without fecha_de_cierre

        for page in data["results"]:
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

                # Check if "Fecha de cierre" property exists and has a date
                fecha_de_cierre_prop = page["properties"].get("Fecha de cierre", None)
                fecha_de_cierre = None
                if fecha_de_cierre_prop and "date" in fecha_de_cierre_prop and fecha_de_cierre_prop["date"]:
                    fecha_de_cierre = fecha_de_cierre_prop["date"].get("start", None)
                
                # Debugging statement to print each page's fecha_de_cierre value
                # print("Page ID:", page["id"], "Fecha de Cierre:", fecha_de_cierre if fecha_de_cierre else "None")
                
                if fecha_de_cierre:
                    page_data["fecha_de_cierre"] = fecha_de_cierre
                    cierre_date = datetime.strptime(fecha_de_cierre, '%Y-%m-%d')
                    # if cierre_date.strftime('%Y-%m-%d') == '2024-06-30':
                    #     print("Page with 6/30/2024 Fecha de Cierre:", page_data)

                    if now_date <= cierre_date <= end_of_month:
                        upcoming_pages.append(page_data)
                else:
                    # Check if "Destinatarios" property equals "Destacar"
                    if page_data.get("destinatarios") == "Destacar":
                        # Assign placeholder date and append to empty_fecha_pages
                        # print("Page without Fecha de Cierre:", page_data)
                        page_data["fecha_de_cierre"] = placeholder_date
                        empty_fecha_pages.append(page_data)
                    else:
                        # Ensure the key is present even if not adding to empty_fecha_pages
                        page_data["fecha_de_cierre"] = placeholder_date

                pages.append(page_data)

        # Sort pages by fecha_de_cierre, placing pages with placeholder fecha_de_cierre at the bottom
        sorted_pages = sorted(pages, key=lambda page: (page["fecha_de_cierre"] == placeholder_date, page["fecha_de_cierre"]), reverse=True)
    else:
        sorted_pages = []

    if request.headers.get('HX-Request', 'false').lower() == 'true':
        print("HTMX request with search:", search_query)
        return render_template("_search_results.html", pages=sorted_pages)
    else:
        print("Regular request")
        return render_template(
            "database.html", 
            pages=sorted_pages, 
            current_month_pages=upcoming_pages, 
            empty_fecha_pages=empty_fecha_pages
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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
