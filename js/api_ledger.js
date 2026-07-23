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

async function simulateApiFetch() {
    const btn = document.getElementById('btnFetchApi');
    const emptyMsg = document.getElementById('emptyStateMsg');
    const dataContainer = document.getElementById('fetchedDataContainer');
    const tabsContainer = document.getElementById('slide3Tabs');
    
    // 새로운 HTML 테이블에서 행을 찾도록 변경
    const rows = document.getElementById('locationTbody').querySelectorAll('tr');
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 실시간 연동 중...';
    btn.disabled = true;
    tabsContainer.innerHTML = ''; dataContainer.innerHTML = ''; 
    let fetchedResults = [];
    const baseUrl = '';

    for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        if(!row.querySelector('.check-ledger').checked) continue;
        
        // 클래스 이름(loc-name, addr-input)에 맞게 데이터 추출
        const locName = row.querySelector('.loc-name').value || `소재지 ${index+1}`;
        const locAddr = row.querySelector('.addr-input').value || ``;
        if (!locAddr) continue;
        
        let isSuccess = false;
        let apiErrMsg = "";
        let totalData = [], titleData = [], floorData = [];

        try {
            const kakaoRes = await fetch(`${baseUrl}/api/kakao?query=${encodeURIComponent(locAddr)}`);
            if(!kakaoRes.ok) throw new Error("카카오 주소 변환 실패");
            const kakaoJson = await kakaoRes.json();
            if(!kakaoJson.documents || kakaoJson.documents.length === 0) throw new Error("조회할 수 없는 주소 형식입니다.");
            
            // [수정완료] 법정동 코드(b_code)를 기준으로 시군구/법정동 코드를 정확히 분리
            const addressDoc = kakaoJson.documents[0].address;
            if (!addressDoc || !addressDoc.b_code) {
                throw new Error("정확한 지번(법정동) 정보를 찾을 수 없는 주소입니다.");
            }
            
            const bCode = addressDoc.b_code; 
            const codes = {
                sigunguCd: bCode.substring(0, 5), 
                bjdongCd: bCode.substring(5, 10), 
                platGbCd: addressDoc.mountain_yn === 'Y' ? '2' : '0',  
                bun: (addressDoc.main_address_no || '').padStart(4, '0'), 
                ji: (addressDoc.sub_address_no || '').padStart(4, '0') 
            };
            
            const fetchEndpoint = async (endpoint, colMap) => {
                const res = await fetch(`${baseUrl}/api/datago?endpoint=${endpoint}&sigunguCd=${codes.sigunguCd}&bjdongCd=${codes.bjdongCd}&platGbCd=${codes.platGbCd}&bun=${codes.bun}&ji=${codes.ji}`);
                if(!res.ok) throw new Error(`서버 통신 실패 (HTTP ${res.status})`);
                return parseXMLToJSON(await res.text(), colMap);
            };
            
            const totalColMap = [["platPlc", ["platPlc"]], ["bldNm", ["bldNm"]], ["mainPurpsCdNm", ["mainPurpsCdNm"]], ["mainBldCnt", ["mainBldCnt"]], ["subBldCnt", ["subBldCnt", "atchBldCnt"]], ["totArea", ["totArea"]], ["pmsDay", ["pmsDay", "prmDay"]], ["stcnsDay", ["stcnsDay", "stcDay"]], ["useAprDay", ["useAprDay", "useAprvDay"]]];
            const titleColMap = [["dongNm", ["dongNm"]], ["mainPurpsCdNm", ["mainPurpsCdNm"]], ["grndFlrCnt", ["grndFlrCnt"]], ["ugrndFlrCnt", ["ugrndFlrCnt"]], ["totArea", ["totArea"]], ["heit", ["heit"]], ["strctCdNm", ["strctCdNm"]], ["roofCdNm", ["roofCdNm"]], ["useAprDay", ["useAprDay", "useAprvDay"]]];
            const floorColMap = [["dongNm", ["dongNm"]], ["flrGbCdNm", ["flrGbCdNm"]], ["flrNoNm", ["flrNoNm"]], ["area", ["area"]], ["etcPurps", ["etcPurps"]], ["strctCdNm", ["strctCdNm"]], ["roofCdNm", ["roofCdNm"]]];

            totalData = await fetchEndpoint('getBrRecapTitleInfo', totalColMap);
            titleData = await fetchEndpoint('getBrTitleInfo', titleColMap);
            floorData = await fetchEndpoint('getBrFlrOulnInfo', floorColMap);
            
            if(totalData.length > 0 || titleData.length > 0) isSuccess = true;
            else throw new Error("해당 지번에 등록된 건축물대장이 없습니다.");
        } catch(e) { isSuccess = false; apiErrMsg = e.message; }

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
    
    // 저장소를 kbState.fetchedData 로 정확히 연결
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

            // 여기서도 kbState.fetchedData 에 담기도록 변경
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
    // 엑셀 내보내기도 kbState.fetchedData 를 바라보도록 변경
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