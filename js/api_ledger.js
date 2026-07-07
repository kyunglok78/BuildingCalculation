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
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 시스템 연동 중...';
    btn.disabled = true;
    tabsContainer.innerHTML = ''; 
    dataContainer.innerHTML = ''; 
    let fetchedResults = [];

    const baseUrl = (window.location.protocol === 'file:' || window.location.protocol === 'blob:') ? 'http://localhost:8000' : '';

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
                if(!kakaoRes.ok) throw new Error("카카오 API 통신 실패");
                
                const kakaoJson = await kakaoRes.json();
                if(!kakaoJson.documents || kakaoJson.documents.length === 0) throw new Error("주소를 찾을 수 없음");
                const doc = kakaoJson.documents[0].address;
                
                const codes = {
                    sigunguCd: doc.h_code ? doc.h_code.substring(0, 5) : "00000",          
                    bjdongCd: doc.b_code ? doc.b_code.substring(5) : "00000",              
                    platGbCd: doc.mountain_yn === 'Y' ? '2' : '0',  
                    bun: (doc.main_address_no || '').padStart(4, '0'), 
                    ji: doc.sub_address_no ? doc.sub_address_no.padStart(4, '0') : '0000' 
                };
                
                const fetchEndpoint = async (endpoint, colMap) => {
                    const url = `${baseUrl}/api/datago?endpoint=${endpoint}&sigunguCd=${codes.sigunguCd}&bjdongCd=${codes.bjdongCd}&platGbCd=${codes.platGbCd}&bun=${codes.bun}&ji=${codes.ji}`;
                    const res = await fetch(url);
                    if(!res.ok) throw new Error(`공공데이터 연동 실패`);
                    const xmlText = await res.text();
                    return parseXMLToJSON(xmlText, colMap);
                };
                
                const totalColMap = [["platPlc", ["platPlc"]], ["bldNm", ["bldNm"]], ["mainPurpsCdNm", ["mainPurpsCdNm"]], ["mainBldCnt", ["mainBldCnt"]], ["atchBldCnt", ["atchBldCnt"]], ["totArea", ["totArea"]], ["prmDay", ["prmDay"]], ["stcDay", ["stcDay"]], ["useAprvDay", ["useAprvDay"]]];
                const titleColMap = [["dongNm", ["dongNm"]], ["mainPurpsCdNm", ["mainPurpsCdNm"]], ["grndFlrCnt", ["grndFlrCnt"]], ["ugrndFlrCnt", ["ugrndFlrCnt"]], ["totArea", ["totArea"]], ["strctCdNm", ["strctCdNm"]], ["roofCdNm", ["roofCdNm"]], ["useAprvDay", ["useAprvDay"]]];
                const floorColMap = [["dongNm", ["dongNm"]], ["flrGbCdNm", ["flrGbCdNm"]], ["flrNoNm", ["flrNoNm"]], ["area", ["area"]], ["etcPurps", ["etcPurps"]], ["strctCdNm", ["strctCdNm"]]];

                totalData = await fetchEndpoint('getBrBasisOulnInfo', totalColMap);
                titleData = await fetchEndpoint('getBrTitleInfo', titleColMap);
                floorData = await fetchEndpoint('getBrFlrOulnInfo', floorColMap);
                
                if(totalData.length > 0 || titleData.length > 0) isSuccess = true;
                else apiErrMsg = "공공데이터에 정보가 존재하지 않습니다.";
            } catch(e) {
                console.error("API 연동 에러:", e);
                apiErrMsg = "가상데이터를 적용합니다.";
            }

            if (!isSuccess) {
                totalData = [{ platPlc: locAddr, bldNm: `${locName} (메인동)`, mainPurpsCdNm: '공장', mainBldCnt: 1, atchBldCnt: 0, totArea: 1633.95, prmDay: '20140201', stcDay: '20140301', useAprvDay: '20141104' }];
                titleData = [{ dongNm: '1동', mainPurpsCdNm: '공장', grndFlrCnt: 3, ugrndFlrCnt: 0, totArea: 1633.95, strctCdNm: '일반철골구조', roofCdNm: '기타지붕', useAprvDay: '20141104' }];
                floorData = [{ dongNm: '1동', flrGbCdNm: '지상', flrNoNm: '1층', area: 544.65, etcPurps: '공장', strctCdNm: '일반철골구조' }];
            }

            fetchedResults.push({ index, locName, locAddr, totalData, titleData, floorData, isSuccess, apiErrMsg });
        }
    }
    executeLedgerRender(fetchedResults);
}

function executeMockLedgerFetch() {
    // 생략 (가상 데이터 렌더링 로직)
}

function executeLedgerRender(results) {
    const btn = document.getElementById('btnFetchApi');
    const emptyMsg = document.getElementById('emptyStateMsg');
    const dataContainer = document.getElementById('fetchedDataContainer');
    const tabsContainer = document.getElementById('slide3Tabs');

    let hasActive = false;

    results.forEach(res => {
        const { index, locName, locAddr, totalData, titleData, floorData, isSuccess, apiErrMsg } = res;
        
        const trTotal = totalData.map(d => `<tr><td>${d.platPlc || locAddr}</td><td>${d.bldNm||'-'}</td><td>${d.mainPurpsCdNm||'-'}</td><td>${d.mainBldCnt||'0'}</td><td>${d.atchBldCnt||'0'}</td><td>${d.totArea||'0'}</td><td>${d.prmDay||'-'}</td><td>${d.stcDay||'-'}</td><td>${d.useAprvDay||'-'}</td></tr>`).join('');
        const trTitle = titleData.map(d => `<tr><td>${d.dongNm||'-'}</td><td>${d.mainPurpsCdNm||'-'}</td><td>${d.grndFlrCnt||'0'}</td><td>${d.ugrndFlrCnt||'0'}</td><td>${d.totArea||'0'}</td><td>${d.strctCdNm||'-'}</td><td>${d.roofCdNm || '기타지붕'}</td><td>${d.useAprvDay||'-'}</td></tr>`).join('');
        const trFloor = floorData.map(d => `<tr><td>${d.dongNm||'-'}</td><td>${d.flrGbCdNm||'-'}</td><td>${d.flrNoNm||'-'}</td><td>${d.area||'0'}</td><td>${d.etcPurps||'-'}</td><td>${d.strctCdNm||'-'}</td><td>기타지붕</td></tr>`).join('');

        const tabDiv = document.createElement('div');
        tabDiv.className = hasActive ? 'tab' : 'tab active';
        tabDiv.textContent = locName;
        tabDiv.onclick = function() { switchApiTab(this, index); };
        tabsContainer.appendChild(tabDiv);

        const statusBadge = isSuccess ? '<span style="color:#28a745; font-size:12px;"><i class="fa-solid fa-check"></i> 리얼 데이터 연동성공</span>' : `<span style="color:#dc3545; font-size:12px;"><i class="fa-solid fa-triangle-exclamation"></i> ${apiErrMsg}</span>`;

        const locDataHTML = `
        <div id="api-loc-${index}" style="display: ${hasActive ? 'none' : 'block'};">
            <div style="margin-bottom: 25px;"><div class="section-title" style="font-size: 14px;">■ [${locName}] 총괄표제부 정보 ${statusBadge}</div><table class="data-table"><thead><tr><th>대지위치</th><th>건물명</th><th>주용도</th><th>주건축물수</th><th>부속건축물수</th><th>연면적(m²)</th><th>허가일</th><th>착공일</th><th>사용승인일</th></tr></thead><tbody>${trTotal}</tbody></table></div>
            <div style="margin-bottom: 25px;"><div class="section-title" style="font-size: 14px;">■ 표제부 상세</div><table class="data-table"><thead><tr><th>동명칭</th><th>주용도(건물별)</th><th>지상층수</th><th>지하층수</th><th>연면적(m²)</th><th>구조코드명</th><th>지붕코드명</th><th>사용승인일</th></tr></thead><tbody>${trTitle}</tbody></table></div>
            <div><div class="section-title" style="font-size: 14px;">■ 층별 개요</div><table class="data-table"><thead><tr><th>동명칭</th><th>층구분</th><th>층번호</th><th>면적(m²)</th><th>기타용도</th><th>구조코드명</th><th>지붕코드명</th></tr></thead><tbody>${trFloor}</tbody></table></div>
        </div>`;
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
