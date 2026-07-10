from datetime import datetime

class BuildingDataProcessor:
    @staticmethod
    def process_raw_to_eval_format(site_name, df_recap, df_title, df_floor):
        """
        API 원시 데이터를 프론트엔드가 사용할 완벽한 평가용 JSON 형태로 정제합니다.
        """
        eval_data = {'title': {site_name: {}}, 'floor': {site_name: {}}}
        
        # [Rule 1] 준공연도 (승인일자) 빈칸 방어 (Fallback)
        fallback_year = datetime.now().year
        if not df_recap.empty and "사용승인일" in df_recap.columns:
            apr_date = str(df_recap.iloc[0].get("사용승인일", "")).strip().replace("-", "").replace("/", "")
            if len(apr_date) >= 4 and apr_date[:4].isdigit():
                fallback_year = int(apr_date[:4])

        # ==========================================
        # 1. 표제부(Title) 정제
        # ==========================================
        title_records = []
        if not df_title.empty:
            for idx, row in df_title.iterrows():
                # [Rule 4] 동명칭 빈칸 예외 처리
                dong_nm = str(row.get("동명칭", "본동")).strip()
                if dong_nm in ["", "-", "nan"]: dong_nm = "본동"
                
                # 연도 보정
                t_date = str(row.get("사용승인일", "")).replace("-", "").replace("/", "")
                b_year = int(t_date[:4]) if len(t_date) >= 4 and t_date[:4].isdigit() else fallback_year
                
                try: area = float(str(row.get("연면적(m²)", "0")).replace(",", ""))
                except: area = 0.0

                record = {
                    "일련번호": str(idx + 1), "동명칭": dong_nm, "용도": str(row.get("주용도(건물별)", "-")),
                    "연면적": area, "구조": str(row.get("구조코드명", "-")), "준공연도": b_year,
                    "구조코드": "-", "단가": 0, "노무비": 0, "물가지수": 1.0, "감가율": 1.78,
                    "재조달_건축": 0, "현재_건축": 0, "잔가율": 100
                }
                title_records.append(record)
                
            # 프론트엔드 그룹핑 규격에 맞게 매핑
            eval_data['title'][site_name] = {
                "동그룹": {"동명칭": "표제부전체", "records": title_records, "부속비율": 20.0, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0}
            }

        # ==========================================
        # 2. 층별(Floor) 정제
        # ==========================================
        floor_groups = {}
        # [Rule 3] 상속을 위해 표제부 데이터 캐싱 (추후 사용자가 저장한 코드를 백엔드에 쏠 때를 대비한 맵)
        title_map = {r["동명칭"]: r for r in title_records}

        if not df_floor.empty:
            for idx, row in df_floor.iterrows():
                dong_nm = str(row.get("동명칭", "본동")).strip()
                if dong_nm in ["", "-", "nan"]: dong_nm = "본동"

                # [Rule 2] 층별 용도 지능형 조립
                flr_gb = str(row.get("층구분", "")).strip()
                flr_no = str(row.get("층번호", "")).strip()
                etc_purps = str(row.get("기타용도", "-")).strip()
                flr_text = f"{flr_gb} {flr_no}층".strip() if flr_no else ""
                purps_assembled = f"[{flr_text}] {etc_purps}" if flr_text else etc_purps

                try: area = float(str(row.get("면적(m²)", "0")).replace(",", ""))
                except: area = 0.0

                record = {
                    "일련번호": str(idx + 1), "동명칭": dong_nm, "용도": purps_assembled,
                    "연면적": area, "구조": str(row.get("구조코드명", "-")), "준공연도": fallback_year,
                    "구조코드": "-", "단가": 0, "노무비": 0, "물가지수": 1.0, "감가율": 1.78,
                    "재조달_건축": 0, "현재_건축": 0, "잔가율": 100
                }

                # [Rule 3] 데이터 상속 적용
                if dong_nm in title_map and title_map[dong_nm]["구조코드"] != "-":
                    record["구조코드"] = title_map[dong_nm]["구조코드"]
                    record["단가"] = title_map[dong_nm]["단가"]
                    record["노무비"] = title_map[dong_nm]["노무비"]

                if dong_nm not in floor_groups:
                    floor_groups[dong_nm] = {"동명칭": dong_nm, "records": [], "부속비율": 20.0, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0}
                floor_groups[dong_nm]["records"].append(record)

            eval_data['floor'][site_name] = floor_groups

        return eval_data