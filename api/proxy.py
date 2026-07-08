import os
import requests
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 파라미터 가져오기 (주소 등)
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        # 여기서 아까 Vercel에 설정한 환경변수(DATA_KEY)를 사용합니다.
        key = os.environ.get('DATA_KEY')
        
        # 공공데이터 API 호출 예시 (실제 호출 URL로 수정 필요)
        # url = f"http://apis.data.go.kr/1613000/.../getBuilding?serviceKey={key}&..."
        
        # 결과 반환
        self.wfile.write(b'{"status": "중계기가 연결되었습니다!"}')