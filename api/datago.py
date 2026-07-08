import os
import requests
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        query = parse_qs(parsed_path.query)
        
        # 호출할 상세 기능(예: getBrBasisOulnInfo)을 가져옵니다.
        endpoint = query.get('endpoint', [''])[0]
        
        # 1. 환경변수에서 키를 가져오되, unquote를 하지 않고 원본 그대로 사용합니다.
        # 인코딩이 두 번 적용되는 문제를 방지합니다.
        raw_key = os.environ.get('DATA_KEY', '8badc9836e19e169b28c280ac25e8c4c0fba9aed68e7f39ee470c5968805a21').strip()
        
        # 2. 공식 문서에 명시된 BldRgstHubService 엔드포인트 경로로 수정하였습니다.
        url = f"https://apis.data.go.kr/1613000/BldRgstHubService/{endpoint}"
        
        params = {
            "serviceKey": raw_key,
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
            # 외부 API 호출
            res = requests.get(url, params=params, timeout=20)
            
            # API 응답 결과 로깅 (디버깅용)
            if res.status_code != 200:
                print(f"API Error Code: {res.status_code}, Body: {res.text}")
            
            self.send_response(res.status_code)
            self.send_header('Content-type', 'application/xml; charset=utf-8')
            self.end_headers()
            self.wfile.write(res.content)
            
        except Exception as e:
            # 서버 내부 에러 발생 시 로그 출력
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))