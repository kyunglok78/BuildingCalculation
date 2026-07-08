import os
import requests
from urllib.parse import urlparse, parse_qs, unquote
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        query = parse_qs(parsed_path.query)
        endpoint = query.get('endpoint', [''])[0]
        
        # 질문자님의 긴 공공데이터 키(안전 장치)
        data_key = os.environ.get('DATA_KEY', '1oOOTG+s4eO71/a5Xn4xV2l7/d+k0G8w3QZ2+29e612B1R0nOq91xH5t5WwI/n5yD9vP4o7zQ7s6+V6e+368lA==')
        
        url = f"https://apis.data.go.kr/1613000/BldRgstService_2/{endpoint}"
        params = {
            "serviceKey": unquote(data_key), # 파이썬 서버와 똑같이 디코딩 처리
            "_type": "xml", 
            "numOfRows": "100", 
            "pageNo": "1",
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
        except Exception as e:
            self.send_response(500)
            self.end_headers()