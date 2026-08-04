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

    // ★ 2.1.1 대장 불러오기 메뉴 클릭 시 백지 현상 방지 (강제 다시 그리기)
    const ledgerMenu = document.getElementById('nav-sec-2-1-1');
    if (ledgerMenu) {
        ledgerMenu.addEventListener('click', () => {
            setTimeout(() => {
                if (window.kbState && window.kbState.fetchedData && Object.keys(window.kbState.fetchedData).length > 0) {
                    const emptyMsg = document.getElementById('emptyStateMsg');
                    const dataCont = document.getElementById('fetchedDataContainer');
                    if (emptyMsg) emptyMsg.style.display = 'none';
                    if (dataCont) dataCont.style.display = 'block';
                    if (typeof window.renderSlide3Tabs === 'function') window.renderSlide3Tabs();
                }
            }, 100);
        });
    }

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
// [4] 하이브리드 UI 렌더링 엔진 (구조코드/감가율 항시입력창 탑재)
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

        // ★ [핵심 버그 수정] JavaScript에서 0은 false로 인식되므로, 값이 명시적으로 있는지 확인!
        const accRate = parseFloat(group['부속비율'] !== undefined && group['부속비율'] !== "" ? group['부속비율'] : 20.0);
        
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

window.syncTitleData = function() {
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
            
            const autoRatio = (area <= 300 && area > 0) ? 0.0 : 20.0;

            siteRecords.push({
                "동명칭": dongNm, "부속비율": autoRatio, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0,
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
    alert("표제부 데이터 연동이 완료되었습니다.\n(연면적 300㎡ 이하 건물은 부속비율이 0%로 자동 세팅되었습니다.)");
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
        
        const floorAreaMap = {};
        dfFloor.forEach(row => {
            let d = (row["dongNm"] || "").trim();
            if (!d || d === "-" || d === "nan") d = "본동";
            const a = isNaN(parseFloat(String(row["area"] || "0").replace(/,/g, "").trim())) ? 0.0 : parseFloat(String(row["area"] || "0").replace(/,/g, "").trim());
            floorAreaMap[d] = (floorAreaMap[d] || 0) + a;
        });

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
            
            let inheritedRatio = (floorAreaMap[dongNm] <= 300 && floorAreaMap[dongNm] > 0) ? 0.0 : 20.0; 
            
            const tGroup = titleRecords.find(g => g.동명칭 === dongNm);
            if (tGroup) {
                const tReq = tGroup.records[0];
                record["구조코드"] = tReq["구조코드"]; record["단가"] = tReq["단가"];
                record["노무비"] = tReq["노무비"]; record["물가지수"] = tReq["물가지수"];
                record["감가율"] = tReq["감가율"]; record["준공연도"] = tReq["준공연도"]; 
                if (tGroup["부속비율"] !== undefined) inheritedRatio = tGroup["부속비율"]; 
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
    alert("✅ 층별 데이터 연동 완료!\n\n(총면적 300㎡ 이하 건물은 부속비율 0%가 자동 적용되었습니다.)");
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
        let sumArea = 0, sumWeight = 0;
        let configAreas = {}; // ★ 추가: 구조/연도별 면적 합계를 추적하기 위한 객체

        // 1. 가중평균 산출 데이터 수집 및 면적 비중 계산
        group.records.forEach(r => {
            const area = parseFloat(r.연면적) || 0;
            const yearlyDepr = parseFloat(r.감가율) || 1.78;
            const buildYear = parseInt(r.준공연도) || evalYear;
            const elapsed = Math.max(0, evalYear - buildYear);
            
            // 구조와 연도를 결합한 고유 키 생성
            const configKey = `${yearlyDepr}_${buildYear}`;
            configAreas[configKey] = (configAreas[configKey] || 0) + area;

            // 70% 상한 제한 없이 순수 감가율 누적
            let totalDepr = elapsed * yearlyDepr;

            // 가중치 산출 시 총감가율(%)을 100으로 나눔
            const weight = (totalDepr / 100.0) * area; 

            sumArea += area;
            sumWeight += weight;
        });

        // ★ 추가: 그룹 내에서 가장 면적이 넓은 '주건물'의 면적 찾기
        let maxConfigArea = 0;
        for (let key in configAreas) {
            if (configAreas[key] > maxConfigArea) {
                maxConfigArea = configAreas[key];
            }
        }

        // ★ 추가: 주건물을 제외한 나머지(증개축/타구조) 부분의 면적 비중 산출
        const minorAreaRatio = sumArea > 0 ? (sumArea - maxConfigArea) / sumArea : 0;

        // 2. 상태 저장 
        // ★ 핵심 룰 적용: 구조가 2개 이상이더라도, 타 구조 면적이 20%를 '초과'할 때만 복합구조 버튼 노출!
        group.isComplex = (Object.keys(configAreas).length > 1 && sumArea > 0 && minorAreaRatio > 0.20);
        
        // 가중평균 산출 (화면 표출용)
        group.avgTotalDepr = sumArea > 0 ? (sumWeight / sumArea) * 100.0 : 0;

        // 3. 재조달 및 현재가액 재계산
        group.records.forEach(r => {
            const compConstCost = (r.연면적 || 0) * (r.단가 || 0) * (r.물가지수 || 1.0);
            r.재조달_건축 = Math.floor(compConstCost / 1000) * 1000;
            const elapsed = Math.max(0, evalYear - (r.준공연도 || evalYear));
            
            // 복합구조 일괄 적용이 켜져있다면, 덮어씌우기
            if (group.complexApplied) {
                let appliedResidual = 100.0 - group.complexRate;
                if (appliedResidual < 30) appliedResidual = 30; // 최종 하한선 방어
                r.잔가율 = appliedResidual;
            } else {
                let residualRatio = 100.0 - (elapsed * (r.감가율 || 1.78));
                if (residualRatio < 30.0) residualRatio = 30.0; // 최종 하한선 방어
                r.잔가율 = residualRatio;
            }
            
            r.현재_건축 = Math.floor((r.재조달_건축 * (r.잔가율 / 100.0)) / 1000) * 1000;
            totRecoArch += r.재조달_건축; 
            totCurArch += r.현재_건축;
        });

        // 4. 부속설비 산출
        const accRate = parseFloat(group.부속비율 !== undefined && group.부속비율 !== "" ? group.부속비율 : 20.0) / 100.0;
        group.재조달_부속 = Math.floor((totRecoArch * accRate) / 1000) * 1000;
        
        // 부속설비의 잔가율은 복합구조 적용시 해당 잔가율, 미적용시 첫번째 항목 기준
        const repResidualRatio = group.complexApplied ? (Math.max(30, 100.0 - group.complexRate) / 100.0) : (group.records.length > 0 ? (group.records[0].잔가율 / 100.0) : 1.0);
        
        group.현재_부속 = Math.floor((group.재조달_부속 * repResidualRatio) / 1000) * 1000;
        group.재조달_합계 = totRecoArch + group.재조달_부속;
        group.현재_합계 = totCurArch + group.현재_부속;
    });
};


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

 // ★ 일괄적용 시, 테이블 셀에 감가율/잔가율이 명확하게 들어가도록 수정!
            const depInputHtml = group.complexApplied 
                ? `<div style="color:#d32f2f; font-weight:bold; font-size:12px; background:#fff3f3; padding:4px; border-radius:3px; border:1px solid #f5c6cb;" title="가중평균 총감가율 적용됨">
                    총 ${group.complexRate.toFixed(2)}%
                   </div>` 
                : `
                <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                    <input type="number" step="0.01" value="${depRate}" style="width:50px; text-align:center; border:1px solid #ccc; padding:3px; font-weight:bold; color:#0056b3;" 
                        onchange="applyDeprToRecord(this.value, '${mode}', '${siteName}', ${gIdx}, ${rIdx})">
                    <button type="button" onclick="openDeprModal('${mode}', '${siteName}', ${gIdx}, ${rIdx})" 
                        style="cursor:pointer; padding:3px 6px; background:#28A745; color:white; border:none; border-radius:3px;" title="표준 감가율 검색">🔍</button>
                </div>`;

            const trashIcon = (rIdx === 0) ? `<i class="fa-solid fa-trash-can" onclick="event.stopPropagation(); deleteEvalItem('${mode}', '${siteName}', ${gIdx})" style="color:#dc3545; margin-left:8px; cursor:pointer;" title="이 동 전체 삭제"></i>` : '';
            const dongDisp = `${dongName} ${trashIcon}`;

            const trArch = document.createElement('tr');
            trArch.style.backgroundColor = '#ffffff';
            
            // ★ 일괄적용 시 잔가율 수치도 붉은색으로 명확하게 렌더링
            const dispRemainRate = group.complexApplied 
                ? `<span style="color:#d32f2f; font-weight:bold; font-size:13px;">${remainRate.toFixed(2)}%</span>` 
                : `${remainRate.toFixed(2)}%`;

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
                <td>${dispRemainRate}</td>
                <td style="text-align:right; color:#0056b3;">${formatPrice(curArch)}</td>
            `;
            tbody.appendChild(trArch);
        });

        const accRate = parseFloat(group['부속비율'] !== undefined && group['부속비율'] !== "" ? group['부속비율'] : 20.0);
        const recoSub = parseFloat(group['재조달_부속'] || 0);
        const curSub = parseFloat(group['현재_부속'] || 0);
        const recoTotal = parseFloat(group['재조달_합계'] || 0);
        const curTotal = parseFloat(group['현재_합계'] || 0);
        const mainDongName = group['동명칭'] || '-';

        grandTotalArea += groupArea; grandTotalReco += recoTotal; grandTotalCur += curTotal;

        // ★ 조건부 노출 로직 (일괄 적용 버튼)
        let complexHtml = '';
        if (group.complexApplied) {
            complexHtml = `
                <div style="color:#d32f2f; font-weight:bold; font-size:12px; cursor:pointer; background:#ffe5e5; padding:6px; border-radius:4px; border: 1px solid #f5c6cb; display:inline-block;"
                     onclick="window.cancelComplexDepr('${mode}', '${siteName}', ${gIdx})" title="클릭 시 일괄 적용이 해제되고 원래 감가율로 돌아갑니다.">
                    <i class="fa-solid fa-check"></i> 복합구조 감가율 ${group.complexRate.toFixed(2)}% 적용됨 (해제)
                </div>`;
        } else if (group.isComplex) {
            complexHtml = `
                <button type="button" onclick="window.openComplexModal('${mode}', '${siteName}', ${gIdx})" 
                        style="background:#6f42c1; color:white; border:none; padding:6px 10px; border-radius:4px; font-size:12px; font-weight:bold; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);">
                    <i class="fa-solid fa-magnifying-glass-chart"></i> 복합 평균감가율 계산 및 적용
                </button>`;
        }

        const trSub = document.createElement('tr');
        trSub.style.backgroundColor = '#f8f9fa';
        trSub.innerHTML = `
            <td colspan="2"></td><td>부속설비</td><td>[${mainDongName}] 일괄부속</td><td colspan="6"></td>
            <td style="font-weight:bold; color:#0056b3; cursor:pointer;" ondblclick="editCell(this, '${mode}', '${siteName}', ${gIdx}, 0, '부속비율', 'number', 'group')">${accRate.toFixed(1)}%</td>
            <td style="text-align:right;">${formatPrice(recoSub)}</td>
            
            <!-- ★ 복합구조 버튼 위치 지정 -->
            <td colspan="2" style="text-align:center; vertical-align:middle;">
                ${complexHtml}
            </td>
            
            <td style="text-align:right;">${formatPrice(curSub)}</td>
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
// [10] ★ 프로젝트 저장 및 불러오기 (건물평가 + 물가보정 통합 저장 완벽 지원)
// ============================================================================

window.saveProject = function() {
    try {
        const hasEvalData = Object.keys(window.kbState.evalData.title).length > 0 || 
                            Object.keys(window.kbState.evalData.floor).length > 0 || 
                            Object.keys(window.kbState.evalData.kfpa).length > 0;
        
        const hasTempKfpa = Object.keys(window.tempKfpaDataStore || {}).length > 0;
        const hasCostData = window.kbState.costData && window.kbState.costData.length > 0;
        const hasInfData = window.infState && window.infState.data && Object.keys(window.infState.data).length > 0;
                            
        if (Object.keys(window.kbState.fetchedData).length === 0 && !hasEvalData && !hasTempKfpa && !hasCostData && !hasInfData) {
            alert("저장할 데이터가 존재하지 않습니다. 대장 조회, 엑셀 업로드 등을 먼저 진행해 주세요.");
            return;
        }

        const contractorInputs = document.querySelectorAll('.contractor-sync');
        const contractorName = contractorInputs.length > 0 ? contractorInputs[0].value : "";
        const evalYearInput = document.getElementById('evalYear');
        const evalYear = evalYearInput ? evalYearInput.value : new Date().getFullYear();

        const locations = [];
        document.querySelectorAll('#locationTbody tr').forEach(row => {
            locations.push({
                name: row.querySelector('.loc-name') ? row.querySelector('.loc-name').value.trim() : '',
                address: row.querySelector('.addr-input') ? row.querySelector('.addr-input').value.trim() : '',
                checkedLedger: row.querySelector('.chk-ledger') ? row.querySelector('.chk-ledger').checked : true,
                checkedKfpa: row.querySelector('.chk-kfpa') ? row.querySelector('.chk-kfpa').checked : true,
                checkedInflation: row.querySelector('.chk-inflation') ? row.querySelector('.chk-inflation').checked : false,
                checkedBI: row.querySelector('.chk-bi') ? row.querySelector('.chk-bi').checked : false
            });
        });

        const sidebarStates = {};
        document.querySelectorAll('.sidebar .menu-item').forEach(menu => {
            const badge = menu.querySelector('.status-badge');
            sidebarStates[menu.id] = {
                className: menu.className,
                badgeHtml: badge ? badge.outerHTML : ''
            };
        });

        const projectData = {
            version: "2.1", 
            contractor: contractorName,
            evalYear: evalYear,
            locations: locations, 
            sidebarStates: sidebarStates, 
            unitCostPath: document.getElementById('unitCostPath') ? document.getElementById('unitCostPath').value : "",
            priceIndexPath: document.getElementById('priceIndexPath') ? document.getElementById('priceIndexPath').value : "",
            tempKfpaDataStore: window.tempKfpaDataStore || {},
            targetKfpaSite: window.targetKfpaSite || "",
            targetKfpaAddress: window.targetKfpaAddress || "",
            kbState: window.kbState,
            inflationSheets: window.kbState.inflationSheets || null,
            indexData: window.kbState.indexData || null,
            infState: window.infState || null 
        };

        const jsonString = JSON.stringify(projectData);
        if(!jsonString) throw new Error("JSON 변환 실패");

        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, "");
        a.download = `${contractorName || '통합가액평가'}_저장파일_${dateStr}.kbproj`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert("저장 중 오류가 발생했습니다. 화면이 정상적인 상태인지 확인해주세요.\n(" + e.message + ")");
    }
};

// ============================================================================
// [10-2] 프로젝트 불러오기 기능 (버그 수정 및 안전한 복원)
// ============================================================================
window.loadProject = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const projectData = JSON.parse(e.target.result, function(key, value) {
                if (value === null || String(value).toLowerCase() === "null" || String(value).toLowerCase() === "nan") {
                    return "";
                }
                return value;
            });
            
            // 1. 상태 변수 복원
            if (projectData.kbState) window.kbState = projectData.kbState;
            if (projectData.inflationSheets) window.kbState.inflationSheets = projectData.inflationSheets;
            if (projectData.indexData) window.kbState.indexData = projectData.indexData;
            
            if (projectData.tempKfpaDataStore) window.tempKfpaDataStore = projectData.tempKfpaDataStore;
            else window.tempKfpaDataStore = {};
            if (projectData.targetKfpaSite) window.targetKfpaSite = projectData.targetKfpaSite;
            if (projectData.targetKfpaAddress) window.targetKfpaAddress = projectData.targetKfpaAddress;

            // 2. 기본 정보 텍스트 복원
            if (projectData.contractor) document.querySelectorAll('.contractor-sync').forEach(el => el.value = projectData.contractor);
            if (projectData.evalYear) { const y = document.getElementById('evalYear'); if(y) y.value = projectData.evalYear; }
            if (projectData.unitCostPath) { const u = document.getElementById('unitCostPath'); if(u) u.value = projectData.unitCostPath; }
            if (projectData.priceIndexPath) { const p = document.getElementById('priceIndexPath'); if(p) p.value = projectData.priceIndexPath; }

            // 3. 소재지 테이블 복원
            const tbody = document.getElementById('locationTbody');
            if (tbody) {
                tbody.innerHTML = ''; 
                if (projectData.locations && projectData.locations.length > 0) {
                    projectData.locations.forEach((loc, idx) => {
                        if (typeof createLocationRowHTML === 'function') {
                            tbody.insertAdjacentHTML('beforeend', createLocationRowHTML(idx + 1));
                            const newRow = document.getElementById(`loc_row_${idx + 1}`);
                            if(newRow) {
                                newRow.querySelector('.loc-name').value = loc.name || '';
                                newRow.querySelector('.addr-input').value = loc.address || '';
                                if(newRow.querySelector('.chk-ledger')) newRow.querySelector('.chk-ledger').checked = loc.checkedLedger !== false;
                                if(newRow.querySelector('.chk-kfpa')) newRow.querySelector('.chk-kfpa').checked = loc.checkedKfpa !== false;
                                if(newRow.querySelector('.chk-inflation')) newRow.querySelector('.chk-inflation').checked = !!loc.checkedInflation;
                                if(newRow.querySelector('.chk-bi')) newRow.querySelector('.chk-bi').checked = !!loc.checkedBI;
                            }
                        }
                    });
                    const locCountInput = document.getElementById('locationCount');
                    if(locCountInput) locCountInput.value = projectData.locations.length;
                    window.locationCounter = projectData.locations.length;
                } 
            }

            // 4. 물가보정(명세서) 데이터 최우선 복원
            if (projectData.infState) {
                window.infState = projectData.infState;
                if (window.infState.data) {
                    for (const tab in window.infState.data) {
                        window.infState.data[tab].selectedRows = new Set();
                        window.infState.data[tab].selectedCols = new Set();
                    }
                }
                const modeRadios = document.querySelectorAll('input[name="infMode"]');
                if(modeRadios.length > 0) {
                    modeRadios.forEach(r => r.checked = (r.value === window.infState.mode));
                }
                if (!window.infState.mappingRules) {
                    window.infState.mappingRules = JSON.parse(localStorage.getItem('kb_mapping_rules_v3')) || window.initialRules;
                }
            }

            // 5. 사이드바 메뉴 뱃지 상태 복원
            if (projectData.sidebarStates) {
                for (const [menuId, state] of Object.entries(projectData.sidebarStates)) {
                    const menu = document.getElementById(menuId);
                    if (menu) {
                        menu.className = state.className;
                        if (state.badgeHtml) {
                            const oldBadge = menu.querySelector('.status-badge');
                            if (oldBadge) oldBadge.remove();
                            menu.insertAdjacentHTML('beforeend', state.badgeHtml);
                        }
                    }
                }
            } else {
                if (typeof updateMenuState === 'function') updateMenuState();
            }

            alert("✅ 가액평가 데이터가 복구되었습니다. 화면을 초기화합니다.");
            
            // 페이지 렌더링
            if (typeof runGroupedRenderTest === 'function') runGroupedRenderTest();
            if (typeof window.infInitTabs === 'function' && window.infState && window.infState.tabs && window.infState.tabs.length > 0) {
                window.infInitTabs();
                if (typeof window.infRenderTable === 'function') window.infRenderTable();
            }

            setTimeout(() => {
                if (typeof switchSection === 'function') switchSection('sec-1-1');
            }, 100);

        } catch (err) {
            console.error("불러오기 오류:", err);
            alert("⚠️ 파일 형식이 잘못되었거나 손상된 파일입니다.\n(에러 상세: " + err.message + ")");
        }
    };
    reader.readAsText(file);
};


// ============================================================================
// [11] ★ 화협(KFPA) 다중 사업장 바구니 보존 및 일괄 확정 로직 
// ============================================================================
window.targetKfpaSite = "";
window.targetKfpaAddress = "";

if (typeof window.tempKfpaDataStore === 'undefined') {
    window.tempKfpaDataStore = {};
}

window.initKfpaScreen = function() {
    const tabsContainer = document.getElementById('slide6Tabs');
    const infoPanel = document.getElementById('kfpaActiveInfoPanel');
    if(!tabsContainer) return;
    tabsContainer.innerHTML = '';
    
    const locations = [];
    document.querySelectorAll('#locationTbody tr').forEach(row => {
        const name = row.querySelector('.loc-name') ? row.querySelector('.loc-name').value.trim() : '';
        const addr = row.querySelector('.addr-input') ? row.querySelector('.addr-input').value.trim() : '';
        const checkedKfpa = row.querySelector('.chk-kfpa') ? row.querySelector('.chk-kfpa').checked : false;
        if(name && checkedKfpa) locations.push({name, addr});
    });

    if(locations.length === 0) {
        tabsContainer.innerHTML = '<div style="padding: 15px; color: #dc3545; font-weight: bold;">등록된 사업장이 없거나 화협자료평가 체크가 해제되어 있습니다. (1.1 일반정보 확인)</div>';
        infoPanel.style.display = 'none';
        switchSection('sec-2-2-1'); 
        return;
    }

    infoPanel.style.display = 'block';
    let isFirst = true;

    locations.forEach(loc => {
        const tabBtn = document.createElement('div');
        tabBtn.innerText = loc.name;
        tabBtn.style.cssText = `padding:10px 20px; cursor:pointer; font-weight:${isFirst ? 'bold' : 'normal'}; border:1px solid ${isFirst ? '#1C5691' : '#e2e8f0'}; border-bottom:none; border-radius:4px 4px 0 0; margin-right:5px; background:${isFirst ? '#1C5691' : '#f1f5f9'}; color:${isFirst ? '#ffffff' : '#94a3b8'};`;
        
        tabBtn.onclick = () => {
            Array.from(tabsContainer.children).forEach(c => { c.style.background = '#f1f5f9'; c.style.color = '#94a3b8'; c.style.fontWeight = 'normal'; c.style.borderColor = '#e2e8f0'; });
            tabBtn.style.background = '#1C5691'; tabBtn.style.color = '#ffffff'; tabBtn.style.fontWeight = 'bold'; tabBtn.style.borderColor = '#1C5691';
            
            document.getElementById('kfpaPreviewSite').value = loc.name;
            document.getElementById('kfpaPreviewAddress').value = loc.addr;
            window.targetKfpaSite = loc.name;
            window.targetKfpaAddress = loc.addr;
            
            if (typeof window.tempKfpaDataStore === 'undefined') window.tempKfpaDataStore = {};
            renderKfpaPreview(loc.name);
        };
        tabsContainer.appendChild(tabBtn);

        if (window.targetKfpaSite === loc.name) {
            tabBtn.click();
            isFirst = false;
        } else if (isFirst && !window.targetKfpaSite) {
            tabBtn.click();
            isFirst = false;
        }
    });
    
    if (isFirst && tabsContainer.firstChild) tabsContainer.firstChild.click();
    switchSection('sec-2-2-1'); 
};

window.renderKfpaPreview = function(siteName) {
    const tbody = document.getElementById('previewKfpaTbody');
    const btnConfirm = document.getElementById('btnConfirmKfpa');
    const records = window.tempKfpaDataStore[siteName];

    if(!records || records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 60px; color:#999; font-size:14px;"><i class="fa-regular fa-folder-open" style="font-size:30px; margin-bottom:10px; display:block;"></i>우측 상단의 <b>[해당 사업장 화협 엑셀 첨부]</b>를 눌러 데이터를 업로드해주세요.</td></tr>`;
        if(btnConfirm) btnConfirm.style.display = 'none';
        return;
    }

    tbody.innerHTML = '';
    let grandTotalArea = 0;

    // 일련번호 앞자리를 기준으로 그룹핑
    const groups = {};
    records.forEach((r, origIdx) => {
        r._origIdx = origIdx; 
        const gk = r.groupKey || "기타";
        if(!groups[gk]) groups[gk] = { items: [], subtotal: null };
        
        if(r.isSubtotal) groups[gk].subtotal = r;
        else groups[gk].items.push(r);
    });

    Object.keys(groups).forEach(gk => {
        const group = groups[gk];
        let calcSum = 0;

        group.items.forEach(r => {
            calcSum += (parseFloat(r.연면적) || 0);
            grandTotalArea += (parseFloat(r.연면적) || 0);
            
            // ★ 평소에 보여질 콤마(,)가 포함된 예쁜 숫자 포맷
            const displayArea = Number(r.연면적).toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2});

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:bold;">${r.일련번호}</td>
                <td>${r.동번호}</td>
                <td style="font-weight:bold; color:#1C5691;">${r.동명칭}</td>
                <td>${r.준공연도}</td>
                <td>${r.층수}</td>
                <td>${r.구조명}</td>
                
                <!-- ★ [디자인 개선] 평소엔 텍스트처럼 투명하게, 클릭 시 입력칸으로 변신 -->
                <td style="text-align:right; padding: 0; position: relative;">
                    <input type="text" value="${displayArea}" 
                        style="width: 100%; box-sizing: border-box; text-align: right; border: 1px solid transparent; background: transparent; font-family: inherit; font-size: inherit; color: #333; outline: none; cursor: pointer; padding: 8px 10px; transition: 0.2s;"
                        onfocus="this.style.borderBottom='2px solid #1C5691'; this.style.background='#fff'; this.value='${r.연면적}'; this.select();"
                        onblur="this.style.borderBottom='1px solid transparent'; this.style.background='transparent';"
                        onmouseover="if(document.activeElement !== this) this.style.background='#f1f5f9';"
                        onmouseout="if(document.activeElement !== this) this.style.background='transparent';"
                        onchange="window.updateKfpaArea('${siteName}', ${r._origIdx}, this.value)"
                        title="클릭하여 면적 수정 (수정 후 엔터)">
                </td>
                
                <td style="text-align:left;">${r.용도}</td>
            `;
            tbody.appendChild(tr);
        });

        if (group.subtotal || group.items.length > 0) {
            const officialSum = group.subtotal ? (parseFloat(group.subtotal.연면적) || 0) : calcSum;
            const diff = Math.abs(calcSum - officialSum);
            const isMismatch = group.subtotal && diff > 0.01; 

            const trSub = document.createElement('tr');
            trSub.style.background = isMismatch ? '#ffe5e5' : '#e9ecef';
            trSub.style.fontWeight = 'bold';
            
            const warningMsg = isMismatch ? `<span style="color:#d32f2f; font-size:13px; font-weight:bold; animation: blink 1.5s infinite;"><i class="fa-solid fa-triangle-exclamation"></i> 동면적을 확인하세요! (엑셀 원본 합계: ${officialSum.toLocaleString('ko-KR')}㎡ / 차이: ${diff.toFixed(2)}㎡)</span>` : '';
            
            trSub.innerHTML = `
                <td></td><td></td>
                <td colspan="4" style="color:${isMismatch ? '#d32f2f' : '#1C5691'}; text-align:center;">동면적합계</td>
                <td style="text-align:right; color:${isMismatch ? '#d32f2f' : '#1C5691'}; font-size:14px; padding-right: 10px;">
                    ${calcSum.toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2})}
                </td>
                <td style="text-align:left;">${warningMsg}</td>
            `;
            tbody.appendChild(trSub);
        }
    });

    const totalTr = document.createElement('tr');
    totalTr.style.background = '#cbd5e1'; totalTr.style.fontWeight = 'bold';
    totalTr.innerHTML = `<td colspan="6" style="text-align:center; color:#333;">${siteName} 사업장 총면적 합계</td><td style="text-align:right; color:#d32f2f; font-size:14px; padding-right: 10px;">${grandTotalArea.toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td><td></td>`;
    tbody.appendChild(totalTr);

    if(btnConfirm) btnConfirm.style.display = 'inline-block';
};

// 깜빡이는 경고 효과용 CSS
if (!document.getElementById('kfpaWarningStyle')) {
    const style = document.createElement('style');
    style.id = 'kfpaWarningStyle';
    style.innerHTML = `@keyframes blink { 50% { opacity: 0.5; } }`;
    document.head.appendChild(style);
}

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
            let lastGroupKey = "1"; // ★ 추가: 소계를 위한 앞자리 그룹 추적

            jsonData.forEach((row, idx) => {
                let serial = String(row[colSerial] || "").trim();
                let dNo = String(row[colDongNo] || "").trim();
                let dNm = String(row[colDongNm] || "").trim();
                let isSubtotal = dNm.includes("합계") || dNm.includes("소계") || serial.includes("합계");

                // ★ 추가: 그룹 키 설정 (소계는 직전 일련번호 그룹에 종속됨)
                let groupKey = serial.includes('-') ? serial.split('-')[0] : serial;
                if (serial && !isSubtotal) {
                    lastGroupKey = groupKey;
                } else if (isSubtotal) {
                    groupKey = lastGroupKey;
                }

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

                // ★ 수정: 면적이 0이라도 공식 합계(isSubtotal) 행이면 데이터에 포함시켜 검증에 사용
                if(area > 0 || isSubtotal) {
                    records.push({
                        "일련번호": serial, "동번호": lastDongNo, "층수": floorStr,
                        "동명칭": isSubtotal ? dNm : lastDongNm, "용도": purps, "연면적": area,
                        "구조명": strctCode, "구조코드": strctCode, "준공연도": buildYear,
                        "isSubtotal": isSubtotal, "groupKey": groupKey, 
                        "단가": 0.0, "노무비": 0.0, "물가지수": 1.0, "감가율": 1.78, "재조달_건축": 0, "잔가율": 100.0, "현재_건축": 0
                    });
                }
            });

            if(records.length === 0) return alert("유효한 화협 데이터(일련번호 및 면적 존재)를 찾을 수 없습니다.");

            if (typeof window.tempKfpaDataStore === 'undefined') window.tempKfpaDataStore = {};
            window.tempKfpaDataStore[siteName] = records;
            renderKfpaPreview(siteName); 
            alert(`✅ [${siteName}] 화협 엑셀 로드 완료!\n동면적 합계에 빨간색 경고가 뜬 항목이 있는지 확인 후 수정해주세요.`);

        } catch (err) { alert("파일 파싱 중 오류 발생: " + err); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
};

window.confirmAllKfpaData = function() {
    if(!window.tempKfpaDataStore) return alert("반영할 데이터가 전혀 없습니다. 엑셀 파일을 먼저 업로드해주세요.");
    
    const sites = Object.keys(window.tempKfpaDataStore);
    if(sites.length === 0) return alert("반영할 데이터가 전혀 없습니다. 엑셀 파일을 먼저 업로드해주세요.");

    if(!window.kbState.evalData.kfpa) window.kbState.evalData.kfpa = {};
    
    sites.forEach(siteName => {
        const records = window.tempKfpaDataStore[siteName].filter(r => !r.isSubtotal); 
        const titleRecords = window.kbState.evalData.title[siteName] || [];
        const siteGroups = {};
        
        // ★ [핵심 수정 1] 일련번호의 '하이픈(-) 앞자리'를 뽑아내어 그룹 총면적을 합산합니다!
        const groupAreaMap = {};
        records.forEach(r => {
            const fullSeq = r.일련번호 || r.동명칭 || "";
            // 하이픈이 있으면 앞자리 추출 (예: '1-24' -> '1'), 없으면 전체 사용
            const groupKey = fullSeq.includes('-') ? fullSeq.split('-')[0] : fullSeq;
            groupAreaMap[groupKey] = (groupAreaMap[groupKey] || 0) + (parseFloat(r.연면적) || 0);
        });
        
        records.forEach(r => {
            let evalRecord = JSON.parse(JSON.stringify(r));

            if (evalRecord.구조코드 && evalRecord.구조코드 !== "-" && window.kbState.costData && window.kbState.costData.length > 0) {
                const cleanCode = String(evalRecord.구조코드).replace(/-/g, "");
                const matched = window.kbState.costData.find(row => {
                    const allText = Object.values(row).map(v => String(v || "")).join(" ").toLowerCase();
                    return allText.includes(String(evalRecord.구조코드).toLowerCase()) || (cleanCode && allText.replace(/-/g, "").includes(cleanCode));
                });
                if (matched) {
                    evalRecord.구조명 = (matched['구조'] && matched['구조'] !== "-") ? matched['구조'] : matched['중분류'];
                    evalRecord.단가 = matched['단가'];
                    evalRecord.노무비 = matched['노무비'];
                    if (window.applyAutoPriceIndex) window.applyAutoPriceIndex(evalRecord);
                }
            }

            // ★ [핵심 수정 2] 같은 앞자리(groupKey)를 가진 레코드들을 하나의 배열(그룹)로 묶어줍니다!
            const fullSeq = evalRecord.일련번호 || evalRecord.동명칭 || "";
            const groupKey = fullSeq.includes('-') ? fullSeq.split('-')[0] : fullSeq;
            const d = evalRecord.동명칭;

            // 잘게 쪼개진 건물들의 면적을 모두 더한 '그룹 총면적(groupAreaMap)'을 기준으로 부속비율 결정
            let inheritedRatio = (groupAreaMap[groupKey] <= 300 && groupAreaMap[groupKey] > 0) ? 0.0 : 20.0;
            
            // 혹시 표제부에 동일한 이름으로 평가된 비율이 있다면 그것을 우선 따름
            const tGroup = titleRecords.find(g => (g.동명칭 || "") === d);
            if (tGroup && tGroup.부속비율 !== undefined) inheritedRatio = tGroup.부속비율;

            if(!siteGroups[groupKey]) {
                // 새로운 그룹이 생성될 때 1번만 부속비율을 세팅 (렌더링 시 그룹 맨 밑에 딱 1번만 부속설비가 나옴)
                const displayDongName = `[${groupKey}번 건물 그룹]`;
                siteGroups[groupKey] = { 
                    "동명칭": displayDongName, 
                    "일련번호": groupKey, 
                    "부속비율": inheritedRatio, 
                    "재조달_부속": 0, 
                    "재조달_합계": 0, 
                    "현재_부속": 0, 
                    "현재_합계": 0, 
                    "records": [] 
                };
            }
            
            // 표의 세부 데이터(행)에는 원래 엑셀에 있던 이름(1-1동 등)이 그대로 나오도록 유지
            evalRecord.동명칭 = d;
            siteGroups[groupKey].records.push(evalRecord);
        });

        window.kbState.evalData.kfpa[siteName] = Object.values(siteGroups);
        recalculateValuation('kfpa', siteName); 
    });

    window.kbState.activeSite.kfpa = sites[0];
    
    // 화면 자동 전환 (SPA 구조 대응)
    if (typeof switchSection === 'function') switchSection('sec-2-2-2');
    else if (typeof goToSlide === 'function') goToSlide('slide7');
    
    renderEvalTabsAndTable('kfpa', 'tbodyKfpaEval', 'tabsKfpaEval');
    
    alert(`🎉 화협자료가 [일련번호 앞자리]를 기준으로 완벽하게 통합 그룹화되었습니다!\n\n(그룹 전체 총면적 300㎡ 이하 건물은 부속비율 0%가 자동 적용되었습니다.)`);
};

// ============================================================================
// [11-1] 화협 연면적 실시간 수정 및 합계 검증 로직
// ============================================================================
window.updateKfpaArea = function(siteName, origIdx, newVal) {
    // 콤마(,)가 포함된 채로 입력되어도 숫자로 정확히 변환합니다.
    let val = parseFloat(String(newVal).replace(/,/g, ''));
    if(isNaN(val)) val = 0;
    
    if(window.tempKfpaDataStore && window.tempKfpaDataStore[siteName] && window.tempKfpaDataStore[siteName][origIdx]) {
        window.tempKfpaDataStore[siteName][origIdx].연면적 = val;
        
        // 데이터 업데이트 후 화면 새로고침 (오차가 맞으면 경고 즉시 해제)
        window.renderKfpaPreview(siteName);
    }
};

// ============================================================================
// [12] ★ 통합 총괄표(Summary Table) 렌더링 로직 
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
            siteRowSpan += (rCount + 2); 
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
                ? `<td rowspan="${siteRowSpan}" style="vertical-align:middle; font-weight:bold; background:#ffffff !important; border-right:1px solid #ddd;">${siteName}</td>` 
                : '';
                
            const dongCellHtml = `<td rowspan="${dongRowSpan}" style="vertical-align:middle; font-weight:bold; color:#1C5691; background:#ffffff !important; border-right:1px solid #ddd;">${dongName}</td>`;

            if (records.length === 0) {
                tbody.innerHTML += `
                    <tr>
                        ${siteCellHtml} ${dongCellHtml}
                        <td style="text-align:left; background:#ffffff !important;">세부항목 없음</td>
                        <td style="text-align:right; background:#ffffff !important;">0</td>
                        <td style="text-align:right; background:#ffffff !important;">0</td>
                        <td style="text-align:right; background:#ffffff !important;">0</td>
                    </tr>
                `;
            } else {
                records.forEach((r, rIdx) => {
                    const isFirstRecord = (rIdx === 0);
                    const gubunText = r.용도 || '건축공사비';

                    tbody.innerHTML += `
                        <tr>
                            ${isFirstRecord ? siteCellHtml : ''}
                            ${isFirstRecord ? dongCellHtml : ''}
                            <td style="text-align:left; color:#444; background:#ffffff !important;">${gubunText}</td>
                            <td style="text-align:right; background:#ffffff !important;">${formatArea(r.연면적)}</td>
                            <td style="text-align:right; background:#ffffff !important;">${formatPrice(r.재조달_건축)}</td>
                            <td style="text-align:right; background:#ffffff !important;">${formatPrice(r.현재_건축)}</td>
                        </tr>
                    `;
                });
            }

            tbody.innerHTML += `
                <tr>
                    <td style="text-align:left; color:#666; background:#f8f9fa !important;">└ 부속설비 (${accRate}%)</td>
                    <td style="text-align:right; color:#999; background:#f8f9fa !important;">-</td>
                    <td style="text-align:right; background:#f8f9fa !important;">${formatPrice(recoSub)}</td>
                    <td style="text-align:right; background:#f8f9fa !important;">${formatPrice(curSub)}</td>
                </tr>
            `;
            
            tbody.innerHTML += `
                <tr style="font-weight:bold;">
                    <td style="text-align:center; color:#111; background:#e2e8f0 !important;">[${dongName}] 소계</td>
                    <td style="text-align:right; background:#e2e8f0 !important;">${formatArea(groupArea)}</td>
                    <td style="text-align:right; color:#1C5691; background:#e2e8f0 !important;">${formatPrice(recoTotal)}</td>
                    <td style="text-align:right; color:#1C5691; background:#e2e8f0 !important;">${formatPrice(curTotal)}</td>
                </tr>
            `;
        });

        grandTotalArea += siteTotalArea;
        grandTotalReco += siteTotalReco;
        grandTotalCur += siteTotalCur;

        tbody.innerHTML += `
            <tr style="font-weight:bold;">
                <td colspan="3" style="text-align:center; background:#cbd5e1 !important;">[${siteName}] 평가액 합계</td>
                <td style="text-align:right; color:#d32f2f; background:#cbd5e1 !important;">${formatArea(siteTotalArea)}</td>
                <td style="text-align:right; color:#d32f2f; background:#cbd5e1 !important;">${formatPrice(siteTotalReco)}</td>
                <td style="text-align:right; color:#d32f2f; background:#cbd5e1 !important;">${formatPrice(siteTotalCur)}</td>
            </tr>
        `;
    }

    if (Object.keys(dataObj).length > 1) { 
        tbody.innerHTML += `
            <tr style="font-weight:bold; font-size:15px;">
                <td colspan="3" style="text-align:center; color:#ffffff !important; background:#1C5691 !important;">전체 사업장 총 평가액</td>
                <td style="text-align:right; color:#FFD700 !important; background:#1C5691 !important;">${formatArea(grandTotalArea)}</td>
                <td style="text-align:right; color:#FFD700 !important; background:#1C5691 !important;">${formatPrice(grandTotalReco)}</td>
                <td style="text-align:right; color:#FFD700 !important; background:#1C5691 !important;">${formatPrice(grandTotalCur)}</td>
            </tr>
        `;
    }
};

window.exportSummaryExcel = function() {
    const table = document.getElementById('summaryTable');
    if(!table || table.rows.length <= 2) {
        return alert("다운로드할 총괄표 데이터가 없습니다. 먼저 좌측 메뉴에서 평가를 완료해 주세요.");
    }

    let activeTabName = "총괄표";
    const tabs = document.querySelectorAll('#summaryTabs .summary-tab');
    tabs.forEach(tab => {
        if (tab.style.fontWeight === 'bold') activeTabName = tab.innerText;
    });

    try {
        const wb = XLSX.utils.table_to_book(table, {sheet: "가액평가_총괄표"});
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, "");
        const fileName = `KB손해보험_${activeTabName}_${dateStr}.xlsx`;
        XLSX.writeFile(wb, fileName);
    } catch (error) {
        alert("엑셀 다운로드 중 오류가 발생했습니다.\n" + error.message);
    }
};

// ============================================================================
// [13] 보고서 생성 파이썬 연동 UI 시뮬레이션
// ============================================================================
window.runReportGeneration = function() {
    const templatePath = document.getElementById('reportTemplatePath').value;
    const evalTypeSelect = document.getElementById('reportEvalType');
    const evalType = evalTypeSelect.options[evalTypeSelect.selectedIndex].text;
    const logBox = document.getElementById('reportLogBox');
    
    if (!templatePath) {
        alert("2번 항목에서 엑셀 보고서 양식(.xlsx) 파일을 첨부해 주세요.");
        return;
    }
    
    // 파이썬 프로그램의 로그 출력 방식을 동일하게 재현
    logBox.value = "--- 보고서 생성을 시작합니다 ---\n";
    logBox.value += `[설정] 선택된 작성 기준: ${evalType}\n`;
    logBox.value += "[시스템] 현재 메모리에 적재된 평가 데이터를 취합 및 분석 중...\n";
    
    setTimeout(() => {
        logBox.value += "[성공] 표지 시트 작성 및 데이터 매핑 완료\n";
    }, 800);
    
    setTimeout(() => {
        logBox.value += "[성공] 총괄표 생성 및 합산 금액 집계 완료\n";
    }, 1500);

    setTimeout(() => {
        logBox.value += "[성공] 세부평가 시트 동적 서식 생성 (부속설비 로직 포함) 완료\n";
        logBox.value += "[성공] 불필요한 템플릿 시트 삭제 및 탭 정렬 완료\n";
        logBox.value += ">>> 작업이 성공적으로 완료되었습니다!\n";
        alert("보고서 생성이 완료되었습니다.\n(현재는 웹 UI 시뮬레이션이 작동 중이며, 실제 엑셀 파일 생성은 백엔드 서버 연동 후 다운로드됩니다.)");
    }, 2500);
};

// ============================================================================
// [14] 복합구조 가중평균 검산 및 일괄 덮어쓰기 모듈
// ============================================================================
window.currentComplexTarget = null;

window.openComplexModal = function(mode, siteName, gIdx) {
    const evalYearInput = document.getElementById('evalYear');
    const evalYear = parseInt(evalYearInput ? evalYearInput.value : new Date().getFullYear());
    const siteData = window.kbState.evalData[mode][siteName];
    const group = Array.isArray(siteData) ? siteData[gIdx] : siteData[Object.keys(siteData)[gIdx]];
    
    window.currentComplexTarget = { mode, siteName, gIdx, group };
    
    const tbody = document.getElementById('complexDeprTbody');
    const tfoot = document.getElementById('complexDeprTfoot');
    tbody.innerHTML = '';
    
    let sumArea = 0, sumWeight = 0;
    
    group.records.forEach(r => {
        const area = parseFloat(r.연면적) || 0;
        const yearlyDepr = parseFloat(r.감가율) || 1.78;
        const buildYear = parseInt(r.준공연도) || evalYear;
        const elapsed = Math.max(0, evalYear - buildYear);
        
        // ★ 수정: 70% 캡(제한) 삭제! 있는 그대로 누적 계산
        let totalDepr = elapsed * yearlyDepr; 
        
        // ★ 수정: 가중치 산출 시 100으로 나누기
        const weight = (totalDepr / 100.0) * area; 
        
        sumArea += area; sumWeight += weight;
        
        tbody.innerHTML += `
            <tr>
                <td style="text-align:center;">${r.구조명 || '-'}</td>
                <td style="text-align:center;">${r.용도 || '-'}</td>
                <td style="text-align:center;">${yearlyDepr.toFixed(2)}%</td>
                <td style="text-align:center;">${elapsed}년</td>
                <td style="text-align:center; color:#d32f2f; font-weight:bold;">${totalDepr.toFixed(2)}%</td>
                <td style="text-align:right;">${area.toLocaleString('ko-KR', {minimumFractionDigits:2})}</td>
                <td style="text-align:right; color:#1C5691;">${weight.toLocaleString('ko-KR', {minimumFractionDigits:2})}</td>
            </tr>
        `;
    });
    
    // ★ 수정: 평균을 구한 후, 화면에 %로 예쁘게 보여주기 위해 다시 100을 곱함
    const avgDepr = sumArea > 0 ? (sumWeight / sumArea) * 100.0 : 0;
    
    tfoot.innerHTML = `
        <tr>
            <td colspan="5" style="text-align:center;">합계 및 산출 과정</td>
            <td style="text-align:right;">${sumArea.toLocaleString('ko-KR', {minimumFractionDigits:2})}</td>
            <td style="text-align:right; color:#1C5691;">${sumWeight.toLocaleString('ko-KR', {minimumFractionDigits:2})}</td>
        </tr>
        <tr style="background:#cbd5e1; font-size:15px; color:#d32f2f;">
            <td colspan="7" style="text-align:center; padding:15px; vertical-align:middle;">
                가중치 합계 (${sumWeight.toLocaleString('ko-KR', {maximumFractionDigits:2})}) ÷ 면적 합계 (${sumArea.toLocaleString('ko-KR', {maximumFractionDigits:2})}) × 100
                = <b>가중평균 총감가율 ${avgDepr.toFixed(2)}%</b>
                
                <button type="button" onclick="window.applyComplexDepr('${mode}', '${siteName}', ${gIdx}, ${avgDepr})" 
                        style="background:#d32f2f; color:white; border:none; padding:8px 20px; border-radius:4px; font-size:14px; font-weight:bold; margin-left:20px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2); transition:0.2s;">
                    <i class="fa-solid fa-check-double"></i> 적용하기
                </button>
            </td>
        </tr>
    `;
    
    const modalContent = document.querySelector('#complexDeprModal .modal-content');
    const modalBody = document.querySelector('#complexDeprModal .modal-body');
    if (modalContent) {
        modalContent.style.maxHeight = '90vh';
        modalContent.style.display = 'flex';
        modalContent.style.flexDirection = 'column';
    }
    if (modalBody) {
        modalBody.style.overflowY = 'auto';
        modalBody.style.flex = '1';
    }

    const oldApplyBtn = document.getElementById('btnApplyComplex');
    if(oldApplyBtn) oldApplyBtn.parentElement.style.display = 'none';

    document.getElementById('complexDeprModal').style.display = 'flex';
};

window.closeComplexModal = function() {
    document.getElementById('complexDeprModal').style.display = 'none';
    window.currentComplexTarget = null;
};

window.applyComplexDepr = function(mode, siteName, gIdx, avgDepr) {
    const siteData = window.kbState.evalData[mode][siteName];
    const group = Array.isArray(siteData) ? siteData[gIdx] : siteData[Object.keys(siteData)[gIdx]];
    
    group.complexApplied = true;
    group.complexRate = avgDepr; // 산출된 총감가율 저장
    
    window.recalculateValuation(mode, siteName);
    window.renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
    window.closeComplexModal();
};

window.cancelComplexDepr = function(mode, siteName, gIdx) {
    if(confirm("일괄 적용된 복합구조 감가율을 해제하고 개별 감가율로 되돌리시겠습니까?")) {
        const siteData = window.kbState.evalData[mode][siteName];
        const group = Array.isArray(siteData) ? siteData[gIdx] : siteData[Object.keys(siteData)[gIdx]];
        group.complexApplied = false;
        window.recalculateValuation(mode, siteName);
        window.renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
    }
};

// ============================================================================
// [15] 스마트 행 삭제 복구 및 추가 작업 기능
// ============================================================================
window.resetRowDeletion = function() {
    if (!confirm("행 삭제 작업을 처음부터 다시 하시겠습니까?\n(열 매핑 정보는 그대로 유지되며, 지워졌던 행들이 다시 복구됩니다.)")) return;
    
    try {
        if (window.infState && window.infState.rawData && Object.keys(window.infState.rawData).length > 0) {
            // 원본 데이터로 다시 복구 (매핑된 설정은 건드리지 않음)
            window.infState.data = JSON.parse(JSON.stringify(window.infState.rawData));
            
            // 테이블 다시 그리기
            if (typeof window.infRenderTable === 'function') {
                window.infRenderTable();
            }
            
            alert("데이터가 복구되었습니다. 붉은색 패널의 도구를 이용해 추가적으로 행 삭제 작업을 진행해 주세요.");
        } else {
            alert("복구할 원본 데이터가 없습니다. 엑셀 파일을 다시 불러와 주세요.");
        }
    } catch (error) {
        console.error("행 삭제 되돌리기 오류:", error);
    }
};

// ============================================================================
// [16] 스마트 빈 셀 자동 탐지 기능 (영구 데이터 저장 및 절대 지워지지 않는 색상 적용)
// ============================================================================

// 1. 기존 시스템의 색상 초기화 방해를 막기 위한 초강력 CSS 강제 주입
if (!document.getElementById('smartDeleteStyle')) {
    const style = document.createElement('style');
    style.id = 'smartDeleteStyle';
    style.innerHTML = `
        tr.delete-target-row td { background-color: #ffe5e5 !important; }
        tr.delete-target-row { background-color: #ffe5e5 !important; }
    `;
    document.head.appendChild(style);
}

// 2. 표가 다시 그려져도 붉은색이 유지되도록 기존 렌더링 함수 가로채기(Patch)
if (typeof window.infRenderTable === 'function' && !window.infRenderTable.isSmartPatched) {
    const originalRender = window.infRenderTable;
    window.infRenderTable = function() {
        originalRender.apply(this, arguments); 
        
        if(!window.infState || !window.infState.data) return;
        const tbody = document.querySelector('.infTbodyGlobal');
        if(!tbody) return;
        
        tbody.querySelectorAll('tr').forEach(tr => {
            const td = tr.querySelector('td');
            if(!td) return;
            const origIdx = parseInt(td.innerText) - 1;
            
            // 캐시 데이터를 돌면서 삭제 대기 상태인지 확인
            let isTarget = false;
            Object.values(window.infState.data).forEach(arr => {
                if (Array.isArray(arr) && arr[origIdx] && arr[origIdx]._isDeleteTarget) isTarget = true;
            });
            
            if(isTarget) {
                tr.classList.add('delete-target-row');
                tr.title = "클릭하면 지우기 대상에서 제외(해제)됩니다.";
            }
        });
    };
    window.infRenderTable.isSmartPatched = true;
}

window.highlightEmptyRows = function() {
    const targetColName = document.getElementById('emptyCheckTarget').value;
    if (!targetColName) return alert("먼저 검사할 항목(예: 자산계정, 취득가액 등)을 선택해 주세요.");
    
    const thead = document.querySelector('.infTheadGlobal tr');
    if (!thead) return;
    
    let targetCellIndex = -1;
    const ths = thead.querySelectorAll('th, td');
    ths.forEach((th, idx) => {
        if (th.innerText.includes(targetColName)) targetCellIndex = idx;
    });

    if (targetCellIndex === -1) {
        return alert(`현재 테이블에서 '${targetColName}' 항목의 열을 찾을 수 없습니다.`);
    }
    
    const tbody = document.querySelector('.infTbodyGlobal');
    if (!tbody) return;
    
    let highlightCount = 0;
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length <= targetCellIndex) return;
        
        const cellText = cells[targetCellIndex].innerText.replace(/\s/g, ''); 
        const firstTd = cells[0];
        if (!firstTd) return;
        const origIdx = parseInt(firstTd.innerText) - 1;
        
        if (cellText === '' || cellText === '-' || cellText === 'null' || cellText === 'undefined' || cellText === '0' || cellText === '0.00' || cellText === 'NaN') {
            
            // 데이터에 삭제 대기 상태 저장 (모든 탭 데이터에 안전하게 기록)
            if (window.infState && window.infState.data) {
                Object.values(window.infState.data).forEach(arr => {
                    if (Array.isArray(arr) && arr[origIdx]) arr[origIdx]._isDeleteTarget = true;
                });
            }
            
            if (!tr.classList.contains('delete-target-row')) {
                tr.classList.add('delete-target-row');
                tr.title = "클릭하면 지우기 대상에서 제외(해제)됩니다.";
                highlightCount++;
            }
        }
    });
    
    if (highlightCount > 0) {
        alert(`🚨 [${targetColName}] 열 기준, 총 ${highlightCount}개의 빈 행이 자동 탐지되었습니다.\n\n수동으로 표 안의 아무 행이나 '클릭'하여 붉은색을 추가하거나 뺄 수 있습니다!`);
    } else {
        alert(`해당 열에는 비어있는 칸이 없습니다! (데이터 정상)`);
    }
};

window.bulkDeleteHighlightedRows = function() {
    const highlightedRows = document.querySelectorAll('.infTbodyGlobal tr.delete-target-row');
    if (highlightedRows.length === 0) {
        return alert("삭제할 붉은색 행이 없습니다.\n먼저 스캔을 하거나 표의 행을 클릭해 붉은색으로 지정해 주세요.");
    }
    
    if (!confirm(`정말 붉은색으로 표시된 ${highlightedRows.length}개의 행을 일괄 삭제하시겠습니까?\n(이 작업은 취소할 수 없습니다.)`)) return;
    
    // 1. 화면에서 삭제할 줄 번호(인덱스) 수집
    let indicesToDelete = [];
    highlightedRows.forEach(tr => {
        const td = tr.querySelector('td');
        if (td) {
            const origIdx = parseInt(td.innerText) - 1; 
            if (!isNaN(origIdx)) indicesToDelete.push(origIdx);
        }
    });
    
    // 인덱스가 밀리지 않도록 뒤(큰 숫자)에서부터 역순 삭제
    indicesToDelete.sort((a, b) => b - a); 
    
    // 2. ★ 초강력 좀비 방지: 시스템이 몰래 숨겨둔 모든 캐시 데이터(rawData 등)에서 강제 추출 및 완벽 파괴
    if (window.infState) {
        const cacheKeys = ['data', 'rawData', 'displayData', 'filteredData'];
        cacheKeys.forEach(key => {
            if (window.infState[key]) {
                Object.keys(window.infState[key]).forEach(subKey => {
                    let arr = window.infState[key][subKey];
                    if (Array.isArray(arr)) {
                        indicesToDelete.forEach(idx => {
                            if (idx >= 0 && idx < arr.length) {
                                arr.splice(idx, 1);
                            }
                        });
                    }
                });
            }
        });
    }
    
    // 3. 강제 화면 갱신
    if (typeof window.infRenderTable === 'function') {
        window.infRenderTable();
    } else {
        highlightedRows.forEach(tr => tr.remove());
    }
    
    alert(`🗑️ 총 ${indicesToDelete.length}개의 빈 행이 뿌리까지 완벽하게 일괄 삭제되었습니다!`);
    
    const btnReset = document.getElementById('btnResetRowDelete');
    if (btnReset) btnReset.style.display = 'inline-block';
};

// ============================================================================
// [17] 매핑된 버튼 다시 클릭 시 매핑 해제(Unmap) 기능 
// ============================================================================
document.addEventListener('click', function(e) {
    const btn = e.target.closest('#infMappingButtons button');
    if (!btn) return;

    if (btn.innerText.includes('✓')) {
        e.preventDefault();
        e.stopPropagation(); 
        e.stopImmediatePropagation();

        const targetName = btn.innerText.replace('✓', '').trim();

        if (window.infState && window.infState.wizard && window.infState.wizard.mapped) {
            delete window.infState.wizard.mapped[targetName];
        }

        const ths = document.querySelectorAll('.infTheadGlobal th, .infTheadGlobal td');
        ths.forEach(th => {
            const badges = th.querySelectorAll('span');
            badges.forEach(badge => {
                if (badge.innerText.includes(targetName)) {
                    badge.remove();
                }
            });
        });

        btn.innerText = targetName;
        btn.style.background = '#fff';
        btn.style.color = '#333';
        btn.style.border = '1px solid #ccc';
        btn.style.boxShadow = 'none';

        if (window.infState && window.infState.wizard.activeTarget === targetName) {
            window.infState.wizard.activeTarget = '';
        }
    }
}, true);

// ============================================================================
// [18] ★ 명세서 표 임의 행 클릭 및 키보드(Delete) 수동 삭제/토글 기능 
// ============================================================================
document.addEventListener('click', function(e) {
    const tbody = e.target.closest('.infTbodyGlobal');
    if (!tbody) return;

    if (['INPUT', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return;

    const tr = e.target.closest('tr');
    if (!tr) return;

    const firstTd = tr.querySelector('td');
    if (!firstTd || firstTd.colSpan > 5) return;

    // 기존 시스템의 충돌 이벤트 차단
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const origIdx = parseInt(firstTd.innerText) - 1;
    if (isNaN(origIdx)) return;
    
    // 시각적 토글 및 데이터 상태 갱신
    if (tr.classList.contains('delete-target-row')) {
        tr.classList.remove('delete-target-row');
        tr.style.removeProperty('background-color');
        tr.title = "";
        
        if (window.infState && window.infState.data) {
            Object.values(window.infState.data).forEach(arr => {
                if (Array.isArray(arr) && arr[origIdx]) arr[origIdx]._isDeleteTarget = false;
            });
        }
    } else {
        tr.classList.add('delete-target-row');
        tr.style.setProperty('background-color', '#ffe5e5', 'important');
        tr.title = "클릭하면 지우기 대상에서 제외(해제)됩니다.";
        
        if (window.infState && window.infState.data) {
            Object.values(window.infState.data).forEach(arr => {
                if (Array.isArray(arr) && arr[origIdx]) arr[origIdx]._isDeleteTarget = true;
            });
        }
    }
}, true);

// ★ 추가: 키보드 Delete 키를 눌렀을 때도 선택된 행이 붉은색으로 토글되도록 지원
document.addEventListener('keydown', function(e) {
    if (e.key === 'Delete') {
        // 현재 마우스가 올라가 있거나 포커스된 행을 타겟팅
        const activeTr = document.querySelector('.infTbodyGlobal tr:hover') || document.activeElement.closest('tr');
        if (!activeTr) return;

        const firstTd = activeTr.querySelector('td');
        if (!firstTd || firstTd.colSpan > 5) return;

        const origIdx = parseInt(firstTd.innerText) - 1;
        if (isNaN(origIdx)) return;

        e.preventDefault(); // 기본 브라우저 동작 방지

        if (activeTr.classList.contains('delete-target-row')) {
            activeTr.classList.remove('delete-target-row');
            activeTr.style.removeProperty('background-color');
            activeTr.title = "";
            
            if (window.infState && window.infState.data) {
                Object.values(window.infState.data).forEach(arr => {
                    if (Array.isArray(arr) && arr[origIdx]) arr[origIdx]._isDeleteTarget = false;
                });
            }
        } else {
            activeTr.classList.add('delete-target-row');
            activeTr.style.setProperty('background-color', '#ffe5e5', 'important');
            activeTr.title = "클릭하면 지우기 대상에서 제외(해제)됩니다.";
            
            if (window.infState && window.infState.data) {
                Object.values(window.infState.data).forEach(arr => {
                    if (Array.isArray(arr) && arr[origIdx]) arr[origIdx]._isDeleteTarget = true;
                });
            }
        }
    }
});