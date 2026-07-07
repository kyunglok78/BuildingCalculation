import http.server
import socketserver
import urllib.parse
import webbrowser
import threading
import time
import requests

PORT = 8000
HTML_FILE = "index.html" # 메인 파일 이름 지정
ㅎ
GLOBAL_KAKAO_KEY = "c48e895cae6e16bc82fc1ed089539352"
GLOBAL_DATA_KEY = "1oOOTG+s4eO71/a5Xn4xV2l7/d+k0G8w3QZ2+29e612B1R0nOq91xH5t5WwI/n5yD9vP4o7zQ7s6+V6e+368lA=="

class APIProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        if parsed_path.path == '/api/kakao':
            query = urllib.parse.parse_qs(parsed_path.query)
            addr = query.get('query', [''])[0]
            url = "[https://dapi.kakao.com/v2/local/search/address.json](https://dapi.kakao.com/v2/local/search/address.json)"
            headers = {"Authorization": f"KakaoAK {GLOBAL_KAKAO_KEY}"}
            try:
                res = requests.get(url, headers=headers, params={"query": addr}, timeout=10)
                self.send_response(res.status_code)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(res.content)
            except Exception:
                self.send_response(500)
                self.end_headers()
                
        elif parsed_path.path == '/api/datago':
            query = urllib.parse.parse_qs(parsed_path.query)
            endpoint = query.get('endpoint', [''])[0]
            url = f"[https://apis.data.go.kr/1613000/BldRgstService_2/](https://apis.data.go.kr/1613000/BldRgstService_2/){endpoint}"
            params = {
                "serviceKey": requests.utils.unquote(GLOBAL_DATA_KEY),
                "_type": "xml", "numOfRows": "100", "pageNo": "1",
                "sigunguCd": query.get('sigunguCd', [''])[0],
                "bjdongCd": query.get('bjdongCd', [''])[0],
                "platGbCd": query.get('platGbCd', [''])[0],
                "bun": query.get('bun', [''])[0],
                "ji": query.get('ji', [''])[0]
            }
            try:
                res = requests.get(url, params=params, timeout=15)
                self.send_response(res.status_code)
                self.send_header('Content-type', 'application/xml; charset=utf-8')
                self.end_headers()
                self.wfile.write(res.content)
            except Exception:
                self.send_response(500)
                self.end_headers()
        else:
            super().do_GET()

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), APIProxyHandler) as httpd:
        httpd.serve_forever()

print("======================================================")
print(" KB손해보험 가액평가 백엔드 서버 시작 중...")
print("======================================================")

threading.Thread(target=start_server, daemon=True).start()
time.sleep(1.5)
url = f"http://localhost:{PORT}/{HTML_FILE}"
print(f"브라우저에서 시스템 창을 엽니다: {url}")
webbrowser.open_new(url)

input("\n[안내] 프로그램을 종료하시려면 이 콘솔 창을 닫거나 엔터를 누르세요.\n")

