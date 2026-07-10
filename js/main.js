// ============================================================================
// [1] 전역 상태 관리 (백엔드와 통신하는 중앙 데이터 저장소)
// ============================================================================
window.kbState = {
    evalData: { title: {}, floor: {}, kfpa: {} }, 
    activeSite: { title: null, floor: null, kfpa: null }, // 모드별로 현재 선택된 탭(사업장) 저장
    fetchedData: {} // API 조회를 통해 가져온 실제 건축물대장 데이터를 보관할 객체 추가
};

window.onload = function() {
    if (typeof goToSlide === 'function') goToSlide('slide2');
    
    // 페이지 로드 시 가짜 데이터를 넣지 않고, 빈 상태로 렌더링 함수만 호출하여 초기화합니다.
    runGroupedRenderTest();
};

// ============================================================================
// [2] 포맷팅 헬퍼 함수
// ============================================================================
function formatPrice(num) { return (num && num > 0) ? Math.round(num).toLocaleString('ko-KR') : "-"; }
function formatArea(num) {
    if (num === null || num === undefined || num === "" || num === "-") return "-";
    return Number(num).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================================
// [3] ★ 사업장별 탭(Tab) 생성 및 화면 분리 렌더링 ★
// ============================================================================
function renderEvalTabsAndTable(mode, tbodyId, tabContainerId) {
    const dataObj = window.kbState.evalData[mode];
    const tabContainer = document.getElementById(tabContainerId);
    const tbody = document.getElementById(tbodyId);
    if (!tabContainer || !tbody) return;

    tabContainer.innerHTML = ''; tbody.innerHTML = '';

    if (!dataObj || Object.keys(dataObj).length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" style="padding: 30px; color: #999; text-align: center;">연동된 데이터가 없습니다.</td></tr>';
        return;
    }

    const sites = Object.keys(dataObj);
    if (!window.kbState.activeSite[mode] || !sites.includes(window.kbState.activeSite[mode])) {
        window.kbState.activeSite[mode] = sites[0];
    }
    const currentSite = window.kbState.activeSite[mode];

    sites.forEach(siteName => {
        const isSelected = (siteName === currentSite);
        const tabBtn = document.createElement('div');
        tabBtn.innerText = siteName;
        tabBtn.style.cssText = `
            padding: 10px 25px; cursor: pointer; font-weight: bold; border: 1px solid #ddd; border-bottom: none;
            border-top-left-radius: 4px; border-top-right-radius: 4px; margin-right: 5px;
            background-color: ${isSelected ? '#1C5691' : '#f8f9fa'};
            color: ${isSelected ? '#ffffff' : '#333333'};
        `;
        tabBtn.onclick = () => {
            window.kbState.activeSite[mode] = siteName;
            renderEvalTabsAndTable(mode, tbodyId, tabContainerId);
        };
        tabContainer.appendChild(tabBtn);
    });

    const selectedData = dataObj[currentSite];
    // ★ 변경점: 편집 이벤트를 위해 mode와 currentSite를 렌더링 함수에 전달합니다.
    renderEvalTableGrouped(tbody, selectedData, mode, currentSite);
}

// ============================================================================
// [4] 3단 콤보(그룹핑) 테이블 렌더링 엔진 (인라인 편집 + 휴지통 삭제 기능 추가)
// ============================================================================
function renderEvalTableGrouped(tbody, groupedData, mode, siteName) {
    let grandTotalArea = 0, grandTotalReco = 0, grandTotalCur = 0;
    const groups = Array.isArray(groupedData) ? groupedData : Object.values(groupedData);

    groups.forEach((group, gIdx) => {
        let groupArea = 0;
        const records = group.records || group.데이터리스트 || [group]; 

        // [1행: 건축공사비] 
        records.forEach((record, rIdx) => {
            const seq = record['일련번호'] || '-';
            const dongName = record['동명칭'] || '-';
            const usage = record['용도'] || '-';
            const area = parseFloat(record['연면적'] || 0);
            const strct = record['구조'] || record['구조명'] || '-';
            const buildYear = record['준공연도'] || '-'; 
            const strctCode = record['구조코드'] || '-';
            const unitPrice = parseFloat(record['단가'] || 0);
            const laborCost = parseFloat(record['노무비'] || 0);
            const priceIdx = parseFloat(record['물가지수'] || 1.0);
            const recoArch = parseFloat(record['재조달_건축'] || 0);
            const depRate = parseFloat(record['감가율'] || 1.78);
            const remainRate = parseFloat(record['잔가율'] || 100);
            const curArch = parseFloat(record['현재_건축'] || 0);

            groupArea += area;

            const codeDisp = (strctCode && strctCode !== "nan" && strctCode !== "-") ? strctCode : "[ 🔍 더블클릭 ]";
            const depDisp = (depRate === 1.78) ? "[ 🔍 더블클릭 (기본 1.78%) ]" : `${depRate.toFixed(2)}%`;

            // ★ 휴지통 아이콘 추가 (첫 번째 줄인 경우에만 표시하여 3줄 통째로 삭제)
            const trashIcon = (rIdx === 0) 
                ? `<i class="fa-solid fa-trash-can" onclick="event.stopPropagation(); deleteEvalItem('${mode}', '${siteName}', ${gIdx})" style="color:#dc3545; margin-left:8px; cursor:pointer;" title="이 동 전체 삭제"></i>` 
                : '';
            const dongDisp = `${dongName} ${trashIcon}`;

            const trArch = document.createElement('tr');
            trArch.style.backgroundColor = '#ffffff';
            
            trArch.innerHTML = `
                <td style="cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx}, '일련번호', 'text')">${seq}</td>
                <td style="color:#0056b3; font-weight:bold; cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx}, '동명칭', 'text')">${dongDisp}</td>
                <td style="color:#0056b3;">건축공사비</td>
                <td style="cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx}, '용도', 'text')">${usage}</td>
                <td style="text-align:right; cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx}, '연면적', 'number')">${formatArea(area)}</td>
                <td style="cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx}, '구조', 'text')">${strct}</td>
                <td style="cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx}, '준공연도', 'number')">${buildYear}</td>
                <td style="color:#0056b3; font-weight:bold; cursor:pointer;" ondblclick="openCodePopup('${mode}', '${siteName}', ${gIdx}, ${rIdx})">${codeDisp}</td>
                <td style="text-align:right; cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx}, '단가', 'number')">${formatPrice(unitPrice)}</td>
                <td style="text-align:right; cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx}, '노무비', 'number')">${formatPrice(laborCost)}</td>
                <td style="cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx}, '물가지수', 'number')">${priceIdx.toFixed(4)}</td>
                <td style="text-align:right; color:#0056b3;">${formatPrice(recoArch)}</td>
                <td style="color:#0056b3; font-weight:bold; cursor:pointer;" ondblclick="openDeprPopup('${mode}', '${siteName}', ${gIdx}, ${rIdx})">${depDisp}</td>
                <td>${remainRate.toFixed(2)}%</td>
                <td style="text-align:right; color:#0056b3;">${formatPrice(curArch)}</td>
            `;
            tbody.appendChild(trArch);
        });

        const accRate = parseFloat(group['부속비율'] || 20.0);
        const recoSub = parseFloat(group['재조달_부속'] || 0);
        const curSub = parseFloat(group['현재_부속'] || 0);
        const recoTotal = parseFloat(group['재조달_합계'] || 0);
        const curTotal = parseFloat(group['현재_합계'] || 0);
        const mainDongName = group['동명칭'] || '-';

        grandTotalArea += groupArea; grandTotalReco += recoTotal; grandTotalCur += curTotal;

        // [2행: 부속설비]
        const trSub = document.createElement('tr');
        trSub.style.backgroundColor = '#f8f9fa';
        trSub.innerHTML = `
            <td colspan="2"></td><td>부속설비</td><td>[${mainDongName}] 일괄부속</td><td colspan="6"></td>
            <td style="font-weight:bold; color:#0056b3; cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, 0, '부속비율', 'number', 'group')">${accRate.toFixed(1)}%</td>
            <td style="text-align:right;">${formatPrice(recoSub)}</td><td colspan="2"></td><td style="text-align:right;">${formatPrice(curSub)}</td>
        `;
        tbody.appendChild(trSub);

        // [3행: 소계]
        const trTotal = document.createElement('tr');
        trTotal.style.backgroundColor = '#e2e8f0'; trTotal.style.fontWeight = 'bold';
        trTotal.innerHTML = `
            <td colspan="2"></td><td>[${mainDongName}] 소계</td><td></td><td style="text-align:right;">${formatArea(groupArea)}</td><td colspan="6"></td>
            <td style="text-align:right;">${formatPrice(recoTotal)}</td><td colspan="2"></td><td style="text-align:right;">${formatPrice(curTotal)}</td>
        `;
        tbody.appendChild(trTotal);
    });

    // [마지막 행: 사업장 합계]
    const trGrandTotal = document.createElement('tr');
    trGrandTotal.style.backgroundColor = '#cbd5e1'; trGrandTotal.style.fontWeight = 'bold';
    trGrandTotal.innerHTML = `
        <td colspan="4" style="text-align:center;">사업장 합계</td><td style="text-align:right;">${formatArea(grandTotalArea)}</td><td colspan="6"></td>
        <td style="text-align:right;">${formatPrice(grandTotalReco)}</td><td colspan="2"></td><td style="text-align:right;">${formatPrice(grandTotalCur)}</td>
    `;
    tbody.appendChild(trGrandTotal);
}

// ============================================================================
// [5] ★ 수동 항목 추가 기능 (무허가 건물 등 추가용) ★
// ============================================================================
function addManualItem(mode) {
    const currentSite = window.kbState.activeSite[mode];
    if (!currentSite) return alert("선택된 사업장 탭이 없습니다.");

    // 새로운 3단 콤보 데이터 블록 생성
    const newGroup = {
        동명칭: "신규 추가항목",
        부속비율: 20.0, 재조달_부속: 0, 현재_부속: 0, 재조달_합계: 0, 현재_합계: 0,
        records: [{
            일련번호: "수동", 동명칭: "신규 추가항목", 용도: "직접 입력", 연면적: 0, 구조명: "직접 입력", 
            준공연도: new Date().getFullYear(), 구조코드: "-", 단가: 0, 노무비: 0, 물가지수: 1.0, 
            감가율: 1.78, 재조달_건축: 0, 잔가율: 100, 현재_건축: 0
        }]
    };

    const targetData = window.kbState.evalData[mode][currentSite];

    if (Array.isArray(targetData)) {
        // 표제부(Title)처럼 배열 구조인 경우
        targetData.push(newGroup);
    } else {
        // 층별(Floor), 화협(Kfpa)처럼 딕셔너리 구조인 경우 키(Key) 중복 방지
        let key = "신규 추가항목";
        let cnt = 1;
        while (targetData[key]) {
            key = `신규 추가항목(${cnt++})`;
        }
        newGroup.동명칭 = key;
        newGroup.records[0].동명칭 = key;
        targetData[key] = newGroup;
    }

    // 렌더링 트리거 함수 호출 매핑
    if (mode === 'title') renderEvalTabsAndTable('title', 'tbodyTitleEval', 'tabsTitleEval');
    else if (mode === 'floor') renderEvalTabsAndTable('floor', 'tbodyFloorEval', 'tabsFloorEval');
    else if (mode === 'kfpa') renderEvalTabsAndTable('kfpa', 'tbodyKfpaEval', 'tabsKfpaEval');
}

// ============================================================================
// [6] 초기 화면 렌더링 (가짜 임의 데이터 제거 완료)
// ============================================================================
function runGroupedRenderTest() {
    // 기존에 있던 테스트용 임의 데이터(안산공장, 시흥공장 등) 강제 주입 로직을 완전히 삭제했습니다.
    // 데이터가 없는 빈 상태({} 구조)를 유지하여 최초 화면에 아무것도 보이지 않게 합니다.
    
    // 화면 그리기 실행 -> 데이터가 없으므로 테이블 중앙에 "연동된 데이터가 없습니다." 메시지만 깔끔하게 표시됩니다.
    renderEvalTabsAndTable('title', 'tbodyTitleEval', 'tabsTitleEval');
    renderEvalTabsAndTable('floor', 'tbodyFloorEval', 'tabsFloorEval');
    renderEvalTabsAndTable('kfpa', 'tbodyKfpaEval', 'tabsKfpaEval');
}

// ============================================================================
// [7] 대장 데이터 -> 표제부 평가 워크시트 연동 (Python sync_building_to_eval 웹 이식)
// ============================================================================
function syncTitleData() {
    const fetchedData = window.kbState.fetchedData;
    if (!fetchedData || Object.keys(fetchedData).length === 0) {
        alert("연동할 수 없습니다. 먼저 [건축물대장 조회시작]을 완료해 주세요.");
        return;
    }

    if (Object.keys(window.kbState.evalData.title || {}).length > 0) {
        if (!confirm("기존에 작업 중이던 표제부 평가 데이터가 초기화됩니다. 계속하시겠습니까?")) return;
    }
    
    const newTitleData = {};

    Object.keys(fetchedData).forEach(siteName => {
        const siteData = fetchedData[siteName];
        
        // ★ 1차 수정: 저장소의 키 이름이 한글이 아닌 영문(title, recap)입니다!
        const dfTitle = siteData["title"] || siteData["표제부 상세"] || [];
        const dfRecap = siteData["recap"] || siteData["총괄표제부 정보"] || [];
        
        let fallbackYear = 2000;
        
        // ★ 2차 수정: '사용승인일' -> 'useAprDay' (API 영문 키 적용)
        if (dfRecap.length > 0 && dfRecap[0]["useAprDay"]) {
            const aprDate = String(dfRecap[0]["useAprDay"]).replace(/[-/]/g, "").trim();
            if (aprDate.length >= 4 && !isNaN(aprDate.substring(0, 4))) {
                fallbackYear = parseInt(aprDate.substring(0, 4));
            }
        }

        const siteRecords = [];

        dfTitle.forEach((row, idx) => {
            // ★ 3차 수정: 모든 데이터를 API 원본 영문 키(dongNm, totArea 등)로 매핑
            let dongNm = (row["dongNm"] || "").trim();
            if (!dongNm || dongNm === "-" || dongNm === "nan") dongNm = "본동";
            
            const areaVal = String(row["totArea"] || "0").replace(/,/g, "").trim();
            const area = isNaN(parseFloat(areaVal)) ? 0.0 : parseFloat(areaVal);
            
            const strct = (row["strctCdNm"] || "-").trim();
            const purps = (row["mainPurpsCdNm"] || "-").trim();
            
            let buildYear = fallbackYear;
            const rowAprDate = String(row["useAprDay"] || "").replace(/[-/]/g, "").trim();
            if (rowAprDate.length >= 4 && !isNaN(rowAprDate.substring(0, 4))) {
                buildYear = parseInt(rowAprDate.substring(0, 4));
            }

            const recordGroup = {
                "동명칭": dongNm,
                "부속비율": 20.0,
                "재조달_부속": 0,
                "재조달_합계": 0,
                "현재_부속": 0,
                "현재_합계": 0,
                "records": [{
                    "일련번호": String(idx + 1),
                    "동명칭": dongNm,
                    "용도": purps,
                    "연면적": area,
                    "구조명": strct,
                    "준공연도": buildYear,
                    "구조코드": "-",
                    "단가": 0.0,
                    "노무비": 0.0,
                    "물가지수": 1.0,
                    "감가율": 1.78,
                    "재조달_건축": 0,
                    "잔가율": 100.0,
                    "현재_건축": 0
                }]
            };
            siteRecords.push(recordGroup);
        });

        if (siteRecords.length > 0) {
            newTitleData[siteName] = siteRecords;
        }
    });

    window.kbState.evalData.title = newTitleData;
    window.kbState.activeSite.title = Object.keys(newTitleData)[0] || null;
    
    renderEvalTabsAndTable('title', 'tbodyTitleEval', 'tabsTitleEval');
    alert("표제부 데이터 연동이 완료되었습니다.");
}

// ============================================================================
// [8] 인라인 편집 및 가액 재계산 시스템 (Python calculate_valuation 이식)
// ============================================================================

// 1. 셀 더블클릭 시 편집창(Input)을 띄우고 저장하는 함수
window.editCell = function(tdElement, mode, siteName, gIdx, rIdx, field, inputType, level = 'record') {
    if (tdElement.querySelector('input')) return; // 이미 편집 중이면 무시

    // 대상 데이터 객체 찾기
    let targetObj;
    const siteData = window.kbState.evalData[mode][siteName];
    if (Array.isArray(siteData)) {
        targetObj = level === 'group' ? siteData[gIdx] : siteData[gIdx].records[rIdx];
    } else {
        const keys = Object.keys(siteData);
        targetObj = level === 'group' ? siteData[keys[gIdx]] : siteData[keys[gIdx]].records[rIdx];
    }

    let origValue = targetObj[field] || (inputType === 'number' ? 0 : '');

    // 입력창 생성
    const input = document.createElement('input');
    input.type = 'text'; 
    input.value = origValue;
    input.style.width = '90%';
    input.style.textAlign = 'center';
    input.style.border = '2px solid #1C5691';
    input.style.padding = '3px';
    input.style.fontWeight = 'bold';

    // 기존 텍스트 지우고 입력창 띄우기
    tdElement.innerHTML = '';
    tdElement.appendChild(input);
    input.focus();
    input.select();

    // 저장 및 화면 갱신 처리
    const saveValue = () => {
        let newVal = input.value.replace(/,/g, '').replace(/%/g, '').trim();
        if (inputType === 'number') {
            newVal = parseFloat(newVal);
            if (isNaN(newVal)) newVal = 0;
        }
        targetObj[field] = newVal;

        // ★ 핵심: 값이 변경되었으므로 가액을 자동으로 다시 계산합니다.
        recalculateValuation(mode, siteName);

        // 변경된 계산 결과를 바탕으로 표 다시 그리기
        const tbodyId = mode === 'title' ? 'tbodyTitleEval' : (mode === 'floor' ? 'tbodyFloorEval' : 'tbodyKfpaEval');
        const tabId = mode === 'title' ? 'tabsTitleEval' : (mode === 'floor' ? 'tabsFloorEval' : 'tabsKfpaEval');
        renderEvalTabsAndTable(mode, tbodyId, tabId);
    };

    // 포커스를 잃거나 엔터를 치면 자동 저장
    input.addEventListener('blur', saveValue);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.removeEventListener('blur', saveValue);
            saveValue();
        }
    });
};

// 2. 가액 자동 재계산 엔진 (파이썬 계산식 완벽 구현)
function recalculateValuation(mode, siteName) {
    const evalYearInput = document.getElementById('evalYear');
    const evalYear = parseInt(evalYearInput ? evalYearInput.value : new Date().getFullYear());
    const siteData = window.kbState.evalData[mode][siteName];
    
    const groups = Array.isArray(siteData) ? siteData : Object.values(siteData);

    groups.forEach(group => {
        let totRecoArch = 0;
        let totCurArch = 0;

        // [건축공사비] 1행 데이터 재계산
        group.records.forEach(r => {
            // 재조달_건축 = 연면적 * 단가 * 물가지수 (1,000원 단위 절사)
            const compConstCost = (r.연면적 || 0) * (r.단가 || 0) * (r.물가지수 || 1.0);
            r.재조달_건축 = Math.floor(compConstCost / 1000) * 1000;
            
            // 잔가율 = 1.0 - (경과년수 * 감가율) (최소 30% 보장)
            const elapsed = Math.max(0, evalYear - (r.준공연도 || evalYear));
            let residualRatio = 1.0 - (elapsed * ((r.감가율 || 1.78) / 100.0));
            if (residualRatio < 0.30) residualRatio = 0.30; 
            
            r.잔가율 = residualRatio * 100.0;
            // 현재_건축 = 재조달가액 * 잔가율 (1,000원 단위 절사)
            r.현재_건축 = Math.floor((r.재조달_건축 * residualRatio) / 1000) * 1000;

            totRecoArch += r.재조달_건축;
            totCurArch += r.현재_건축;
        });

        // [부속설비] 2행 및 소계 데이터 재계산
        const accRate = parseFloat(group.부속비율 || 20.0) / 100.0;
        group.재조달_부속 = Math.floor((totRecoArch * accRate) / 1000) * 1000;
        
        const repResidualRatio = group.records.length > 0 ? (group.records[0].잔가율 / 100.0) : 1.0;
        group.현재_부속 = Math.floor((group.재조달_부속 * repResidualRatio) / 1000) * 1000;

        group.재조달_합계 = totRecoArch + group.재조달_부속;
        group.현재_합계 = totCurArch + group.현재_부속;
    });
}

// 3. 구조코드 & 감가율 팝업 호출 대기 (다음 단계용)
window.openCodePopup = function(mode, siteName, gIdx, rIdx) {
    alert("🛠️ 신축단가표 구조코드 팝업창이 뜰 위치입니다.\n(다음 단계에서 엑셀 단가표 검색기를 연결합니다!)");
};

window.openDeprPopup = function(mode, siteName, gIdx, rIdx) {
    alert("🛠️ 감가율 표준 선택 팝업창이 뜰 위치입니다.\n(다음 단계에서 KFPA 기준표를 연결합니다!)");
};

// ============================================================================
// [9] 개별 항목 삭제(휴지통) 기능
// ============================================================================
window.deleteEvalItem = function(mode, siteName, gIdx) {
    const siteData = window.kbState.evalData[mode][siteName];
    let targetName = "";
    
    // 데이터 구조(표제부 vs 층별/화협)에 따라 타겟명 추출
    if (Array.isArray(siteData)) {
        targetName = siteData[gIdx].동명칭 || "선택한 항목";
    } else {
        const keys = Object.keys(siteData);
        targetName = keys[gIdx];
    }

    // 실수로 지우지 않도록 한 번 확인
    if (!confirm(`[${targetName}] 평가 데이터를 완전히 삭제하시겠습니까?`)) return;

    // 실제 데이터 구조에서 안전하게 삭제
    if (Array.isArray(siteData)) {
        siteData.splice(gIdx, 1); // 표제부(Array 형태) 삭제
    } else {
        const keys = Object.keys(siteData);
        delete siteData[keys[gIdx]]; // 층별/화협(Object 딕셔너리 형태) 삭제
    }

    // 삭제 완료 후 금액 재계산 및 테이블 다시 렌더링
    recalculateValuation(mode, siteName);
    const tbodyId = mode === 'title' ? 'tbodyTitleEval' : (mode === 'floor' ? 'tbodyFloorEval' : 'tbodyKfpaEval');
    const tabId = mode === 'title' ? 'tabsTitleEval' : (mode === 'floor' ? 'tabsFloorEval' : 'tabsKfpaEval');
    renderEvalTabsAndTable(mode, tbodyId, tabId);
};