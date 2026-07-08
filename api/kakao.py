import os
import requests
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        query = parse_qs(parsed_path.query)
        addr = query.get('query', [''])[0]
        
        # Vercel 환경변수를 쓰거나, 없으면 질문자님의 키를 그대로 사용 (안전 장치)
        kakao_key = os.environ.get('KAKAO_KEY', '030dc3e5950b6682f690e3cefd2d8095')
        
        url = "https://dapi.kakao.com/v2/local/search/address.json"
        headers = {"Authorization": f"KakaoAK {kakao_key}"}
        
        try:
            res = requests.get(url, headers=headers, params={"query": addr}, timeout=10)
            self.send_response(res.status_code)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(res.content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()