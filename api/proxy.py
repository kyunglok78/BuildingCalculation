import os
import requests
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 1. 환경변수에서 데이터 키 가져오기
        data_key = os.environ.get('DATA_KEY')
        
        # 2. 웹에서 넘겨준 주소 파라미터 가져오기 (예: address=...)
        # (여기에 실제 공공데이터 API 호출 URL을 작성하세요)
        url = "http://apis.data.go.kr/1613000/Bld100/getBuilding"
        params = {
            "serviceKey": data_key,
            "address": "강남구 테헤란로 334", # 실제로는 웹에서 전달받은 값으로 대체
            "_type": "json"
        }
        
        # 3. 데이터 요청
        response = requests.get(url, params=params)
        
        # 4. 결과 반환
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(response.content)