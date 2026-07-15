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

    const selectedData = dataObj[currentSite];
    renderEvalTableGrouped(tbody, selectedData, mode, currentSite);
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

            // ★ 항시 노출되는 직접입력창 + 돋보기 하이브리드 UI 생성
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

// ============================================================================
// ★ [신규 추가] 층별 데이터 연동 및 표제부 데이터(구조, 감가, 부속비율) 자동 상속
// ============================================================================
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
        
        // ★ 1. 표제부(Title) 평가 데이터 가져오기 (매칭용)
        const titleRecords = window.kbState.evalData.title[siteName] || [];
        
        const siteGroups = {}; // 동별로 그룹핑
        
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
            if (rowAprDate.length >= 4 && !isNaN(rowAprDate.substring(0, 4))) {
                buildYear = parseInt(rowAprDate.substring(0, 4));
            }
            
            // 기본 레코드 뼈대 생성
            const record = {
                "일련번호": String(idx + 1), "동명칭": dongNm, "용도": purps, "연면적": area, "구조명": strct,
                "준공연도": buildYear, "구조코드": "-", "단가": 0.0, "노무비": 0.0, "물가지수": 1.0,
                "감가율": 1.78, "재조달_건축": 0, "잔가율": 100.0, "현재_건축": 0
            };
            
            // ★ 2. 표제부 상속 로직 (핵심 포인트)
            let inheritedRatio = 20.0; // 기본 부속비율
            
            // 현재 층의 '동명칭'과 일치하는 표제부 건물을 찾음
            const tGroup = titleRecords.find(g => g.동명칭 === dongNm);
            if (tGroup) {
                const tReq = tGroup.records[0]; // 표제부의 실제 입력 데이터
                record["구조코드"] = tReq["구조코드"];
                record["단가"] = tReq["단가"];
                record["노무비"] = tReq["노무비"];
                record["물가지수"] = tReq["물가지수"];
                record["감가율"] = tReq["감가율"];
                if (tGroup["부속비율"]) inheritedRatio = tGroup["부속비율"];
            }
            
            // 그룹(동) 단위로 층별 데이터 묶어주기
            if (!siteGroups[dongNm]) {
                siteGroups[dongNm] = {
                    "동명칭": dongNm, "부속비율": inheritedRatio, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0,
                    "records": []
                };
            }
            siteGroups[dongNm].records.push(record);
        });
        
        if (Object.keys(siteGroups).length > 0) {
            newFloorData[siteName] = Object.values(siteGroups);
        }
    });
    
    window.kbState.evalData.floor = newFloorData;
    window.kbState.activeSite.floor = Object.keys(newFloorData)[0] || null;
    
    // 복사된 데이터로 가액 자동 재계산 및 화면 렌더링
    Object.keys(newFloorData).forEach(siteName => recalculateValuation('floor', siteName));
    renderEvalTabsAndTable('floor', 'tbodyFloorEval', 'tabsFloorEval');
    
    alert("✅ 층별 데이터 연동 완료!\n\n(표제부에서 작업하신 구조코드, 단가, 노무비, 감가율, 부속비율이 동명칭 기준으로 자동 상속되었습니다.)");
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
        
        // ★ [핵심 추가] 노무비 직접 편집 시 물가지수도 자동 재계산
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
// [7] ★ 신축단가 엑셀 로드 및 구조코드 하이브리드 연동 (엑셀 밀림 및 병합셀 완벽 방어)
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
            
            // 1. 단가, 노무비 최신 연도 인덱스 동적 탐색 (병합 셀 완벽 방어)
            window.kbState.costBaseYear = new Date().getFullYear();
            let idxDanga = 26, idxNomu = 43; // 기본값 (통상 26열, 43열)
            let yearCols = [];
            
            // 상위 15개 행을 탐색하여 연도(2025 등)가 적힌 열을 모두 수집
            for (let r = 0; r < Math.min(jsonData.length, 15); r++) {
                const row = jsonData[r];
                if (!row) continue;
                for (let c = 5; c < row.length; c++) {
                    const cellStr = String(row[c]).replace(/\s/g, "");
                    const match = cellStr.match(/^(20\d{2})(년)?$/); // 2025 또는 2025년 매칭
                    if (match) {
                        yearCols.push({ col: c, year: parseInt(match[1], 10) });
                    }
                }
            }
            
            if (yearCols.length > 0) {
                const maxYear = Math.max(...yearCols.map(y => y.year));
                window.kbState.costBaseYear = maxYear; 
                
                // 최신 연도에 해당하는 열 번호 추출 (중복 제거)
                const maxCols = yearCols.filter(y => y.year === maxYear).map(y => y.col);
                const uniqueCols = [...new Set(maxCols)].sort((a, b) => a - b);
                
                if (uniqueCols.length >= 2) {
                    idxDanga = uniqueCols[0];
                    idxNomu = uniqueCols[1];
                } else if (uniqueCols.length === 1) {
                    idxDanga = uniqueCols[0];
                    idxNomu = uniqueCols[0] + 1; // 병합셀 대비 우측 칸 강제 지정
                }
            }

            window.kbState.costData = [];
            
// 2. 데이터 파싱 (불필요한 헤더/빈칸 행 무시하고 순수 데이터만 쏙쏙 추출)
            for(let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                if(!row || row.length < 6) continue;
                
                // ★ [수정됨] A열(0)부터 F열(5)까지로 인덱스를 한 칸씩 당겨서 맵핑 (밀림 현상 해결)
                const colDae = String(row[0] || "").trim();
                const colJung = String(row[1] || "").trim();
                const colSo = String(row[2] || "").trim();
                const colYong = String(row[3] || "").trim();
                const colGoo = String(row[4] || "").trim();
                const colGeup = String(row[5] || "").trim();
                
                // 데이터 유효성 검사 (코드나 용도, 구조 중 하나라도 있어야 함)
                if (colDae.includes("용도별") || colDae.includes("상승지수") || colDae.includes("분류번호")) continue;
                if (!colDae && !colJung && !colYong && !colGoo) continue;
                
                const danga = parseFloat(String(row[idxDanga]).replace(/,/g, '')) || 0;
                const nomu = parseFloat(String(row[idxNomu]).replace(/,/g, '')) || 0;
                
                // 단가, 노무비가 둘 다 0이고 구조명도 없으면 의미 없는 행이므로 스킵
                if (danga === 0 && nomu === 0 && colGoo === "" && colGoo === "-") continue;
                
                window.kbState.costData.push({
                    '대분류': colDae || "-", 
                    '중분류': colJung || colDae || "-", 
                    '소분류': colSo || "-", 
                    '용도': colYong || "-", 
                    '구조': colGoo || "-", 
                    '급수': colGeup || "-",
                    '단가': danga,
                    '노무비': nomu
                });
            }
            alert(`✅ 신축단가표 분석 완료! (총 ${window.kbState.costData.length}건 데이터 탑재)`);
            
            if(window.retroactiveApplyPriceIndex) window.retroactiveApplyPriceIndex();
            
        } catch(err) {
            alert("엑셀 파싱 중 오류가 발생했습니다.\n(에러: " + err + ")");
        }
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
                const cleanAllText = allText.replace(/-/g, "");
                return allText.includes(String(code).toLowerCase()) || (cleanCode && cleanAllText.includes(cleanCode));
            });
            if(matched) { 
                record['단가'] = matched['단가']; 
                record['노무비'] = matched['노무비']; 
                if(window.applyAutoPriceIndex) window.applyAutoPriceIndex(record);
            }
        }
    };
    if (gIdx === null || rIdx === null) { 
        if(!siteData) return;
        if (Array.isArray(siteData)) siteData.forEach(group => group.records.forEach(updateRecord));
        else Object.values(siteData).forEach(group => group.records.forEach(updateRecord));
    } else { 
        updateRecord(Array.isArray(siteData) ? siteData[gIdx].records[rIdx] : siteData[Object.keys(siteData)[gIdx]].records[rIdx]);
    }
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

window.closeCodeModal = function() {
    document.getElementById('codeSearchModal').style.display = 'none'; window.currentCodeTarget = null;
};

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
            const cleanAllText = allText.replace(/-/g, "");
            
            if (targetVal.includes(kw)) return true;
            if (allText.includes(kw)) return true;
            if (cleanKw && cleanAllText.includes(cleanKw)) return true;
            
            return false;
        });
    }
    
    const max = Math.min(filtered.length, 100); 
    for(let i=0; i<max; i++) {
        const row = filtered[i]; const tr = document.createElement('tr');
        tr.style.cursor = 'pointer'; tr.style.background = i % 2 === 0 ? '#fff' : '#f9f9fa';
        
        const dispDae = row['대분류'] || '-';
        const dispJung = row['중분류'] || dispDae;
        const dispSo = row['소분류'] || '-';
        const dispYong = row['용도'] || dispDae;
        const dispGoo = row['구조'] || '-';
        const dispGeup = row['급수'] || '-';

        tr.innerHTML = `<td>${dispDae}</td><td style="font-weight:bold; color:#1C5691;">${dispJung}</td><td>${dispSo}</td><td>${dispYong}</td><td>${dispGoo}</td><td>${dispGeup}</td><td style="text-align:right;">${formatPrice(row['단가'])}</td><td style="text-align:right;">${formatPrice(row['노무비'])}</td>`;
        
        const applyVal = (dispJung !== '-' && dispJung !== 'undefined') ? dispJung : dispDae;
        tr.onclick = () => { Array.from(tbody.children).forEach(c => c.style.background = c.dataset.origBg); tr.dataset.origBg = tr.style.background; tr.style.background = '#d6e4f0'; tbody.dataset.selectedCode = applyVal; };
        tr.ondblclick = () => { tbody.dataset.selectedCode = applyVal; applySelectedCode(); };
        tbody.appendChild(tr);
    }
};

window.applySelectedCode = function() {
    const code = document.getElementById('codeSearchTbody').dataset.selectedCode;
    if(!code || code === 'undefined') return alert("반영할 코드를 목록에서 선택해주세요.");
    if(!window.currentCodeTarget) return;
    const {mode, siteName, gIdx, rIdx} = window.currentCodeTarget;
    applyCodeToRecord(code, mode, siteName, gIdx, rIdx); 
    closeCodeModal();
};

// ============================================================================
// [7-5] ★ 물가지수 엑셀 로드 및 연동 (파이썬 완벽 호환)
// ============================================================================
window.loadIndexExcel = function(event) {
    const file = event.target.files[0];
    if(!file) return;
    
    const pathInput = document.getElementById('priceIndexPath');
    if(pathInput) pathInput.value = file.name;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0]; 
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {defval: "-"});
            
            window.kbState.indexData = jsonData;
            alert(`✅ 건축물가지수 엑셀 분석 완료!`);
            
            if(window.retroactiveApplyPriceIndex) window.retroactiveApplyPriceIndex();
        } catch(err) {
            alert("물가지수 파싱 중 오류가 발생했습니다.\n(에러: " + err + ")");
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
};

// 동적으로 엘리먼트를 찾아서 이벤트 리스너 부착
setTimeout(() => {
    const priceIndexFile = document.getElementById('priceIndexFile');
    if(priceIndexFile) priceIndexFile.addEventListener('change', window.loadIndexExcel);
}, 1000);

window.applyAutoPriceIndex = function(record) {
    if(!window.kbState.indexData || window.kbState.indexData.length === 0) return;
    const nomuVal = parseFloat(record['노무비']) || 0;
    if (nomuVal <= 0) return;

    const targetYear = String(window.kbState.costBaseYear || new Date().getFullYear());

    let yearCol = null;
    let nomuCol = null;

    const sampleRow = window.kbState.indexData[0] || {};
    for(let key in sampleRow) {
        const cleanKey = String(key).replace(/\s/g, '');
        if (cleanKey.includes(targetYear)) yearCol = key;
        if (cleanKey.includes("인건비") || cleanKey.includes("노무비")) nomuCol = key;
    }

    if (!yearCol || !nomuCol) return;

    const matched = window.kbState.indexData.find(row => {
        const rowNomuStr = String(row[nomuCol] || "").replace(/,/g, '').split('.')[0];
        const rowNomu = parseFloat(rowNomuStr);
        return rowNomu === Math.floor(nomuVal);
    });

    if (matched) {
        const indexVal = parseFloat(String(matched[yearCol]).replace(/,/g, ''));
        if (!isNaN(indexVal)) {
            record['물가지수'] = indexVal;
        }
    }
};

window.retroactiveApplyPriceIndex = function() {
    let changed = false;
    ['title', 'floor', 'kfpa'].forEach(mode => {
        if (!window.kbState.evalData[mode]) return;
        Object.keys(window.kbState.evalData[mode]).forEach(siteName => {
            let groups = window.kbState.evalData[mode][siteName];
            if (!Array.isArray(groups)) groups = Object.values(groups);
            groups.forEach(group => {
                const records = group.records || [group];
                records.forEach(r => {
                    if (r["단가"] > 0 || r["노무비"] > 0) {
                        window.applyAutoPriceIndex(r);
                        changed = true;
                    }
                });
            });
        });
    });
    
    if (changed) {
        ['title', 'floor', 'kfpa'].forEach(mode => {
            Object.keys(window.kbState.evalData[mode] || {}).forEach(siteName => {
                recalculateValuation(mode, siteName);
            });
        });
        runGroupedRenderTest();
    }
};

// ============================================================================
// [8] ★ 화협 표준 감가율 연동 (모달창 데이터 주입)
// ============================================================================
window.applyDeprToRecord = function(rate, mode, siteName, gIdx, rIdx, skipRender=false) {
    const siteData = window.kbState.evalData[mode][siteName];
    const rateVal = parseFloat(rate) || 1.78;
    const updateRecord = (record) => { record['감가율'] = rateVal; };
    if (gIdx === null || rIdx === null) {
        if(!siteData) return;
        if (Array.isArray(siteData)) siteData.forEach(group => group.records.forEach(updateRecord));
        else Object.values(siteData).forEach(group => group.records.forEach(updateRecord));
    } else {
        updateRecord(Array.isArray(siteData) ? siteData[gIdx].records[rIdx] : siteData[Object.keys(siteData)[gIdx]].records[rIdx]);
    }
    recalculateValuation(mode, siteName); 
    if(!skipRender) renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
};

window.currentDeprTarget = null;
window.openDeprModal = function(mode, siteName, gIdx, rIdx) {
    if(!siteName) return alert("선택된 사업장 탭이 없습니다.");
    window.currentDeprTarget = {mode, siteName, gIdx, rIdx};
    document.getElementById('deprSearchModal').style.display = 'flex';
    
    const tbody = document.getElementById('deprSearchTbody');
    tbody.innerHTML = '';
    
    window.DEPRECIATION_DB.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer'; tr.style.background = i % 2 === 0 ? '#fff' : '#f9f9fa';
        tr.innerHTML = `<td style="text-align:left; padding-left:10px;">${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td style="font-weight:bold; color:#d32f2f;">${row[3]}</td>`;
        tr.onclick = () => { Array.from(tbody.children).forEach(c => c.style.background = c.dataset.origBg); tr.dataset.origBg = tr.style.background; tr.style.background = '#d6e4f0'; tbody.dataset.selectedRate = row[3]; };
        tr.ondblclick = () => { tbody.dataset.selectedRate = row[3]; applySelectedDepr(); };
        tbody.appendChild(tr);
    });
};

window.closeDeprModal = function() {
    document.getElementById('deprSearchModal').style.display = 'none'; window.currentDeprTarget = null;
};

window.applySelectedDepr = function() {
    const rate = document.getElementById('deprSearchTbody').dataset.selectedRate;
    if(!rate) return alert("반영할 감가율을 목록에서 선택해주세요.");
    if(!window.currentDeprTarget) return;
    const {mode, siteName, gIdx, rIdx} = window.currentDeprTarget;
    applyDeprToRecord(rate, mode, siteName, gIdx, rIdx); 
    closeDeprModal();
};

// ============================================================================
// [9] 부속비율 일괄적용 공통 함수
// ============================================================================
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
// [10] ★ 프로젝트 임시 저장 및 불러오기 (화면 완벽 복구 추가 및 하위호환성 유지)
// ============================================================================
window.quickSaveProject = function() {
    const hasEvalData = Object.keys(window.kbState.evalData.title).length > 0 || 
                        Object.keys(window.kbState.evalData.floor).length > 0 || 
                        Object.keys(window.kbState.evalData.kfpa).length > 0;
                        
    if (Object.keys(window.kbState.fetchedData).length === 0 && !hasEvalData) {
        alert("저장할 데이터가 존재하지 않습니다. 대장 조회나 평가를 먼저 진행해 주세요.");
        return;
    }

    const contractorInputs = document.querySelectorAll('.contractor-sync');
    const contractorName = contractorInputs.length > 0 ? contractorInputs[0].value : "";
    const evalYearInput = document.getElementById('evalYear');
    const evalYear = evalYearInput ? evalYearInput.value : new Date().getFullYear();

    // ★ 현재 화면에 있는 소재지(주소) 목록 데이터 긁어오기
    const locations = [];
    document.querySelectorAll('#locationListBox .list-row').forEach(row => {
        locations.push({
            name: row.querySelector('.input-short') ? row.querySelector('.input-short').value : '',
            address: row.querySelector('.addr-input') ? row.querySelector('.addr-input').value : '',
            checkedLedger: row.querySelector('.check-ledger') ? row.querySelector('.check-ledger').checked : true,
            checkedKfpa: row.querySelector('.check-kfpa') ? row.querySelector('.check-kfpa').checked : true
        });
    });

    const projectData = {
        version: "1.1", // 버전 업그레이드
        contractor: contractorName,
        evalYear: evalYear,
        locations: locations, // 긁어온 주소 목록을 저장 데이터에 포함!
        kbState: window.kbState 
    };

    const blob = new Blob([JSON.stringify(projectData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, "");
    a.download = `${contractorName || '가액평가'}_임시저장_${dateStr}.kbproj`;
    a.click();
    URL.revokeObjectURL(url);
};

window.quickLoadProject = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const projectData = JSON.parse(e.target.result);
            
            // 1. 상태 완전 복구
            if (projectData.kbState) {
                window.kbState = projectData.kbState;
            }

            // 2. 일반정보 UI 복원
            if (projectData.contractor) {
                document.querySelectorAll('.contractor-sync').forEach(el => el.value = projectData.contractor);
            }
            if (projectData.evalYear) {
                const evalYearInput = document.getElementById('evalYear');
                if (evalYearInput) evalYearInput.value = projectData.evalYear;
            }

            // 3. 저장된 주소 데이터를 바탕으로 HTML 소재지 목록 다시 그리기
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

            // 4. 저장된 평가 데이터를 바탕으로 하단 테이블 전체 다시 그리기
            runGroupedRenderTest();

// =========================================================
            // 5. ★ 건축물대장 표(Table) 화면 복구 로직 (한글 번역 및 정렬 적용)
            // =========================================================
            if (window.kbState.fetchedData && Object.keys(window.kbState.fetchedData).length > 0) {
                const dataContainer = document.getElementById('fetchedDataContainer');
                const tabsContainer = document.getElementById('slide3Tabs');
                const emptyMsg = document.getElementById('emptyStateMsg');
                
                if (emptyMsg) emptyMsg.style.display = 'none';
                if (dataContainer && tabsContainer) {
                    dataContainer.style.display = 'block';
                    dataContainer.innerHTML = ''; 
                    tabsContainer.innerHTML = '';

                    // ★ API 영문 키값을 한글로 예쁘게 바꿔주는 번역 사전
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
                        // 1) 탭 생성
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

                        // 2) 데이터 테이블 생성
                        for (const [title, rows] of Object.entries(siteData)) {
                            if (title === 'address' || title === 'errors' || !Array.isArray(rows) || rows.length === 0) continue;
                            
                            const sectionTitle = document.createElement('h3');
                            // 영문 타이틀도 한글로 변환
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
                                const korName = korMap[col] || col; // 사전에 없으면 원래 키값 사용
                                th.innerHTML = `${korName} <span style="font-size:10px; color:#ccc;">▲▼</span>`;
                                th.style.cursor = 'pointer';
                                th.title = "클릭 시 정렬됩니다.";
                                
                                // ★ 오름차순/내림차순 정렬 로직
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
                                    rowArray.forEach(tr => tbody.appendChild(tr)); // 화면 재배치
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

            alert("✅ 임시 저장 데이터 로드 완료!\n(건축물대장 내용도 정상적으로 복구되었습니다.)");
        } catch (err) {
            alert("파일 형식이 잘못되었거나 읽을 수 없습니다.\n(" + err + ")");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
};

// ============================================================================
// ★ [신규 추가] 화협(KFPA) 엑셀/CSV 데이터 파싱 및 평가 데이터로 변환
// ============================================================================
window.loadKfpaExcel = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    // 현재 작업 중인 사업장 이름 입력받기 (여러 개의 화협 자료를 올릴 수 있도록)
    let siteName = prompt("이 화협자료를 적용할 사업장(소재지) 이름을 입력하세요.\n(예: 안산공장, 시흥공장 등)", "본점");
    if(!siteName) { event.target.value = ''; return; }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // 헤더가 있는 JSON 형태로 변환
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {defval: "-"});
            if(jsonData.length === 0) return alert("엑셀 파일에 데이터가 없습니다.");

            const headers = Object.keys(jsonData[0]);
            
            // 열(Column) 이름이 약간 달라도 찾아내는 헬퍼 함수
            const getCol = (keywords) => headers.find(h => keywords.some(k => String(h).includes(k)));

            // 엑셀에서 추출할 핵심 컬럼 탐색
            const colDong = getCol(["건물명", "동명", "건물번호", "동"]);
            const colStrct = getCol(["구조(본)", "구조"]);
            const colRoof = getCol(["지붕"]);
            const colPurps = getCol(["용도"]);
            const colYear = getCol(["신축년도", "건축년도", "준공"]);
            const colArea = getCol(["면적", "연면적"]);

            if(!colArea) return alert("면적 데이터를 찾을 수 없습니다. 화협 양식을 확인해주세요.");

            const records = [];
            
            // 데이터 행(Row) 순회하며 정규화 진행
            jsonData.forEach((row, idx) => {
                let dongNm = String(row[colDong] || "").trim();
                if(!dongNm || dongNm === "-" || dongNm === "undefined") dongNm = "본동";

                let strct = String(row[colStrct] || "").trim();
                let roof = String(row[colRoof] || "").trim();
                
                // 파이썬 로직 차용: 구조와 지붕 명칭 결합
                let fullStrct = (strct !== "-" ? strct : "") + (roof !== "-" && roof ? " / " + roof : "");
                if(!fullStrct || fullStrct === " / ") fullStrct = "확인필요";

                let purps = String(row[colPurps] || "-").trim();

                let areaStr = String(row[colArea] || "0").replace(/,/g, '');
                let area = parseFloat(areaStr);
                if(isNaN(area)) area = 0.0;

                let buildYear = new Date().getFullYear();
                let yearStr = String(row[colYear] || "").replace(/[^0-9]/g, '');
                if(yearStr.length >= 4) buildYear = parseInt(yearStr.substring(0, 4));

                // 면적이 존재하는 유효한 데이터만 추가
                if(area > 0) {
                    records.push({
                        "일련번호": String(idx + 1), "동명칭": dongNm, "용도": purps,
                        "연면적": area, "구조명": fullStrct, "준공연도": buildYear,
                        "구조코드": "-", "단가": 0.0, "노무비": 0.0, "물가지수": 1.0,
                        "감가율": 1.78, "재조달_건축": 0, "잔가율": 100.0, "현재_건축": 0
                    });
                }
            });

            if(records.length === 0) return alert("유효한 화협 데이터(면적 > 0)를 찾을 수 없습니다.");

            // 동명칭(dongNm) 기준으로 데이터를 그룹핑 (표제부/층별과 동일한 형태)
            const siteGroups = {};
            records.forEach(r => {
                const d = r.동명칭;
                if(!siteGroups[d]) {
                    siteGroups[d] = {
                        "동명칭": d, "부속비율": 20.0, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0,
                        "records": []
                    };
                }
                siteGroups[d].records.push(r);
            });

            // 상태 저장소에 밀어넣기
            if(!window.kbState.evalData.kfpa) window.kbState.evalData.kfpa = {};
            window.kbState.evalData.kfpa[siteName] = Object.values(siteGroups);
            window.kbState.activeSite.kfpa = siteName;

            // 가액 재계산 및 렌더링
            recalculateValuation('kfpa', siteName);
            
            alert(`✅ 화협자료 [${siteName}] 데이터 변환 완료! (총 ${records.length}건)\n이제 구조코드와 감가율을 매핑해 주세요.`);
            
            // 변환 완료 후 자동으로 2.2.2 평가 탭으로 화면 이동
            if(typeof goToSlide === 'function') goToSlide('slide7');
            renderEvalTabsAndTable('kfpa', 'tbodyKfpaEval', 'tabsKfpaEval');

        } catch (err) {
            alert("파일 읽기 중 오류 발생: " + err);
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; // 같은 파일 재업로드 방지
};

// ============================================================================
// ★ 화협(KFPA) 자료 파싱, 미리보기 및 확정 연동 로직
// ============================================================================
window.tempKfpaRecords = null; // 파싱된 데이터 임시 보관
window.tempKfpaSite = "";      // 선택된 사업장 임시 보관

// 1. 화면 진입 시 콤보박스에 사업장 목록 채우기
window.initKfpaScreen = function() {
    const select = document.getElementById('kfpaSiteSelect');
    if(select) {
        select.innerHTML = '<option value="">사업장 선택...</option>';
        // 등록된 주소지나 조회된 대장 데이터를 바탕으로 사업장 목록 추출
        const sites = Object.keys(window.kbState.evalData.title || window.kbState.fetchedData || {});
        sites.forEach(site => {
            const opt = document.createElement('option');
            opt.value = site;
            opt.innerText = site;
            select.appendChild(opt);
        });
    }
    goToSlide('slide6');
};

// 2. 파일 업로드 및 데이터 파싱 (미리보기 생성)
window.loadKfpaExcel = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    const siteSelect = document.getElementById('kfpaSiteSelect');
    const siteName = siteSelect ? siteSelect.value : "";
    
    if(!siteName) {
        alert("먼저 데이터를 적용할 '사업장(소재지)'을 선택해 주세요.");
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {defval: "-"});
            if(jsonData.length === 0) return alert("엑셀 파일에 데이터가 없습니다.");

            const headers = Object.keys(jsonData[0]);
            const getCol = (keywords) => headers.find(h => keywords.some(k => String(h).includes(k)));

            const colDong = getCol(["건물명", "동명", "건물번호", "동"]);
            const colStrct = getCol(["구조(본)", "구조"]);
            const colRoof = getCol(["지붕"]);
            const colPurps = getCol(["용도"]);
            const colYear = getCol(["신축년도", "건축년도", "준공"]);
            const colArea = getCol(["면적", "연면적", "면적(m2)"]);

            if(!colArea) return alert("면적 데이터를 찾을 수 없습니다. 화협 양식을 확인해주세요.");

            const records = [];
            
            jsonData.forEach((row, idx) => {
                let dongNm = String(row[colDong] || "").trim();
                if(!dongNm || dongNm === "-" || dongNm === "undefined") dongNm = "본동";

                let strct = String(row[colStrct] || "").trim();
                let roof = String(row[colRoof] || "").trim();
                let fullStrct = (strct !== "-" ? strct : "") + (roof !== "-" && roof ? " / " + roof : "");
                if(!fullStrct || fullStrct === " / ") fullStrct = "확인필요";

                let purps = String(row[colPurps] || "-").trim();
                let area = parseFloat(String(row[colArea] || "0").replace(/,/g, ''));
                if(isNaN(area)) area = 0.0;

                let buildYear = new Date().getFullYear();
                let yearStr = String(row[colYear] || "").replace(/[^0-9]/g, '');
                if(yearStr.length >= 4) buildYear = parseInt(yearStr.substring(0, 4));

                if(area > 0) {
                    records.push({
                        "일련번호": String(idx + 1), "동명칭": dongNm, "용도": purps,
                        "연면적": area, "구조명": fullStrct, "준공연도": buildYear,
                        "구조코드": "-", "단가": 0.0, "노무비": 0.0, "물가지수": 1.0,
                        "감가율": 1.78, "재조달_건축": 0, "잔가율": 100.0, "현재_건축": 0
                    });
                }
            });

            if(records.length === 0) return alert("유효한 화협 데이터(면적 > 0)를 찾을 수 없습니다.");

            // 임시 저장
            window.tempKfpaRecords = records;
            window.tempKfpaSite = siteName;

            // 미리보기 표 렌더링
            const tbody = document.getElementById('previewKfpaTbody');
            tbody.innerHTML = '';
            records.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${r.일련번호}</td>
                    <td style="font-weight:bold; color:#1C5691;">${r.동명칭}</td>
                    <td>${r.구조명}</td>
                    <td>${r.용도}</td>
                    <td>${r.준공연도}</td>
                    <td style="text-align:right;">${r.연면적.toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                `;
                tbody.appendChild(tr);
            });

            // 확정 버튼 노출
            document.getElementById('btnConfirmKfpa').style.display = 'block';
            alert(`✅ 화협 엑셀 파싱 완료!\n아래 [미리보기] 표에서 데이터가 맞는지 확인하신 후,\n우측 상단의 [데이터 확정 및 가액평가 시작 ▶] 버튼을 눌러주세요.`);

        } catch (err) {
            alert("파일 읽기 중 오류 발생: " + err);
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
};

// 3. 데이터 최종 확정 및 평가 탭으로 연동 이동
window.confirmKfpaData = function() {
    if(!window.tempKfpaRecords || !window.tempKfpaSite) return alert("반영할 데이터가 없습니다.");
    
    const siteName = window.tempKfpaSite;
    const records = window.tempKfpaRecords;
    
    // 표제부 상속 로직 (표제부에서 이미 작업한 '부속비율'이 있다면 동명칭 기준으로 자동 맵핑)
    const titleRecords = window.kbState.evalData.title[siteName] || [];
    const siteGroups = {};
    
    records.forEach(r => {
        const d = r.동명칭;
        let inheritedRatio = 20.0;
        
        const tGroup = titleRecords.find(g => (g.동명칭 || "") === d);
        if (tGroup && tGroup.부속비율) inheritedRatio = tGroup.부속비율;

        if(!siteGroups[d]) {
            siteGroups[d] = {
                "동명칭": d, "부속비율": inheritedRatio, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0,
                "records": []
            };
        }
        siteGroups[d].records.push(r);
    });

    // 최종 데이터 덮어쓰기
    if(!window.kbState.evalData.kfpa) window.kbState.evalData.kfpa = {};
    window.kbState.evalData.kfpa[siteName] = Object.values(siteGroups);
    window.kbState.activeSite.kfpa = siteName;

    // 가액 재계산
    recalculateValuation('kfpa', siteName);
    
    // 임시 보관소 초기화
    window.tempKfpaRecords = null;
    window.tempKfpaSite = "";
    document.getElementById('btnConfirmKfpa').style.display = 'none';
    document.getElementById('previewKfpaTbody').innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 60px; color:#999;">사업장을 선택하고 화협 자료 엑셀을 업로드해주세요.</td></tr>';

    // 2.2.2 슬라이드(평가)로 화면 이동 및 렌더링
    goToSlide('slide7');
    renderEvalTabsAndTable('kfpa', 'tbodyKfpaEval', 'tabsKfpaEval');
    
    alert(`🎉 [${siteName}] 화협자료 확정 완료!\n\n데이터가 2.2.2 평가 테이블로 연동되었습니다.\n구조코드와 감가율을 매핑하여 평가를 완료해 주세요.`);
};