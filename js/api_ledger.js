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

// [기능 개선 2] 8자리 숫자를 YYYY-MM-DD 날짜로 예쁘게 변환
function formatDate(str) {
    if (!str || str === '-' || str.trim() === '' || str.includes('자료 없음')) return '자료 없음';
    const s = str.replace(/\D/g, ''); // 숫자만 추출
    if (s.length === 8) return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
    return str;
}

// [기능 개선 2] 1,000단위 콤마 포맷팅 (숫자가 아닌 문자는 그대로 반환)
function formatNumber(str) {
    if (!str || str === '-' || str.trim() === '') return '-';
    const num = parseFloat(str.replace(/,/g, ''));
    return isNaN(num) ? str : num.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

// [기능 개선 1] 중복된 API 데이터(여러 줄) 제거 알고리즘
function removeDuplicates(arr) {
    const unique = [];
    const seen = new Set();
    for (const item of arr) {
        const str = JSON.stringify(item);
        if (!seen.has(str)) {
            seen.add(str);
            unique.push(item);
        }
    }
    return unique;
}

// XML -> JSON 변환 코어 함수
function parseXMLToJSON(xmlText, dataType) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        const cmmMsgHeader = xmlDoc.getElementsByTagName("cmmMsgHeader");
        if(cmmMsgHeader && cmmMsgHeader.length > 0) {
            const returnAuthMsg = getXmlText(xmlDoc, "returnAuthMsg");
            throw new Error(`[공공데이터 에러] ${returnAuthMsg}`);
        }

        const resultCode = getXmlText(xmlDoc, "resultCode");
        if (resultCode !== "00" && resultCode !== "-") {
            throw new Error(getXmlText(xmlDoc, "resultMsg"));
        }

        const items = xmlDoc.getElementsByTagName("item");
        if(items.length === 0) return [];
        
        const parsedList = [];
        
        for (let i = 0; i < items.length; i++) {
            const itemNode = items[i];
            
            // [기능 개선 1] 파이썬 원본 코드와 1:1 대응되는 항목 파싱
            if (dataType === 'recap') { // 총괄표제부
                parsedList.push({
                    platPlc: getXmlText(itemNode, "platPlc"),
                    bldNm: getXmlText(itemNode, "bldNm"),
                    mainPurpsCdNm: getXmlText(itemNode, "mainPurpsCdNm"),
                    mainBldCnt: getXmlText(itemNode, "mainBldCnt", "0"),
                    subBldCnt: getXmlText(itemNode, "subBldCnt", "0"),
                    totArea: getXmlText(itemNode, "totArea", "0"),
                    pmsDay: getXmlText(itemNode, "pmsDay"),
                    stcnsDay: getXmlText(itemNode, "stcnsDay"),
                    useAprDay: getXmlText(itemNode, "useAprDay") || getXmlText(itemNode, "useAprvDay")
                });
            } 
            else if (dataType === 'title') { // 표제부 상세
                parsedList.push({
                    dongNm: getXmlText(itemNode, "dongNm"),
                    mainPurpsCdNm: getXmlText(itemNode, "mainPurpsCdNm"),
                    grndFlrCnt: getXmlText(itemNode, "grndFlrCnt", "0"),
                    ugrndFlrCnt: getXmlText(itemNode, "ugrndFlrCnt", "0"),
                    totArea: getXmlText(itemNode, "totArea", "0"),
                    heit: getXmlText(itemNode, "heit", "0"),
                    strctCdNm: getXmlText(itemNode, "strctCdNm"),
                    roofCdNm: getXmlText(itemNode, "roofCdNm"),
                    useAprDay: getXmlText(itemNode, "useAprDay") || getXmlText(itemNode, "useAprvDay")
                });
            }
            else if (dataType === 'floor') { // 층별개요
                parsedList.push({
                    dongNm: getXmlText(itemNode, "dongNm"),
                    flrGbCdNm: getXmlText(itemNode, "flrGbCdNm"),
                    flrNoNm: getXmlText(itemNode, "flrNoNm"),
                    area: getXmlText(itemNode, "area", "0"),
                    etcPurps: getXmlText(itemNode, "etcPurps"),
                    strctCdNm: getXmlText(itemNode, "strctCdNm"),
                    roofCdNm: getXmlText(itemNode, "roofCdNm")
                });
            }
        }
        // 파싱된 데이터에서 완벽히 일치하는 중복 줄(Row) 제거 후 반환
        return removeDuplicates(parsedList);
    } catch (e) {
        console.error("XML 파싱 에러:", e);
        return [];
    }
}

// ==========================================
// [기능 개선 4] 테이블 헤더(th) 클릭 시 오름/내림차순 정렬 로직
// ==========================================
function sortTable(thElement) {
    const table = thElement.closest('table');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const colIndex = Array.from(thElement.parentNode.children).indexOf(thElement);
    
    // 정렬 방향 토글 (asc <-> desc)
    let asc = thElement.dataset.asc === 'true';
    asc = !asc;
    thElement.dataset.asc = asc;
    
    // 다른 헤더의 화살표 초기화
    Array.from(thElement.parentNode.children).forEach(th => {
        if(th !== thElement) {
            th.dataset.asc = '';
            th.innerHTML = th.innerHTML.replace(/ ▲| ▼/g, ' ▲▼');
        }
    });
    
    // 현재 클릭한 헤더에 화살표 표시
    thElement.innerHTML = thElement.innerHTML.replace(/ ▲▼| ▲| ▼/g, '') + (asc ? ' ▲' : ' ▼');

    rows.sort((a, b) => {
        let valA = a.children[colIndex].textContent.trim();
        let valB = b.children[colIndex].textContent.trim();
        
        // 콤마가 포함된 숫자인지 판별 정규식 (예: 1,200.5)
        let isNumA = /^[\d,]+(\.\d+)?$/.test(valA);
        let isNumB = /^[\d,]+(\.\d+)?$/.test(valB);
        
        if(isNumA && isNumB) {
            let numA = parseFloat(valA.replace(/,/g, ''));
            let numB = parseFloat(valB.replace(/,/g, ''));
            return asc ? numA - numB : numB - numA;
        } else {
            // 문자와 날짜(YYYY-MM-DD)는 문자열 순서로 완벽하게 정렬됨
            return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
    });

    // 정렬된 배열을 DOM에 다시 렌더링하고, 얼룩무늬(Zebra) 배경색 재적용
    tbody.innerHTML = '';
    rows.forEach((row, idx) => {
        row.style.backgroundColor = (idx % 2 === 0) ? '#ffffff' : '#f8f9fa';
        tbody.appendChild(row);
    });
}

// 정렬용 테이블 헤더(th)를 HTML로 만들어주는 헬퍼 함수
function buildSortableTh(text, widthStr = '') {
    return `<th style="cursor:pointer; width:${widthStr};" onclick="sortTable(this)" data-asc="">${text} ▲▼</th>`;
}


// ==========================================
// 건축물대장 API 조회 및 화면 렌더링
// ==========================================
async function simulateApiFetch() {
    const rows = document.querySelectorAll('#locationListBox .list-row');
    const validTargets = [];
    
    rows.forEach(row => {
        const checkLedger = row.querySelector('.check-ledger');
        if (checkLedger && !checkLedger.checked) return;
        
        const addrInput = row.querySelector('.addr-input');
        const nameInput = row.querySelector('.input-short');
        const addr = addrInput ? addrInput.value.trim() : "";
        let name = nameInput ? nameInput.value.trim() : "";
        
        if (addr && !addr.startsWith("예)")) {
            if (!name) name = `사업장_${validTargets.length + 1}`;
            validTargets.push({ name: name, addr: addr });
        }
    });

    if (validTargets.length === 0) {
        alert("조회할 건축물대장 주소가 없거나 체크가 해제되어 있습니다.");
        return;
    }

    const btnFetch = document.getElementById('btnFetchApi');
    const originalBtnText = btnFetch.innerHTML;
    btnFetch.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 조회 중...`;
    btnFetch.disabled = true;

    document.getElementById('emptyStateMsg').style.display = 'none';
    const dataContainer = document.getElementById('fetchedDataContainer');
    const tabsContainer = document.getElementById('slide3Tabs');
    dataContainer.innerHTML = '';
    tabsContainer.innerHTML = '';
    dataContainer.style.display = 'block';

    window.fetchedData = window.fetchedData || {};
    let hasActive = false;

    // TODO: 실제 서버 연결 시 이 부분에서 fetch()를 통해 공공데이터를 수신합니다.
    // 현재는 파이썬에서 내려주는 데이터 구조를 100% 모사하여 렌더링합니다.
    for (let index = 0; index < validTargets.length; index++) {
        const target = validTargets[index];
        const locName = target.name;
        
        // --- (가상 데이터 세팅: 실제 연결 시 parseXMLToJSON을 통해 생성됩니다) ---
        // 백엔드 API 연결 시 사용할 코드: const recapData = parseXMLToJSON(xml_recap_text, 'recap');
        window.fetchedData[locName] = {
            address: target.addr,
            recap: [{ platPlc: target.addr, bldNm: "본동", mainPurpsCdNm: "공장", mainBldCnt: "1", subBldCnt: "2", totArea: "3500.55", pmsDay: "20150501", stcnsDay: "20150601", useAprDay: "20160110" }],
            title: [{ dongNm: "본동", mainPurpsCdNm: "공장", grndFlrCnt: "2", ugrndFlrCnt: "0", totArea: "3000", heit: "12", strctCdNm: "일반철골구조", roofCdNm: "판넬지붕", useAprDay: "20160110" }],
            floor: [
                { dongNm: "본동", flrGbCdNm: "지상", flrNoNm: "1", area: "1500", etcPurps: "공장", strctCdNm: "일반철골구조", roofCdNm: "판넬지붕" },
                { dongNm: "본동", flrGbCdNm: "지상", flrNoNm: "2", area: "1500", etcPurps: "사무실", strctCdNm: "일반철골구조", roofCdNm: "판넬지붕" }
            ]
        };
        const data = window.fetchedData[locName];

        // 탭 생성
        const tabHTML = `<div class="tab ${!hasActive ? 'active' : ''}" onclick="switchApiTab(this, ${index})">${locName}</div>`;
        tabsContainer.insertAdjacentHTML('beforeend', tabHTML);

        // 데이터 표 행(tr) HTML 생성 (포맷팅 적용)
        let trRecap = data.recap.map(r => `<tr><td>${r.platPlc}</td><td>${r.bldNm}</td><td>${r.mainPurpsCdNm}</td><td>${formatNumber(r.mainBldCnt)}</td><td>${formatNumber(r.subBldCnt)}</td><td>${formatNumber(r.totArea)}</td><td>${formatDate(r.pmsDay)}</td><td>${formatDate(r.stcnsDay)}</td><td>${formatDate(r.useAprDay)}</td></tr>`).join('');
        let trTitle = data.title.map(r => `<tr><td>${r.dongNm}</td><td>${r.mainPurpsCdNm}</td><td>${formatNumber(r.grndFlrCnt)}</td><td>${formatNumber(r.ugrndFlrCnt)}</td><td>${formatNumber(r.totArea)}</td><td>${formatNumber(r.heit)}</td><td>${r.strctCdNm}</td><td>${r.roofCdNm}</td><td>${formatDate(r.useAprDay)}</td></tr>`).join('');
        let trFloor = data.floor.map(r => `<tr><td>${r.dongNm}</td><td>${r.flrGbCdNm}</td><td>${r.flrNoNm}</td><td>${formatNumber(r.area)}</td><td>${r.etcPurps}</td><td>${r.strctCdNm}</td><td>${r.roofCdNm}</td></tr>`).join('');

        // 헤더 HTML 생성 (파이썬과 100% 동일 + 정렬 기능 추가)
        const headerRecap = `<tr>${buildSortableTh('대지위치','200px')}${buildSortableTh('건물명')}${buildSortableTh('주용도')}${buildSortableTh('주건축물수')}${buildSortableTh('부속건축물수')}${buildSortableTh('연면적(m²)')}${buildSortableTh('허가일')}${buildSortableTh('착공일')}${buildSortableTh('사용승인일')}</tr>`;
        const headerTitle = `<tr>${buildSortableTh('동명칭')}${buildSortableTh('주용도(건물별)')}${buildSortableTh('지상층수')}${buildSortableTh('지하층수')}${buildSortableTh('연면적(m²)')}${buildSortableTh('높이(m)')}${buildSortableTh('구조코드명')}${buildSortableTh('지붕코드명')}${buildSortableTh('사용승인일')}</tr>`;
        const headerFloor = `<tr>${buildSortableTh('동명칭')}${buildSortableTh('층구분')}${buildSortableTh('층번호')}${buildSortableTh('면적(m²)')}${buildSortableTh('기타용도')}${buildSortableTh('구조코드명')}${buildSortableTh('지붕코드명')}</tr>`;

        // 뷰어 DOM 삽입
        let locDataHTML = `
        <div id="api-loc-${index}" style="display: ${!hasActive ? 'block' : 'none'}; padding: 20px;">
            <div style="margin-bottom: 25px;"><div class="section-title" style="font-size: 14px; color:#1C5691;">■ 총괄표제부 정보</div><table class="data-table"><thead>${headerRecap}</thead><tbody>${trRecap || '<tr><td colspan="9">데이터가 없습니다.</td></tr>'}</tbody></table></div>
            <div style="margin-bottom: 25px;"><div class="section-title" style="font-size: 14px; color:#1C5691;">■ 표제부 상세</div><table class="data-table"><thead>${headerTitle}</thead><tbody>${trTitle || '<tr><td colspan="9">데이터가 없습니다.</td></tr>'}</tbody></table></div>
            <div><div class="section-title" style="font-size: 14px; color:#1C5691;">■ 층별 개요</div><table class="data-table"><thead>${headerFloor}</thead><tbody>${trFloor || '<tr><td colspan="7">데이터가 없습니다.</td></tr>'}</tbody></table></div>
        </div>`;
        
        dataContainer.insertAdjacentHTML('beforeend', locDataHTML);
        hasActive = true;
    }

    btnFetch.innerHTML = originalBtnText;
    btnFetch.disabled = false;
    
    // 테이블 얼룩무늬 스타일 최초 적용
    document.querySelectorAll('.data-table tbody').forEach(tbody => {
        Array.from(tbody.querySelectorAll('tr')).forEach((row, idx) => {
            row.style.backgroundColor = (idx % 2 === 0) ? '#ffffff' : '#f8f9fa';
        });
    });

    const badge = document.querySelector('div[data-menu-type="ledger"] .status-badge');
    if (badge) {
        badge.textContent = '완료';
        badge.className = 'status-badge status-done';
    }
}

// ==========================================
// [기능 개선 3] 엑셀(CSV) 즉시 다운로드 내보내기 
// ==========================================
function exportLedgerToExcel() {
    if (!window.fetchedData || Object.keys(window.fetchedData).length === 0) {
        alert("내보낼 데이터가 존재하지 않습니다. 먼저 건축물대장을 조회해 주세요.");
        return;
    }
    
    let csvContent = "\uFEFF"; // 한글 깨짐을 방지하는 UTF-8 BOM 삽입
    
    for (const [siteName, data] of Object.entries(window.fetchedData)) {
        csvContent += `[사업장명: ${siteName}]\n`;
        csvContent += `주소: ${data.address}\n\n`;
        
        // 총괄표제부 CSV 변환
        if (data.recap && data.recap.length > 0) {
            csvContent += "■ 총괄표제부 정보\n";
            csvContent += "대지위치,건물명,주용도,주건축물수,부속건축물수,연면적(m²),허가일,착공일,사용승인일\n";
            data.recap.forEach(row => {
                csvContent += `"${row.platPlc}","${row.bldNm}","${row.mainPurpsCdNm}","${formatNumber(row.mainBldCnt)}","${formatNumber(row.subBldCnt)}","${formatNumber(row.totArea)}","${formatDate(row.pmsDay)}","${formatDate(row.stcnsDay)}","${formatDate(row.useAprDay)}"\n`;
            });
            csvContent += "\n";
        }
        
        // 표제부 상세 CSV 변환
        if (data.title && data.title.length > 0) {
            csvContent += "■ 표제부 상세\n";
            csvContent += "동명칭,주용도(건물별),지상층수,지하층수,연면적(m²),높이(m),구조코드명,지붕코드명,사용승인일\n";
            data.title.forEach(row => {
                 csvContent += `"${row.dongNm}","${row.mainPurpsCdNm}","${formatNumber(row.grndFlrCnt)}","${formatNumber(row.ugrndFlrCnt)}","${formatNumber(row.totArea)}","${formatNumber(row.heit)}","${row.strctCdNm}","${row.roofCdNm}","${formatDate(row.useAprDay)}"\n`;
            });
            csvContent += "\n";
        }
        
        // 층별개요 CSV 변환
        if (data.floor && data.floor.length > 0) {
            csvContent += "■ 층별 개요\n";
            csvContent += "동명칭,층구분,층번호,면적(m²),기타용도,구조코드명,지붕코드명\n";
            data.floor.forEach(row => {
                csvContent += `"${row.dongNm}","${row.flrGbCdNm}","${row.flrNoNm}","${formatNumber(row.area)}","${row.etcPurps}","${row.strctCdNm}","${row.roofCdNm}"\n`;
            });
            csvContent += "\n\n";
        }
    }
    
    // 파일 다운로드 브라우저 로직
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    const contractorInputs = document.querySelectorAll('.contractor-sync');
    const contractor = (contractorInputs.length > 0 && contractorInputs[0].value) ? contractorInputs[0].value : "미지정";
    
    a.download = `${contractor}_건축물대장_원본_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}