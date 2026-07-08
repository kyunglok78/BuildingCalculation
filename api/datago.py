import os
import requests
from urllib.parse import urlparse, parse_qs, unquote
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        query = parse_qs(parsed_path.query)
        
        endpoint = query.get('endpoint', [''])[0]
        
        # 1. 환경변수에서 공공데이터 키를 가져옵니다. (없으면 로컬 코드에 있던 기본 키 사용)
        raw_key = os.environ.get('DATA_KEY', '1oOOTG+s4eO71/a5Xn4xV2l7/d+k0G8w3QZ2+29e612B1R0nOq91xH5t5WwI/n5yD9vP4o7zQ7s6+V6e+368lA==').strip()
        
        # 2. 핵심 포인트: requests 라이브러리의 자동 인코딩과 충돌하지 않도록 디코딩 처리
        decoded_key = unquote(raw_key)
        
        url = f"https://apis.data.go.kr/1613000/BldRgstService_2/{endpoint}"
        
        params = {
            "serviceKey": decoded_key,
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
            # 타임아웃을 20초로 넉넉하게 부여하여 공공데이터 서버 지연에 대비합니다.
            res = requests.get(url, params=params, timeout=20)
            
            self.send_response(res.status_code)
            # 공공데이터포털은 XML을 반환하므로 헤더를 XML로 지정
            self.send_header('Content-type', 'application/xml; charset=utf-8')
            self.end_headers()
            self.wfile.write(res.content)
            
        except Exception as e:
            # 에러 발생 시, 500 에러와 함께 파이썬이 내뿜는 실제 에러 메시지를 화면에 출력
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))