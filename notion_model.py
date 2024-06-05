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

from datetime import datetime, timedelta

from flask_socketio import SocketIO
import socket as py_socket

load_dotenv()
print("Loaded AUTH0_DOMAIN:", os.environ.get("AUTH0_DOMAIN"))


app: Flask = Flask(__name__)
socketio = SocketIO(app)

app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "default_fallback_secret_key")

app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_COOKIE_SECURE"] = False
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_PERMANENT"] = True  # Ensure sessions don't expire immediately
app.config["SESSION_USE_SIGNER"] = (
    True  # Optionally, enhance security by signing the session cookie
)


Session(app)  # Initialize session

# Role-Base Access Mgmt
app.config["JWT_SECRET_KEY"] = "daleboquita"  # Change this to your actual secret key
jwt = JWTManager(app)


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
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
        return redirect(url_for("index"))
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

        if not selected_pages:
            return jsonify({"error": "No pages selected"}), 400

        for page_id in selected_pages:
            # Check if the opportunity is already saved
            if is_opportunity_already_saved(user_id, page_id):
                continue  # Skip already saved opportunities

            # Save the opportunity to the user's saved opportunities in Notion
            save_to_notion(user_id, page_id)

        success_message = """
        <div role="alert" class="alert alert-success w-1/2 m-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Oportunidad(es) guardada(s) exitosamente!</span>
        </div>
        """

        return success_message, 200
    except Exception as e:
        print("Error:", str(e))
        return jsonify({"error": str(e)}), 400


@app.route("/saved_opportunities", methods=["GET"])
@login_required
def list_saved_opportunities():
    user_id = session["user"]["sub"]

    # Fetch saved opportunity IDs from Notion
    opportunity_ids = get_saved_opportunity_ids(user_id)
    print("Fetched opportunity IDs:", opportunity_ids)  # Debugging statement

    # Fetch detailed information for each opportunity
    opportunities = [
        get_opportunity_by_id(opportunity_id) for opportunity_id in opportunity_ids
    ]
    print("Fetched opportunities:", opportunities)  # Debugging statement

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
    print("Opportunity IDs from Notion:", opportunity_ids)  # Debugging statement
    return opportunity_ids


def get_opportunity_by_id(opportunity_id):
    url = f"https://api.notion.com/v1/pages/{opportunity_id}"
    headers = {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }

    response = requests.get(url, headers=headers)
    response.raise_for_status()  # Raise an exception for HTTP errors
    data = response.json()

    opportunity = {
        "id": data["id"],
        "nombre": data["properties"].get("Nombre", {}).get("title", [{}])[0].get("text", {}).get("content", ""),
        "país": data["properties"].get("País", {}).get("rich_text", [{}])[0].get("text", {}).get("content", ""),
        "destinatarios": data["properties"].get("Destinatarios", {}).get("rich_text", [{}])[0].get("text", {}).get("content", ""),
        "resumen_IA": data["properties"].get("Resumen generado por la IA", {}).get("rich_text", [{}])[0].get("text", {}).get("content", ""),
        "url": data["properties"].get("URL", {}).get("url", ""),
        "nombre_original": data["properties"].get("Nombre", {}).get("title", [{}])[0].get("text", {}).get("content", ""),
        "ai_keywords": (data["properties"].get("AI keywords", {}).get("multi_select", [{}])[0].get("name") if data["properties"].get("AI keywords", {}).get("multi_select") else ""),
        "fecha_de_cierre": data["properties"].get("Fecha de cierre", {}).get("date", {}).get("start", "")
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

    # Delete the first matching result (assuming there is only one)
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
        print(
            "Attempting to delete saved opportunity with ID:", page_id
        )  # Debugging statement

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


@app.route("/")
def index():
    print(
        "Current Session Data at Index:", session.get("user")
    )  # Debug: print session data
    if "user" in session:
        user = session["user"]
        return render_template(
            "index.html", user=user, pretty=json.dumps(user, indent=4)
        )
    else:
        return render_template("index.html", user=None, pretty="No user data")


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

    # Expand the date range to cover the entire month of June 2024
    expanded_date_filter = {
        "property": "Fecha de cierre",
        "date": {
            "after": "2024-05-31",
            "before": "2024-07-01"
        }
    }

    json_body = {
        "filter": {
            "and": [
                {"property": "Publicar", "checkbox": {"equals": True}},
                {
                    "or": [
                        {"property": "Resumen generado por la IA", "rich_text": {"contains": search_query}},
                        {"property": "País", "rich_text": {"contains": search_query}},
                        {"property": "Destinatarios", "rich_text": {"contains": search_query}},
                        expanded_date_filter
                    ]
                },
            ]
        }
    }

    res = requests.post(url, headers=headers, json=json_body)
    data = res.json()

    # Debugging statements to inspect the API response
    print("API Response Results Count:", len(data.get("results", [])))

    pages = []
    upcoming_pages = []
    empty_fecha_pages = []

    if data and data.get("results"):
        now = datetime.now()
        end_of_month = datetime(now.year, now.month + 1, 1) - timedelta(days=1)

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

                if "Fecha de cierre" in page["properties"] and page["properties"]["Fecha de cierre"]["date"]:
                    fecha_de_cierre = page["properties"]["Fecha de cierre"]["date"]["start"]
                    page_data["fecha_de_cierre"] = fecha_de_cierre if fecha_de_cierre else ""

                    # Debugging statement to print each page's fecha_de_cierre value
                    print("Page ID:", page["id"], "Fecha de Cierre:", fecha_de_cierre)

                    if fecha_de_cierre:
                        cierre_date = datetime.strptime(fecha_de_cierre, '%Y-%m-%d')
                        if cierre_date.strftime('%Y-%m-%d') == '2024-06-30':
                            print("Page with 6/30/2024 Fecha de Cierre:", page_data)

                        if now <= cierre_date <= end_of_month:
                            upcoming_pages.append(page_data)
                    else:
                        empty_fecha_pages.append(page_data)

                else:
                    page_data["fecha_de_cierre"] = ""
                    empty_fecha_pages.append(page_data)

                pages.append(page_data)

        sorted_pages = sorted(pages, key=lambda page: page["fecha_de_cierre"], reverse=True)
    else:
        sorted_pages = []

    # Debugging statements to inspect the lists before rendering
    print("Pages List:", pages)
    print("Sorted Pages:", sorted_pages)
    print("Upcoming Pages:", upcoming_pages)
    print("Empty Fecha Pages:", empty_fecha_pages)

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
    if not value:
        return ''
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

if __name__ == '__main__':
    port = 5000
    print(f"Running on http://127.0.0.1:{port}")
    socketio.run(app, debug=True, port=port, use_reloader=True)
