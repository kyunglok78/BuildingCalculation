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

// [기능 추가] 8자리 숫자를 YYYY-MM-DD 날짜로 예쁘게 변환
function formatDate(str) {
    if (!str || str === '-' || str === '자료 없음') return '자료 없음';
    const s = str.replace(/\D/g, ''); // 숫자만 추출
    if (s.length === 8) return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
    return str;
}

// [기능 추가] 1,000단위 콤마 포맷팅 (숫자가 아닌 문자는 그대로 반환)
function formatNumber(str) {
    if (!str || str === '-' || str.trim() === '') return '-';
    const num = parseFloat(str.replace(/,/g, ''));
    return isNaN(num) ? str : num.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

// [기능 추가] 중복된 API 데이터(여러 줄) 제거 알고리즘
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

// ==========================================
// [기능 추가] 테이블 헤더(th) 클릭 시 오름/내림차순 정렬 로직
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
        
        // 콤마가 포함된 숫자인지 판별
        let isNumA = /^[\d,]+(\.\d+)?$/.test(valA);
        let isNumB = /^[\d,]+(\.\d+)?$/.test(valB);
        
        if(isNumA && isNumB) {
            let numA = parseFloat(valA.replace(/,/g, ''));
            let numB = parseFloat(valB.replace(/,/g, ''));
            return asc ? numA - numB : numB - numA;
        } else {
            return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
    });

    // 정렬된 배열을 DOM에 다시 렌더링하고 얼룩무늬 배경색 재적용
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


function parseXMLToJSON(xmlText, colMap) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        // 공공데이터포털 에러 노드 체크
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
        
        // [기능 추가] API 중복 송출 데이터를 필터링하여 반환
        return removeDuplicates(result);
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

    const baseUrl = '';

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
                
                const doc = kakaoJson.documents[0].address || kakaoJson.documents[0].road_address;
                if(!doc) throw new Error("카카오 API 내에 매핑된 주소 좌표계가 기술되지 않았습니다.");
                
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
                
                // 파이썬 원본에 맞춰 유연한 태그 매핑(대체 태그 포함) 적용
                const totalColMap = [["platPlc", ["platPlc"]], ["bldNm", ["bldNm"]], ["mainPurpsCdNm", ["mainPurpsCdNm"]], ["mainBldCnt", ["mainBldCnt"]], ["atchBldCnt", ["atchBldCnt", "subBldCnt"]], ["totArea", ["totArea"]], ["prmDay", ["prmDay", "pmsDay"]], ["stcDay", ["stcDay", "stcnsDay"]], ["useAprvDay", ["useAprvDay", "useAprDay"]]];
                const titleColMap = [["dongNm", ["dongNm"]], ["mainPurpsCdNm", ["mainPurpsCdNm"]], ["grndFlrCnt", ["grndFlrCnt"]], ["ugrndFlrCnt", ["ugrndFlrCnt"]], ["totArea", ["totArea"]], ["heit", ["heit"]], ["strctCdNm", ["strctCdNm"]], ["roofCdNm", ["roofCdNm"]], ["useAprvDay", ["useAprvDay", "useAprDay"]]];
                const floorColMap = [["dongNm", ["dongNm"]], ["flrGbCdNm", ["flrGbCdNm"]], ["flrNoNm", ["flrNoNm"]], ["area", ["area"]], ["etcPurps", ["etcPurps"]], ["strctCdNm", ["strctCdNm"]], ["roofCdNm", ["roofCdNm"]]];

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
    window.fetchedData = window.fetchedData || {}; // 엑셀 추출용 전역 데이터

    results.forEach(res => {
        const { index, locName, locAddr, totalData, titleData, floorData, isSuccess, apiErrMsg } = res;
        
        let locDataHTML = "";
        const tabDiv = document.createElement('div');
        tabDiv.className = hasActive ? 'tab' : 'tab active';
        tabDiv.textContent = locName;
        tabDiv.onclick = function() { switchApiTab(this, index); };
        tabsContainer.appendChild(tabDiv);

        if (isSuccess) {
            // [기능 추가] 엑셀 내보내기를 위한 백업본 저장
            window.fetchedData[locName] = {
                address: locAddr,
                recap: totalData,
                title: titleData,
                floor: floorData
            };

            // [기능 추가] 콤마(Number) 및 날짜(Date) 포맷팅 반영
            const trTotal = totalData.map(d => `<tr><td>${d.platPlc || locAddr}</td><td>${d.bldNm||'-'}</td><td>${d.mainPurpsCdNm||'-'}</td><td>${formatNumber(d.mainBldCnt||'0')}</td><td>${formatNumber(d.atchBldCnt||'0')}</td><td>${formatNumber(d.totArea||'0')}</td><td>${formatDate(d.prmDay||'-')}</td><td>${formatDate(d.stcDay||'-')}</td><td>${formatDate(d.useAprvDay||'-')}</td></tr>`).join('');
            const trTitle = titleData.map(d => `<tr><td>${d.dongNm||'-'}</td><td>${d.mainPurpsCdNm||'-'}</td><td>${formatNumber(d.grndFlrCnt||'0')}</td><td>${formatNumber(d.ugrndFlrCnt||'0')}</td><td>${formatNumber(d.totArea||'0')}</td><td>${formatNumber(d.heit||'0')}</td><td>${d.strctCdNm||'-'}</td><td>${d.roofCdNm || '기타지붕'}</td><td>${formatDate(d.useAprvDay||'-')}</td></tr>`).join('');
            const trFloor = floorData.map(d => `<tr><td>${d.dongNm||'-'}</td><td>${d.flrGbCdNm||'-'}</td><td>${d.flrNoNm||'-'}</td><td>${formatNumber(d.area||'0')}</td><td>${d.etcPurps||'-'}</td><td>${d.strctCdNm||'-'}</td><td>${d.roofCdNm || '기타지붕'}</td></tr>`).join('');

            // [기능 추가] 오름/내림차순 정렬 기능을 내장한 테이블 헤더 생성
            const headerRecap = `<tr>${buildSortableTh('대지위치','200px')}${buildSortableTh('건물명')}${buildSortableTh('주용도')}${buildSortableTh('주건축물수')}${buildSortableTh('부속건축물수')}${buildSortableTh('연면적(m²)')}${buildSortableTh('허가일')}${buildSortableTh('착공일')}${buildSortableTh('사용승인일')}</tr>`;
            const headerTitle = `<tr>${buildSortableTh('동명칭')}${buildSortableTh('주용도(건물별)')}${buildSortableTh('지상층수')}${buildSortableTh('지하층수')}${buildSortableTh('연면적(m²)')}${buildSortableTh('높이(m)')}${buildSortableTh('구조코드명')}${buildSortableTh('지붕코드명')}${buildSortableTh('사용승인일')}</tr>`;
            const headerFloor = `<tr>${buildSortableTh('동명칭')}${buildSortableTh('층구분')}${buildSortableTh('층번호')}${buildSortableTh('면적(m²)')}${buildSortableTh('기타용도')}${buildSortableTh('구조코드명')}${buildSortableTh('지붕코드명')}</tr>`;

            locDataHTML = `
            <div id="api-loc-${index}" style="display: ${hasActive ? 'none' : 'block'};">
                <div style="margin-bottom: 25px;"><div class="section-title" style="font-size: 14px;">■ [${locName}] 총괄표제부 정보 <span style="color:#28a745; font-size:12px;"><i class="fa-solid fa-check"></i> 실시간 연동성공</span></div><table class="data-table"><thead>${headerRecap}</thead><tbody>${trTotal}</tbody></table></div>
                <div style="margin-bottom: 25px;"><div class="section-title" style="font-size: 14px;">■ 표제부 상세</div><table class="data-table"><thead>${headerTitle}</thead><tbody>${trTitle}</tbody></table></div>
                <div><div class="section-title" style="font-size: 14px;">■ 층별 개요</div><table class="data-table"><thead>${headerFloor}</thead><tbody>${trFloor}</tbody></table></div>
            </div>`;
        } else {
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
    
    // 테이블 얼룩무늬 스타일 최초 적용
    document.querySelectorAll('.data-table tbody').forEach(tbody => {
        Array.from(tbody.querySelectorAll('tr')).forEach((row, idx) => {
            row.style.backgroundColor = (idx % 2 === 0) ? '#ffffff' : '#f8f9fa';
        });
    });
    
    if(!hasActive) {
        tabsContainer.innerHTML = '<div class="tab active">조회 대상 사업장 없음</div>';
        dataContainer.style.display = 'none';
        emptyMsg.style.display = 'block';
    } else {
        emptyMsg.style.display = 'none';
        dataContainer.style.display = 'block';
    }
}


// ==========================================
// [기능 추가] 엑셀(CSV) 즉시 다운로드 내보내기 
// ==========================================
function exportLedgerToExcel() {
    if (!window.fetchedData || Object.keys(window.fetchedData).length === 0) {
        alert("내보낼 데이터가 존재하지 않습니다. 먼저 건축물대장을 조회해 주세요.");
        return;
    }
    
    let csvContent = "\uFEFF"; // 한글 깨짐 방지용 UTF-8 BOM
    
    for (const [siteName, data] of Object.entries(window.fetchedData)) {
        csvContent += `[사업장명: ${siteName}]\n`;
        csvContent += `주소: ${data.address}\n\n`;
        
        if (data.recap && data.recap.length > 0) {
            csvContent += "■ 총괄표제부 정보\n";
            csvContent += "대지위치,건물명,주용도,주건축물수,부속건축물수,연면적(m²),허가일,착공일,사용승인일\n";
            data.recap.forEach(row => {
                csvContent += `"${row.platPlc || data.address}","${row.bldNm}","${row.mainPurpsCdNm}","${formatNumber(row.mainBldCnt)}","${formatNumber(row.atchBldCnt)}","${formatNumber(row.totArea)}","${formatDate(row.prmDay)}","${formatDate(row.stcDay)}","${formatDate(row.useAprvDay)}"\n`;
            });
            csvContent += "\n";
        }
        
        if (data.title && data.title.length > 0) {
            csvContent += "■ 표제부 상세\n";
            csvContent += "동명칭,주용도(건물별),지상층수,지하층수,연면적(m²),높이(m),구조코드명,지붕코드명,사용승인일\n";
            data.title.forEach(row => {
                 csvContent += `"${row.dongNm}","${row.mainPurpsCdNm}","${formatNumber(row.grndFlrCnt)}","${formatNumber(row.ugrndFlrCnt)}","${formatNumber(row.totArea)}","${formatNumber(row.heit)}","${row.strctCdNm}","${row.roofCdNm || '기타지붕'}","${formatDate(row.useAprvDay)}"\n`;
            });
            csvContent += "\n";
        }
        
        if (data.floor && data.floor.length > 0) {
            csvContent += "■ 층별 개요\n";
            csvContent += "동명칭,층구분,층번호,면적(m²),기타용도,구조코드명,지붕코드명\n";
            data.floor.forEach(row => {
                csvContent += `"${row.dongNm}","${row.flrGbCdNm}","${row.flrNoNm}","${formatNumber(row.area)}","${row.etcPurps}","${row.strctCdNm}","${row.roofCdNm || '기타지붕'}"\n`;
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