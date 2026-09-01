// ==========================================
// 공공데이터 XML 파서 및 유틸리티 함수
// ==========================================
function getXmlText(xmlDoc, tag, defaultVal = "-") {
    const nodes = xmlDoc.getElementsByTagName(tag);
    if (nodes && nodes.length > 0 && nodes[0].textContent && nodes[0].textContent.trim() !== "") {
        return nodes[0].textContent.trim();
    }
    return defaultVal;
}

function formatDate(str) {
    if (!str || str === '-' || str === '자료 없음') return '자료 없음';
    const s = str.replace(/\D/g, ''); 
    if (s.length === 8) return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
    return str;
}

function formatNumber(str) {
    if (!str || str === '-' || str.trim() === '') return '-';
    const num = parseFloat(str.replace(/,/g, ''));
    return isNaN(num) ? str : num.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

function removeDuplicates(arr) {
    const unique = [];
    const seen = new Set();
    for (const item of arr) {
        const str = JSON.stringify(item);
        if (!seen.has(str)) { seen.add(str); unique.push(item); }
    }
    return unique;
}

// ==========================================
// 테이블 정렬 기능
// ==========================================
function sortTable(thElement) {
    const table = thElement.closest('table');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const colIndex = Array.from(thElement.parentNode.children).indexOf(thElement);
    
    let asc = thElement.dataset.asc === 'true';
    asc = !asc;
    thElement.dataset.asc = asc;
    
    Array.from(thElement.parentNode.children).forEach(th => {
        if(th !== thElement) {
            th.dataset.asc = '';
            th.innerHTML = th.innerHTML.replace(/ ▲| ▼/g, ' ▲▼');
        }
    });
    
    thElement.innerHTML = thElement.innerHTML.replace(/ ▲▼| ▲| ▼/g, '') + (asc ? ' ▲' : ' ▼');

    rows.sort((a, b) => {
        let valA = a.children[colIndex].textContent.trim();
        let valB = b.children[colIndex].textContent.trim();
        let isNumA = /^[\d,]+(\.\d+)?$/.test(valA);
        let isNumB = /^[\d,]+(\.\d+)?$/.test(valB);
        if(isNumA && isNumB) {
            return asc ? parseFloat(valA.replace(/,/g, '')) - parseFloat(valB.replace(/,/g, '')) : parseFloat(valB.replace(/,/g, '')) - parseFloat(valA.replace(/,/g, ''));
        } else {
            return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
    });

    tbody.innerHTML = '';
    rows.forEach((row, idx) => {
        row.style.backgroundColor = (idx % 2 === 0) ? '#ffffff' : '#f8f9fa';
        tbody.appendChild(row);
    });
}

function buildSortableTh(text, widthStr = '') {
    const w = widthStr ? `width:${widthStr};` : '';
    return `<th style="cursor:pointer; ${w}" onclick="sortTable(this)" data-asc="">${text} ▲▼</th>`;
}

// ==========================================
// 통신 및 파싱 로직
// ==========================================
function parseXMLToJSON(xmlText, colMap) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const cmmMsgHeader = xmlDoc.getElementsByTagName("cmmMsgHeader");
        if(cmmMsgHeader && cmmMsgHeader.length > 0) throw new Error(`[공공데이터 에러] ${getXmlText(xmlDoc, "returnAuthMsg")}`);
        
        const items = xmlDoc.getElementsByTagName("item");
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
                obj[pyKey] = val;
            }
            result.push(obj);
        }
        return removeDuplicates(result);
    } catch(e) { return []; }
}


// ============================================================================
// [수정] api_ledger.js 의 simulateApiFetch 함수 교체
// 트래픽 분산(쿨타임) 및 실패 시 자동 재시도(Retry) 로직 적용
// ============================================================================
async function simulateApiFetch() {
    const btn = document.getElementById('btnFetchApi');
    const emptyMsg = document.getElementById('emptyStateMsg');
    const dataContainer = document.getElementById('fetchedDataContainer');
    const tabsContainer = document.getElementById('slide3Tabs');
    
    const tbody = document.getElementById('locationTbody');
    const rows = tbody ? tbody.querySelectorAll('tr') : [];
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 실시간 연동 중... (서버 안정화 적용)';
    btn.disabled = true;
    tabsContainer.innerHTML = ''; dataContainer.innerHTML = ''; 
    let fetchedResults = [];
    const baseUrl = '';

    // [핵심 1] 방화벽 차단 방지 및 재시도를 위한 대기(Sleep) 함수
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const checkLedger = row.querySelector('.check-ledger') || row.querySelector('.chk-ledger');
        if(!checkLedger || !checkLedger.checked) continue;
        
        const nameInput = row.querySelector('.loc-name');
        const addrInput = row.querySelector('.addr-input');
        const locName = nameInput ? nameInput.value : `소재지 ${index+1}`;
        const locAddr = addrInput ? addrInput.value : ``;
        if (!locAddr) continue;
        
        let isSuccess = false;
        let apiErrMsg = "";
        let totalData = [], titleData = [], floorData = [];

        try {
            const kakaoRes = await fetch(`${baseUrl}/api/kakao?query=${encodeURIComponent(locAddr)}`);
            if(!kakaoRes.ok) throw new Error("카카오 주소 변환 실패");
            const kakaoJson = await kakaoRes.json();
            if(!kakaoJson.documents || kakaoJson.documents.length === 0) throw new Error("조회할 수 없는 주소 형식입니다.");
            
            const doc = kakaoJson.documents[0].address || kakaoJson.documents[0].road_address;
            const sigunguCd = doc.h_code ? doc.h_code.substring(0, 5) : "00000";
            const bjdongCd = doc.b_code ? doc.b_code.substring(5) : "00000";
            const codes = {
                sigunguCd: sigunguCd, 
                bjdongCd: bjdongCd, 
                platGbCd: doc.mountain_yn === 'Y' ? '2' : '0',  
                bun: (doc.main_address_no || '').padStart(4, '0'), 
                ji: doc.sub_address_no ? doc.sub_address_no.padStart(4, '0') : '0000' 
            };
            
            // [핵심 2] 3회 재시도(Retry) 로직이 탑재된 fetchEndpoint
            const fetchEndpoint = async (endpoint, colMap, retries = 3) => {
                const url = `${baseUrl}/api/datago?endpoint=${endpoint}&sigunguCd=${codes.sigunguCd}&bjdongCd=${codes.bjdongCd}&platGbCd=${codes.platGbCd}&bun=${codes.bun}&ji=${codes.ji}`;
                
                for (let i = 0; i < retries; i++) {
                    try {
                        const res = await fetch(url);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        
                        const xmlText = await res.text();
                        
                        // 정부 서버에서 정상 형태가 아닌 에러 메시지를 보낸 경우 강제 에러 발생
                        if (xmlText.includes("<cmmMsgHeader>") || xmlText.includes("OpenAPI_ServiceResponse")) {
                            throw new Error("공공데이터포털 트래픽 초과 또는 내부 오류 응답");
                        }
                        
                        return parseXMLToJSON(xmlText, colMap);
                    } catch (err) {
                        console.warn(`[API 호출 재시도 ${i+1}/${retries}] ${endpoint} - ${err.message}`);
                        if (i === retries - 1) {
                            throw new Error(`정부 서버 응답 지연 (최종 실패: ${err.message})`);
                        }
                        await sleep(1000); // 실패 시 1초 숨고르기 후 다시 찌름
                    }
                }
            };
            
            const totalColMap = [["platPlc", ["platPlc"]], ["bldNm", ["bldNm"]], ["mainPurpsCdNm", ["mainPurpsCdNm"]], ["mainBldCnt", ["mainBldCnt"]], ["subBldCnt", ["subBldCnt", "atchBldCnt"]], ["totArea", ["totArea"]], ["pmsDay", ["pmsDay", "prmDay"]], ["stcnsDay", ["stcnsDay", "stcDay"]], ["useAprDay", ["useAprDay", "useAprvDay"]]];
            const titleColMap = [["dongNm", ["dongNm"]], ["mainPurpsCdNm", ["mainPurpsCdNm"]], ["grndFlrCnt", ["grndFlrCnt"]], ["ugrndFlrCnt", ["ugrndFlrCnt"]], ["totArea", ["totArea"]], ["heit", ["heit"]], ["strctCdNm", ["strctCdNm"]], ["roofCdNm", ["roofCdNm"]], ["useAprDay", ["useAprDay", "useAprvDay"]]];
            const floorColMap = [["dongNm", ["dongNm"]], ["flrGbCdNm", ["flrGbCdNm"]], ["flrNoNm", ["flrNoNm"]], ["area", ["area"]], ["etcPurps", ["etcPurps"]], ["strctCdNm", ["strctCdNm"]], ["roofCdNm", ["roofCdNm"]]];

            // [핵심 3] 연속 호출에 의한 방화벽 차단 방지를 위해 각 호출 사이 0.5초 쿨타임(Sleep) 부여
            totalData = await fetchEndpoint('getBrRecapTitleInfo', totalColMap);
            await sleep(500);
            titleData = await fetchEndpoint('getBrTitleInfo', titleColMap);
            await sleep(500);
            floorData = await fetchEndpoint('getBrFlrOulnInfo', floorColMap);
            
            if(totalData.length > 0 || titleData.length > 0) isSuccess = true;
            else throw new Error("해당 지번에 등록된 건축물대장이 없습니다.");
        } catch(e) { isSuccess = false; apiErrMsg = e.message; }

        // 다음 사업장(소재지)으로 넘어가기 전 0.8초 추가 쿨타임
        if (index < rows.length - 1) {
            await sleep(800);
        }

        fetchedResults.push({ index, locName, locAddr, totalData, titleData, floorData, isSuccess, apiErrMsg });
    }
    executeLedgerRender(fetchedResults);
}


function executeLedgerRender(results) {
    const btn = document.getElementById('btnFetchApi');
    const emptyMsg = document.getElementById('emptyStateMsg');
    const dataContainer = document.getElementById('fetchedDataContainer');
    const tabsContainer = document.getElementById('slide3Tabs');

    let hasActive = false;
    window.kbState.fetchedData = {}; 

    results.forEach(res => {
        const { index, locName, locAddr, totalData, titleData, floorData, isSuccess, apiErrMsg } = res;
        
        let locDataHTML = "";
        const tabDiv = document.createElement('div');
        tabDiv.className = hasActive ? 'tab' : 'tab active';
        tabDiv.textContent = locName;
        tabDiv.onclick = function() { switchApiTab(this, index); };
        tabsContainer.appendChild(tabDiv);

        if (isSuccess) {
            if (totalData.length > 0 && titleData.length > 0) {
                totalData.forEach(recapItem => {
                    const useAprVal = recapItem.useAprDay;
                    if (!useAprVal || useAprVal === '-' || useAprVal === '자료 없음' || useAprVal.trim() === '') {
                        const validDates = titleData.map(t => t.useAprDay ? t.useAprDay.replace(/\D/g, '') : '').filter(d => d.length === 8);
                        if (validDates.length > 0) recapItem.useAprDay = validDates.sort()[0];
                        else recapItem.useAprDay = "자료 없음";
                    }
                });
            }

            window.kbState.fetchedData[locName] = { address: locAddr, recap: totalData, title: titleData, floor: floorData };

            const trTotal = totalData.map(d => `<tr><td>${d.platPlc || locAddr}</td><td>${d.bldNm||'-'}</td><td>${d.mainPurpsCdNm||'-'}</td><td>${formatNumber(d.mainBldCnt||'0')}</td><td>${formatNumber(d.subBldCnt||'0')}</td><td>${formatNumber(d.totArea||'0')}</td><td>${formatDate(d.pmsDay||'-')}</td><td>${formatDate(d.stcnsDay||'-')}</td><td>${formatDate(d.useAprDay||'-')}</td></tr>`).join('');
            const trTitle = titleData.map(d => `<tr><td>${d.dongNm||'-'}</td><td>${d.mainPurpsCdNm||'-'}</td><td>${formatNumber(d.grndFlrCnt||'0')}</td><td>${formatNumber(d.ugrndFlrCnt||'0')}</td><td>${formatNumber(d.totArea||'0')}</td><td>${formatNumber(d.heit||'0')}</td><td>${d.strctCdNm||'-'}</td><td>${d.roofCdNm || '기타지붕'}</td><td>${formatDate(d.useAprDay||'-')}</td></tr>`).join('');
            const trFloor = floorData.map(d => `<tr><td>${d.dongNm||'-'}</td><td>${d.flrGbCdNm||'-'}</td><td>${d.flrNoNm||'-'}</td><td>${formatNumber(d.area||'0')}</td><td>${d.etcPurps||'-'}</td><td>${d.strctCdNm||'-'}</td><td>${d.roofCdNm || '기타지붕'}</td></tr>`).join('');

            const headerRecap = `<tr>${buildSortableTh('대지위치','200px')}${buildSortableTh('건물명')}${buildSortableTh('주용도')}${buildSortableTh('주건축물수')}${buildSortableTh('부속건축물수')}${buildSortableTh('연면적(m²)')}${buildSortableTh('허가일')}${buildSortableTh('착공일')}${buildSortableTh('사용승인일')}</tr>`;
            const headerTitle = `<tr>${buildSortableTh('동명칭')}${buildSortableTh('주용도(건물별)')}${buildSortableTh('지상층수')}${buildSortableTh('지하층수')}${buildSortableTh('연면적(m²)')}${buildSortableTh('높이(m)')}${buildSortableTh('구조코드명')}${buildSortableTh('지붕코드명')}${buildSortableTh('사용승인일')}</tr>`;
            const headerFloor = `<tr>${buildSortableTh('동명칭')}${buildSortableTh('층구분')}${buildSortableTh('층번호')}${buildSortableTh('면적(m²)')}${buildSortableTh('기타용도')}${buildSortableTh('구조코드명')}${buildSortableTh('지붕코드명')}</tr>`;

            locDataHTML = `
            <div id="api-loc-${index}" style="display: ${hasActive ? 'none' : 'block'};">
                <div style="margin-bottom: 25px;"><div class="section-title" style="font-size: 14px;">■ [${locName}] 총괄표제부 정보</div><table class="data-table"><thead>${headerRecap}</thead><tbody>${trTotal}</tbody></table></div>
                <div style="margin-bottom: 25px;"><div class="section-title" style="font-size: 14px;">■ 표제부 상세</div><table class="data-table"><thead>${headerTitle}</thead><tbody>${trTitle}</tbody></table></div>
                <div><div class="section-title" style="font-size: 14px;">■ 층별 개요</div><table class="data-table"><thead>${headerFloor}</thead><tbody>${trFloor}</tbody></table></div>
            </div>`;
        } else {
            locDataHTML = `<div id="api-loc-${index}" style="display: ${hasActive ? 'none' : 'block'}; padding: 40px; text-align:center;"><h3 style="color:#dc3545;">[${locName}] 조회 실패</h3><p>${apiErrMsg}</p></div>`;
        }
        dataContainer.insertAdjacentHTML('beforeend', locDataHTML);
        hasActive = true;
    });

    btn.innerHTML = '건축물대장 조회시작'; btn.disabled = false;
    document.querySelectorAll('.data-table tbody').forEach(tbody => { Array.from(tbody.querySelectorAll('tr')).forEach((row, idx) => { row.style.backgroundColor = (idx % 2 === 0) ? '#ffffff' : '#f8f9fa'; }); });
    if(!hasActive) { emptyMsg.style.display = 'block'; dataContainer.style.display = 'none'; } 
    else { emptyMsg.style.display = 'none'; dataContainer.style.display = 'block'; }
}

// ==========================================
// 엑셀 내보내기 
// ==========================================
window.exportLedgerToExcel = function() {
    if (!window.kbState.fetchedData || Object.keys(window.kbState.fetchedData).length === 0) {
        alert("내보낼 데이터가 존재하지 않습니다. 먼저 조회해 주세요."); return;
    }
    let csvContent = "\uFEFF"; 
    
    for (const [siteName, data] of Object.entries(window.kbState.fetchedData)) { 
        csvContent += `[사업장명: ${siteName}]\n주소: ${data.address}\n\n`;
        if (data.recap && data.recap.length > 0) {
            csvContent += "■ 총괄표제부 정보\n대지위치,건물명,주용도,주건축물수,부속건축물수,연면적(m²),허가일,착공일,사용승인일\n";
            data.recap.forEach(row => { csvContent += `"${row.platPlc||data.address}","${row.bldNm}","${row.mainPurpsCdNm}","${row.mainBldCnt}","${row.subBldCnt}","${row.totArea}","${formatDate(row.pmsDay)}","${formatDate(row.stcnsDay)}","${formatDate(row.useAprDay)}"\n`; });
            csvContent += "\n";
        }
        if (data.title && data.title.length > 0) {
            csvContent += "■ 표제부 상세\n동명칭,주용도(건물별),지상층수,지하층수,연면적(m²),높이(m),구조코드명,지붕코드명,사용승인일\n";
            data.title.forEach(row => { csvContent += `"${row.dongNm}","${row.mainPurpsCdNm}","${row.grndFlrCnt}","${row.ugrndFlrCnt}","${row.totArea}","${row.heit}","${row.strctCdNm}","${row.roofCdNm||'기타지붕'}","${formatDate(row.useAprDay)}"\n`; });
            csvContent += "\n";
        }
        if (data.floor && data.floor.length > 0) {
            csvContent += "■ 층별 개요\n동명칭,층구분,층번호,면적(m²),기타용도,구조코드명,지붕코드명\n";
            data.floor.forEach(row => { csvContent += `"${row.dongNm}","${row.flrGbCdNm}","${row.flrNoNm}","${row.area}","${row.etcPurps}","${row.strctCdNm}","${row.roofCdNm||'기타지붕'}"\n`; });
            csvContent += "\n\n";
        }
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `건축물대장_원본_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
};