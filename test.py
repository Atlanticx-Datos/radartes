import requests

url = "http://127.0.0.1:5000/create"  # replace with your server's URL

data = {
    "Nombre": {"title": [{"text": {"content": "Test de Nombre"}}]},
    "País": {"rich_text": [{"text": {"content": "Test de País"}}]},
    "URL": {"url": "https://www.example.com"},
    "Destinatarios": {"rich_text": [{"text":{"content": "Test de Destinatario"}}]}
}

response = requests.post(url, json=data)

print(response.status_code)
print(response.text)