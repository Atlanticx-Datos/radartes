import requests
import json

url = "https://api.notion.com/v1/databases/{database_id}/query"
headers = {
    "Authorization": "Bearer {your_notion_api_key}",
    "Notion-Version": "2021-08-16",
    "Content-Type": "application/json"
}

response = requests.post(url, headers=headers)

data = response.json()