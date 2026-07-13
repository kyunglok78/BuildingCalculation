// ============================================================================
// [1] 전역 상태 관리 (백엔드와 통신하는 중앙 데이터 저장소)
// ============================================================================
window.kbState = {
    evalData: { title: {}, floor: {}, kfpa: {} }, 
    activeSite: { title: null, floor: null, kfpa: null }, // 모드별로 현재 선택된 탭(사업장) 저장
    fetchedData: {}, // API 조회를 통해 가져온 실제 건축물대장 데이터
    sortRev: { title: {}, floor: {}, kfpa: {} }, // 동명칭 정렬 상태 기억
    costData: [] // 엑셀에서 읽어올 단가표 데이터 저장소
};

window.onload = function() {
    if (typeof goToSlide === 'function') goToSlide('slide2');
    
    // 동명칭 헤더를 찾아서 클릭(정렬) 이벤트를 자동으로 연결합니다.
    document.querySelectorAll('th').forEach(th => {
        if (th.innerText.includes('동명칭')) {
            th.style.cursor = 'pointer';
            th.title = "클릭하여 오름차순/내림차순 정렬";
            th.onclick = function() {
                const tableId = th.closest('table').id;
                let mode = 'title';
                if (tableId.includes('Floor')) mode = 'floor';
                if (tableId.includes('Kfpa')) mode = 'kfpa';
                sortEvalData(mode, th);
            };
        }
    });

    runGroupedRenderTest(); // 빈 테이블 뼈대 초기화
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
// [3] 사업장별 탭(Tab) 생성 및 화면 분리 렌더링
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
    renderEvalTableGrouped(tbody, selectedData, mode, currentSite);
}

// ============================================================================
// [4] 3단 콤보(그룹핑) 테이블 렌더링 엔진 (인라인 편집 + 삭제 + 하이브리드 검색 결합)
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

            const codeDisp = (strctCode && strctCode !== "nan" && strctCode !== "-") ? strctCode : "[ 🔍 검색 / ⌨️ 입력 ]";
            const depDisp = (depRate === 1.78) ? "[ 🔍 더블클릭 (기본 1.78%) ]" : `${depRate.toFixed(2)}%`;

            // 휴지통 아이콘 추가 (첫 번째 줄인 경우에만 표시하여 3줄 통째로 삭제)
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
                <td style="color:#0056b3; font-weight:bold; cursor:pointer;" ondblclick="editCodeCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx})">${codeDisp}</td>
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
// [5] 수동 항목 추가 기능
// ============================================================================
function addManualItem(mode) {
    const currentSite = window.kbState.activeSite[mode];
    if (!currentSite) return alert("선택된 사업장 탭이 없습니다.");

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
        targetData.push(newGroup);
    } else {
        let key = "신규 추가항목";
        let cnt = 1;
        while (targetData[key]) key = `신규 추가항목(${cnt++})`;
        newGroup.동명칭 = key;
        newGroup.records[0].동명칭 = key;
        targetData[key] = newGroup;
    }

    if (mode === 'title') renderEvalTabsAndTable('title', 'tbodyTitleEval', 'tabsTitleEval');
    else if (mode === 'floor') renderEvalTabsAndTable('floor', 'tbodyFloorEval', 'tabsFloorEval');
    else if (mode === 'kfpa') renderEvalTabsAndTable('kfpa', 'tbodyKfpaEval', 'tabsKfpaEval');
}

// ============================================================================
// [6] 초기 화면 렌더링
// ============================================================================
function runGroupedRenderTest() {
    renderEvalTabsAndTable('title', 'tbodyTitleEval', 'tabsTitleEval');
    renderEvalTabsAndTable('floor', 'tbodyFloorEval', 'tabsFloorEval');
    renderEvalTabsAndTable('kfpa', 'tbodyKfpaEval', 'tabsKfpaEval');
}

// ============================================================================
// [7] 대장 데이터 -> 표제부 평가 워크시트 연동
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
        const dfTitle = siteData["title"] || siteData["표제부 상세"] || [];
        const dfRecap = siteData["recap"] || siteData["총괄표제부 정보"] || [];
        
        let fallbackYear = 2000;
        if (dfRecap.length > 0 && dfRecap[0]["useAprDay"]) {
            const aprDate = String(dfRecap[0]["useAprDay"]).replace(/[-/]/g, "").trim();
            if (aprDate.length >= 4 && !isNaN(aprDate.substring(0, 4))) {
                fallbackYear = parseInt(aprDate.substring(0, 4));
            }
        }

        const siteRecords = [];

        dfTitle.forEach((row, idx) => {
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
                "동명칭": dongNm, "부속비율": 20.0, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0,
                "records": [{
                    "일련번호": String(idx + 1), "동명칭": dongNm, "용도": purps, "연면적": area, "구조명": strct,
                    "준공연도": buildYear, "구조코드": "-", "단가": 0.0, "노무비": 0.0, "물가지수": 1.0,
                    "감가율": 1.78, "재조달_건축": 0, "잔가율": 100.0, "현재_건축": 0
                }]
            };
            siteRecords.push(recordGroup);
        });

        if (siteRecords.length > 0) newTitleData[siteName] = siteRecords;
    });

    window.kbState.evalData.title = newTitleData;
    window.kbState.activeSite.title = Object.keys(newTitleData)[0] || null;
    
    renderEvalTabsAndTable('title', 'tbodyTitleEval', 'tabsTitleEval');
    alert("표제부 데이터 연동이 완료되었습니다.");
}

// ============================================================================
// [8] 인라인 편집 및 가액 재계산 시스템
// ============================================================================
window.editCell = function(tdElement, mode, siteName, gIdx, rIdx, field, inputType, level = 'record') {
    if (tdElement.querySelector('input')) return;

    let targetObj;
    const siteData = window.kbState.evalData[mode][siteName];
    if (Array.isArray(siteData)) targetObj = level === 'group' ? siteData[gIdx] : siteData[gIdx].records[rIdx];
    else targetObj = level === 'group' ? siteData[Object.keys(siteData)[gIdx]] : siteData[Object.keys(siteData)[gIdx]].records[rIdx];

    let origValue = targetObj[field] || (inputType === 'number' ? 0 : '');

    const input = document.createElement('input');
    input.type = 'text'; input.value = origValue;
    input.style.width = '90%'; input.style.textAlign = 'center';
    input.style.border = '2px solid #1C5691'; input.style.padding = '3px'; input.style.fontWeight = 'bold';

    tdElement.innerHTML = ''; tdElement.appendChild(input);
    input.focus(); input.select();

    const saveValue = () => {
        let newVal = input.value.replace(/,/g, '').replace(/%/g, '').trim();
        if (inputType === 'number') {
            newVal = parseFloat(newVal);
            if (isNaN(newVal)) newVal = 0;
        }
        targetObj[field] = newVal;
        recalculateValuation(mode, siteName);
        const tbodyId = mode === 'title' ? 'tbodyTitleEval' : (mode === 'floor' ? 'tbodyFloorEval' : 'tbodyKfpaEval');
        const tabId = mode === 'title' ? 'tabsTitleEval' : (mode === 'floor' ? 'tabsFloorEval' : 'tabsKfpaEval');
        renderEvalTabsAndTable(mode, tbodyId, tabId);
    };

    input.addEventListener('blur', saveValue);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { input.removeEventListener('blur', saveValue); saveValue(); }
    });
};

function recalculateValuation(mode, siteName) {
    const evalYearInput = document.getElementById('evalYear');
    const evalYear = parseInt(evalYearInput ? evalYearInput.value : new Date().getFullYear());
    const siteData = window.kbState.evalData[mode][siteName];
    const groups = Array.isArray(siteData) ? siteData : Object.values(siteData);

    groups.forEach(group => {
        let totRecoArch = 0;
        let totCurArch = 0;

        group.records.forEach(r => {
            const compConstCost = (r.연면적 || 0) * (r.단가 || 0) * (r.물가지수 || 1.0);
            r.재조달_건축 = Math.floor(compConstCost / 1000) * 1000;
            
            const elapsed = Math.max(0, evalYear - (r.준공연도 || evalYear));
            let residualRatio = 1.0 - (elapsed * ((r.감가율 || 1.78) / 100.0));
            if (residualRatio < 0.30) residualRatio = 0.30; 
            
            r.잔가율 = residualRatio * 100.0;
            r.현재_건축 = Math.floor((r.재조달_건축 * residualRatio) / 1000) * 1000;

            totRecoArch += r.재조달_건축;
            totCurArch += r.현재_건축;
        });

        const accRate = parseFloat(group.부속비율 || 20.0) / 100.0;
        group.재조달_부속 = Math.floor((totRecoArch * accRate) / 1000) * 1000;
        const repResidualRatio = group.records.length > 0 ? (group.records[0].잔가율 / 100.0) : 1.0;
        group.현재_부속 = Math.floor((group.재조달_부속 * repResidualRatio) / 1000) * 1000;

        group.재조달_합계 = totRecoArch + group.재조달_부속;
        group.현재_합계 = totCurArch + group.현재_부속;
    });
}

window.openDeprPopup = function(mode, siteName, gIdx, rIdx) {
    alert("🛠️ 감가율 표준 선택 팝업창이 뜰 위치입니다.");
};

// ============================================================================
// [9] 개별 항목 삭제(휴지통) 기능
// ============================================================================
window.deleteEvalItem = function(mode, siteName, gIdx) {
    const siteData = window.kbState.evalData[mode][siteName];
    let targetName = "";
    
    if (Array.isArray(siteData)) targetName = siteData[gIdx].동명칭 || "선택한 항목";
    else targetName = Object.keys(siteData)[gIdx];

    if (!confirm(`[${targetName}] 평가 데이터를 완전히 삭제하시겠습니까?`)) return;

    if (Array.isArray(siteData)) siteData.splice(gIdx, 1);
    else delete siteData[Object.keys(siteData)[gIdx]]; 

    recalculateValuation(mode, siteName);
    const tbodyId = mode === 'title' ? 'tbodyTitleEval' : (mode === 'floor' ? 'tbodyFloorEval' : 'tbodyKfpaEval');
    const tabId = mode === 'title' ? 'tabsTitleEval' : (mode === 'floor' ? 'tabsFloorEval' : 'tabsKfpaEval');
    renderEvalTabsAndTable(mode, tbodyId, tabId);
};

// ============================================================================
// [10] 동명칭 오름차순/내림차순 정렬 기능
// ============================================================================
window.sortEvalData = function(mode, thElement) {
    const siteName = window.kbState.activeSite[mode];
    if (!siteName) return;

    const targetData = window.kbState.evalData[mode][siteName];
    if (!targetData) return;

    const isRev = !!window.kbState.sortRev[mode][siteName];
    window.kbState.sortRev[mode][siteName] = !isRev;

    const sortLogic = (a, b) => {
        return !isRev ? a.localeCompare(b, undefined, {numeric: true}) : b.localeCompare(a, undefined, {numeric: true});
    };

    if (Array.isArray(targetData)) {
        targetData.sort((a, b) => sortLogic(a.동명칭 || "", b.동명칭 || ""));
    } else {
        const sortedKeys = Object.keys(targetData).sort(sortLogic);
        const newData = {};
        sortedKeys.forEach(k => { newData[k] = targetData[k]; });
        window.kbState.evalData[mode][siteName] = newData;
    }

    const allTh = thElement.closest('tr').querySelectorAll('th');
    allTh.forEach(th => {
        if(th.innerText.includes('동명칭')) th.innerText = !isRev ? '동명칭 ▲' : '동명칭 ▼';
    });

    const tbodyId = mode === 'title' ? 'tbodyTitleEval' : (mode === 'floor' ? 'tbodyFloorEval' : 'tbodyKfpaEval');
    const tabId = mode === 'title' ? 'tabsTitleEval' : (mode === 'floor' ? 'tabsFloorEval' : 'tabsKfpaEval');
    renderEvalTabsAndTable(mode, tbodyId, tabId);
};

// ============================================================================
// [11] 신축단가표 엑셀 파싱 및 하이브리드 구조코드 검색 시스템
// ============================================================================

window.loadCostExcel = function(event) {
    const file = event.target.files[0];
    if(!file) return;
    document.getElementById('unitCostPath').value = file.name;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            let targetSheetName = workbook.SheetNames.find(n => n.includes("용도")) || workbook.SheetNames[0];
            const worksheet = workbook.Sheets[targetSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: "-"});
            
            let startRow = 0;
            for(let i=0; i<jsonData.length; i++) {
                const rowStr = jsonData[i].join("").replace(/\s/g, "");
                if(rowStr.includes("분류번호") || rowStr.includes("용도") || rowStr.includes("대분류")) {
                    startRow = i; break;
                }
            }
            
            const headerRow = jsonData[startRow];
            const findCol = (keyword, defaultIdx) => {
                const idx = headerRow.findIndex(val => String(val).includes(keyword));
                return idx !== -1 ? idx : defaultIdx;
            };
            
            const cols = {
                '대분류': findCol('대분류', 0), '중분류': findCol('중분류', 1), '소분류': findCol('소분류', 2),
                '용도': findCol('용도', 3), '구조': findCol('구조', 4), '급수': findCol('급수', 5),
                '단가': findCol('단가', 26), '노무비': findCol('노무비', 43)
            };
            
            window.kbState.costData = [];
            for(let i = startRow + 2; i < jsonData.length; i++) {
                const row = jsonData[i];
                if(!row || row.length === 0 || row.join("").replace(/-/g,"").trim() === "") continue;
                window.kbState.costData.push({
                    '대분류': row[cols['대분류']], '중분류': row[cols['중분류']], '소분류': row[cols['소분류']],
                    '용도': row[cols['용도']], '구조': row[cols['구조']], '급수': row[cols['급수']],
                    '단가': parseFloat(String(row[cols['단가']]).replace(/,/g, '')) || 0,
                    '노무비': parseFloat(String(row[cols['노무비']]).replace(/,/g, '')) || 0
                });
            }
            alert(`✅ 단가표 파일 분석 완료! (총 ${window.kbState.costData.length}건 데이터 탑재)`);
        } catch(err) {
            alert("엑셀 파일 분석 중 오류가 발생했습니다: " + err);
        }
    };
    reader.readAsArrayBuffer(file);
};

window.editCodeCell = function(tdElement, mode, siteName, gIdx, rIdx) {
    if (tdElement.querySelector('input')) return; 
    
    const siteData = window.kbState.evalData[mode][siteName];
    const targetObj = Array.isArray(siteData) ? siteData[gIdx].records[rIdx] : siteData[Object.keys(siteData)[gIdx]].records[rIdx];
    const origValue = (targetObj['구조코드'] && targetObj['구조코드'] !== '-') ? targetObj['구조코드'] : '';
    
    tdElement.innerHTML = '';
    const container = document.createElement('div');
    container.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:5px;';
    
    const input = document.createElement('input');
    input.type = 'text'; input.value = origValue;
    input.style.cssText = 'width:85px; text-align:center; border:2px solid #1C5691; padding:3px; font-weight:bold; outline:none;';
    
    const btn = document.createElement('button');
    btn.innerHTML = '🔍';
    btn.style.cssText = 'cursor:pointer; padding:3px 6px; border:none; background:#1C5691; color:white; border-radius:3px;';
    
    container.appendChild(input); container.appendChild(btn); tdElement.appendChild(container);
    input.focus(); input.select();
    
    input.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') {
            const code = input.value.trim();
            if(code) applyCodeToRecord(code, mode, siteName, gIdx, rIdx);
        }
    });
    
    btn.onclick = (e) => {
        e.stopPropagation();
        openCodeModal(mode, siteName, gIdx, rIdx, input.value.trim());
    };
};

window.applyCodeToRecord = function(code, mode, siteName, gIdx, rIdx, skipRender=false) {
    const siteData = window.kbState.evalData[mode][siteName];
    const targetObj = Array.isArray(siteData) ? siteData[gIdx].records[rIdx] : siteData[Object.keys(siteData)[gIdx]].records[rIdx];
    
    targetObj['구조코드'] = code;
    
    if(window.kbState.costData && window.kbState.costData.length > 0) {
        const matched = window.kbState.costData.find(row => String(row['중분류']).includes(code) || String(row['소분류']).includes(code));
        if(matched) {
            targetObj['단가'] = matched['단가'];
            targetObj['노무비'] = matched['노무비'];
        }
    } else {
        alert("⚠️ 신축단가표가 로드되지 않아 코드는 입력되었으나 단가를 불러오지 못했습니다.");
    }
    
    recalculateValuation(mode, siteName); 
    
    if(!skipRender) {
        const tbodyId = mode === 'title' ? 'tbodyTitleEval' : (mode === 'floor' ? 'tbodyFloorEval' : 'tbodyKfpaEval');
        const tabId = mode === 'title' ? 'tabsTitleEval' : (mode === 'floor' ? 'tabsFloorEval' : 'tabsKfpaEval');
        renderEvalTabsAndTable(mode, tbodyId, tabId);
    }
};

window.currentCodeTarget = null;

window.openCodeModal = function(mode, siteName, gIdx, rIdx, initKeyword) {
    if(!window.kbState.costData || window.kbState.costData.length === 0) {
        alert("1.2 메뉴에서 [신축단가표 불러오기]를 통해 엑셀을 먼저 로드해주세요."); return;
    }
    window.currentCodeTarget = {mode, siteName, gIdx, rIdx};
    document.getElementById('codeSearchModal').style.display = 'flex';
    document.getElementById('codeSearchKeyword').value = initKeyword || "6-1-6-16-3";
    searchCodeData();
};

window.closeCodeModal = function() {
    document.getElementById('codeSearchModal').style.display = 'none';
    if(window.currentCodeTarget) {
        const m = window.currentCodeTarget.mode;
        const tbodyId = m === 'title' ? 'tbodyTitleEval' : (m === 'floor' ? 'tbodyFloorEval' : 'tbodyKfpaEval');
        const tabId = m === 'title' ? 'tabsTitleEval' : (m === 'floor' ? 'tabsFloorEval' : 'tabsKfpaEval');
        renderEvalTabsAndTable(m, tbodyId, tabId);
    }
    window.currentCodeTarget = null;
};

window.searchCodeData = function() {
    const col = document.getElementById('codeSearchCol').value;
    const kw = document.getElementById('codeSearchKeyword').value.trim().toLowerCase();
    const tbody = document.getElementById('codeSearchTbody');
    tbody.innerHTML = '';
    
    let filtered = window.kbState.costData;
    if(kw) filtered = filtered.filter(row => String(row[col]).toLowerCase().includes(kw));
    
    const max = Math.min(filtered.length, 100); 
    for(let i=0; i<max; i++) {
        const row = filtered[i];
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.style.background = i % 2 === 0 ? '#fff' : '#f9f9fa';
        
        tr.innerHTML = `
            <td>${row['대분류']}</td><td style="font-weight:bold; color:#1C5691;">${row['중분류']}</td><td>${row['소분류']}</td>
            <td>${row['용도']}</td><td>${row['구조']}</td><td>${row['급수']}</td>
            <td style="text-align:right;">${formatPrice(row['단가'])}</td><td style="text-align:right;">${formatPrice(row['노무비'])}</td>
        `;
        
        tr.onclick = () => { 
            Array.from(tbody.children).forEach(c => c.style.background = c.dataset.origBg);
            tr.dataset.origBg = tr.style.background;
            tr.style.background = '#d6e4f0';
            tbody.dataset.selectedCode = row['중분류']; 
        };
        
        tr.ondblclick = () => { 
            tbody.dataset.selectedCode = row['중분류'];
            applySelectedCode();
        };
        tbody.appendChild(tr);
    }
};

window.applySelectedCode = function() {
    const code = document.getElementById('codeSearchTbody').dataset.selectedCode;
    if(!code) return alert("반영할 코드를 목록에서 선택해주세요.");
    if(!window.currentCodeTarget) return;
    
    const {mode, siteName, gIdx, rIdx} = window.currentCodeTarget;
    applyCodeToRecord(code, mode, siteName, gIdx, rIdx); 
    closeCodeModal();
};