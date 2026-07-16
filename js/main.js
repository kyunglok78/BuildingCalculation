// ============================================================================
// [0] 화협 표준 감가율 DB 세팅
// ============================================================================
window.DEPRECIATION_DB = [
    ["철골·철근콘크리트조 / 철근콘크리트조", "일반건물 (우기 이외)", 75, 1.07],
    ["철골·철근콘크리트조 / 철근콘크리트조", "공장, 창고", 75, 1.40],
    ["철골·철근콘크리트조 / 철근콘크리트조", "변전소, 발전소 등 특수건물", 75, 2.11],
    ["철골조 / 석조 / 연와석조", "일반건물 (우기 이외)", 60, 1.33],
    ["철골조 / 석조 / 연와석조", "공장, 창고", 60, 1.78],
    ["철골조 / 석조 / 연와석조", "변전소, 발전소 등 특수건물", 60, 2.67],
    ["콘크리트조 / 연와조 / 벽돌조 / 보강블럭조 / 목조(한식)", "일반건물 (우기 이외)", 50, 1.60],
    ["콘크리트조 / 연와조 / 벽돌조 / 보강블럭조 / 목조(한식)", "공장, 창고", 50, 2.11],
    ["콘크리트조 / 연와조 / 벽돌조 / 보강블럭조 / 목조(한식)", "변전소, 발전소 등 특수건물", 50, 3.20],
    ["블록조 / 경량철골조 / 단열판넬조 / 목조(절충식)", "일반건물 (우기 이외)", 40, 2.00],
    ["블록조 / 경량철골조 / 단열판넬조 / 목조(절충식)", "공장, 창고", 40, 2.67],
    ["블록조 / 경량철골조 / 단열판넬조 / 목조(절충식)", "변전소, 발전소 등 특수건물", 40, 4.00],
    ["토조 / 토벽조 / 목골몰탈조", "일반건물 (우기 이외)", 30, 2.67]
];

// ============================================================================
// [1] 전역 상태 관리
// ============================================================================
window.kbState = {
    evalData: { title: {}, floor: {}, kfpa: {} }, 
    activeSite: { title: null, floor: null, kfpa: null },
    fetchedData: {},
    sortRev: { title: {}, floor: {}, kfpa: {} },
    costData: [] 
};

window.onload = function() {
    if (typeof goToSlide === 'function') goToSlide('slide2');
    
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
// [3] 사업장별 탭(Tab) 생성
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
    renderEvalTableGrouped(tbody, dataObj[currentSite], mode, currentSite);
}

// ============================================================================
// [4] ★ 하이브리드 UI 렌더링 엔진 (구조코드/감가율 항시입력창 탑재)
// ============================================================================
function renderEvalTableGrouped(tbody, groupedData, mode, siteName) {
    let grandTotalArea = 0, grandTotalReco = 0, grandTotalCur = 0;
    const groups = Array.isArray(groupedData) ? groupedData : Object.values(groupedData);

    groups.forEach((group, gIdx) => {
        let groupArea = 0;
        const records = group.records || group.데이터리스트 || [group]; 

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

            const codeVal = (strctCode !== "nan" && strctCode !== "-") ? strctCode : "";
            const codeInputHtml = `
                <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                    <input type="text" value="${codeVal}" style="width:80px; text-align:center; border:1px solid #ccc; padding:3px; font-weight:bold;" 
                        onchange="applyCodeToRecord(this.value, '${mode}', '${siteName}', ${gIdx}, ${rIdx})">
                    <button type="button" onclick="openCodeModal('${mode}', '${siteName}', ${gIdx}, ${rIdx}, this.previousElementSibling.value)" 
                        style="cursor:pointer; padding:3px 6px; background:#1C5691; color:white; border:none; border-radius:3px;" title="단가표 검색">🔍</button>
                </div>`;

            const depInputHtml = `
                <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                    <input type="number" step="0.01" value="${depRate}" style="width:50px; text-align:center; border:1px solid #ccc; padding:3px; font-weight:bold; color:#0056b3;" 
                        onchange="applyDeprToRecord(this.value, '${mode}', '${siteName}', ${gIdx}, ${rIdx})">
                    <button type="button" onclick="openDeprModal('${mode}', '${siteName}', ${gIdx}, ${rIdx})" 
                        style="cursor:pointer; padding:3px 6px; background:#28A745; color:white; border:none; border-radius:3px;" title="표준 감가율 검색">🔍</button>
                </div>`;

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
                <td>${codeInputHtml}</td>
                <td style="text-align:right; cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx}, '단가', 'number')">${formatPrice(unitPrice)}</td>
                <td style="text-align:right; cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx}, '노무비', 'number')">${formatPrice(laborCost)}</td>
                <td style="cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, ${rIdx}, '물가지수', 'number')">${priceIdx.toFixed(4)}</td>
                <td style="text-align:right; color:#0056b3;">${formatPrice(recoArch)}</td>
                <td>${depInputHtml}</td>
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

        const trSub = document.createElement('tr');
        trSub.style.backgroundColor = '#f8f9fa';
        trSub.innerHTML = `
            <td colspan="2"></td><td>부속설비</td><td>[${mainDongName}] 일괄부속</td><td colspan="6"></td>
            <td style="font-weight:bold; color:#0056b3; cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, 0, '부속비율', 'number', 'group')">${accRate.toFixed(1)}%</td>
            <td style="text-align:right;">${formatPrice(recoSub)}</td><td colspan="2"></td><td style="text-align:right;">${formatPrice(curSub)}</td>
        `;
        tbody.appendChild(trSub);

        const trTotal = document.createElement('tr');
        trTotal.style.backgroundColor = '#e2e8f0'; trTotal.style.fontWeight = 'bold';
        trTotal.innerHTML = `
            <td colspan="2"></td><td>[${mainDongName}] 소계</td><td></td><td style="text-align:right;">${formatArea(groupArea)}</td><td colspan="6"></td>
            <td style="text-align:right;">${formatPrice(recoTotal)}</td><td colspan="2"></td><td style="text-align:right;">${formatPrice(curTotal)}</td>
        `;
        tbody.appendChild(trTotal);
    });

    const trGrandTotal = document.createElement('tr');
    trGrandTotal.style.backgroundColor = '#cbd5e1'; trGrandTotal.style.fontWeight = 'bold';
    trGrandTotal.innerHTML = `
        <td colspan="4" style="text-align:center;">사업장 합계</td><td style="text-align:right;">${formatArea(grandTotalArea)}</td><td colspan="6"></td>
        <td style="text-align:right;">${formatPrice(grandTotalReco)}</td><td colspan="2"></td><td style="text-align:right;">${formatPrice(grandTotalCur)}</td>
    `;
    tbody.appendChild(trGrandTotal);
}

// ============================================================================
// [5] 기타 부가 헬퍼 (수동항목 추가 / 대장연동 / 삭제 / 정렬)
// ============================================================================
function addManualItem(mode) {
    const currentSite = window.kbState.activeSite[mode];
    if (!currentSite) return alert("선택된 사업장 탭이 없습니다.");

    const newGroup = {
        동명칭: "신규 추가항목", 부속비율: 20.0, 재조달_부속: 0, 현재_부속: 0, 재조달_합계: 0, 현재_합계: 0,
        records: [{
            일련번호: "수동", 동명칭: "신규 추가항목", 용도: "직접 입력", 연면적: 0, 구조명: "직접 입력", 
            준공연도: new Date().getFullYear(), 구조코드: "-", 단가: 0, 노무비: 0, 물가지수: 1.0, 
            감가율: 1.78, 재조달_건축: 0, 잔가율: 100, 현재_건축: 0
        }]
    };
    const targetData = window.kbState.evalData[mode][currentSite];
    if (Array.isArray(targetData)) targetData.push(newGroup);
    else {
        let key = "신규 추가항목", cnt = 1;
        while (targetData[key]) key = `신규 추가항목(${cnt++})`;
        newGroup.동명칭 = key; newGroup.records[0].동명칭 = key; targetData[key] = newGroup;
    }
    renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
}

function runGroupedRenderTest() {
    renderEvalTabsAndTable('title', 'tbodyTitleEval', 'tabsTitleEval');
    renderEvalTabsAndTable('floor', 'tbodyFloorEval', 'tabsFloorEval');
    renderEvalTabsAndTable('kfpa', 'tbodyKfpaEval', 'tabsKfpaEval');
}

function syncTitleData() {
    const fetchedData = window.kbState.fetchedData;
    if (!fetchedData || Object.keys(fetchedData).length === 0) {
        alert("연동할 수 없습니다. 먼저 [건축물대장 조회시작]을 완료해 주세요."); return;
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
            if (aprDate.length >= 4 && !isNaN(aprDate.substring(0, 4))) fallbackYear = parseInt(aprDate.substring(0, 4));
        }
        const siteRecords = [];
        dfTitle.forEach((row, idx) => {
            let dongNm = (row["dongNm"] || "").trim(); if (!dongNm || dongNm === "-" || dongNm === "nan") dongNm = "본동";
            const area = isNaN(parseFloat(String(row["totArea"] || "0").replace(/,/g, "").trim())) ? 0.0 : parseFloat(String(row["totArea"] || "0").replace(/,/g, "").trim());
            const strct = (row["strctCdNm"] || "-").trim(); const purps = (row["mainPurpsCdNm"] || "-").trim();
            let buildYear = fallbackYear;
            const rowAprDate = String(row["useAprDay"] || "").replace(/[-/]/g, "").trim();
            if (rowAprDate.length >= 4 && !isNaN(rowAprDate.substring(0, 4))) buildYear = parseInt(rowAprDate.substring(0, 4));
            
            siteRecords.push({
                "동명칭": dongNm, "부속비율": 20.0, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0,
                "records": [{
                    "일련번호": String(idx + 1), "동명칭": dongNm, "용도": purps, "연면적": area, "구조명": strct,
                    "준공연도": buildYear, "구조코드": "-", "단가": 0.0, "노무비": 0.0, "물가지수": 1.0,
                    "감가율": 1.78, "재조달_건축": 0, "잔가율": 100.0, "현재_건축": 0
                }]
            });
        });
        if (siteRecords.length > 0) newTitleData[siteName] = siteRecords;
    });
    window.kbState.evalData.title = newTitleData;
    window.kbState.activeSite.title = Object.keys(newTitleData)[0] || null;
    renderEvalTabsAndTable('title', 'tbodyTitleEval', 'tabsTitleEval');
    alert("표제부 데이터 연동이 완료되었습니다.");
}

window.syncFloorData = function() {
    const fetchedData = window.kbState.fetchedData;
    if (!fetchedData || Object.keys(fetchedData).length === 0) {
        alert("연동할 수 없습니다. 먼저 [건축물대장 조회시작]을 완료해 주세요."); return;
    }
    if (Object.keys(window.kbState.evalData.floor || {}).length > 0) {
        if (!confirm("기존에 작업 중이던 층별 평가 데이터가 초기화됩니다. 계속하시겠습니까?")) return;
    }
    
    const newFloorData = {};
    Object.keys(fetchedData).forEach(siteName => {
        const siteData = fetchedData[siteName];
        const dfFloor = siteData["floor"] || siteData["층별 개요"] || [];
        const dfRecap = siteData["recap"] || siteData["총괄표제부 정보"] || [];
        let fallbackYear = 2000;
        if (dfRecap.length > 0 && dfRecap[0]["useAprDay"]) {
            const aprDate = String(dfRecap[0]["useAprDay"]).replace(/[-/]/g, "").trim();
            if (aprDate.length >= 4 && !isNaN(aprDate.substring(0, 4))) fallbackYear = parseInt(aprDate.substring(0, 4));
        }
        const titleRecords = window.kbState.evalData.title[siteName] || [];
        const siteGroups = {}; 
        
        dfFloor.forEach((row, idx) => {
            let dongNm = (row["dongNm"] || "").trim(); 
            if (!dongNm || dongNm === "-" || dongNm === "nan") dongNm = "본동";
            const area = isNaN(parseFloat(String(row["area"] || "0").replace(/,/g, "").trim())) ? 0.0 : parseFloat(String(row["area"] || "0").replace(/,/g, "").trim());
            const strct = (row["strctCdNm"] || "-").trim(); 
            const flrGb = (row["flrGbCdNm"] || "").trim();
            const flrNo = (row["flrNoNm"] || "").trim();
            const etcPurps = (row["etcPurps"] || "-").trim();
            const flrText = flrNo ? `${flrGb} ${flrNo}층` : "";
            const purps = flrText ? `[${flrText}] ${etcPurps}` : etcPurps;
            
            let buildYear = fallbackYear;
            const rowAprDate = String(row["useAprDay"] || "").replace(/[-/]/g, "").trim();
            if (rowAprDate.length >= 4 && !isNaN(rowAprDate.substring(0, 4))) buildYear = parseInt(rowAprDate.substring(0, 4));
            
            const record = {
                "일련번호": String(idx + 1), "동명칭": dongNm, "용도": purps, "연면적": area, "구조명": strct,
                "준공연도": buildYear, "구조코드": "-", "단가": 0.0, "노무비": 0.0, "물가지수": 1.0,
                "감가율": 1.78, "재조달_건축": 0, "잔가율": 100.0, "현재_건축": 0
            };
            
            let inheritedRatio = 20.0; 
            const tGroup = titleRecords.find(g => g.동명칭 === dongNm);
            if (tGroup) {
                const tReq = tGroup.records[0];
                record["구조코드"] = tReq["구조코드"]; record["단가"] = tReq["단가"];
                record["노무비"] = tReq["노무비"]; record["물가지수"] = tReq["물가지수"];
                record["감가율"] = tReq["감가율"];
                record["준공연도"] = tReq["준공연도"]; // ★ 표제부 준공연도 상속 (수정됨)
                if (tGroup["부속비율"]) inheritedRatio = tGroup["부속비율"];
            }
            
            if (!siteGroups[dongNm]) {
                siteGroups[dongNm] = {
                    "동명칭": dongNm, "부속비율": inheritedRatio, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0,
                    "records": []
                };
            }
            siteGroups[dongNm].records.push(record);
        });
        if (Object.keys(siteGroups).length > 0) newFloorData[siteName] = Object.values(siteGroups);
    });
    
    window.kbState.evalData.floor = newFloorData;
    window.kbState.activeSite.floor = Object.keys(newFloorData)[0] || null;
    Object.keys(newFloorData).forEach(siteName => recalculateValuation('floor', siteName));
    renderEvalTabsAndTable('floor', 'tbodyFloorEval', 'tabsFloorEval');
    alert("✅ 층별 데이터 연동 완료!\n\n(표제부에서 작업하신 구조코드, 단가, 준공연도 등이 자동 상속되었습니다.)");
};

window.deleteEvalItem = function(mode, siteName, gIdx) {
    const siteData = window.kbState.evalData[mode][siteName];
    const targetName = Array.isArray(siteData) ? (siteData[gIdx].동명칭 || "선택항목") : Object.keys(siteData)[gIdx];
    if (!confirm(`[${targetName}] 평가 데이터를 완전히 삭제하시겠습니까?`)) return;
    if (Array.isArray(siteData)) siteData.splice(gIdx, 1);
    else delete siteData[Object.keys(siteData)[gIdx]]; 
    recalculateValuation(mode, siteName);
    renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
};

window.sortEvalData = function(mode, thElement) {
    const siteName = window.kbState.activeSite[mode]; if (!siteName) return;
    const targetData = window.kbState.evalData[mode][siteName]; if (!targetData) return;
    const isRev = !!window.kbState.sortRev[mode][siteName];
    window.kbState.sortRev[mode][siteName] = !isRev;
    const sortLogic = (a, b) => !isRev ? a.localeCompare(b, undefined, {numeric: true}) : b.localeCompare(a, undefined, {numeric: true});
    if (Array.isArray(targetData)) targetData.sort((a, b) => sortLogic(a.동명칭 || "", b.동명칭 || ""));
    else {
        const sortedKeys = Object.keys(targetData).sort(sortLogic);
        const newData = {}; sortedKeys.forEach(k => newData[k] = targetData[k]);
        window.kbState.evalData[mode][siteName] = newData;
    }
    thElement.closest('tr').querySelectorAll('th').forEach(th => {
        if(th.innerText.includes('동명칭')) th.innerText = !isRev ? '동명칭 ▲' : '동명칭 ▼';
    });
    renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
};

// ============================================================================
// [6] 셀 인라인 편집 및 가액 재계산
// ============================================================================
window.editCell = function(tdElement, mode, siteName, gIdx, rIdx, field, inputType, level = 'record') {
    if (tdElement.querySelector('input')) return;
    let targetObj; const siteData = window.kbState.evalData[mode][siteName];
    if (Array.isArray(siteData)) targetObj = level === 'group' ? siteData[gIdx] : siteData[gIdx].records[rIdx];
    else targetObj = level === 'group' ? siteData[Object.keys(siteData)[gIdx]] : siteData[Object.keys(siteData)[gIdx]].records[rIdx];

    const input = document.createElement('input');
    input.type = 'text'; input.value = targetObj[field] || (inputType === 'number' ? 0 : '');
    input.style.width = '90%'; input.style.textAlign = 'center'; input.style.border = '2px solid #1C5691'; input.style.padding = '3px'; input.style.fontWeight = 'bold';
    tdElement.innerHTML = ''; tdElement.appendChild(input); input.focus(); input.select();

    const saveValue = () => {
        let newVal = input.value.replace(/,/g, '').replace(/%/g, '').trim();
        if (inputType === 'number') newVal = isNaN(parseFloat(newVal)) ? 0 : parseFloat(newVal);
        targetObj[field] = newVal;
        if (field === '노무비') {
            if(window.applyAutoPriceIndex) window.applyAutoPriceIndex(targetObj);
        }
        recalculateValuation(mode, siteName);
        renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
    };
    input.addEventListener('blur', saveValue);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { input.removeEventListener('blur', saveValue); saveValue(); } });
};

window.recalculateValuation = function(mode, siteName) {
    const evalYearInput = document.getElementById('evalYear');
    const evalYear = parseInt(evalYearInput ? evalYearInput.value : new Date().getFullYear());
    const siteData = window.kbState.evalData[mode][siteName];
    if(!siteData) return;
    const groups = Array.isArray(siteData) ? siteData : Object.values(siteData);

    groups.forEach(group => {
        let totRecoArch = 0, totCurArch = 0;
        group.records.forEach(r => {
            const compConstCost = (r.연면적 || 0) * (r.단가 || 0) * (r.물가지수 || 1.0);
            r.재조달_건축 = Math.floor(compConstCost / 1000) * 1000;
            const elapsed = Math.max(0, evalYear - (r.준공연도 || evalYear));
            let residualRatio = 1.0 - (elapsed * ((r.감가율 || 1.78) / 100.0));
            if (residualRatio < 0.30) residualRatio = 0.30; 
            r.잔가율 = residualRatio * 100.0;
            r.현재_건축 = Math.floor((r.재조달_건축 * residualRatio) / 1000) * 1000;
            totRecoArch += r.재조달_건축; totCurArch += r.현재_건축;
        });

        const accRate = parseFloat(group.부속비율 || 20.0) / 100.0;
        group.재조달_부속 = Math.floor((totRecoArch * accRate) / 1000) * 1000;
        const repResidualRatio = group.records.length > 0 ? (group.records[0].잔가율 / 100.0) : 1.0;
        group.현재_부속 = Math.floor((group.재조달_부속 * repResidualRatio) / 1000) * 1000;
        group.재조달_합계 = totRecoArch + group.재조달_부속;
        group.현재_합계 = totCurArch + group.현재_부속;
    });
};

// ============================================================================
// [7] 단가/물가/구조코드 연동 로직
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
            
            window.kbState.costBaseYear = new Date().getFullYear();
            let idxDanga = 26, idxNomu = 43; 
            let yearCols = [];
            for (let r = 0; r < Math.min(jsonData.length, 15); r++) {
                const row = jsonData[r];
                if (!row) continue;
                for (let c = 5; c < row.length; c++) {
                    const match = String(row[c]).replace(/\s/g, "").match(/^(20\d{2})(년)?$/);
                    if (match) yearCols.push({ col: c, year: parseInt(match[1], 10) });
                }
            }
            if (yearCols.length > 0) {
                const maxYear = Math.max(...yearCols.map(y => y.year));
                window.kbState.costBaseYear = maxYear; 
                const uniqueCols = [...new Set(yearCols.filter(y => y.year === maxYear).map(y => y.col))].sort((a, b) => a - b);
                if (uniqueCols.length >= 2) { idxDanga = uniqueCols[0]; idxNomu = uniqueCols[1]; } 
                else if (uniqueCols.length === 1) { idxDanga = uniqueCols[0]; idxNomu = uniqueCols[0] + 1; }
            }

            window.kbState.costData = [];
            for(let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                if(!row || row.length < 6) continue;
                const colDae = String(row[0] || "").trim(); const colJung = String(row[1] || "").trim();
                const colSo = String(row[2] || "").trim(); const colYong = String(row[3] || "").trim();
                const colGoo = String(row[4] || "").trim(); const colGeup = String(row[5] || "").trim();
                
                if (colDae.includes("용도별") || colDae.includes("상승지수") || colDae.includes("분류번호")) continue;
                if (!colDae && !colJung && !colYong && !colGoo) continue;
                
                const danga = parseFloat(String(row[idxDanga]).replace(/,/g, '')) || 0;
                const nomu = parseFloat(String(row[idxNomu]).replace(/,/g, '')) || 0;
                if (danga === 0 && nomu === 0 && colGoo === "" && colGoo === "-") continue;
                
                window.kbState.costData.push({'대분류': colDae || "-", '중분류': colJung || colDae || "-", '소분류': colSo || "-", '용도': colYong || "-", '구조': colGoo || "-", '급수': colGeup || "-", '단가': danga, '노무비': nomu});
            }
            alert(`✅ 신축단가표 분석 완료! (총 ${window.kbState.costData.length}건)`);
            if(window.retroactiveApplyPriceIndex) window.retroactiveApplyPriceIndex();
        } catch(err) { alert("엑셀 파싱 중 오류가 발생했습니다.\n(에러: " + err + ")"); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
};

window.applyCodeToRecord = function(code, mode, siteName, gIdx, rIdx, skipRender=false) {
    const siteData = window.kbState.evalData[mode][siteName];
    const updateRecord = (record) => {
        record['구조코드'] = code;
        if(window.kbState.costData && window.kbState.costData.length > 0) {
            const cleanCode = String(code).replace(/-/g, "");
            const matched = window.kbState.costData.find(row => {
                const allText = Object.values(row).map(v => String(v || "")).join(" ").toLowerCase();
                return allText.includes(String(code).toLowerCase()) || (cleanCode && allText.replace(/-/g, "").includes(cleanCode));
            });
            if(matched) { 
                record['단가'] = matched['단가']; 
                record['노무비'] = matched['노무비']; 
                // ★ 단가표의 구조(F열) 또는 중분류(C열) 이름을 구조명으로 자동 업데이트
                record['구조명'] = (matched['구조'] && matched['구조'] !== "-") ? matched['구조'] : matched['중분류'];
                if(window.applyAutoPriceIndex) window.applyAutoPriceIndex(record); 
            }
        }
    };
    if (gIdx === null || rIdx === null) { 
        if(!siteData) return;
        if (Array.isArray(siteData)) siteData.forEach(group => group.records.forEach(updateRecord));
        else Object.values(siteData).forEach(group => group.records.forEach(updateRecord));
    } else { updateRecord(Array.isArray(siteData) ? siteData[gIdx].records[rIdx] : siteData[Object.keys(siteData)[gIdx]].records[rIdx]); }
    recalculateValuation(mode, siteName); 
    if(!skipRender) renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
};

window.currentCodeTarget = null;
window.openCodeModal = function(mode, siteName, gIdx, rIdx, initKeyword) {
    if(!window.kbState.costData || window.kbState.costData.length === 0) return alert("1.2 메뉴에서 [신축단가표 불러오기]를 통해 엑셀을 먼저 로드해주세요.");
    window.currentCodeTarget = {mode, siteName, gIdx, rIdx};
    document.getElementById('codeSearchModal').style.display = 'flex';
    document.getElementById('codeSearchKeyword').value = initKeyword || "6-1-6-16-3";
    searchCodeData();
};
window.closeCodeModal = function() { document.getElementById('codeSearchModal').style.display = 'none'; window.currentCodeTarget = null; };

window.searchCodeData = function() {
    const col = document.getElementById('codeSearchCol').value;
    const kw = document.getElementById('codeSearchKeyword').value.trim().toLowerCase();
    const tbody = document.getElementById('codeSearchTbody'); tbody.innerHTML = '';
    
    let filtered = window.kbState.costData;
    if(kw) {
        filtered = filtered.filter(row => {
            const targetVal = String(row[col] || "").toLowerCase();
            const allText = Object.values(row).map(v => String(v || "")).join(" ").toLowerCase();
            const cleanKw = kw.replace(/-/g, "");
            return targetVal.includes(kw) || allText.includes(kw) || (cleanKw && allText.replace(/-/g, "").includes(cleanKw));
        });
    }
    
    const max = Math.min(filtered.length, 100); 
    for(let i=0; i<max; i++) {
        const row = filtered[i]; const tr = document.createElement('tr');
        tr.style.cursor = 'pointer'; tr.style.background = i % 2 === 0 ? '#fff' : '#f9f9fa';
        const dispDae = row['대분류'] || '-'; const dispJung = row['중분류'] || dispDae;
        tr.innerHTML = `<td>${dispDae}</td><td style="font-weight:bold; color:#1C5691;">${dispJung}</td><td>${row['소분류'] || '-'}</td><td>${row['용도'] || dispDae}</td><td>${row['구조'] || '-'}</td><td>${row['급수'] || '-'}</td><td style="text-align:right;">${formatPrice(row['단가'])}</td><td style="text-align:right;">${formatPrice(row['노무비'])}</td>`;
        const applyVal = (dispJung !== '-' && dispJung !== 'undefined') ? dispJung : dispDae;
        tr.onclick = () => { Array.from(tbody.children).forEach(c => c.style.background = c.dataset.origBg); tr.dataset.origBg = tr.style.background; tr.style.background = '#d6e4f0'; tbody.dataset.selectedCode = applyVal; };
        tr.ondblclick = () => { tbody.dataset.selectedCode = applyVal; applySelectedCode(); };
        tbody.appendChild(tr);
    }
};

window.applySelectedCode = function() {
    const code = document.getElementById('codeSearchTbody').dataset.selectedCode;
    if(!code || code === 'undefined') return alert("반영할 코드를 선택해주세요.");
    if(!window.currentCodeTarget) return;
    applyCodeToRecord(code, window.currentCodeTarget.mode, window.currentCodeTarget.siteName, window.currentCodeTarget.gIdx, window.currentCodeTarget.rIdx); 
    closeCodeModal();
};

window.loadIndexExcel = function(event) {
    const file = event.target.files[0];
    if(!file) return;
    document.getElementById('priceIndexPath').value = file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            window.kbState.indexData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {defval: "-"});
            alert(`✅ 건축물가지수 엑셀 분석 완료!`);
            if(window.retroactiveApplyPriceIndex) window.retroactiveApplyPriceIndex();
        } catch(err) { alert("물가지수 파싱 중 오류 발생: " + err); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
};
setTimeout(() => { const priceIndexFile = document.getElementById('priceIndexFile'); if(priceIndexFile) priceIndexFile.addEventListener('change', window.loadIndexExcel); }, 1000);

window.applyAutoPriceIndex = function(record) {
    if(!window.kbState.indexData || window.kbState.indexData.length === 0) return;
    const nomuVal = parseFloat(record['노무비']) || 0; if (nomuVal <= 0) return;
    const targetYear = String(window.kbState.costBaseYear || new Date().getFullYear());
    let yearCol = null, nomuCol = null;
    for(let key in window.kbState.indexData[0] || {}) {
        const cleanKey = String(key).replace(/\s/g, '');
        if (cleanKey.includes(targetYear)) yearCol = key;
        if (cleanKey.includes("인건비") || cleanKey.includes("노무비")) nomuCol = key;
    }
    if (!yearCol || !nomuCol) return;
    const matched = window.kbState.indexData.find(row => parseFloat(String(row[nomuCol] || "").replace(/,/g, '').split('.')[0]) === Math.floor(nomuVal));
    if (matched && !isNaN(parseFloat(String(matched[yearCol]).replace(/,/g, '')))) record['물가지수'] = parseFloat(String(matched[yearCol]).replace(/,/g, ''));
};

window.retroactiveApplyPriceIndex = function() {
    let changed = false;
    ['title', 'floor', 'kfpa'].forEach(mode => {
        if (!window.kbState.evalData[mode]) return;
        Object.keys(window.kbState.evalData[mode]).forEach(siteName => {
            let groups = window.kbState.evalData[mode][siteName];
            (Array.isArray(groups) ? groups : Object.values(groups)).forEach(group => {
                (group.records || [group]).forEach(r => { if (r["단가"] > 0 || r["노무비"] > 0) { window.applyAutoPriceIndex(r); changed = true; } });
            });
        });
    });
    if (changed) {
        ['title', 'floor', 'kfpa'].forEach(mode => Object.keys(window.kbState.evalData[mode] || {}).forEach(siteName => recalculateValuation(mode, siteName)));
        runGroupedRenderTest();
    }
};

// ============================================================================
// [8] 감가율 연동 
// ============================================================================
window.applyDeprToRecord = function(rate, mode, siteName, gIdx, rIdx, skipRender=false) {
    const siteData = window.kbState.evalData[mode][siteName];
    const rateVal = parseFloat(rate) || 1.78;
    const updateRecord = (record) => { record['감가율'] = rateVal; };
    if (gIdx === null || rIdx === null) {
        if(!siteData) return;
        if (Array.isArray(siteData)) siteData.forEach(group => group.records.forEach(updateRecord));
        else Object.values(siteData).forEach(group => group.records.forEach(updateRecord));
    } else { updateRecord(Array.isArray(siteData) ? siteData[gIdx].records[rIdx] : siteData[Object.keys(siteData)[gIdx]].records[rIdx]); }
    recalculateValuation(mode, siteName); 
    if(!skipRender) renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
};

window.currentDeprTarget = null;
window.openDeprModal = function(mode, siteName, gIdx, rIdx) {
    if(!siteName) return alert("선택된 사업장 탭이 없습니다.");
    window.currentDeprTarget = {mode, siteName, gIdx, rIdx};
    document.getElementById('deprSearchModal').style.display = 'flex';
    const tbody = document.getElementById('deprSearchTbody'); tbody.innerHTML = '';
    window.DEPRECIATION_DB.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer'; tr.style.background = i % 2 === 0 ? '#fff' : '#f9f9fa';
        tr.innerHTML = `<td style="text-align:left; padding-left:10px;">${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td style="font-weight:bold; color:#d32f2f;">${row[3]}</td>`;
        tr.onclick = () => { Array.from(tbody.children).forEach(c => c.style.background = c.dataset.origBg); tr.dataset.origBg = tr.style.background; tr.style.background = '#d6e4f0'; tbody.dataset.selectedRate = row[3]; };
        tr.ondblclick = () => { tbody.dataset.selectedRate = row[3]; applySelectedDepr(); };
        tbody.appendChild(tr);
    });
};
window.closeDeprModal = function() { document.getElementById('deprSearchModal').style.display = 'none'; window.currentDeprTarget = null; };
window.applySelectedDepr = function() {
    const rate = document.getElementById('deprSearchTbody').dataset.selectedRate;
    if(!rate) return alert("반영할 감가율을 선택해주세요.");
    if(!window.currentDeprTarget) return;
    applyDeprToRecord(rate, window.currentDeprTarget.mode, window.currentDeprTarget.siteName, window.currentDeprTarget.gIdx, window.currentDeprTarget.rIdx); 
    closeDeprModal();
};

window.batchApplyRatio = function(mode, siteName) {
    if (!siteName) return alert("선택된 사업장 탭이 없습니다.");
    const val = prompt(`[${siteName}]의 모든 항목에 일괄 적용할 부속설비 비율(%)을 입력하세요:\n(예: 15)`, "20.0");
    if (val === null) return;
    const rate = parseFloat(val) || 0;
    const siteData = window.kbState.evalData[mode][siteName];
    if (Array.isArray(siteData)) siteData.forEach(group => group.부속비율 = rate);
    else Object.values(siteData).forEach(group => group.부속비율 = rate);
    recalculateValuation(mode, siteName);
    renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
    alert(`부속비율이 ${rate}%로 일괄 반영되었습니다.`);
};

// ============================================================================
// [10] ★ 프로젝트 임시 저장 및 불러오기 (평가지수 파일명, 화협 임시데이터 완벽 보존)
// ============================================================================
window.quickSaveProject = function() {
    try {
        const hasEvalData = Object.keys(window.kbState.evalData.title).length > 0 || 
                            Object.keys(window.kbState.evalData.floor).length > 0 || 
                            Object.keys(window.kbState.evalData.kfpa).length > 0;
        
        // ★ 화협 엑셀을 올려두기만 하고 확정하지 않은 임시 데이터가 있는지도 체크
        const hasTempKfpa = Object.keys(window.tempKfpaDataStore || {}).length > 0;
        
        // ★ 단가표나 물가지수를 올린 기록이 있는지도 체크
        const hasCostData = window.kbState.costData && window.kbState.costData.length > 0;
                            
        if (Object.keys(window.kbState.fetchedData).length === 0 && !hasEvalData && !hasTempKfpa && !hasCostData) {
            alert("저장할 데이터가 존재하지 않습니다. 대장 조회, 엑셀 업로드 등을 먼저 진행해 주세요.");
            return;
        }

        const contractorInputs = document.querySelectorAll('.contractor-sync');
        const contractorName = contractorInputs.length > 0 ? contractorInputs[0].value : "";
        const evalYearInput = document.getElementById('evalYear');
        const evalYear = evalYearInput ? evalYearInput.value : new Date().getFullYear();

        const locations = [];
        document.querySelectorAll('#locationListBox .list-row').forEach(row => {
            locations.push({
                name: row.querySelector('.input-short') ? row.querySelector('.input-short').value : '',
                address: row.querySelector('.addr-input') ? row.querySelector('.addr-input').value : '',
                checkedLedger: row.querySelector('.check-ledger') ? row.querySelector('.check-ledger').checked : true,
                checkedKfpa: row.querySelector('.check-kfpa') ? row.querySelector('.check-kfpa').checked : true
            });
        });

        // ★ 저장 항목에 단가표/물가지수 파일명 텍스트와 화협 임시 바구니를 모조리 포함!
        // (단가표 데이터 자체는 kbState 안에 이미 포함되어 함께 자동 저장됩니다)
        const projectData = {
            version: "1.4", 
            contractor: contractorName,
            evalYear: evalYear,
            locations: locations, 
            unitCostPath: document.getElementById('unitCostPath') ? document.getElementById('unitCostPath').value : "",
            priceIndexPath: document.getElementById('priceIndexPath') ? document.getElementById('priceIndexPath').value : "",
            tempKfpaDataStore: window.tempKfpaDataStore || {},
            targetKfpaSite: window.targetKfpaSite || "",
            targetKfpaAddress: window.targetKfpaAddress || "",
            kbState: window.kbState 
        };

        const jsonString = JSON.stringify(projectData);
        if(!jsonString) throw new Error("JSON 변환 실패");

        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, "");
        a.download = `${contractorName || '가액평가'}_임시저장_${dateStr}.kbproj`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert("저장 중 오류가 발생했습니다. 화면이 정상적인 상태인지 확인해주세요.\n(" + e.message + ")");
    }
};

window.quickLoadProject = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const projectData = JSON.parse(e.target.result);
            
            // 1. 핵심 상태 데이터 복구 (단가표 데이터, 물가지수 데이터도 여기서 복구됨)
            if (projectData.kbState) window.kbState = projectData.kbState;

            // 2. ★ 화협 임시 바구니 완벽 복구 (엑셀 올려두고 확정 안 한 상태 그대로!)
            if (projectData.tempKfpaDataStore) window.tempKfpaDataStore = projectData.tempKfpaDataStore;
            if (projectData.targetKfpaSite) window.targetKfpaSite = projectData.targetKfpaSite;
            if (projectData.targetKfpaAddress) window.targetKfpaAddress = projectData.targetKfpaAddress;

            // 3. 일반 정보 복구
            if (projectData.contractor) {
                document.querySelectorAll('.contractor-sync').forEach(el => el.value = projectData.contractor);
            }
            if (projectData.evalYear) {
                const evalYearInput = document.getElementById('evalYear');
                if (evalYearInput) evalYearInput.value = projectData.evalYear;
            }

            // 4. ★ 평가지수 파일명 텍스트 복구 (화면에 이름이 그대로 표시됨!)
            if (projectData.unitCostPath) {
                const uPath = document.getElementById('unitCostPath');
                if (uPath) uPath.value = projectData.unitCostPath;
            }
            if (projectData.priceIndexPath) {
                const pPath = document.getElementById('priceIndexPath');
                if (pPath) pPath.value = projectData.priceIndexPath;
            }

            // 5. 소재지 리스트 화면 복구
            const listBox = document.getElementById('locationListBox');
            if (listBox) {
                listBox.innerHTML = ''; 
                if (projectData.locations && projectData.locations.length > 0) {
                    projectData.locations.forEach((loc, idx) => {
                        const row = document.createElement('div');
                        row.className = 'list-row';
                        row.innerHTML = `
                            <input type="checkbox" class="row-checkbox" checked><span>소재지 ${idx + 1}</span>
                            <input type="text" class="input-short" value="${loc.name}" placeholder="예: 공장/지점명">
                            <button type="button" class="btn-blue" onclick="openAddressModal(this); return false;"><i class="fa-solid fa-magnifying-glass"></i> 주소 검색</button>
                            <span>주소</span><input type="text" class="input-long addr-input" value="${loc.address}" placeholder="주소를 검색해 주세요" readonly>
                            <div class="check-group">
                                <label class="check-item"><input type="checkbox" class="check-ledger" ${loc.checkedLedger ? 'checked' : ''} onchange="updateMenuState()"> 건축물대장</label>
                                <label class="check-item"><input type="checkbox" class="check-kfpa" ${loc.checkedKfpa ? 'checked' : ''} onchange="updateMenuState()"> 화협자료평가</label>
                            </div>
                        `;
                        listBox.appendChild(row);
                    });
                    const locCountInput = document.getElementById('locationCount');
                    if(locCountInput) locCountInput.value = projectData.locations.length;
                } 
            }

            runGroupedRenderTest();

            // 6. 공공데이터(대장) 탭 복구 로직
            if (window.kbState.fetchedData && Object.keys(window.kbState.fetchedData).length > 0) {
                const dataContainer = document.getElementById('fetchedDataContainer');
                const tabsContainer = document.getElementById('slide3Tabs');
                const emptyMsg = document.getElementById('emptyStateMsg');
                
                if (emptyMsg) emptyMsg.style.display = 'none';
                if (dataContainer && tabsContainer) {
                    dataContainer.style.display = 'block';
                    dataContainer.innerHTML = ''; 
                    tabsContainer.innerHTML = '';

                    const korMap = {
                        "platPlc": "대지위치", "bldNm": "건물명", "mainPurpsCdNm": "주용도",
                        "mainBldCnt": "주건축물수", "subBldCnt": "부속건축물수", "totArea": "연면적(㎡)",
                        "pmsDay": "허가일", "stcnsDay": "착공일", "useAprDay": "사용승인일",
                        "dongNm": "동명칭", "grndFlrCnt": "지상층수", "ugrndFlrCnt": "지하층수",
                        "heit": "높이(m)", "strctCdNm": "구조명", "roofCdNm": "지붕코드명",
                        "flrGbCdNm": "층구분", "flrNoNm": "층번호", "area": "면적(㎡)", "etcPurps": "기타용도"
                    };

                    let isFirst = true;
                    for (const [siteName, siteData] of Object.entries(window.kbState.fetchedData)) {
                        const tabBtn = document.createElement('div');
                        tabBtn.innerText = siteName;
                        tabBtn.style.cssText = `padding:10px 20px; cursor:pointer; font-weight:bold; border:1px solid #ddd; border-bottom:none; border-radius:4px 4px 0 0; margin-right:5px; background:${isFirst ? '#fff' : '#f8f9fa'}; color:${isFirst ? '#1C5691' : '#333'};`;
                        
                        const contentDiv = document.createElement('div');
                        contentDiv.style.display = isFirst ? 'block' : 'none';
                        
                        tabBtn.onclick = () => { 
                            Array.from(tabsContainer.children).forEach(c => { c.style.background = '#f8f9fa'; c.style.color = '#333'; });
                            Array.from(dataContainer.children).forEach(c => c.style.display = 'none');
                            tabBtn.style.background = '#fff'; tabBtn.style.color = '#1C5691';
                            contentDiv.style.display = 'block';
                        };
                        tabsContainer.appendChild(tabBtn);

                        for (const [title, rows] of Object.entries(siteData)) {
                            if (title === 'address' || title === 'errors' || !Array.isArray(rows) || rows.length === 0) continue;
                            
                            const sectionTitle = document.createElement('h3');
                            let korTitle = title === 'recap' ? '총괄표제부 정보' : (title === 'title' ? '표제부 상세' : (title === 'floor' ? '층별 개요' : title));
                            sectionTitle.innerText = `■ ${korTitle}`; 
                            sectionTitle.style.cssText = 'font-size:15px; margin: 20px 0 10px 0; color:#1C5691;';
                            contentDiv.appendChild(sectionTitle);

                            const tableWrapper = document.createElement('div');
                            tableWrapper.style.cssText = 'overflow-x:auto; margin-bottom:20px; border:1px solid #ddd; max-height: 300px; overflow-y: auto;';
                            
                            const table = document.createElement('table');
                            table.className = 'data-table'; 
                            table.style.margin = '0';
                            
                            const thead = document.createElement('thead');
                            const headerRow = document.createElement('tr');
                            thead.style.position = 'sticky';
                            thead.style.top = '0';
                            thead.style.zIndex = '1';
                            
                            const cols = Object.keys(rows[0]);
                            cols.forEach(col => {
                                const th = document.createElement('th');
                                const korName = korMap[col] || col;
                                th.innerHTML = `${korName} <span style="font-size:10px; color:#ccc;">▲▼</span>`;
                                th.style.cursor = 'pointer';
                                
                                th.dataset.sortOrder = 'asc';
                                th.onclick = () => {
                                    const isAsc = th.dataset.sortOrder === 'asc';
                                    th.dataset.sortOrder = isAsc ? 'desc' : 'asc';
                                    
                                    const tbody = table.querySelector('tbody');
                                    const rowArray = Array.from(tbody.querySelectorAll('tr'));
                                    const colIndex = Array.from(headerRow.children).indexOf(th);
                                    
                                    rowArray.sort((a, b) => {
                                        const cellA = a.children[colIndex].innerText.replace(/,/g, '');
                                        const cellB = b.children[colIndex].innerText.replace(/,/g, '');
                                        const valA = isNaN(cellA) ? cellA : parseFloat(cellA);
                                        const valB = isNaN(cellB) ? cellB : parseFloat(cellB);
                                        
                                        if(valA > valB) return isAsc ? 1 : -1;
                                        if(valA < valB) return isAsc ? -1 : 1;
                                        return 0;
                                    });
                                    rowArray.forEach(tr => tbody.appendChild(tr)); 
                                };
                                headerRow.appendChild(th);
                            });
                            thead.appendChild(headerRow);
                            table.appendChild(thead);
                            
                            const tbody = document.createElement('tbody');
                            rows.forEach((row, rIdx) => {
                                const tr = document.createElement('tr');
                                tr.style.background = rIdx % 2 === 0 ? '#fff' : '#f9f9fa';
                                cols.forEach(col => {
                                    const td = document.createElement('td');
                                    td.innerText = row[col] || '-';
                                    td.style.textAlign = 'center';
                                    tr.appendChild(td);
                                });
                                tbody.appendChild(tr);
                            });
                            table.appendChild(tbody);
                            tableWrapper.appendChild(table);
                            contentDiv.appendChild(tableWrapper);
                        }
                        dataContainer.appendChild(contentDiv);
                        isFirst = false;
                    }
                }
            }

            alert("✅ 임시 저장 데이터 완벽 로드 완료!\n(화협 데이터, 평가지수 파일명 등 모든 상태가 복구되었습니다.)");
        } catch (err) {
            alert("⚠️ 파일 형식이 잘못되었거나 과거의 손상된 저장 파일입니다.\n(에러: " + err.message + ")");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
};


// ============================================================================
// [11] ★ 화협(KFPA) 다중 사업장 바구니 보존 및 일괄 확정 로직 (데이터 증발 완벽 방어)
// ============================================================================
window.targetKfpaSite = "";
window.targetKfpaAddress = "";

// ★ 전역 바구니가 없으면 만들고, 이미 있으면 절대 초기화하지 않도록 방어막 설정!
if (typeof window.tempKfpaDataStore === 'undefined') {
    window.tempKfpaDataStore = {};
}

// 1. 화협 불러오기 진입 시 탭 세팅
window.initKfpaScreen = function() {
    const tabsContainer = document.getElementById('slide6Tabs');
    const infoPanel = document.getElementById('kfpaActiveInfoPanel');
    if(!tabsContainer) return;
    tabsContainer.innerHTML = '';
    
    const locations = [];
    document.querySelectorAll('#locationListBox .list-row').forEach(row => {
        const name = row.querySelector('.input-short') ? row.querySelector('.input-short').value.trim() : '';
        const addr = row.querySelector('.addr-input') ? row.querySelector('.addr-input').value.trim() : '';
        const checkedKfpa = row.querySelector('.check-kfpa') ? row.querySelector('.check-kfpa').checked : false;
        if(name && checkedKfpa) locations.push({name, addr});
    });

    if(locations.length === 0) {
        tabsContainer.innerHTML = '<div style="padding: 15px; color: #dc3545; font-weight: bold;">등록된 사업장이 없거나 화협자료평가 체크가 해제되어 있습니다. (1.1 일반정보 확인)</div>';
        infoPanel.style.display = 'none';
        goToSlide('slide6');
        return;
    }

    infoPanel.style.display = 'block';
    let isFirst = true;

    locations.forEach(loc => {
        const tabBtn = document.createElement('div');
        tabBtn.innerText = loc.name;
        tabBtn.style.cssText = `padding:10px 20px; cursor:pointer; font-weight:bold; border:1px solid #ddd; border-bottom:none; border-radius:4px 4px 0 0; margin-right:5px; background:${isFirst ? '#fff' : '#f8f9fa'}; color:${isFirst ? '#1C5691' : '#333'};`;
        
        tabBtn.onclick = () => {
            Array.from(tabsContainer.children).forEach(c => { c.style.background = '#f8f9fa'; c.style.color = '#333'; });
            tabBtn.style.background = '#fff'; tabBtn.style.color = '#1C5691';
            
            document.getElementById('kfpaPreviewSite').value = loc.name;
            document.getElementById('kfpaPreviewAddress').value = loc.addr;
            window.targetKfpaSite = loc.name;
            window.targetKfpaAddress = loc.addr;
            
            // ★ 메뉴를 이동했다 돌아와도 바구니(tempKfpaDataStore)에 있는 데이터를 그대로 화면에 그려줌!
            if (typeof window.tempKfpaDataStore === 'undefined') window.tempKfpaDataStore = {};
            renderKfpaPreview(loc.name);
        };
        tabsContainer.appendChild(tabBtn);

        // 화면 진입 시 기존에 보던 탭이 있다면 그 탭을, 없다면 첫 번째 탭을 강제 클릭
        if (window.targetKfpaSite === loc.name) {
            tabBtn.click();
            isFirst = false;
        } else if (isFirst && !window.targetKfpaSite) {
            tabBtn.click();
            isFirst = false;
        }
    });
    
    // 일치하는 탭이 없어서 클릭 안 됐을 경우 첫번째 탭 강제 클릭 (버그 방어)
    if (isFirst && tabsContainer.firstChild) tabsContainer.firstChild.click();
    
    goToSlide('slide6');
};

// 2. 화면 미리보기 렌더링 함수
window.renderKfpaPreview = function(siteName) {
    const tbody = document.getElementById('previewKfpaTbody');
    const btnConfirm = document.getElementById('btnConfirmKfpa');
    const records = window.tempKfpaDataStore[siteName];

    if(!records || records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 60px; color:#999; font-size:14px;"><i class="fa-regular fa-folder-open" style="font-size:30px; margin-bottom:10px; display:block;"></i>우측 상단의 <b>[해당 사업장 화협 엑셀 첨부]</b>를 눌러 데이터를 업로드해주세요.</td></tr>`;
    } else {
        tbody.innerHTML = '';
        let totalArea = 0;

        records.forEach(r => {
            const tr = document.createElement('tr');
            if(r.isSubtotal) { 
                tr.style.background = '#e9ecef';
                tr.style.fontWeight = 'bold';
                tr.innerHTML = `<td></td><td></td><td colspan="4" style="color:#1C5691; text-align:center;">${r.동명칭}</td><td style="text-align:right; color:#1C5691;">${r.연면적.toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td><td></td>`;
            } else { 
                totalArea += r.연면적;
                tr.innerHTML = `<td style="font-weight:bold;">${r.일련번호}</td><td>${r.동번호}</td><td style="font-weight:bold; color:#1C5691;">${r.동명칭}</td><td>${r.준공연도}</td><td>${r.층수}</td><td>${r.구조명}</td><td style="text-align:right;">${r.연면적.toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td><td style="text-align:left;">${r.용도}</td>`;
            }
            tbody.appendChild(tr);
        });

        const totalTr = document.createElement('tr');
        totalTr.style.background = '#cbd5e1'; totalTr.style.fontWeight = 'bold';
        totalTr.innerHTML = `<td colspan="6" style="text-align:center; color:#333;">${siteName} 사업장 총면적 합계</td><td style="text-align:right; color:#d32f2f;">${totalArea.toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td><td></td>`;
        tbody.appendChild(totalTr);
    }

    // 바구니에 전체 사업장 중 하나라도 데이터가 있다면 확정 버튼 노출
    if (window.tempKfpaDataStore && Object.keys(window.tempKfpaDataStore).length > 0) {
        btnConfirm.style.display = 'block';
    } else {
        btnConfirm.style.display = 'none';
    }
};

// 3. 엑셀 파일 파싱 (빈칸 채우기 포함)
window.loadKfpaExcel = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    const siteName = window.targetKfpaSite;
    if(!siteName) { alert("선택된 사업장 탭이 없습니다."); event.target.value = ''; return; }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {defval: ""});
            
            if(jsonData.length === 0) return alert("엑셀 파일에 데이터가 없습니다.");

            const headers = Object.keys(jsonData[0]);
            const getCol = (keywords) => headers.find(h => keywords.some(k => String(h).includes(k)));

            const colSerial = getCol(["일련번호"]); const colDongNo = getCol(["동번호"]); const colDongNm = getCol(["동명", "건물명"]);
            const colYear = getCol(["준공"]); const colFloor = getCol(["층", "층수"]); const colStrct = getCol(["건물구조", "구조코드", "구조"]);
            const colArea = getCol(["면적"]); const colPurps = getCol(["용도", "특기사항"]);

            if(!colArea) return alert("면적 데이터를 찾을 수 없습니다. 화협 양식을 확인해주세요.");

            const records = [];
            let lastDongNo = "-"; let lastDongNm = "본동";

            jsonData.forEach((row, idx) => {
                let serial = String(row[colSerial] || "").trim();
                let dNo = String(row[colDongNo] || "").trim();
                let dNm = String(row[colDongNm] || "").trim();
                
                let isSubtotal = dNm.includes("합계") || dNm.includes("소계") || serial.includes("합계");

                if(dNo && dNo !== "-" && dNo !== "undefined") lastDongNo = dNo;
                if(dNm && dNm !== "-" && dNm !== "undefined" && !isSubtotal) lastDongNm = dNm;

                if((!serial || serial === "-" || serial === "undefined") && !isSubtotal) return;

                let strctCode = String(row[colStrct] || "").trim(); let purps = String(row[colPurps] || "-").trim();
                let floorStr = String(row[colFloor] || "").trim();
                let area = parseFloat(String(row[colArea] || "0").replace(/,/g, ''));
                if(isNaN(area)) area = 0.0;

                let buildYear = new Date().getFullYear();
                let yearStr = String(row[colYear] || "").replace(/[^0-9]/g, '');
                if(yearStr.length >= 4) buildYear = parseInt(yearStr.substring(0, 4));

                if(area > 0) {
                    records.push({
                        "일련번호": serial, "동번호": lastDongNo, "층수": floorStr,
                        "동명칭": isSubtotal ? dNm : lastDongNm, "용도": purps, "연면적": area,
                        "구조명": strctCode, "구조코드": strctCode, "준공연도": buildYear,
                        "isSubtotal": isSubtotal, 
                        "단가": 0.0, "노무비": 0.0, "물가지수": 1.0, "감가율": 1.78, "재조달_건축": 0, "잔가율": 100.0, "현재_건축": 0
                    });
                }
            });

            if(records.length === 0) return alert("유효한 화협 데이터(일련번호 및 면적 존재)를 찾을 수 없습니다.");

            // ★ 해당 사업장 바구니에 안전하게 보관!
            if (typeof window.tempKfpaDataStore === 'undefined') window.tempKfpaDataStore = {};
            window.tempKfpaDataStore[siteName] = records;
            renderKfpaPreview(siteName); 

            alert(`✅ [${siteName}] 화협 엑셀 로드 완료!\n상단의 다른 탭이 있다면 이동해서 마저 업로드하시거나,\n모두 올리셨다면 우측 [전체 확정]을 눌러주세요.`);

        } catch (err) { alert("파일 파싱 중 오류 발생: " + err); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
};

// 4. ★ 전체 확정 후 Slide 7로 이동 (단가/노무비/구조명 자동 매핑 포함)
window.confirmAllKfpaData = function() {
    if(!window.tempKfpaDataStore) return alert("반영할 데이터가 전혀 없습니다. 엑셀 파일을 먼저 업로드해주세요.");
    
    const sites = Object.keys(window.tempKfpaDataStore);
    if(sites.length === 0) return alert("반영할 데이터가 전혀 없습니다. 엑셀 파일을 먼저 업로드해주세요.");

    if(!window.kbState.evalData.kfpa) window.kbState.evalData.kfpa = {};
    
    sites.forEach(siteName => {
        const records = window.tempKfpaDataStore[siteName].filter(r => !r.isSubtotal); 
        const titleRecords = window.kbState.evalData.title[siteName] || [];
        const siteGroups = {};
        
        records.forEach(r => {
            // ★ 확정 시점에 단가표가 있다면 엑셀의 구조코드를 바탕으로 자동 매핑 실행!
            if (r.구조코드 && r.구조코드 !== "-" && window.kbState.costData && window.kbState.costData.length > 0) {
                const cleanCode = String(r.구조코드).replace(/-/g, "");
                const matched = window.kbState.costData.find(row => {
                    const allText = Object.values(row).map(v => String(v || "")).join(" ").toLowerCase();
                    return allText.includes(String(r.구조코드).toLowerCase()) || (cleanCode && allText.replace(/-/g, "").includes(cleanCode));
                });
                if (matched) {
                    r.구조명 = (matched['구조'] && matched['구조'] !== "-") ? matched['구조'] : matched['중분류'];
                    r.단가 = matched['단가'];
                    r.노무비 = matched['노무비'];
                    if (window.applyAutoPriceIndex) window.applyAutoPriceIndex(r);
                }
            }

            const d = r.동명칭;
            let inheritedRatio = 20.0;
            const tGroup = titleRecords.find(g => (g.동명칭 || "") === d);
            if (tGroup && tGroup.부속비율) inheritedRatio = tGroup.부속비율;

            if(!siteGroups[d]) {
                siteGroups[d] = { "동명칭": d, "부속비율": inheritedRatio, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0, "records": [] };
            }
            siteGroups[d].records.push(r);
        });

        window.kbState.evalData.kfpa[siteName] = Object.values(siteGroups);
        recalculateValuation('kfpa', siteName); 
    });

    window.kbState.activeSite.kfpa = sites[0];
    
    // ★ 일괄 확정이 무사히 끝났으므로 임시 바구니를 비워줌
    window.tempKfpaDataStore = {};
    
    goToSlide('slide7');
    renderEvalTabsAndTable('kfpa', 'tbodyKfpaEval', 'tabsKfpaEval');
    
    alert(`🎉 총 ${sites.length}개 사업장의 화협자료가 평가 테이블로 일괄 전송되었습니다!\n(엑셀 구조코드를 바탕으로 단가, 노무비, 물가지수 자동 매핑 완료)`);
};

// ============================================================================
// [12] ★ 통합 총괄표(Summary Table) 렌더링 로직 (세부 항목 전체 펼침 모드 & 배경색 고정)
// ============================================================================

setTimeout(() => {
    document.querySelectorAll('.menu-l1, .menu-l2, .menu-l3').forEach(menu => {
        if (menu.innerText.includes('3. 총괄표 작성')) {
            menu.onclick = function() { window.initSummaryScreen(); };
        }
    });
}, 500);

window.initSummaryScreen = function() {
    goToSlide('slide8');
    const firstTab = document.querySelector('#summaryTabs .summary-tab');
    if (firstTab) renderSummary('title', firstTab); 
};

window.renderSummary = function(mode, tabElement) {
    if (tabElement) {
        document.querySelectorAll('#summaryTabs .summary-tab').forEach(t => {
            t.style.background = '#f8f9fa'; t.style.color = '#666'; 
            t.style.borderColor = '#ddd'; t.style.fontWeight = 'normal';
        });
        tabElement.style.background = '#fff'; tabElement.style.color = '#1C5691'; 
        tabElement.style.borderColor = '#1C5691'; tabElement.style.fontWeight = 'bold';
    }

    const tbody = document.getElementById('tbodySummary');
    tbody.innerHTML = '';
    
    const dataObj = window.kbState.evalData[mode];
    
    if (!dataObj || Object.keys(dataObj).length === 0) {
        let guideMsg = "";
        if (mode === 'title') guideMsg = "▶ [2.1.2 표제부 평가] 메뉴로 이동하여 <b>'표제부 데이터 연동하기'</b> 버튼을 눌러주세요.";
        else if (mode === 'floor') guideMsg = "▶ [2.1.3 층별 평가] 메뉴로 이동하여 <b>'층별 데이터 연동하기'</b> 버튼을 눌러주세요.";
        else if (mode === 'kfpa') guideMsg = "▶ [2.2.1 화협 불러오기] 메뉴에서 엑셀을 업로드하고 확정을 진행해 주세요.";

        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 60px; color:#999; font-size:15px; line-height: 1.8;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:35px; margin-bottom:15px; display:block; color:#f39c12;"></i>
            ${mode === 'title' ? '표제부' : mode === 'floor' ? '층별' : '화협자료'} 평가 데이터가 아직 없습니다.<br>
            <span style="color:#d32f2f; font-weight:bold;">${guideMsg}</span>
        </td></tr>`;
        return;
    }

    let grandTotalArea = 0, grandTotalReco = 0, grandTotalCur = 0;

    for (const [siteName, groups] of Object.entries(dataObj)) {
        let siteTotalArea = 0, siteTotalReco = 0, siteTotalCur = 0;
        const groupArray = Array.isArray(groups) ? groups : Object.values(groups);

        if (groupArray.length === 0) continue;

        let siteRowSpan = 0;
        groupArray.forEach(g => {
            const rCount = (g.records && g.records.length > 0) ? g.records.length : 1;
            siteRowSpan += (rCount + 2); // (실제 층/항목 수) + (부속설비 1줄) + (소계 1줄)
        });

        groupArray.forEach((group, gIdx) => {
            const records = group.records || [];
            const rCount = records.length > 0 ? records.length : 1;
            const dongRowSpan = rCount + 2;

            let groupArea = 0;
            records.forEach(r => groupArea += (parseFloat(r.연면적) || 0));

            const recoTotal = parseFloat(group.재조달_합계 || 0);
            const curTotal = parseFloat(group.현재_합계 || 0);
            const recoSub = parseFloat(group.재조달_부속 || 0);
            const curSub = parseFloat(group.현재_부속 || 0);

            siteTotalArea += groupArea;
            siteTotalReco += recoTotal;
            siteTotalCur += curTotal;

            const dongName = group.동명칭 || '-';
            const accRate = parseFloat(group.부속비율 || 20.0).toFixed(1);

            const siteCellHtml = (gIdx === 0) 
                ? `<td rowspan="${siteRowSpan}" style="vertical-align:middle; font-weight:bold; background:#fff; border-right:1px solid #ddd;">${siteName}</td>` 
                : '';
                
            const dongCellHtml = `<td rowspan="${dongRowSpan}" style="vertical-align:middle; font-weight:bold; color:#1C5691; background:#fff; border-right:1px solid #ddd;">${dongName}</td>`;

            // 1. 건축공사비(세부 층/항목) 렌더링
            if (records.length === 0) {
                tbody.innerHTML += `
                    <tr style="background:#fff;">
                        ${siteCellHtml} ${dongCellHtml}
                        <td style="text-align:left;">세부항목 없음</td>
                        <td style="text-align:right;">0</td><td style="text-align:right;">0</td><td style="text-align:right;">0</td>
                    </tr>
                `;
            } else {
                records.forEach((r, rIdx) => {
                    const isFirstRecord = (rIdx === 0);
                    const gubunText = r.용도 || '건축공사비';

                    tbody.innerHTML += `
                        <tr style="background:#fff;">
                            ${isFirstRecord ? siteCellHtml : ''}
                            ${isFirstRecord ? dongCellHtml : ''}
                            <td style="text-align:left; color:#444;">${gubunText}</td>
                            <td style="text-align:right;">${formatArea(r.연면적)}</td>
                            <td style="text-align:right;">${formatPrice(r.재조달_건축)}</td>
                            <td style="text-align:right;">${formatPrice(r.현재_건축)}</td>
                        </tr>
                    `;
                });
            }

            // 2. [동별] 부속설비 행
            tbody.innerHTML += `
                <tr style="background:#f8f9fa;">
                    <td style="text-align:left; color:#666;">└ 부속설비 (${accRate}%)</td>
                    <td style="text-align:right; color:#999;">-</td>
                    <td style="text-align:right;">${formatPrice(recoSub)}</td>
                    <td style="text-align:right;">${formatPrice(curSub)}</td>
                </tr>
            `;
            
            // 3. [동별] 소계 행 (색상 고정)
            tbody.innerHTML += `
                <tr style="background:#e2e8f0; font-weight:bold;">
                    <td style="text-align:center; color:#111;">[${dongName}] 소계</td>
                    <td style="text-align:right;">${formatArea(groupArea)}</td>
                    <td style="text-align:right; color:#1C5691;">${formatPrice(recoTotal)}</td>
                    <td style="text-align:right; color:#1C5691;">${formatPrice(curTotal)}</td>
                </tr>
            `;
        });

        // 4. [사업장별] 합계 행
        grandTotalArea += siteTotalArea;
        grandTotalReco += siteTotalReco;
        grandTotalCur += siteTotalCur;

        tbody.innerHTML += `
            <tr style="background:#cbd5e1; font-weight:bold;">
                <td colspan="3" style="text-align:center;">[${siteName}] 평가액 합계</td>
                <td style="text-align:right; color:#d32f2f;">${formatArea(siteTotalArea)}</td>
                <td style="text-align:right; color:#d32f2f;">${formatPrice(siteTotalReco)}</td>
                <td style="text-align:right; color:#d32f2f;">${formatPrice(siteTotalCur)}</td>
            </tr>
        `;
    }

    // 5. [전체] 총계 행 (맨 아래, 글자색 강제 고정 !important 적용)
    if (Object.keys(dataObj).length > 1) { 
        tbody.innerHTML += `
            <tr style="background:#1C5691; font-weight:bold; font-size:15px;">
                <td colspan="3" style="text-align:center; color:#ffffff !important;">전체 사업장 총 평가액</td>
                <td style="text-align:right; color:#FFD700 !important;">${formatArea(grandTotalArea)}</td>
                <td style="text-align:right; color:#FFD700 !important;">${formatPrice(grandTotalReco)}</td>
                <td style="text-align:right; color:#FFD700 !important;">${formatPrice(grandTotalCur)}</td>
            </tr>
        `;
    }
};

// ★ 총괄표 엑셀 다운로드 기능 완벽 구현
window.exportSummaryExcel = function() {
    const table = document.getElementById('summaryTable');
    // 표에 헤더(1줄)와 빈 안내문구(1줄)밖에 없으면 데이터가 없는 것
    if(!table || table.rows.length <= 2) {
        return alert("다운로드할 총괄표 데이터가 없습니다. 먼저 좌측 메뉴에서 평가를 완료해 주세요.");
    }

    // 현재 열려있는 탭 이름 찾기 (예: '표제부 기반 총괄표')
    let activeTabName = "총괄표";
    const tabs = document.querySelectorAll('#summaryTabs .summary-tab');
    tabs.forEach(tab => {
        if (tab.style.fontWeight === 'bold') activeTabName = tab.innerText;
    });

    try {
        // HTML 테이블을 통째로 엑셀 워크시트로 변환
        const wb = XLSX.utils.table_to_book(table, {sheet: "가액평가_총괄표"});
        
        // 파일명에 오늘 날짜 추가
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, "");
        const fileName = `KB손해보험_${activeTabName}_${dateStr}.xlsx`;
        
        // 다운로드 실행
        XLSX.writeFile(wb, fileName);
    } catch (error) {
        alert("엑셀 다운로드 중 오류가 발생했습니다.\n" + error.message);
    }
};};