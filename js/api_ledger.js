function getXmlText(xmlDoc, tag, defaultVal = "-") {
    const nodes = xmlDoc.getElementsByTagName(tag);
    if (nodes && nodes.length > 0 && nodes[0].textContent && nodes[0].textContent.trim() !== "") {
        return nodes[0].textContent.trim();
    }
    return defaultVal;
}

function parseXMLToJSON(xmlText, colMap) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        // 공공데이터포털 에러 노드 체크 (.getBrTitleInfo 등 에러 발생 시)
        const cmmMsgHeader = xmlDoc.getElementsByTagName("cmmMsgHeader");
        if(cmmMsgHeader && cmmMsgHeader.length > 0) {
            const returnAuthMsg = getXmlText(xmlDoc, "returnAuthMsg");
            const returnReasonCode = getXmlText(xmlDoc, "returnReasonCode");
            throw new Error(`[공공데이터포털 인증에러 ${returnReasonCode}] ${returnAuthMsg}`);
        }

        const resultCode = getXmlText(xmlDoc, "resultCode");
        if (resultCode !== "00" && resultCode !== "-") {
            const resultMsg = getXmlText(xmlDoc, "resultMsg");
            throw new Error(resultMsg);
        }

        const items = xmlDoc.getElementsByTagName("item");
        if(items.length === 0) return [];
        
        let result = [];
        for(let i=0; i<items.length; i++) {
            let obj = {};
            for (let j=0; j<colMap.length; j++) {
                const pyKey = colMap[j][0];
                const tags = colMap[j][1];
                let val = "-";
                for(let t=0; t<tags.length; t++) {
                    const foundVal = getXmlText(items[i], tags[t], null);
                    if(foundVal !== null) { val = foundVal; break; }
                }
                if(val === "-" && (pyKey.includes("사용승인일") || pyKey.includes("허가일") || pyKey.includes("착공일"))) {
                    val = "자료 없음";
                }
                obj[pyKey] = val;
            }
            result.push(obj);
        }
        return result;
    } catch(e) { throw e; }
}

async function simulateApiFetch() {
    const btn = document.getElementById('btnFetchApi');
    const emptyMsg = document.getElementById('emptyStateMsg');
    const dataContainer = document.getElementById('fetchedDataContainer');
    const tabsContainer = document.getElementById('slide3Tabs');
    const rows = document.getElementById('locationListBox').querySelectorAll('.list-row');
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 국토교통부 시스템 실시간 연동 중...';
    btn.disabled = true;
    tabsContainer.innerHTML = ''; 
    dataContainer.innerHTML = ''; 
    let fetchedResults = [];

    const baseUrl = 'http://localhost:8000';

    for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        if(row.querySelector('.check-ledger').checked) {
            const locName = row.querySelector('.input-short').value || `소재지 ${index+1}`;
            const locAddr = row.querySelector('.input-long').value || ``;
            if (!locAddr) continue;
            
            let isSuccess = false;
            let apiErrMsg = "";
            let totalData = [], titleData = [], floorData = [];

            try {
                const kakaoRes = await fetch(`${baseUrl}/api/kakao?query=${encodeURIComponent(locAddr)}`);
                if(!kakaoRes.ok) throw new Error("카카오 주소 변환 및 행정코드 매핑 실패");
                
                const kakaoJson = await kakaoRes.json();
                if(!kakaoJson.documents || kakaoJson.documents.length === 0) throw new Error("건축물대장을 조회할 수 없는 주소 형식입니다.");
                
                // 도로명주소 정보가 없을 때를 대비해 지번/도로명 통합 예외처리
                const doc = kakaoJson.documents[0].address || kakaoJson.documents[0].road_address;
                if(!doc) throw new Error("카카오 API 내에 매핑된 주소 좌표계가 기술되지 않았습니다.");
                
                // 카카오 주소 데이터 구조 맵핑 정밀화
                const sigunguCd = doc.h_code ? doc.h_code.substring(0, 5) : (doc.main_address_no ? "00000" : "00000");
                const bjdongCd = doc.b_code ? doc.b_code.substring(5) : "00000";
                
                const codes = {
                    sigunguCd: sigunguCd,          
                    bjdongCd: bjdongCd,              
                    platGbCd: doc.mountain_yn === 'Y' ? '2' : '0',  
                    bun: (doc.main_address_no || '').padStart(4, '0'), 
                    ji: doc.sub_address_no ? doc.sub_address_no.padStart(4, '0') : '0000' 
                };
                
                const fetchEndpoint = async (endpoint, colMap) => {
                    const url = `${baseUrl}/api/datago?endpoint=${endpoint}&sigunguCd=${codes.sigunguCd}&bjdongCd=${codes.bjdongCd}&platGbCd=${codes.platGbCd}&bun=${codes.bun}&ji=${codes.ji}`;
                    const res = await fetch(url);
                    if(!res.ok) throw new Error(`정부 공공데이터포털 서버 통신 실패 (HTTP ${res.status})`);
                    const xmlText = await res.text();
                    return parseXMLToJSON(xmlText, colMap);
                };
                
                const totalColMap = [["platPlc", ["platPlc"]], ["bldNm", ["bldNm"]], ["mainPurpsCdNm", ["mainPurpsCdNm"]], ["mainBldCnt", ["mainBldCnt"]], ["atchBldCnt", ["atchBldCnt"]], ["totArea", ["totArea"]], ["prmDay", ["prmDay"]], ["stcDay", ["stcDay"]], ["useAprvDay", ["useAprvDay"]]];
                const titleColMap = [["dongNm", ["dongNm"]], ["mainPurpsCdNm", ["mainPurpsCdNm"]], ["grndFlrCnt", ["grndFlrCnt"]], ["ugrndFlrCnt", ["ugrndFlrCnt"]], ["totArea", ["totArea"]], ["strctCdNm", ["strctCdNm"]], ["roofCdNm", ["roofCdNm"]], ["useAprvDay", ["useAprvDay"]]];
                const floorColMap = [["dongNm", ["dongNm"]], ["flrGbCdNm", ["flrGbCdNm"]], ["flrNoNm", ["flrNoNm"]], ["area", ["area"]], ["etcPurps", ["etcPurps"]], ["strctCdNm", ["strctCdNm"]]];

                totalData = await fetchEndpoint('getBrBasisOulnInfo', totalColMap);
                titleData = await fetchEndpoint('getBrTitleInfo', titleColMap);
                floorData = await fetchEndpoint('getBrFlrOulnInfo', floorColMap);
                
                if(totalData.length > 0 || titleData.length > 0) {
                    isSuccess = true;
                } else {
                    throw new Error("조회는 성공했으나 해당 지번에 등록된 건축물대장이 없습니다.");
                }
            } catch(e) {
                console.error(`[${locName}] 실시간 API 연동 차단 오류:`, e);
                isSuccess = false;
                apiErrMsg = e.message;
            }

            // 가상 데이터 백업 루틴을 완전히 격리하여 강제로 에러를 표출하게 만듭니다.
            fetchedResults.push({ index, locName, locAddr, totalData, titleData, floorData, isSuccess, apiErrMsg });
        }
    }
    executeLedgerRender(fetchedResults);
}

function executeLedgerRender(results) {
    const btn = document.getElementById('btnFetchApi');
    const emptyMsg = document.getElementById('emptyStateMsg');
    const dataContainer = document.getElementById('fetchedDataContainer');
    const tabsContainer = document.getElementById('slide3Tabs');

    let hasActive = false;

    results.forEach(res => {
        const { index, locName, locAddr, totalData, titleData, floorData, isSuccess, apiErrMsg } = res;
        
        let locDataHTML = "";
        const tabDiv = document.createElement('div');
        tabDiv.className = hasActive ? 'tab' : 'tab active';
        tabDiv.textContent = locName;
        tabDiv.onclick = function() { switchApiTab(this, index); };
        tabsContainer.appendChild(tabDiv);

        if (isSuccess) {
            const trTotal = totalData.map(d => `<tr><td>${d.platPlc || locAddr}</td><td>${d.bldNm||'-'}</td><td>${d.mainPurpsCdNm||'-'}</td><td>${d.mainBldCnt||'0'}</td><td>${d.atchBldCnt||'0'}</td><td>${d.totArea||'0'}</td><td>${d.prmDay||'-'}</td><td>${d.stcDay||'-'}</td><td>${d.useAprvDay||'-'}</td></tr>`).join('');
            const trTitle = titleData.map(d => `<tr><td>${d.dongNm||'-'}</td><td>${d.mainPurpsCdNm||'-'}</td><td>${d.grndFlrCnt||'0'}</td><td>${d.ugrndFlrCnt||'0'}</td><td>${d.totArea||'0'}</td><td>${d.strctCdNm||'-'}</td><td>${d.roofCdNm || '기타지붕'}</td><td>${d.useAprvDay||'-'}</td></tr>`).join('');
            const trFloor = floorData.map(d => `<tr><td>${d.dongNm||'-'}</td><td>${d.flrGbCdNm||'-'}</td><td>${d.flrNoNm||'-'}</td><td>${d.area||'0'}</td><td>${d.etcPurps||'-'}</td><td>${d.strctCdNm||'-'}</td><td>기타지붕</td></tr>`).join('');

            locDataHTML = `
            <div id="api-loc-${index}" style="display: ${hasActive ? 'none' : 'block'};">
                <div style="margin-bottom: 25px;"><div class="section-title" style="font-size: 14px;">■ [${locName}] 총괄표제부 정보 <span style="color:#28a745; font-size:12px;"><i class="fa-solid fa-check"></i> 실시간 연동성공</span></div><table class="data-table"><thead><tr><th>대지위치</th><th>건물명</th><th>주용도</th><th>주건축물수</th><th>부속건축물수</th><th>연면적(m²)</th><th>허가일</th><th>착공일</th><th>사용승인일</th></tr></thead><tbody>${trTotal}</tbody></table></div>
                <div style="margin-bottom: 25px;"><div class="section-title" style="font-size: 14px;">■ 표제부 상세</div><table class="data-table"><thead><tr><th>동명칭</th><th>주용도(건물별)</th><th>지상층수</th><th>지하층수</th><th>연면적(m²)</th><th>구조코드명</th><th>지붕코드명</th><th>사용승인일</th></tr></thead><tbody>${trTitle}</tbody></table></div>
                <div><div class="section-title" style="font-size: 14px;">■ 층별 개요</div><table class="data-table"><thead><tr><th>동명칭</th><th>층구분</th><th>층번호</th><th>면적(m²)</th><th>기타용도</th><th>구조코드명</th><th>지붕코드명</th></tr></thead><tbody>${trFloor}</tbody></table></div>
            </div>`;
        } else {
            // 연동 실패 시 빈 테이블 대신 명확한 에러를 꽂아줍니다.
            locDataHTML = `
            <div id="api-loc-${index}" style="display: ${hasActive ? 'none' : 'block'}; padding: 40px; text-align:center;">
                <i class="fa-solid fa-circle-exclamation" style="font-size:48px; color:#dc3545; margin-bottom:15px;"></i>
                <h3 style="color:#dc3545; margin-bottom:10px;">[${locName}] 오픈 API 조회 실패</h3>
                <p style="font-size:14px; color:#555;">실패 사유: <span style="font-weight:bold; color:#111;">${apiErrMsg}</span></p>
                <p style="font-size:12px; color:#888; margin-top:5px;">입력된 주소 정보: ${locAddr}</p>
            </div>`;
        }

        dataContainer.insertAdjacentHTML('beforeend', locDataHTML);
        hasActive = true;
    });

    btn.innerHTML = '건축물대장 조회시작';
    btn.disabled = false;
    
    if(!hasActive) {
        tabsContainer.innerHTML = '<div class="tab active">조회 대상 사업장 없음</div>';
        dataContainer.style.display = 'none';
        emptyMsg.style.display = 'block';
    } else {
        emptyMsg.style.display = 'none';
        dataContainer.style.display = 'block';
    }
}