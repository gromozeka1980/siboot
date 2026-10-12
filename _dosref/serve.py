# Dev static server that can also save POSTed screenshots.  usage: serve.py PORT [ROOT] [SHOTDIR]
import http.server, os, sys
here = os.path.dirname(os.path.abspath(__file__))
port = int(sys.argv[1])
root = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else here
shots = os.path.abspath(sys.argv[3]) if len(sys.argv) > 3 else os.path.join(here, 'shots')
os.makedirs(shots, exist_ok=True)
os.chdir(root)
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def do_POST(self):
        data = self.rfile.read(int(self.headers['Content-Length']))
        if self.path == '/__review':  # art review decisions (web/remake/review.html) -> remake_art/review.json
            open(os.path.join(here, '..', 'remake_art', 'review.json'), 'wb').write(data)
        else:
            open(os.path.join(shots, os.path.basename(self.path)), 'wb').write(data)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
class S(http.server.ThreadingHTTPServer):
    request_queue_size = 256  # default listen backlog is 5: the game's parallel asset fetches overflowed it -> "Failed to fetch"
    daemon_threads = True
S(('', port), H).serve_forever()
