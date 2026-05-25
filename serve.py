"""
田径计时系统 - 本地服务器
运行方式: python serve.py
然后在手机浏览器打开: http://电脑IP:8080
"""
import http.server, socketserver, socket, os, sys

PORT = 8080
DIR  = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIR, **kw)

    def end_headers(self):
        # Required for camera/mic on local network (not HTTPS)
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def log_message(self, fmt, *args):
        print(f"  {self.address_string()} → {fmt % args}")

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return '127.0.0.1'

if __name__ == '__main__':
    ip = get_local_ip()
    print('=' * 50)
    print('  🏃 田径计时系统 — 本地服务器')
    print('=' * 50)
    print(f'  本机访问:  http://localhost:{PORT}')
    print(f'  局域网访问: http://{ip}:{PORT}')
    print(f'  (手机与电脑连同一WiFi，用局域网地址)')
    print('  按 Ctrl+C 停止服务器')
    print('=' * 50)
    with socketserver.TCPServer(('', PORT), Handler) as httpd:
        httpd.allow_reuse_address = True
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n服务器已停止')
