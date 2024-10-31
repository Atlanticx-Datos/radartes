from http.server import BaseHTTPRequestHandler
from main import fetch_notion_pages  # Import your existing function

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            fetch_notion_pages()  # This will update the cache
            self.send_response(200)
            self.end_headers()
            self.wfile.write('Cache refreshed'.encode())
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode()) 