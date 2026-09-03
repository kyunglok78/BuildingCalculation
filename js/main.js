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
// [1] 전역 상태 관리 및 초기화
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
// [3] 평가 데이터 UI (탭 및 테이블 렌더링)
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
            
            const dispRemainRate = group.complexApplied ? `<span style="color:#d32f2f; font-weight:bold; font-size:13px;">${remainRate.toFixed(2)}%</span>` : `${remainRate.toFixed(2)}%`;

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
            <td colspan="2" style="text-align:center; vertical-align:middle;">${complexHtml}</td>
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
// [4] 가액 재계산 엔진 (복합구조 지원)
// ============================================================================
window.recalculateValuation = function(mode, siteName) {
    const evalYearInput = document.getElementById('evalYear');
    const evalYear = parseInt(evalYearInput ? evalYearInput.value : new Date().getFullYear());
    const siteData = window.kbState.evalData[mode][siteName];
    if(!siteData) return;
    const groups = Array.isArray(siteData) ? siteData : Object.values(siteData);

    groups.forEach(group => {
        let totRecoArch = 0, totCurArch = 0, sumArea = 0, sumWeight = 0;
        let configAreas = {}; 

        group.records.forEach(r => {
            const area = parseFloat(r.연면적) || 0;
            const yearlyDepr = parseFloat(r.감가율) || 1.78;
            const buildYear = parseInt(r.준공연도) || evalYear;
            const elapsed = Math.max(0, evalYear - buildYear);
            
            const configKey = `${yearlyDepr}_${buildYear}`;
            configAreas[configKey] = (configAreas[configKey] || 0) + area;

            let totalDepr = elapsed * yearlyDepr;
            const weight = (totalDepr / 100.0) * area; 

            sumArea += area; sumWeight += weight;
        });

        let maxConfigArea = 0;
        for (let key in configAreas) if (configAreas[key] > maxConfigArea) maxConfigArea = configAreas[key];
        const minorAreaRatio = sumArea > 0 ? (sumArea - maxConfigArea) / sumArea : 0;

        group.isComplex = (Object.keys(configAreas).length > 1 && sumArea > 0 && minorAreaRatio > 0.20);
        group.avgTotalDepr = sumArea > 0 ? (sumWeight / sumArea) * 100.0 : 0;

        group.records.forEach(r => {
            const compConstCost = (r.연면적 || 0) * (r.단가 || 0) * (r.물가지수 || 1.0);
            r.재조달_건축 = Math.floor(compConstCost / 1000) * 1000;
            const elapsed = Math.max(0, evalYear - (r.준공연도 || evalYear));
            
            if (group.complexApplied) {
                let appliedResidual = 100.0 - group.complexRate;
                if (appliedResidual < 30) appliedResidual = 30; 
                r.잔가율 = appliedResidual;
            } else {
                let residualRatio = 100.0 - (elapsed * (r.감가율 || 1.78));
                if (residualRatio < 30.0) residualRatio = 30.0; 
                r.잔가율 = residualRatio;
            }
            
            r.현재_건축 = Math.floor((r.재조달_건축 * (r.잔가율 / 100.0)) / 1000) * 1000;
            totRecoArch += r.재조달_건축; totCurArch += r.현재_건축;
        });

        const accRate = parseFloat(group.부속비율 !== undefined && group.부속비율 !== "" ? group.부속비율 : 20.0) / 100.0;
        group.재조달_부속 = Math.floor((totRecoArch * accRate) / 1000) * 1000;
        const repResidualRatio = group.complexApplied ? (Math.max(30, 100.0 - group.complexRate) / 100.0) : (group.records.length > 0 ? (group.records[0].잔가율 / 100.0) : 1.0);
        group.현재_부속 = Math.floor((group.재조달_부속 * repResidualRatio) / 1000) * 1000;
        group.재조달_합계 = totRecoArch + group.재조달_부속;
        group.현재_합계 = totCurArch + group.현재_부속;
    });
};

// ============================================================================
// [5] 인라인 편집 및 대장 데이터 연동
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
        if (field === '노무비' && window.applyAutoPriceIndex) window.applyAutoPriceIndex(targetObj);
        recalculateValuation(mode, siteName);
        renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
    };
    input.addEventListener('blur', saveValue);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { input.removeEventListener('blur', saveValue); saveValue(); } });
};

function addManualItem(mode) {
    const currentSite = window.kbState.activeSite[mode];
    if (!currentSite) return alert("선택된 사업장 탭이 없습니다.");

    const newGroup = {
        동명칭: "신규 추가항목", 부속비율: 20.0, 재조달_부속: 0, 현재_부속: 0, 재조달_합계: 0, 현재_합계: 0,
        records: [{ 일련번호: "수동", 동명칭: "신규 추가항목", 용도: "직접 입력", 연면적: 0, 구조명: "직접 입력", 준공연도: new Date().getFullYear(), 구조코드: "-", 단가: 0, 노무비: 0, 물가지수: 1.0, 감가율: 1.78, 재조달_건축: 0, 잔가율: 100, 현재_건축: 0 }]
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
    if (!fetchedData || Object.keys(fetchedData).length === 0) return alert("연동할 수 없습니다. 먼저 [건축물대장 조회시작]을 완료해 주세요.");
    if (Object.keys(window.kbState.evalData.title || {}).length > 0 && !confirm("기존에 작업 중이던 표제부 평가 데이터가 초기화됩니다. 계속하시겠습니까?")) return;
    
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
                "동명칭": dongNm, "부속비율": (area <= 300 && area > 0) ? 0.0 : 20.0, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0,
                "records": [{ "일련번호": String(idx + 1), "동명칭": dongNm, "용도": purps, "연면적": area, "구조명": strct, "준공연도": buildYear, "구조코드": "-", "단가": 0.0, "노무비": 0.0, "물가지수": 1.0, "감가율": 1.78, "재조달_건축": 0, "잔가율": 100.0, "현재_건축": 0 }]
            });
        });
        if (siteRecords.length > 0) newTitleData[siteName] = siteRecords;
    });
    window.kbState.evalData.title = newTitleData; window.kbState.activeSite.title = Object.keys(newTitleData)[0] || null;
    renderEvalTabsAndTable('title', 'tbodyTitleEval', 'tabsTitleEval');
    alert("표제부 데이터 연동이 완료되었습니다.\n(연면적 300㎡ 이하 건물은 부속비율이 0%로 자동 세팅되었습니다.)");
}

window.syncFloorData = function() {
    const fetchedData = window.kbState.fetchedData;
    if (!fetchedData || Object.keys(fetchedData).length === 0) return alert("연동할 수 없습니다. 먼저 [건축물대장 조회시작]을 완료해 주세요.");
    if (Object.keys(window.kbState.evalData.floor || {}).length > 0 && !confirm("기존에 작업 중이던 층별 평가 데이터가 초기화됩니다. 계속하시겠습니까?")) return;
    
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
            let d = (row["dongNm"] || "").trim(); if (!d || d === "-" || d === "nan") d = "본동";
            floorAreaMap[d] = (floorAreaMap[d] || 0) + (isNaN(parseFloat(String(row["area"] || "0").replace(/,/g, "").trim())) ? 0.0 : parseFloat(String(row["area"] || "0").replace(/,/g, "").trim()));
        });

        const titleRecords = window.kbState.evalData.title[siteName] || [];
        const siteGroups = {}; 
        
        dfFloor.forEach((row, idx) => {
            let dongNm = (row["dongNm"] || "").trim(); if (!dongNm || dongNm === "-" || dongNm === "nan") dongNm = "본동";
            const area = isNaN(parseFloat(String(row["area"] || "0").replace(/,/g, "").trim())) ? 0.0 : parseFloat(String(row["area"] || "0").replace(/,/g, "").trim());
            const flrText = (row["flrNoNm"] || "").trim() ? `${(row["flrGbCdNm"] || "").trim()} ${(row["flrNoNm"] || "").trim()}층` : "";
            const purps = flrText ? `[${flrText}] ${(row["etcPurps"] || "-").trim()}` : (row["etcPurps"] || "-").trim();
            
            let buildYear = fallbackYear;
            const rowAprDate = String(row["useAprDay"] || "").replace(/[-/]/g, "").trim();
            if (rowAprDate.length >= 4 && !isNaN(rowAprDate.substring(0, 4))) buildYear = parseInt(rowAprDate.substring(0, 4));
            
            const record = { "일련번호": String(idx + 1), "동명칭": dongNm, "용도": purps, "연면적": area, "구조명": (row["strctCdNm"] || "-").trim(), "준공연도": buildYear, "구조코드": "-", "단가": 0.0, "노무비": 0.0, "물가지수": 1.0, "감가율": 1.78, "재조달_건축": 0, "잔가율": 100.0, "현재_건축": 0 };
            let inheritedRatio = (floorAreaMap[dongNm] <= 300 && floorAreaMap[dongNm] > 0) ? 0.0 : 20.0; 
            
            const tGroup = titleRecords.find(g => g.동명칭 === dongNm);
            if (tGroup) {
                const tReq = tGroup.records[0];
                record["구조코드"] = tReq["구조코드"]; record["단가"] = tReq["단가"]; record["노무비"] = tReq["노무비"]; record["물가지수"] = tReq["물가지수"]; record["감가율"] = tReq["감가율"]; record["준공연도"] = tReq["준공연도"]; 
                if (tGroup["부속비율"] !== undefined) inheritedRatio = tGroup["부속비율"]; 
            }
            
            if (!siteGroups[dongNm]) siteGroups[dongNm] = { "동명칭": dongNm, "부속비율": inheritedRatio, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0, "records": [] };
            siteGroups[dongNm].records.push(record);
        });
        if (Object.keys(siteGroups).length > 0) newFloorData[siteName] = Object.values(siteGroups);
    });
    
    window.kbState.evalData.floor = newFloorData; window.kbState.activeSite.floor = Object.keys(newFloorData)[0] || null;
    Object.keys(newFloorData).forEach(siteName => recalculateValuation('floor', siteName));
    renderEvalTabsAndTable('floor', 'tbodyFloorEval', 'tabsFloorEval');
    alert("✅ 층별 데이터 연동 완료!\n\n(총면적 300㎡ 이하 건물은 부속비율 0%가 자동 적용되었습니다.)");
};

window.deleteEvalItem = function(mode, siteName, gIdx) {
    const siteData = window.kbState.evalData[mode][siteName];
    const targetName = Array.isArray(siteData) ? (siteData[gIdx].동명칭 || "선택항목") : Object.keys(siteData)[gIdx];
    if (!confirm(`[${targetName}] 평가 데이터를 완전히 삭제하시겠습니까?`)) return;
    if (Array.isArray(siteData)) siteData.splice(gIdx, 1); else delete siteData[Object.keys(siteData)[gIdx]]; 
    recalculateValuation(mode, siteName); renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
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
    thElement.closest('tr').querySelectorAll('th').forEach(th => { if(th.innerText.includes('동명칭')) th.innerText = !isRev ? '동명칭 ▲' : '동명칭 ▼'; });
    renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
};

// ============================================================================
// [6] 구조코드, 신축단가표, 물가지수 엑셀 연동 로직
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
                record['단가'] = matched['단가']; record['노무비'] = matched['노무비']; 
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
// [7] 표준 감가율 모달 연동
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
// [8] 프로젝트 파일 통합 저장 및 복구 (.kbproj)
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
            alert("저장할 데이터가 존재하지 않습니다. 대장 조회, 엑셀 업로드 등을 먼저 진행해 주세요."); return;
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
            sidebarStates[menu.id] = { className: menu.className, badgeHtml: badge ? badge.outerHTML : '' };
        });

        const projectData = {
            version: "2.3", contractor: contractorName, evalYear: evalYear, locations: locations, 
            sidebarStates: sidebarStates, 
            unitCostPath: document.getElementById('unitCostPath') ? document.getElementById('unitCostPath').value : "",
            priceIndexPath: document.getElementById('priceIndexPath') ? document.getElementById('priceIndexPath').value : "",
            tempKfpaDataStore: window.tempKfpaDataStore || {}, targetKfpaSite: window.targetKfpaSite || "", targetKfpaAddress: window.targetKfpaAddress || "",
            kbState: window.kbState, inflationSheets: window.kbState.inflationSheets || null,
            indexData: window.kbState.indexData || null, infState: window.infState || null,
            verifState: window.verifState // ★ 핵심: 검산 모듈 데이터 완벽 보존
        };

        const jsonString = JSON.stringify(projectData);
        if(!jsonString) throw new Error("JSON 변환 실패");

        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, "");
        a.download = `${contractorName || '통합가액평가'}_저장파일_${dateStr}.kbproj`;
        a.click(); URL.revokeObjectURL(url);
    } catch (e) { alert("저장 중 오류가 발생했습니다. 화면이 정상적인 상태인지 확인해주세요.\n(" + e.message + ")"); }
};

window.loadProject = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const projectData = JSON.parse(e.target.result, function(key, value) {
                if (value === null || String(value).toLowerCase() === "null" || String(value).toLowerCase() === "nan") return "";
                return value;
            });
            
            if (projectData.kbState) window.kbState = projectData.kbState;
            if (projectData.inflationSheets) window.kbState.inflationSheets = projectData.inflationSheets;
            if (projectData.indexData) window.kbState.indexData = projectData.indexData;
            
            // ★ 핵심: 검산 모듈 상태 완벽 복구
            if (projectData.verifState) window.verifState = projectData.verifState;
            
            if (projectData.tempKfpaDataStore) window.tempKfpaDataStore = projectData.tempKfpaDataStore; else window.tempKfpaDataStore = {};
            if (projectData.targetKfpaSite) window.targetKfpaSite = projectData.targetKfpaSite;
            if (projectData.targetKfpaAddress) window.targetKfpaAddress = projectData.targetKfpaAddress;

            if (projectData.contractor) document.querySelectorAll('.contractor-sync').forEach(el => el.value = projectData.contractor);
            if (projectData.evalYear) { const y = document.getElementById('evalYear'); if(y) y.value = projectData.evalYear; }
            if (projectData.unitCostPath) { const u = document.getElementById('unitCostPath'); if(u) u.value = projectData.unitCostPath; }
            if (projectData.priceIndexPath) { const p = document.getElementById('priceIndexPath'); if(p) p.value = projectData.priceIndexPath; }

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

            if (projectData.infState) {
                window.infState = projectData.infState;
                if (window.infState.data) {
                    for (const tab in window.infState.data) {
                        window.infState.data[tab].selectedRows = new Set();
                        window.infState.data[tab].selectedCols = new Set();
                    }
                }
                const modeRadios = document.querySelectorAll('input[name="infMode"]');
                if(modeRadios.length > 0) modeRadios.forEach(r => r.checked = (r.value === window.infState.mode));
                if (!window.infState.mappingRules) window.infState.mappingRules = JSON.parse(localStorage.getItem('kb_mapping_rules_v3')) || window.initialRules;
            }

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

            alert("✅ 가액평가 데이터가 완벽하게 복구되었습니다. 화면을 초기화합니다.");
            
            // ★ 핵심: 대장 데이터 및 검산 데이터 복구 후 화면 재렌더링 강제 실행
            if (window.kbState && window.kbState.fetchedData && Object.keys(window.kbState.fetchedData).length > 0) {
                const emptyMsg = document.getElementById('emptyStateMsg');
                const dataCont = document.getElementById('fetchedDataContainer');
                if (emptyMsg) emptyMsg.style.display = 'none';
                if (dataCont) dataCont.style.display = 'block';
                if (typeof window.renderSlide3Tabs === 'function') window.renderSlide3Tabs();
            }

            if (typeof runGroupedRenderTest === 'function') runGroupedRenderTest();
            if (typeof window.infInitTabs === 'function' && window.infState && window.infState.tabs && window.infState.tabs.length > 0) {
                window.infInitTabs(); if (typeof window.infRenderTable === 'function') window.infRenderTable();
            }
            if (typeof window.initVerificationScreen === 'function') window.initVerificationScreen();
            
            setTimeout(() => { if (typeof switchSection === 'function') switchSection('sec-1-1'); }, 100);
            
        } catch (err) { alert("⚠️ 파일 형식이 잘못되었거나 손상된 파일입니다.\n(에러 상세: " + err.message + ")"); }
    };
    reader.readAsText(file);
};

// ============================================================================
// [9] 화협(KFPA) 다중 사업장 바구니 보존 및 일괄 확정 로직 
// ============================================================================
window.targetKfpaSite = ""; window.targetKfpaAddress = "";
if (typeof window.tempKfpaDataStore === 'undefined') window.tempKfpaDataStore = {};

window.initKfpaScreen = function() {
    const tabsContainer = document.getElementById('slide6Tabs'); const infoPanel = document.getElementById('kfpaActiveInfoPanel');
    if(!tabsContainer) return; tabsContainer.innerHTML = '';
    
    const locations = [];
    document.querySelectorAll('#locationTbody tr').forEach(row => {
        const name = row.querySelector('.loc-name') ? row.querySelector('.loc-name').value.trim() : '';
        const addr = row.querySelector('.addr-input') ? row.querySelector('.addr-input').value.trim() : '';
        const checkedKfpa = row.querySelector('.chk-kfpa') ? row.querySelector('.chk-kfpa').checked : false;
        if(name && checkedKfpa) locations.push({name, addr});
    });

    if(locations.length === 0) {
        tabsContainer.innerHTML = '<div style="padding: 15px; color: #dc3545; font-weight: bold;">등록된 사업장이 없거나 화협자료평가 체크가 해제되어 있습니다. (1.1 일반정보 확인)</div>';
        infoPanel.style.display = 'none'; switchSection('sec-2-2-1'); return;
    }

    infoPanel.style.display = 'block'; let isFirst = true;
    locations.forEach(loc => {
        const tabBtn = document.createElement('div'); tabBtn.innerText = loc.name;
        tabBtn.style.cssText = `padding:10px 20px; cursor:pointer; font-weight:${isFirst ? 'bold' : 'normal'}; border:1px solid ${isFirst ? '#1C5691' : '#e2e8f0'}; border-bottom:none; border-radius:4px 4px 0 0; margin-right:5px; background:${isFirst ? '#1C5691' : '#f1f5f9'}; color:${isFirst ? '#ffffff' : '#94a3b8'};`;
        tabBtn.onclick = () => {
            Array.from(tabsContainer.children).forEach(c => { c.style.background = '#f1f5f9'; c.style.color = '#94a3b8'; c.style.fontWeight = 'normal'; c.style.borderColor = '#e2e8f0'; });
            tabBtn.style.background = '#1C5691'; tabBtn.style.color = '#ffffff'; tabBtn.style.fontWeight = 'bold'; tabBtn.style.borderColor = '#1C5691';
            document.getElementById('kfpaPreviewSite').value = loc.name; document.getElementById('kfpaPreviewAddress').value = loc.addr;
            window.targetKfpaSite = loc.name; window.targetKfpaAddress = loc.addr;
            if (typeof window.tempKfpaDataStore === 'undefined') window.tempKfpaDataStore = {};
            renderKfpaPreview(loc.name);
        };
        tabsContainer.appendChild(tabBtn);
        if (window.targetKfpaSite === loc.name || (isFirst && !window.targetKfpaSite)) { tabBtn.click(); isFirst = false; }
    });
    if (isFirst && tabsContainer.firstChild) tabsContainer.firstChild.click();
    switchSection('sec-2-2-1'); 
};

window.renderKfpaPreview = function(siteName) {
    const tbody = document.getElementById('previewKfpaTbody'); const btnConfirm = document.getElementById('btnConfirmKfpa');
    const records = window.tempKfpaDataStore[siteName];

    if(!records || records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 60px; color:#999; font-size:14px;"><i class="fa-regular fa-folder-open" style="font-size:30px; margin-bottom:10px; display:block;"></i>우측 상단의 <b>[해당 사업장 화협 엑셀 첨부]</b>를 눌러 데이터를 업로드해주세요.</td></tr>`;
        if(btnConfirm) btnConfirm.style.display = 'none'; return;
    }
    tbody.innerHTML = ''; let grandTotalArea = 0; const groups = {};
    records.forEach((r, origIdx) => {
        r._origIdx = origIdx; const gk = r.groupKey || "기타";
        if(!groups[gk]) groups[gk] = { items: [], subtotal: null };
        if(r.isSubtotal) groups[gk].subtotal = r; else groups[gk].items.push(r);
    });

    Object.keys(groups).forEach(gk => {
        const group = groups[gk]; let calcSum = 0;
        group.items.forEach(r => {
            calcSum += (parseFloat(r.연면적) || 0); grandTotalArea += (parseFloat(r.연면적) || 0);
            const displayArea = Number(r.연면적).toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2});
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:bold;">${r.일련번호}</td><td>${r.동번호}</td><td style="font-weight:bold; color:#1C5691;">${r.동명칭}</td>
                <td>${r.준공연도}</td><td>${r.층수}</td><td>${r.구조명}</td>
                <td style="text-align:right; padding: 0; position: relative;">
                    <input type="text" value="${displayArea}" style="width: 100%; box-sizing: border-box; text-align: right; border: 1px solid transparent; background: transparent; font-family: inherit; font-size: inherit; color: #333; outline: none; cursor: pointer; padding: 8px 10px; transition: 0.2s;" onfocus="this.style.borderBottom='2px solid #1C5691'; this.style.background='#fff'; this.value='${r.연면적}'; this.select();" onblur="this.style.borderBottom='1px solid transparent'; this.style.background='transparent';" onmouseover="if(document.activeElement !== this) this.style.background='#f1f5f9';" onmouseout="if(document.activeElement !== this) this.style.background='transparent';" onchange="window.updateKfpaArea('${siteName}', ${r._origIdx}, this.value)" title="클릭하여 면적 수정 (수정 후 엔터)">
                </td><td style="text-align:left;">${r.용도}</td>
            `;
            tbody.appendChild(tr);
        });
        if (group.subtotal || group.items.length > 0) {
            const officialSum = group.subtotal ? (parseFloat(group.subtotal.연면적) || 0) : calcSum;
            const diff = Math.abs(calcSum - officialSum); const isMismatch = group.subtotal && diff > 0.01; 
            const trSub = document.createElement('tr'); trSub.style.background = isMismatch ? '#ffe5e5' : '#e9ecef'; trSub.style.fontWeight = 'bold';
            const warningMsg = isMismatch ? `<span style="color:#d32f2f; font-size:13px; font-weight:bold; animation: blink 1.5s infinite;"><i class="fa-solid fa-triangle-exclamation"></i> 동면적을 확인하세요! (엑셀 원본 합계: ${officialSum.toLocaleString('ko-KR')}㎡ / 차이: ${diff.toFixed(2)}㎡)</span>` : '';
            trSub.innerHTML = `<td></td><td></td><td colspan="4" style="color:${isMismatch ? '#d32f2f' : '#1C5691'}; text-align:center;">동면적합계</td><td style="text-align:right; color:${isMismatch ? '#d32f2f' : '#1C5691'}; font-size:14px; padding-right: 10px;">${calcSum.toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td><td style="text-align:left;">${warningMsg}</td>`;
            tbody.appendChild(trSub);
        }
    });

    const totalTr = document.createElement('tr'); totalTr.style.background = '#cbd5e1'; totalTr.style.fontWeight = 'bold';
    totalTr.innerHTML = `<td colspan="6" style="text-align:center; color:#333;">${siteName} 사업장 총면적 합계</td><td style="text-align:right; color:#d32f2f; font-size:14px; padding-right: 10px;">${grandTotalArea.toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td><td></td>`;
    tbody.appendChild(totalTr);
    if(btnConfirm) btnConfirm.style.display = 'inline-block';
};

if (!document.getElementById('kfpaWarningStyle')) {
    const style = document.createElement('style'); style.id = 'kfpaWarningStyle'; style.innerHTML = `@keyframes blink { 50% { opacity: 0.5; } }`; document.head.appendChild(style);
}

window.loadKfpaExcel = function(event) {
    const file = event.target.files[0]; if(!file) return;
    const siteName = window.targetKfpaSite; if(!siteName) { alert("선택된 사업장 탭이 없습니다."); event.target.value = ''; return; }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result); const workbook = XLSX.read(data, {type: 'array'});
            const worksheet = workbook.Sheets[workbook.SheetNames[0]]; const jsonData = XLSX.utils.sheet_to_json(worksheet, {defval: ""});
            if(jsonData.length === 0) return alert("엑셀 파일에 데이터가 없습니다.");

            const headers = Object.keys(jsonData[0]); const getCol = (keywords) => headers.find(h => keywords.some(k => String(h).includes(k)));
            const colSerial = getCol(["일련번호"]); const colDongNo = getCol(["동번호"]); const colDongNm = getCol(["동명", "건물명"]);
            const colYear = getCol(["준공"]); const colFloor = getCol(["층", "층수"]); const colStrct = getCol(["건물구조", "구조코드", "구조"]);
            const colArea = getCol(["면적"]); const colPurps = getCol(["용도", "특기사항"]);

            if(!colArea) return alert("면적 데이터를 찾을 수 없습니다. 화협 양식을 확인해주세요.");

            const records = []; let lastDongNo = "-"; let lastDongNm = "본동"; let lastGroupKey = "1"; 
            jsonData.forEach((row, idx) => {
                let serial = String(row[colSerial] || "").trim(); let dNo = String(row[colDongNo] || "").trim(); let dNm = String(row[colDongNm] || "").trim();
                let isSubtotal = dNm.includes("합계") || dNm.includes("소계") || serial.includes("합계");
                let groupKey = serial.includes('-') ? serial.split('-')[0] : serial;
                if (serial && !isSubtotal) lastGroupKey = groupKey; else if (isSubtotal) groupKey = lastGroupKey;

                if(dNo && dNo !== "-" && dNo !== "undefined") lastDongNo = dNo;
                if(dNm && dNm !== "-" && dNm !== "undefined" && !isSubtotal) lastDongNm = dNm;
                if((!serial || serial === "-" || serial === "undefined") && !isSubtotal) return;

                let strctCode = String(row[colStrct] || "").trim(); let purps = String(row[colPurps] || "-").trim();
                let floorStr = String(row[colFloor] || "").trim();
                let area = parseFloat(String(row[colArea] || "0").replace(/,/g, '')); if(isNaN(area)) area = 0.0;

                let buildYear = new Date().getFullYear(); let yearStr = String(row[colYear] || "").replace(/[^0-9]/g, '');
                if(yearStr.length >= 4) buildYear = parseInt(yearStr.substring(0, 4));

                if(area > 0 || isSubtotal) {
                    records.push({ "일련번호": serial, "동번호": lastDongNo, "층수": floorStr, "동명칭": isSubtotal ? dNm : lastDongNm, "용도": purps, "연면적": area, "구조명": strctCode, "구조코드": strctCode, "준공연도": buildYear, "isSubtotal": isSubtotal, "groupKey": groupKey, "단가": 0.0, "노무비": 0.0, "물가지수": 1.0, "감가율": 1.78, "재조달_건축": 0, "잔가율": 100.0, "현재_건축": 0 });
                }
            });

            if(records.length === 0) return alert("유효한 화협 데이터(일련번호 및 면적 존재)를 찾을 수 없습니다.");
            if (typeof window.tempKfpaDataStore === 'undefined') window.tempKfpaDataStore = {};
            window.tempKfpaDataStore[siteName] = records; renderKfpaPreview(siteName); 
            alert(`✅ [${siteName}] 화협 엑셀 로드 완료!\n동면적 합계에 빨간색 경고가 뜬 항목이 있는지 확인 후 수정해주세요.`);
        } catch (err) { alert("파일 파싱 중 오류 발생: " + err); }
    };
    reader.readAsArrayBuffer(file); event.target.value = ''; 
};

window.confirmAllKfpaData = function() {
    if(!window.tempKfpaDataStore || Object.keys(window.tempKfpaDataStore).length === 0) return alert("반영할 데이터가 전혀 없습니다. 엑셀 파일을 먼저 업로드해주세요.");
    const sites = Object.keys(window.tempKfpaDataStore);
    if(!window.kbState.evalData.kfpa) window.kbState.evalData.kfpa = {};
    
    sites.forEach(siteName => {
        const records = window.tempKfpaDataStore[siteName].filter(r => !r.isSubtotal); 
        const titleRecords = window.kbState.evalData.title[siteName] || [];
        const siteGroups = {}; const groupAreaMap = {};
        
        records.forEach(r => {
            const fullSeq = r.일련번호 || r.동명칭 || ""; const groupKey = fullSeq.includes('-') ? fullSeq.split('-')[0] : fullSeq;
            groupAreaMap[groupKey] = (groupAreaMap[groupKey] || 0) + (parseFloat(r.연면적) || 0);
        });
        
        records.forEach(r => {
            let evalRecord = JSON.parse(JSON.stringify(r));
            if (evalRecord.구조코드 && evalRecord.구조코드 !== "-" && window.kbState.costData && window.kbState.costData.length > 0) {
                const cleanCode = String(evalRecord.구조코드).replace(/-/g, "");
                const matched = window.kbState.costData.find(row => { const allText = Object.values(row).map(v => String(v || "")).join(" ").toLowerCase(); return allText.includes(String(evalRecord.구조코드).toLowerCase()) || (cleanCode && allText.replace(/-/g, "").includes(cleanCode)); });
                if (matched) { evalRecord.구조명 = (matched['구조'] && matched['구조'] !== "-") ? matched['구조'] : matched['중분류']; evalRecord.단가 = matched['단가']; evalRecord.노무비 = matched['노무비']; if (window.applyAutoPriceIndex) window.applyAutoPriceIndex(evalRecord); }
            }

            const fullSeq = evalRecord.일련번호 || evalRecord.동명칭 || "";
            const groupKey = fullSeq.includes('-') ? fullSeq.split('-')[0] : fullSeq; const d = evalRecord.동명칭;
            let inheritedRatio = (groupAreaMap[groupKey] <= 300 && groupAreaMap[groupKey] > 0) ? 0.0 : 20.0;
            const tGroup = titleRecords.find(g => (g.동명칭 || "") === d); if (tGroup && tGroup.부속비율 !== undefined) inheritedRatio = tGroup.부속비율;

            if(!siteGroups[groupKey]) {
                const displayDongName = `[${groupKey}번 건물 그룹]`;
                siteGroups[groupKey] = { "동명칭": displayDongName, "일련번호": groupKey, "부속비율": inheritedRatio, "재조달_부속": 0, "재조달_합계": 0, "현재_부속": 0, "현재_합계": 0, "records": [] };
            }
            evalRecord.동명칭 = d; siteGroups[groupKey].records.push(evalRecord);
        });
        window.kbState.evalData.kfpa[siteName] = Object.values(siteGroups); recalculateValuation('kfpa', siteName); 
    });

    window.kbState.activeSite.kfpa = sites[0];
    if (typeof switchSection === 'function') switchSection('sec-2-2-2'); else if (typeof goToSlide === 'function') goToSlide('slide7');
    renderEvalTabsAndTable('kfpa', 'tbodyKfpaEval', 'tabsKfpaEval');
    alert(`🎉 화협자료가 [일련번호 앞자리]를 기준으로 완벽하게 통합 그룹화되었습니다!\n\n(그룹 전체 총면적 300㎡ 이하 건물은 부속비율 0%가 자동 적용되었습니다.)`);
};

// ============================================================================
// [10] 화협 연면적 실시간 수정 로직
// ============================================================================
window.updateKfpaArea = function(siteName, origIdx, newVal) {
    let val = parseFloat(String(newVal).replace(/,/g, '')); if(isNaN(val)) val = 0;
    if(window.tempKfpaDataStore && window.tempKfpaDataStore[siteName] && window.tempKfpaDataStore[siteName][origIdx]) {
        window.tempKfpaDataStore[siteName][origIdx].연면적 = val; window.renderKfpaPreview(siteName);
    }
};

// ============================================================================
// [11] 통합 총괄표(Summary Table) 렌더링 로직 
// ============================================================================
setTimeout(() => {
    document.querySelectorAll('.menu-l1, .menu-l2, .menu-l3').forEach(menu => {
        if (menu.innerText.includes('3. 총괄표 작성')) menu.onclick = function() { window.initSummaryScreen(); };
    });
}, 500);

window.initSummaryScreen = function() {
    goToSlide('slide8'); const firstTab = document.querySelector('#summaryTabs .summary-tab'); if (firstTab) renderSummary('title', firstTab); 
};

window.renderSummary = function(mode, tabElement) {
    if (tabElement) {
        document.querySelectorAll('#summaryTabs .summary-tab').forEach(t => { t.style.background = '#f8f9fa'; t.style.color = '#666'; t.style.borderColor = '#ddd'; t.style.fontWeight = 'normal'; });
        tabElement.style.background = '#fff'; tabElement.style.color = '#1C5691'; tabElement.style.borderColor = '#1C5691'; tabElement.style.fontWeight = 'bold';
    }

    const tbody = document.getElementById('tbodySummary'); tbody.innerHTML = '';
    const dataObj = window.kbState.evalData[mode];
    
    if (!dataObj || Object.keys(dataObj).length === 0) {
        let guideMsg = mode === 'title' ? "▶ [2.1.2 표제부 평가] 메뉴로 이동하여 <b>'표제부 데이터 연동하기'</b> 버튼을 눌러주세요." : mode === 'floor' ? "▶ [2.1.3 층별 평가] 메뉴로 이동하여 <b>'층별 데이터 연동하기'</b> 버튼을 눌러주세요." : "▶ [2.2.1 화협 불러오기] 메뉴에서 엑셀을 업로드하고 확정을 진행해 주세요.";
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 60px; color:#999; font-size:15px; line-height: 1.8;"><i class="fa-solid fa-triangle-exclamation" style="font-size:35px; margin-bottom:15px; display:block; color:#f39c12;"></i>${mode === 'title' ? '표제부' : mode === 'floor' ? '층별' : '화협자료'} 평가 데이터가 아직 없습니다.<br><span style="color:#d32f2f; font-weight:bold;">${guideMsg}</span></td></tr>`; return;
    }

    let grandTotalArea = 0, grandTotalReco = 0, grandTotalCur = 0;
    for (const [siteName, groups] of Object.entries(dataObj)) {
        let siteTotalArea = 0, siteTotalReco = 0, siteTotalCur = 0;
        const groupArray = Array.isArray(groups) ? groups : Object.values(groups);
        if (groupArray.length === 0) continue;

        let siteRowSpan = 0;
        groupArray.forEach(g => { const rCount = (g.records && g.records.length > 0) ? g.records.length : 1; siteRowSpan += (rCount + 2); });

        groupArray.forEach((group, gIdx) => {
            const records = group.records || []; const rCount = records.length > 0 ? records.length : 1; const dongRowSpan = rCount + 2;
            let groupArea = 0; records.forEach(r => groupArea += (parseFloat(r.연면적) || 0));
            const recoTotal = parseFloat(group.재조달_합계 || 0); const curTotal = parseFloat(group.현재_합계 || 0);
            const recoSub = parseFloat(group.재조달_부속 || 0); const curSub = parseFloat(group.현재_부속 || 0);
            siteTotalArea += groupArea; siteTotalReco += recoTotal; siteTotalCur += curTotal;

            const dongName = group.동명칭 || '-'; const accRate = parseFloat(group.부속비율 || 20.0).toFixed(1);
            const siteCellHtml = (gIdx === 0) ? `<td rowspan="${siteRowSpan}" style="vertical-align:middle; font-weight:bold; background:#ffffff !important; border-right:1px solid #ddd;">${siteName}</td>` : '';
            const dongCellHtml = `<td rowspan="${dongRowSpan}" style="vertical-align:middle; font-weight:bold; color:#1C5691; background:#ffffff !important; border-right:1px solid #ddd;">${dongName}</td>`;

            if (records.length === 0) {
                tbody.innerHTML += `<tr>${siteCellHtml} ${dongCellHtml}<td style="text-align:left; background:#ffffff !important;">세부항목 없음</td><td style="text-align:right; background:#ffffff !important;">0</td><td style="text-align:right; background:#ffffff !important;">0</td><td style="text-align:right; background:#ffffff !important;">0</td></tr>`;
            } else {
                records.forEach((r, rIdx) => {
                    const isFirstRecord = (rIdx === 0); const gubunText = r.용도 || '건축공사비';
                    tbody.innerHTML += `<tr>${isFirstRecord ? siteCellHtml : ''}${isFirstRecord ? dongCellHtml : ''}<td style="text-align:left; color:#444; background:#ffffff !important;">${gubunText}</td><td style="text-align:right; background:#ffffff !important;">${formatArea(r.연면적)}</td><td style="text-align:right; background:#ffffff !important;">${formatPrice(r.재조달_건축)}</td><td style="text-align:right; background:#ffffff !important;">${formatPrice(r.현재_건축)}</td></tr>`;
                });
            }
            tbody.innerHTML += `<tr><td style="text-align:left; color:#666; background:#f8f9fa !important;">└ 부속설비 (${accRate}%)</td><td style="text-align:right; color:#999; background:#f8f9fa !important;">-</td><td style="text-align:right; background:#f8f9fa !important;">${formatPrice(recoSub)}</td><td style="text-align:right; background:#f8f9fa !important;">${formatPrice(curSub)}</td></tr>`;
            tbody.innerHTML += `<tr style="font-weight:bold;"><td style="text-align:center; color:#111; background:#e2e8f0 !important;">[${dongName}] 소계</td><td style="text-align:right; background:#e2e8f0 !important;">${formatArea(groupArea)}</td><td style="text-align:right; color:#1C5691; background:#e2e8f0 !important;">${formatPrice(recoTotal)}</td><td style="text-align:right; color:#1C5691; background:#e2e8f0 !important;">${formatPrice(curTotal)}</td></tr>`;
        });
        grandTotalArea += siteTotalArea; grandTotalReco += siteTotalReco; grandTotalCur += siteTotalCur;
        tbody.innerHTML += `<tr style="font-weight:bold;"><td colspan="3" style="text-align:center; background:#cbd5e1 !important;">[${siteName}] 평가액 합계</td><td style="text-align:right; color:#d32f2f; background:#cbd5e1 !important;">${formatArea(siteTotalArea)}</td><td style="text-align:right; color:#d32f2f; background:#cbd5e1 !important;">${formatPrice(siteTotalReco)}</td><td style="text-align:right; color:#d32f2f; background:#cbd5e1 !important;">${formatPrice(siteTotalCur)}</td></tr>`;
    }

    if (Object.keys(dataObj).length > 1) { 
        tbody.innerHTML += `<tr style="font-weight:bold; font-size:15px;"><td colspan="3" style="text-align:center; color:#ffffff !important; background:#1C5691 !important;">전체 사업장 총 평가액</td><td style="text-align:right; color:#FFD700 !important; background:#1C5691 !important;">${formatArea(grandTotalArea)}</td><td style="text-align:right; color:#FFD700 !important; background:#1C5691 !important;">${formatPrice(grandTotalReco)}</td><td style="text-align:right; color:#FFD700 !important; background:#1C5691 !important;">${formatPrice(grandTotalCur)}</td></tr>`;
    }
};

window.exportSummaryExcel = function() {
    const table = document.getElementById('summaryTable');
    if(!table || table.rows.length <= 2) return alert("다운로드할 총괄표 데이터가 없습니다. 먼저 좌측 메뉴에서 평가를 완료해 주세요.");
    let activeTabName = "총괄표";
    document.querySelectorAll('#summaryTabs .summary-tab').forEach(tab => { if (tab.style.fontWeight === 'bold') activeTabName = tab.innerText; });
    try {
        const wb = XLSX.utils.table_to_book(table, {sheet: "가액평가_총괄표"});
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, "");
        XLSX.writeFile(wb, `KB손해보험_${activeTabName}_${dateStr}.xlsx`);
    } catch (error) { alert("엑셀 다운로드 중 오류가 발생했습니다.\n" + error.message); }
};

// ============================================================================
// [12] 보고서 생성 연동 UI
// ============================================================================
window.runReportGeneration = function() {
    const templatePath = document.getElementById('reportTemplatePath').value;
    const evalTypeSelect = document.getElementById('reportEvalType');
    const evalType = evalTypeSelect.options[evalTypeSelect.selectedIndex].text;
    const logBox = document.getElementById('reportLogBox');
    
    if (!templatePath) return alert("2번 항목에서 엑셀 보고서 양식(.xlsx) 파일을 첨부해 주세요.");
    
    logBox.value = "--- 보고서 생성을 시작합니다 ---\n";
    logBox.value += `[설정] 선택된 작성 기준: ${evalType}\n`;
    logBox.value += "[시스템] 현재 메모리에 적재된 평가 데이터를 취합 및 분석 중...\n";
    
    setTimeout(() => { logBox.value += "[성공] 표지 시트 작성 및 데이터 매핑 완료\n"; }, 800);
    setTimeout(() => { logBox.value += "[성공] 총괄표 생성 및 합산 금액 집계 완료\n"; }, 1500);
    setTimeout(() => {
        logBox.value += "[성공] 세부평가 시트 동적 서식 생성 (부속설비 로직 포함) 완료\n";
        logBox.value += "[성공] 불필요한 템플릿 시트 삭제 및 탭 정렬 완료\n>>> 작업이 성공적으로 완료되었습니다!\n";
        alert("보고서 생성이 완료되었습니다.\n(현재는 웹 UI 시뮬레이션이 작동 중이며, 실제 엑셀 파일 생성은 백엔드 서버 연동 후 다운로드됩니다.)");
    }, 2500);
};

// ============================================================================
// [13] 복합구조 가중평균 검산 모듈
// ============================================================================
window.currentComplexTarget = null;
window.openComplexModal = function(mode, siteName, gIdx) {
    const evalYearInput = document.getElementById('evalYear');
    const evalYear = parseInt(evalYearInput ? evalYearInput.value : new Date().getFullYear());
    const siteData = window.kbState.evalData[mode][siteName];
    const group = Array.isArray(siteData) ? siteData[gIdx] : siteData[Object.keys(siteData)[gIdx]];
    
    window.currentComplexTarget = { mode, siteName, gIdx, group };
    const tbody = document.getElementById('complexDeprTbody'); const tfoot = document.getElementById('complexDeprTfoot');
    tbody.innerHTML = ''; let sumArea = 0, sumWeight = 0;
    
    group.records.forEach(r => {
        const area = parseFloat(r.연면적) || 0; const yearlyDepr = parseFloat(r.감가율) || 1.78;
        const buildYear = parseInt(r.준공연도) || evalYear; const elapsed = Math.max(0, evalYear - buildYear);
        let totalDepr = elapsed * yearlyDepr; const weight = (totalDepr / 100.0) * area; 
        sumArea += area; sumWeight += weight;
        tbody.innerHTML += `<tr><td style="text-align:center;">${r.구조명 || '-'}</td><td style="text-align:center;">${r.용도 || '-'}</td><td style="text-align:center;">${yearlyDepr.toFixed(2)}%</td><td style="text-align:center;">${elapsed}년</td><td style="text-align:center; color:#d32f2f; font-weight:bold;">${totalDepr.toFixed(2)}%</td><td style="text-align:right;">${area.toLocaleString('ko-KR', {minimumFractionDigits:2})}</td><td style="text-align:right; color:#1C5691;">${weight.toLocaleString('ko-KR', {minimumFractionDigits:2})}</td></tr>`;
    });
    
    const avgDepr = sumArea > 0 ? (sumWeight / sumArea) * 100.0 : 0;
    tfoot.innerHTML = `
        <tr><td colspan="5" style="text-align:center;">합계 및 산출 과정</td><td style="text-align:right;">${sumArea.toLocaleString('ko-KR', {minimumFractionDigits:2})}</td><td style="text-align:right; color:#1C5691;">${sumWeight.toLocaleString('ko-KR', {minimumFractionDigits:2})}</td></tr>
        <tr style="background:#cbd5e1; font-size:15px; color:#d32f2f;"><td colspan="7" style="text-align:center; padding:15px; vertical-align:middle;">가중치 합계 (${sumWeight.toLocaleString('ko-KR', {maximumFractionDigits:2})}) ÷ 면적 합계 (${sumArea.toLocaleString('ko-KR', {maximumFractionDigits:2})}) × 100 = <b>가중평균 총감가율 ${avgDepr.toFixed(2)}%</b><button type="button" onclick="window.applyComplexDepr('${mode}', '${siteName}', ${gIdx}, ${avgDepr})" style="background:#d32f2f; color:white; border:none; padding:8px 20px; border-radius:4px; font-size:14px; font-weight:bold; margin-left:20px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2); transition:0.2s;"><i class="fa-solid fa-check-double"></i> 적용하기</button></td></tr>
    `;
    
    const oldApplyBtn = document.getElementById('btnApplyComplex'); if(oldApplyBtn) oldApplyBtn.parentElement.style.display = 'none';
    document.getElementById('complexDeprModal').style.display = 'flex';
};
window.closeComplexModal = function() { document.getElementById('complexDeprModal').style.display = 'none'; window.currentComplexTarget = null; };

window.applyComplexDepr = function(mode, siteName, gIdx, avgDepr) {
    const siteData = window.kbState.evalData[mode][siteName]; const group = Array.isArray(siteData) ? siteData[gIdx] : siteData[Object.keys(siteData)[gIdx]];
    group.complexApplied = true; group.complexRate = avgDepr; 
    window.recalculateValuation(mode, siteName); window.renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval'); window.closeComplexModal();
};

window.cancelComplexDepr = function(mode, siteName, gIdx) {
    if(confirm("일괄 적용된 복합구조 감가율을 해제하고 개별 감가율로 되돌리시겠습니까?")) {
        const siteData = window.kbState.evalData[mode][siteName]; const group = Array.isArray(siteData) ? siteData[gIdx] : siteData[Object.keys(siteData)[gIdx]];
        group.complexApplied = false; window.recalculateValuation(mode, siteName); window.renderEvalTabsAndTable(mode, 'tbody'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval', 'tabs'+mode.charAt(0).toUpperCase()+mode.slice(1)+'Eval');
    }
};

// ============================================================================
// [14] 스마트 행 삭제 복구 기능
// ============================================================================
window.resetRowDeletion = function() {
    if (!confirm("행 삭제 작업을 처음부터 다시 하시겠습니까?\n(열 매핑 정보는 그대로 유지되며, 지워졌던 행들이 다시 복구됩니다.)")) return;
    try {
        if (window.infState && window.infState.rawData && Object.keys(window.infState.rawData).length > 0) {
            window.infState.data = JSON.parse(JSON.stringify(window.infState.rawData));
            if (typeof window.infRenderTable === 'function') window.infRenderTable();
            alert("데이터가 복구되었습니다. 붉은색 패널의 도구를 이용해 추가적으로 행 삭제 작업을 진행해 주세요.");
        } else alert("복구할 원본 데이터가 없습니다. 엑셀 파일을 다시 불러와 주세요.");
    } catch (error) { console.error("행 삭제 되돌리기 오류:", error); }
};

// ============================================================================
// [15] 자산번호 원천 텍스트 변환 (렉 제로 & 콤마 영구 차단) 및 중앙 정렬
// ============================================================================
if (typeof window.infRenderTable === 'function' && !window.infRenderTable.isDataPatched) {
    const originalRender = window.infRenderTable;
    window.infRenderTable = function() {
        
        // 1. 메모리 데이터 조작: 시스템이 숫자로 인식하지 못하도록 '투명 글자' 삽입
        if (window.infState && window.infState.data) {
            for (let tab in window.infState.data) {
                window.infState.data[tab].forEach(row => {
                    ['자산번호', '신자산번호'].forEach(key => {
                        if (row[key] !== undefined && row[key] !== null) {
                            // 콤마를 제거한 뒤 눈에 보이지 않는 공백(\u200B)을 붙여 완벽한 문자로 위장
                            let safeStr = String(row[key]).replace(/,/g, '').replace(/\u200B/g, '').trim();
                            row[key] = safeStr + '\u200B'; 
                        }
                    });
                });
            }
        }

        // 2. 원래 표 그리기 실행 (이제 데이터가 텍스트라 시스템이 알아서 콤마를 안 찍음)
        originalRender.apply(this, arguments);
        
        // 3. 표가 다 그려진 후 딱 1번만 가운데 정렬 실행 (CCTV 철거 -> 렉 완전 해소)
        const thead = document.querySelector('.infTheadGlobal tr');
        const tbody = document.querySelector('.infTbodyGlobal');
        if (thead && tbody) {
            let assetColIdxs = [];
            thead.querySelectorAll('th, td').forEach((th, idx) => {
                if (th.innerText.replace(/\s/g, '').includes('자산번호')) assetColIdxs.push(idx);
            });

            if (assetColIdxs.length > 0) {
                // DOM 렌더링 속도 향상을 위해 잠깐 숨김
                tbody.style.display = 'none';
                tbody.querySelectorAll('tr').forEach(tr => {
                    const cells = tr.querySelectorAll('td');
                    assetColIdxs.forEach(idx => {
                        if (cells[idx]) {
                            // 텍스트 가운데 정렬 적용 및 혹시 모를 콤마 2차 제거
                            cells[idx].style.textAlign = 'center'; 
                            if (cells[idx].innerText.includes(',')) {
                                cells[idx].innerText = cells[idx].innerText.replace(/,/g, '');
                            }
                        }
                    });
                });
                tbody.style.display = '';
            }
        }
    };
    window.infRenderTable.isDataPatched = true;
}

// 4. [Delete] -> [Ctrl] + [-] 텍스트 실시간 강제 교체 (가벼운 주기 검사)
setInterval(() => {
    const step1Panel = document.getElementById('infStep1Panel');
    if (step1Panel && step1Panel.innerHTML.includes('[Delete] 키로 지우시고')) {
        step1Panel.innerHTML = step1Panel.innerHTML.replace(/\[Delete\] 키로 지우시고/g, "<b style='color:#dc3545;'>[Ctrl] + [-] (마이너스) 키</b>로 지우시고");
    }
}, 1000);

// ============================================================================
// [15] 자산번호 콤마 영구 삭제 & 중앙 정렬 (CCTV 철거 -> 렉 제로 후처리 방식)
// ============================================================================
if (typeof window.infRenderTable === 'function' && !window.infRenderTable.isDataPatchedFast) {
    const originalRender = window.infRenderTable;
    window.infRenderTable = function() {
        
        // 1. 메모리 데이터 문자열 강제 변환 (과거 데이터와 100% 매칭되도록 공백 제거)
        if (window.infState && window.infState.data) {
            for (let tab in window.infState.data) {
                window.infState.data[tab].forEach(row => {
                    ['자산번호', '신자산번호'].forEach(key => {
                        if (row[key] !== undefined && row[key] !== null) {
                            row[key] = String(row[key]).replace(/,/g, '').trim();
                        }
                    });
                });
            }
        }

        // 2. 원래 표 그리기 실행
        originalRender.apply(this, arguments);

        // 3. 다 그려진 직후 딱 1번만 콤마를 제거하고 CSS로 중앙 정렬 (무한루프 원천 차단)
        const thead = document.querySelector('.infTheadGlobal tr');
        const tbody = document.querySelector('.infTbodyGlobal');
        if (thead && tbody) {
            let assetColIdxs = [];
            thead.querySelectorAll('th, td').forEach((th, idx) => {
                if (th.innerText.replace(/\s/g, '').includes('자산번호')) assetColIdxs.push(idx);
            });

            if (assetColIdxs.length > 0) {
                // CSS 인젝션을 통한 번개같은 중앙 정렬 적용
                let styleTag = document.getElementById('fast-align-style');
                if (!styleTag) {
                    styleTag = document.createElement('style');
                    styleTag.id = 'fast-align-style';
                    document.head.appendChild(styleTag);
                }
                let alignStyles = '';
                assetColIdxs.forEach(idx => alignStyles += `.infTbodyGlobal tr td:nth-child(${idx + 1}) { text-align: center !important; } `);
                styleTag.innerHTML = alignStyles;

                // 콤마 텍스트 제거 (화면 당 딱 1번만 실행되어 렉 없음)
                tbody.querySelectorAll('tr').forEach(tr => {
                    const cells = tr.querySelectorAll('td');
                    assetColIdxs.forEach(idx => {
                        if (cells[idx] && cells[idx].innerText.includes(',')) {
                            cells[idx].innerText = cells[idx].innerText.replace(/,/g, '');
                        }
                    });
                });
            }
        }
    };
    window.infRenderTable.isDataPatchedFast = true;
}

// 4. [Delete] -> [Ctrl] + [-] 텍스트 실시간 강제 교체 (가벼운 주기 검사)
setInterval(() => {
    const step1Panel = document.getElementById('infStep1Panel');
    if (step1Panel && step1Panel.innerHTML.includes('[Delete] 키로 지우시고')) {
        step1Panel.innerHTML = step1Panel.innerHTML.replace(/\[Delete\] 키로 지우시고/g, "<b style='color:#dc3545;'>[Ctrl] + [-] (마이너스) 키</b>로 지우시고");
    }
}, 1000);

// ============================================================================
// [16] 전역 클릭 제어기 (열 매핑 렉 제로 CSS 인젝션 & 꼬임 방지 안전장치)
// ============================================================================
document.addEventListener('click', function(e) {
    // 1. 평가제외 버튼 자동 연동
    const btnExclude = e.target.closest('button');
    if (btnExclude && btnExclude.innerText.includes('평가 제외')) {
        setTimeout(() => { if(typeof window.excludeUnderTenThousand === 'function') window.excludeUnderTenThousand(true); }, 100);
    }
    
    // 2. 열(기둥) 매핑 시 무거운 로직 제거 및 뱃지 부유(Absolute) 처리
    const cell = e.target.closest('.infTheadGlobal th, .infTheadGlobal td');
    if (cell && window.infState && window.infState.wizard && window.infState.wizard.phase === 'mapping') {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();

        const targetName = window.infState.wizard.activeTarget;
        if (!targetName) { alert('먼저 상단에서 매핑할 파란색 버튼(예: 취득가액)을 선택하세요.'); return; }

        const tr = cell.closest('tr');
        const colIndex = Array.from(tr.children).indexOf(cell) - 1; // 행 번호 제외
        if (colIndex < 0) return;

        // 상태 저장
        if (!window.infState.wizard.mapped) window.infState.wizard.mapped = {};
        window.infState.wizard.mapped[targetName] = colIndex;
        const safeTargetName = targetName.replace(/[^a-zA-Z0-9가-힣]/g, '');

        // ★ 핵심: 표 레이아웃 재계산(Reflow) 완벽 차단을 위한 Absolute 뱃지 삽입
        document.querySelectorAll(`.badge-${safeTargetName}`).forEach(el => el.remove());
        
        const badge = document.createElement('span');
        badge.className = `badge-${safeTargetName}`;
        badge.innerText = `${targetName} ✓`;
        badge.style.cssText = "position:absolute; top:2px; right:2px; font-size:11px; color:white; background:#1C5691; border-radius:3px; padding:2px 5px; box-shadow:0 1px 3px rgba(0,0,0,0.3); z-index:10; white-space:nowrap; pointer-events:none;";
        
        cell.style.position = 'relative';
        cell.appendChild(badge);

        // CSS로 기둥 한 번에 색칠 (렉 제로)
        let styleTag = document.getElementById('fast-mapping-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'fast-mapping-style';
            document.head.appendChild(styleTag);
        }
        let newStyles = '';
        for (const [name, idx] of Object.entries(window.infState.wizard.mapped)) {
            newStyles += `.infTbodyGlobal tr td:nth-child(${idx + 2}) { background-color: #e6f2ff !important; } `;
        }
        styleTag.innerHTML = newStyles;

        // 기존 버튼 회색(완료) 처리
        const btn = Array.from(document.querySelectorAll('#infMappingButtons button')).find(b => b.innerText.replace('✓','').trim() === targetName);
        if (btn) {
            btn.innerText = `${targetName} ✓`;
            btn.style.cssText = 'background:#e2e8f0 !important; color:#64748b !important; border:2px solid #cbd5e1 !important; transform: none; box-shadow: none;'; 
        }

        // ★ 오지랖 방지 로직: 무조건 현재 위치보다 '뒤'에 있는 미매핑 항목만 찾음 (역주행 금지)
        const currentIndex = window.infState.wizard.columns.indexOf(targetName);
        let nextTarget = '';
        for (let i = currentIndex + 1; i < window.infState.wizard.columns.length; i++) {
            if (window.infState.wizard.mapped[window.infState.wizard.columns[i]] === undefined) {
                nextTarget = window.infState.wizard.columns[i];
                break;
            }
        }
        window.infState.wizard.activeTarget = nextTarget; 

        // 모든 버튼 기본 스타일 초기화 (완료된 것 제외)
        document.querySelectorAll('#infMappingButtons button').forEach(b => {
            if (!b.innerText.includes('✓')) {
                b.style.cssText = 'background: #ffffff !important; color: #333 !important; border: 1px solid #ccc !important; opacity: 1 !important; cursor: pointer;';
            }
        });

        // 다음 타겟을 매우 강렬하게(빨간색) 하이라이트하여 실수 방지
        if (window.infState.wizard.activeTarget) {
            const nextBtn = Array.from(document.querySelectorAll('#infMappingButtons button')).find(b => b.innerText.trim() === window.infState.wizard.activeTarget);
            if (nextBtn) {
                nextBtn.style.cssText = 'background:#d32f2f !important; color:white !important; border:2px solid #d32f2f !important; font-weight:bold !important; box-shadow:0 0 12px rgba(211,47,47,0.5); transform: scale(1.05); transition: 0.2s;';
            }
        }

        const finishBtn = document.getElementById('btnFinishMapping');
        if (finishBtn) finishBtn.style.display = 'inline-block';
        
        const textEl = document.getElementById('infWizardText');
        if (textEl) {
            if (window.infState.wizard.activeTarget) {
                textEl.innerHTML = `<span style="color:#28A745;">✅ [${targetName}] 매핑 완료! 이어서 <b style="color:#d32f2f;">[${window.infState.wizard.activeTarget}]</b> 열을 클릭해 주세요. (엑셀에 없는 항목이면 다른 버튼을 먼저 누르세요)</span>`;
            } else {
                textEl.innerHTML = '<span style="color:#28A745;">✅ 매핑이 끝났습니다! 우측의 [열 매핑 완료 ▶] 버튼을 눌러주세요.</span>';
            }
        }
    }
    
    // 3. 매핑 해제 시 오류 방지 (수동 타겟 지정 포함)
    const btnMap = e.target.closest('#infMappingButtons button');
    if (btnMap) {
        // 이미 완료된 버튼(✓)을 누르면 매핑 해제
        if (btnMap.innerText.includes('✓')) {
            e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();

            const targetName = btnMap.innerText.replace('✓', '').trim();
            if (window.infState && window.infState.wizard && window.infState.wizard.mapped) {
                delete window.infState.wizard.mapped[targetName];
            }
            
            const safeTargetName = targetName.replace(/[^a-zA-Z0-9가-힣]/g, '');
            document.querySelectorAll(`.badge-${safeTargetName}`).forEach(el => el.remove());
            
            let styleTag = document.getElementById('fast-mapping-style');
            if (styleTag && window.infState && window.infState.wizard && window.infState.wizard.mapped) {
                let newStyles = '';
                for (const [name, idx] of Object.entries(window.infState.wizard.mapped)) {
                    newStyles += `.infTbodyGlobal tr td:nth-child(${idx + 2}) { background-color: #e6f2ff !important; } `;
                }
                styleTag.innerHTML = newStyles;
            }

            btnMap.innerText = targetName; 
            window.infState.wizard.activeTarget = targetName;
        } else {
            // 안 된 버튼을 누르면 해당 버튼을 강제 타겟으로 지정 (오지랖 무시)
            window.infState.wizard.activeTarget = btnMap.innerText.trim();
        }

        // 전체 버튼 스타일 리셋 후 현재 타겟만 강렬하게 강조
        document.querySelectorAll('#infMappingButtons button').forEach(b => {
            if (!b.innerText.includes('✓')) {
                b.style.cssText = 'background: #ffffff !important; color: #333 !important; border: 1px solid #ccc !important; opacity: 1 !important; cursor: pointer; transform: none; box-shadow: none;';
            }
        });

        if (window.infState && window.infState.wizard && window.infState.wizard.activeTarget) {
            window.infState.wizard.phase = 'mapping'; 
            const activeBtn = Array.from(document.querySelectorAll('#infMappingButtons button')).find(b => b.innerText.trim() === window.infState.wizard.activeTarget);
            if(activeBtn) {
                activeBtn.style.cssText = 'background:#d32f2f !important; color:white !important; border:2px solid #d32f2f !important; font-weight:bold !important; box-shadow:0 0 12px rgba(211,47,47,0.5); transform: scale(1.05); transition: 0.2s;';
            }
        }
        
        const finishBtn = document.getElementById('btnFinishMapping');
        if (finishBtn) finishBtn.style.display = 'none';
        
        const textEl = document.getElementById('infWizardText');
        if (textEl) textEl.innerHTML = `🎯 현재 지정할 타겟은 <b style="color:#d32f2f;">[${window.infState.wizard.activeTarget}]</b> 입니다. 명세서에서 알맞은 기둥을 클릭하세요!`;
    }
}, true);


// ============================================================================
// [17] 초간단 명세서 행 즉시 삭제 (Ctrl + 마이너스)
// ============================================================================
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault(); 
        const activeTr = document.querySelector('.infTbodyGlobal tr:hover');
        if (!activeTr) return;
        const tbody = activeTr.closest('tbody');
        if (!tbody) return;
        
        const rowIndex = Array.from(tbody.children).indexOf(activeTr);
        if (!window.infState || !window.infState.data) return;
        let activeTab = window.infState.activeTab || Object.keys(window.infState.data)[0];
        if (!activeTab) return;

        const currentData = window.infState.data[activeTab];
        if (!currentData || !currentData[rowIndex]) return;
        const targetObj = currentData[rowIndex];

        const cacheKeys = ['data', 'rawData', 'displayData', 'filteredData'];
        cacheKeys.forEach(key => {
            if (window.infState[key] && Array.isArray(window.infState[key][activeTab])) {
                const arr = window.infState[key][activeTab];
                const exactIdx = arr.indexOf(targetObj); 
                if (exactIdx > -1) arr.splice(exactIdx, 1); 
            }
        });

        if (typeof window.infRenderTable === 'function') window.infRenderTable();
        else activeTr.remove(); 
    }
});
window.highlightEmptyRows = function() { alert("Ctrl + 마이너스(-) 단축키를 이용해 직접 즉시 삭제해주세요!"); };
window.bulkDeleteHighlightedRows = function() { alert("Ctrl + 마이너스(-) 단축키를 이용해 직접 즉시 삭제해주세요!"); };

// ============================================================================
// [18] 과거 데이터 연동 마법사 모달창 지원 (2.3.2 자산 구분 및 예외 처리용 정밀 매칭)
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const step2_1 = document.getElementById('step-2-1');
        if (step2_1) step2_1.onclick = function() { document.getElementById('pastDataModal').style.display = 'flex'; };
    }, 1000);
});

window.pastMappingTemp = { data: null, filename: "" };

window.handlePastDataUpload = function(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    if (type === 'excel') {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                
                window.pastMappingTemp.data = workbook;
                window.pastMappingTemp.filename = file.name;

                // 기존 모달 닫기 및 새 정밀 매핑 모달 띄우기
                const pastModal = document.getElementById('pastDataModal');
                if (pastModal) pastModal.style.display = 'none';
                window.showPastExcelMappingWizard(workbook);

            } catch(err) {
                alert("과거 엑셀 파싱 중 오류가 발생했습니다.\n(" + err.message + ")");
            }
        };
        reader.readAsArrayBuffer(file);
    } else if (type === 'kbproj') {
        // 기존 kbproj 연동 로직
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const projData = JSON.parse(e.target.result);
                alert(`[프로젝트 파일 연동 시작]\n데이터 크기: ${Object.keys(projData).length}건\n\n(프로젝트 파싱 로직 실행 대기 중)`);
            } catch(err) { alert("프로젝트 파일을 읽는 중 오류가 발생했습니다."); }
        };
        reader.readAsText(file);
    }
    event.target.value = '';
};

window.showPastExcelMappingWizard = function(workbook) {
    let mapModal = document.getElementById('pastExcelWizardModal');
    if (!mapModal) {
        const modalHtml = `
        <div class="modal-overlay" id="pastExcelWizardModal" style="display:flex; z-index: 1060; justify-content: center; align-items: center;">
            <div class="modal-content" style="width: 500px; background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <div class="modal-header" style="background:#1C5691; color:white; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold;"><i class="fa-solid fa-file-excel"></i> 2.3.2 과거 엑셀 데이터 정밀 매핑</span>
                    <i class="fa-solid fa-xmark" style="cursor:pointer;" onclick="document.getElementById('pastExcelWizardModal').style.display='none'"></i>
                </div>
                <div class="modal-body" style="padding: 20px; background:#f8f9fa;">
                    <div style="background:#fff; padding:15px; border:1px solid #ddd; border-radius:4px;">
                        <label style="font-weight:bold; font-size:13px; display:block; margin-bottom:5px;">① 데이터가 있는 시트 선택</label>
                        <select id="pastExcelSheet" class="input-box" style="width:100%; padding:8px; margin-bottom:15px; border:1px solid #ccc; background:#f0fdf4;" onchange="window.updatePastExcelCols()"></select>
                        
                        <label style="font-weight:bold; font-size:13px; display:block; margin-bottom:5px;">② 매칭 기준 열 (예: 자산번호 H열)</label>
                        <select id="pastExcelKeyCol" class="input-box" style="width:100%; padding:8px; margin-bottom:15px; border:2px solid #1C5691;"></select>
                        
                        <label style="font-weight:bold; font-size:13px; display:block; margin-bottom:5px;">③ 적용할 '구분(계정)' 열 (예: 구분 AG열)</label>
                        <select id="pastExcelValCol" class="input-box" style="width:100%; padding:8px; margin-bottom:15px; border:2px solid #28a745;"></select>
                    </div>
                    <div style="text-align:right; margin-top:15px;">
                        <button type="button" class="btn-dark" style="background:#1C5691; border:none; padding:10px 20px; font-weight:bold;" onclick="window.applyPastExcelMapping()">⚡ 데이터 연동 실행</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        mapModal = document.getElementById('pastExcelWizardModal');
    } else {
        mapModal.style.display = 'flex';
    }

    const sheetSelect = document.getElementById('pastExcelSheet');
    sheetSelect.innerHTML = '';
    workbook.SheetNames.forEach(name => {
        sheetSelect.innerHTML += `<option value="${name}">${name}</option>`;
    });

    window.updatePastExcelCols();
};

window.updatePastExcelCols = function() {
    const sheetName = document.getElementById('pastExcelSheet').value;
    const workbook = window.pastMappingTemp.data;
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ""});
    
    const keyColSelect = document.getElementById('pastExcelKeyCol');
    const valColSelect = document.getElementById('pastExcelValCol');
    keyColSelect.innerHTML = ''; valColSelect.innerHTML = '';

    let maxCols = 0;
    json.forEach(r => { if(r.length > maxCols) maxCols = r.length; });
    for (let i = 0; i < maxCols; i++) {
        let letter = String.fromCharCode(65 + (i % 26));
        if (i >= 26) letter = String.fromCharCode(64 + Math.floor(i / 26)) + letter;
        const optionHtml = `<option value="${i}">${letter} 열 (${i+1})</option>`;
        keyColSelect.innerHTML += optionHtml;
        valColSelect.innerHTML += optionHtml;
    }
    
    // 엘티정밀 파일 기준 자동 세팅 (자산번호 H열=7, 구분 AG열=32)
    if (maxCols >= 33) {
        keyColSelect.value = "7";
        valColSelect.value = "32";
    }
};

window.applyPastExcelMapping = function() {
    const sheetName = document.getElementById('pastExcelSheet').value;
    const keyColIdx = parseInt(document.getElementById('pastExcelKeyCol').value);
    const valColIdx = parseInt(document.getElementById('pastExcelValCol').value);

    const workbook = window.pastMappingTemp.data;
    const worksheet = workbook.Sheets[sheetName];
    // 헤더 병합 이슈를 무시하기 위해 순수 배열로 직접 파싱
    const rawData = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ""});

    if (!window.infState || !window.infState.data) return alert("현재 명세서 데이터가 없습니다. 먼저 명세서를 업로드하세요.");

    let matchCount = 0;
    const pastMap = new Map();

    // 1. 과거 데이터를 Map으로 변환 (불순물 완벽 세척)
    rawData.forEach(row => {
        const rawKey = String(row[keyColIdx] || '');
        const rawVal = String(row[valColIdx] || '');
        
        // ★ 핵심: 보이지 않는 투명 글자(\u200B), 공백, 콤마 완벽 제거 및 대문자 통일
        const cleanKey = rawKey.replace(/[\u200B\s,]/g, '').trim().toUpperCase();
        const cleanVal = rawVal.trim();

        // 헤더 행이 아닌 실제 데이터만 적재
        if (cleanKey && cleanVal && cleanVal !== '-' && !cleanKey.includes('자산번호')) {
            pastMap.set(cleanKey, cleanVal);
        }
    });

    // 2. 현재 데이터에 1:1 매칭
    for (const tabName in window.infState.data) {
        const currentTabRows = window.infState.data[tabName];
        
        currentTabRows.forEach(row => {
            // 현재 명세서의 자산번호 추출 (마법사 매핑 또는 기본 객체 키 사용)
            const rawCurrentKey = String(row['자산번호'] || row['신자산번호'] || '');
            
            // ★ 핵심: 현재 데이터도 똑같이 완벽 세척하여 매칭률 100% 보장
            const cleanCurrentKey = rawCurrentKey.replace(/[\u200B\s,]/g, '').trim().toUpperCase();

            if (cleanCurrentKey && pastMap.has(cleanCurrentKey)) {
                const matchedClass = pastMap.get(cleanCurrentKey);
                row['_assetClass'] = matchedClass; // 시스템 내부 분류 변수
                row['구분'] = matchedClass; // 화면 표출용
                matchCount++;
            }
        });
    }

    document.getElementById('pastExcelWizardModal').style.display = 'none';
    
    // 화면 재렌더링
    if (typeof window.infRenderTable === 'function') window.infRenderTable();
    
    if (matchCount > 0) {
        alert(`🎉 과거 데이터 연동 성공!\n총 ${matchCount}건의 자산이 텍스트 클리닝을 거쳐 완벽하게 매칭 및 분류되었습니다.`);
    } else {
        alert(`⚠️ 매칭된 자산이 없습니다.\n- 선택하신 기둥(열)이 맞는지 확인해주세요.\n- 현재 명세서와 과거 엑셀의 자산번호가 서로 다른 체계일 수 있습니다.`);
    }
};

// ============================================================================
// [19] 1만원 이하 소액 자산 일괄 평가제외 처리기
// ============================================================================
window.excludeUnderTenThousand = function(silent = false) {
    if (!window.infState || !window.infState.data) return;
    let activeTab = window.infState.activeTab || Object.keys(window.infState.data)[0];
    if (!activeTab) return;

    let count = 0;
    window.infState.data[activeTab].forEach(row => {
        let priceStr = String(row['취득가액'] || '').replace(/,/g, '').trim();
        if (priceStr === '' || priceStr === '-') return;
        let price = parseFloat(priceStr);
        if (!isNaN(price) && price <= 10000) {
            row['_assetClass'] = '평가제외(만원이하)'; 
            row['구분'] = '평가제외(만원이하)';
            count++;
        }
    });

    if (typeof window.infRenderTable === 'function') window.infRenderTable();
    if (!silent && count > 0) alert(`🎉 총 ${count}건의 소액 자산이 '평가제외' 처리되었습니다!`);
};

// ============================================================================
// [20] 표 실시간 검색 기능 (디바운싱 적용 - 검색 렉 제로)
// ============================================================================
let searchTimeout = null;
window.filterInfTable = function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { 
        const keyword = document.getElementById('infTableSearchInput').value.toLowerCase().trim();
        const tbody = document.querySelector('.page-section.active .infTbodyGlobal') || document.querySelector('.infTbodyGlobal');
        if (!tbody) return;
        tbody.style.display = 'none'; // DOM 최적화
        tbody.querySelectorAll('tr').forEach(tr => {
            tr.style.display = tr.innerText.toLowerCase().includes(keyword) ? '' : 'none';
        });
        tbody.style.display = '';
    }, 300); 
};

// ============================================================================
// [부록] 표준 감가율 기준표 렌더링 및 탭 전환 모듈 (누락분 복구 및 자동 표출 추가)
// ============================================================================

// 1. 표준 감가율 참고표 원본 데이터베이스 (건물, 구축물, 업종, 공기구)
window.DEPR_REF_DATA = {
    sheets: {
        1: {
            title: "1. 건물 감가율",
            headers: ["구조/재질", "용도 분류", "내용연수(년)", "감가율(%)"],
            rows: [
                ["철골·철근콘크리트조", "일반건물 (우기 이외)", "75", "1.07"],
                ["철골·철근콘크리트조", "공장, 창고", "75", "1.40"],
                ["철골·철근콘크리트조", "변전소, 발전소 등 특수건물", "75", "2.11"],
                ["철골조 / 석조 / 연와석조", "일반건물 (우기 이외)", "60", "1.33"],
                ["철골조 / 석조 / 연와석조", "공장, 창고", "60", "1.78"],
                ["철골조 / 석조 / 연와석조", "변전소, 발전소 등 특수건물", "60", "2.67"],
                ["콘크리트조 / 연와조 / 블록조", "일반건물 (우기 이외)", "50", "1.60"],
                ["콘크리트조 / 연와조 / 블록조", "공장, 창고", "50", "2.11"],
                ["경량철골조 / 단열판넬조", "일반건물 (우기 이외)", "40", "2.00"],
                ["경량철골조 / 단열판넬조", "공장, 창고", "40", "2.67"],
                ["토조 / 토벽조 / 목골몰탈조", "일반건물 (우기 이외)", "30", "2.67"]
            ]
        },
        2: {
            title: "2. 구축물 감가율",
            headers: ["구축물 분류명", "세부 내용", "내용연수(년)", "감가율(%)"],
            rows: [
                ["구조물 (축조물)", "콘크리트조, 연와조 구축물", "40", "2.00"],
                ["구조물 (축조물)", "철골조, 금속조 구축물", "30", "2.67"],
                ["굴뚝", "연와조, 콘크리트조 굴뚝", "30", "2.67"],
                ["정화조 / 배관시설", "오폐수 처리 및 배관 설비", "20", "4.00"],
                ["야외 시설물", "담장, 포장, 가도로 등", "15", "5.33"],
                ["저수지 / 수조", "철근콘크리트 저수조", "40", "2.00"]
            ]
        },
        3: {
            title: "3. 업종 감가율 (전체)",
            headers: ["업종명 / 자산분류", "세부 설명", "내용연수(년)", "감가율(%)"],
            rows: [
                ["제조업 전반", "기계장치 및 부속설비", "15", "5.33"],
                ["화학 및 섬유공업", "부식성 가스/약품 취급 설비", "10", "8.00"],
                ["금속제련업", "고열/중량물 취급 기계장치", "12", "6.67"],
                ["식음료품 제조업", "일반 가공 및 포장 기계", "10", "8.00"],
                ["창고 및 운수업", "하역 및 물류 자동화 설비", "12", "6.67"],
                ["전기 및 가스업", "발전 및 송배전 설비", "20", "4.00"]
            ]
        },
        4: {
            title: "4. 공기구 감가율",
            headers: ["공기구/기구 품목", "적용 대상", "내용연수(년)", "감가율(%)"],
            rows: [
                ["측정기기 / 시험기", "품질 관리 및 연구실험용 기기", "5", "16.00"],
                ["공구 및 기구", "일반 공장용 수공구 및 치공구", "5", "16.00"],
                ["사무용 비품", "책상, 의자, 캐비닛 등", "8", "10.00"],
                ["전산 소모기기", "PC, 프린터, 서버 장비", "4", "20.00"],
                ["차량운반구", "업무용 승용 및 화물 차량", "4", "20.00"]
            ]
        }
    },
    currentTab: 1
};

// 2. 탭 전환 함수 (클릭 시 해당 표 데이터를 HTML로 빌드)
window.switchDeprRefTab = function(tabIdx) {
    window.DEPR_REF_DATA.currentTab = tabIdx;
    
    // 버튼 active 스타일 갱신
    const buttons = document.querySelectorAll('#deprRefTabs .ref-tab-btn');
    buttons.forEach((btn, idx) => {
        if (idx === (tabIdx - 1)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const sheetData = window.DEPR_REF_DATA.sheets[tabIdx];
    if (!sheetData) return;

    // 헤더 그리기
    const thead = document.getElementById('deprRefThead');
    if (thead) {
        let hHtml = "<tr>";
        sheetData.headers.forEach(h => {
            hHtml += `<th style="text-align:center; padding:8px; border:1px solid #ccc; background:#e9ecef; font-weight:bold;">${h}</th>`;
        });
        hHtml += "</tr>";
        thead.innerHTML = hHtml;
    }

    // 바디 그리기
    const tbody = document.getElementById('deprRefTbody');
    if (tbody) {
        let bHtml = "";
        sheetData.rows.forEach((row, rIdx) => {
            const bg = rIdx % 2 === 0 ? "#fff" : "#f9f9fa";
            bHtml += `<tr style="background:${bg}; cursor:pointer;" onmouseover="this.style.background='#e6f2ff'" onmouseout="this.style.background='${bg}'">`;
            row.forEach((cell, cIdx) => {
                const align = cIdx >= 2 ? "center" : "left";
                const color = cIdx === 3 ? "color:#d32f2f; font-weight:bold;" : "color:#333;";
                bHtml += `<td style="text-align:${align}; padding:8px 10px; border:1px solid #eee; ${color}">${cell}</td>`;
            });
            bHtml += "</tr>";
        });
        tbody.innerHTML = bHtml;
    }
};

// 3. 실시간 검색 필터링 함수
window.filterDeprRefTable = function() {
    const input = document.getElementById('deprRefSearchInput');
    if (!input) return;
    const keyword = input.value.toLowerCase().trim();
    
    const tbody = document.getElementById('deprRefTbody');
    if (!tbody) return;
    
    const trs = tbody.querySelectorAll('tr');
    trs.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        if (text.includes(keyword)) {
            tr.classList.remove('depr-row-hide');
        } else {
            tr.classList.add('depr-row-hide');
        }
    });
};

// ============================================================================
// ★ [추가] 표가 비어있는 현상을 해결하는 자동 렌더링(표출) 실행 트리거
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    // 브라우저 로딩 시 백그라운드에서 1번 탭(건물 감가율)을 미리 그려둡니다.
    setTimeout(function() {
        if (typeof window.switchDeprRefTab === 'function' && document.getElementById('deprRefThead')) {
            window.switchDeprRefTab(1);
        }
    }, 800);
});

document.addEventListener('click', function(e) {
    // 사용자가 '감가율 일괄지정(팝업)' 버튼을 누르는 순간 1번 탭을 강제로 한 번 더 확실하게 표출시킵니다.
    const btn = e.target.closest('button');
    if (btn && btn.innerText.includes('감가율 일괄지정')) {
        setTimeout(function() {
            if (typeof window.switchDeprRefTab === 'function') {
                window.switchDeprRefTab(1);
            }
        }, 50);
    }
});

// ============================================================================
// [섹션 10] 3.1 가액평가 데이터 검산 및 무결성 종합 비교 모듈 (상단 포커스 뷰 드릴다운 탑재)
// ============================================================================

window.verifState = {
    pastData: {},    
    currentData: {}, 
    reasons: {},     
    totalAcqOriginal: 0,
    totalAcqCurrent: 0,
    tempParsed: {},  
    customOrder: [], 
    currentView: '전체 합산', 
    siteMapping: {},     
    buildingSource: {},
    preparedSiteData: {} // 포커스 뷰 출력을 위한 계산 완료 데이터 보관소
};

// 중복 모달 강제 제거
const oldVerifModal = document.getElementById('verifPastModal'); if (oldVerifModal) oldVerifModal.remove();
const oldMapModal = document.getElementById('verifSiteMappingModal'); if (oldMapModal) oldMapModal.remove();

(function initVerifModule() {
    // 1. 과거 데이터 연동 마법사 모달
    if (!document.getElementById('verifPastModal')) {
        const modalHtml = `
        <div class="modal-overlay" id="verifPastModal" style="display:none; z-index: 1050; justify-content: center; align-items: center;">
            <div class="modal-content" style="width: 650px; max-width: 95%; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <div class="modal-header" style="background:#28a745; color:white; padding:15px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight:bold;"><i class="fa-solid fa-link"></i> 과거 데이터 스마트 매핑 마법사</span>
                    <i class="fa-solid fa-xmark modal-close" style="cursor:pointer; font-size:18px;" onclick="document.getElementById('verifPastModal').style.display='none'"></i>
                </div>
                <div class="modal-body" style="padding: 25px; background:#f4f5f7;">
                    <div style="background:#fff; padding:15px; border:1px solid #ddd; border-radius:4px; margin-bottom:15px;">
                        <label style="font-weight:bold; font-size:14px; color:#333; display:block; margin-bottom:10px;">① 과거 데이터 엑셀 양식 선택</label>
                        <div style="display:flex; gap:15px; margin-bottom:15px; padding:10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:4px;">
                            <label style="cursor:pointer; font-weight:bold; color:#166534;"><input type="radio" name="verifPastType" value="single" checked onchange="window.updateVerifPastHeaders()"> 단일 시트 (사업장 구분 열 지정)</label>
                            <label style="cursor:pointer; font-weight:bold; color:#1C5691;"><input type="radio" name="verifPastType" value="multi" onchange="window.updateVerifPastHeaders()"> 다중 시트 (시트명=소재지명 자동매칭)</label>
                        </div>
                        <div id="verifSingleSheetWrap">
                            <label style="font-weight:bold; font-size:13px; color:#333; display:block; margin-bottom:5px;">② 작업할 시트 선택 (단일 시트용)</label>
                            <select id="verifPastSheet" class="input-box" style="width:100%; padding:8px; border:1px solid #ccc; margin-bottom: 15px; background:#f8f9fa;" onchange="window.updateVerifPastHeaders(true)"></select>
                        </div>
                        <label style="font-weight:bold; font-size:14px; color:#333; display:block; margin-bottom:10px; border-top:1px dashed #ccc; padding-top:15px;">③ 추출할 데이터 열(기둥) 지정</label>
                        <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                            <div style="flex: 1 1 30%;" id="verifColLocWrap">
                                <label style="font-weight:bold; font-size:13px; color:#d32f2f; display:block; margin-bottom:5px;">[선택] 소재지 구분 열</label>
                                <select id="verifColLoc" class="input-box" style="width:100%; padding:8px; border:1px solid #f5c6cb; background:#fff3f3;"></select>
                            </div>
                            <div style="flex: 1 1 30%;">
                                <label style="font-weight:bold; font-size:13px; color:#1C5691; display:block; margin-bottom:5px;">자산계정 열</label>
                                <select id="verifColAcc" class="input-box" style="width:100%; padding:8px; border:2px solid #1C5691;"></select>
                            </div>
                            <div style="flex: 1 1 30%;">
                                <label style="font-weight:bold; font-size:13px; color:#333; display:block; margin-bottom:5px;">취득가액 열</label>
                                <select id="verifColAcq" class="input-box" style="width:100%; padding:8px; border:1px solid #ccc;"></select>
                            </div>
                            <div style="flex: 1 1 30%;">
                                <label style="font-weight:bold; font-size:13px; color:#333; display:block; margin-bottom:5px;">재조달가액 열</label>
                                <select id="verifColRep" class="input-box" style="width:100%; padding:8px; border:1px solid #ccc;"></select>
                            </div>
                            <div style="flex: 1 1 30%;">
                                <label style="font-weight:bold; font-size:13px; color:#333; display:block; margin-bottom:5px;">현재가액 열</label>
                                <select id="verifColCur" class="input-box" style="width:100%; padding:8px; border:1px solid #ccc;"></select>
                            </div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <button type="button" class="btn-dark" style="background:#28a745; padding:10px 25px; border:none; font-weight:bold;" onclick="window.applyVerifPastMapping()">⚡ 연동 확정 및 검산 실행</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // 2. 명세서 미등록 소재지 병합 보드
    if (!document.getElementById('verifSiteMappingModal')) {
        const mapModal = `
        <div class="modal-overlay" id="verifSiteMappingModal" style="display:none; z-index: 1050; justify-content: center; align-items: center;">
            <div class="modal-content" style="width: 550px; max-width: 95%; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <div class="modal-header" style="background:#6f42c1; color:white; padding:15px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight:bold;"><i class="fa-solid fa-code-branch"></i> 명세서 미등록 소재지 병합 보드</span>
                    <i class="fa-solid fa-xmark modal-close" style="cursor:pointer;" onclick="document.getElementById('verifSiteMappingModal').style.display='none'"></i>
                </div>
                <div class="modal-body" style="padding: 20px; background:#f4f5f7;">
                    <p style="font-size:13px; color:#555; margin-bottom:15px;">
                        명세서에 존재하는 텍스트 중, <b>[1.1 일반정보]에 미등록된 이름</b>들입니다.<br>
                        어느 공장의 자산으로 편입시켜 검산할지 짝지어주세요.
                    </p>
                    <div style="max-height:300px; overflow-y:auto; border:1px solid #ccc;">
                        <table class="data-table" style="margin:0; background:#fff;">
                            <thead style="background:#eee;"><tr><th>명세서 상의 미등록 이름</th><th>편입시킬 기준 사업장</th></tr></thead>
                            <tbody id="verifSiteMappingTbody"></tbody>
                        </table>
                    </div>
                    <div style="text-align: right; margin-top:15px;">
                        <button type="button" class="btn-dark" style="background:#6f42c1; padding:8px 20px; border:none; font-weight:bold;" onclick="window.applySiteMapping()">⚡ 병합 확정 및 재계산</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', mapModal);
    }
})();

document.addEventListener("DOMContentLoaded", () => {
    const menu3_1 = document.getElementById('nav-sec-3-1');
    if (menu3_1) {
        menu3_1.addEventListener('click', () => {
            setTimeout(() => { window.initVerificationScreen(); }, 200);
        });
    }
});

window.initVerificationScreen = function() {
    window.verifState.currentData = { '전체 합산': {} };
    if(!window.verifState.pastData) window.verifState.pastData = { '전체 합산': {} };
    if(!window.verifState.reasons) window.verifState.reasons = { '전체 합산': {} };
    if(!window.verifState.siteMapping) window.verifState.siteMapping = {};
    if(!window.verifState.buildingSource) window.verifState.buildingSource = {};
    if(!window.verifState.preparedSiteData) window.verifState.preparedSiteData = {};
    
    window.verifState.totalAcqOriginal = 0;
    window.verifState.totalAcqCurrent = 0;

    const locInputs = document.querySelectorAll('#locationTbody tr');
    const locationsConfig = [];
    locInputs.forEach(row => {
        const name = row.querySelector('.loc-name') ? row.querySelector('.loc-name').value.trim() : '';
        if (name) {
            locationsConfig.push({
                name: name,
                ledger: row.querySelector('.chk-ledger') ? row.querySelector('.chk-ledger').checked : false,
                kfpa: row.querySelector('.chk-kfpa') ? row.querySelector('.chk-kfpa').checked : false
            });
        }
    });
    const registeredLocations = locationsConfig.map(l => l.name);

    registeredLocations.forEach(loc => {
        window.verifState.currentData[loc] = {};
        if(!window.verifState.pastData[loc]) window.verifState.pastData[loc] = {};
        if(!window.verifState.reasons[loc]) window.verifState.reasons[loc] = {};
    });

    const step2Tbody = document.getElementById('verifStep2Tbody');
    if (step2Tbody) {
        step2Tbody.innerHTML = '';
        locationsConfig.forEach(loc => {
            let defaultSource = window.verifState.buildingSource[loc.name];
            let selectHtml = '';
            
            if (loc.ledger && loc.kfpa) {
                if(!defaultSource || defaultSource === 'none') defaultSource = 'title';
                selectHtml = `<select onchange="window.verifState.buildingSource['${loc.name}'] = this.value; window.renderVerificationTable();" style="padding:4px; font-weight:bold; color:#1C5691; border:1px solid #ccc; width:100%;">
                    <option value="title" ${defaultSource==='title'?'selected':''}>표제부 기준 적용</option>
                    <option value="floor" ${defaultSource==='floor'?'selected':''}>층별 기준 적용</option>
                    <option value="kfpa" ${defaultSource==='kfpa'?'selected':''}>화협 기준 적용</option>
                </select>`;
            } else if (loc.ledger) {
                if(!defaultSource || defaultSource === 'kfpa' || defaultSource === 'none') defaultSource = 'title';
                selectHtml = `<select onchange="window.verifState.buildingSource['${loc.name}'] = this.value; window.renderVerificationTable();" style="padding:4px; font-weight:bold; color:#1C5691; border:1px solid #ccc; width:100%;">
                    <option value="title" ${defaultSource==='title'?'selected':''}>표제부 기준 적용</option>
                    <option value="floor" ${defaultSource==='floor'?'selected':''}>층별 기준 적용</option>
                </select>`;
            } else if (loc.kfpa) {
                defaultSource = 'kfpa';
                selectHtml = `<span style="color:#d32f2f; font-weight:bold;">화협 기준 (단일)</span>`;
            } else {
                defaultSource = 'none';
                selectHtml = `<span style="color:#999;">건물 평가 대상 아님</span>`;
            }
            window.verifState.buildingSource[loc.name] = defaultSource;

            step2Tbody.innerHTML += `
                <tr style="background:#fff; border-bottom:1px solid #eee;">
                    <td style="text-align:center; font-weight:bold; color:#333;">${loc.name}</td>
                    <td style="text-align:center;">${loc.ledger ? '<span style="color:#28a745; font-weight:bold;">O</span>' : '<span style="color:#dc3545;">X</span>'}</td>
                    <td style="text-align:center;">${loc.kfpa ? '<span style="color:#28a745; font-weight:bold;">O</span>' : '<span style="color:#dc3545;">X</span>'}</td>
                    <td style="text-align:center;">${selectHtml}</td>
                </tr>
            `;
        });
    }

    const wiz = window.infState && window.infState.wizard ? window.infState.wizard.mapped : {};
    const locColIdx = wiz['소재지'];
    
    if (window.infState && window.infState.data) {
        for (const tabName in window.infState.data) {
            const raw = window.infState.data[tabName].raw || window.infState.data[tabName] || [];
            const accIdx = wiz['자산계정']; const priceIdx = wiz['취득가액'];
            const mappedColCount = Object.keys(wiz).length;
            const finalClassIdx = mappedColCount + 4; const repIdx = mappedColCount + 6; const curIdx = mappedColCount + 9;

            if (accIdx === undefined || priceIdx === undefined) continue;

            raw.forEach(row => {
                const yearVal = String(row[wiz['취득년도']] || '');
                if (yearVal.includes('소계') || yearVal.includes('총계')) return;

                let acqVal = Number(String(row[priceIdx] || '').replace(/,/g, '')) || 0;
                let repVal = Number(String(row[repIdx] || '').replace(/,/g, '')) || 0;
                let curVal = Number(String(row[curIdx] || '').replace(/,/g, '')) || 0;
                
                const accName = String(row[accIdx] || '').trim();
                const finalClass = String(row[finalClassIdx] || '').trim();

                window.verifState.totalAcqOriginal += acqVal;
                window.verifState.totalAcqCurrent += acqVal;

                if (accName && !finalClass.includes('평가제외(만원이하)')) {
                    if (finalClass.includes('평가제외')) { repVal = 0; curVal = acqVal; } 
                    else if (finalClass.includes('부보제외')) { repVal = 0; curVal = 0; }

                    let rawSiteName = tabName;
                    if (locColIdx !== undefined) {
                        const val = String(row[locColIdx] || '').trim();
                        if (val && val !== '-' && val !== '소계' && val !== '총계') rawSiteName = val;
                    }

                    let targetSite = window.verifState.siteMapping[rawSiteName] || rawSiteName;
                    if (!registeredLocations.includes(targetSite)) targetSite = '전체 합산'; 

                    if (!window.verifState.currentData['전체 합산'][accName]) window.verifState.currentData['전체 합산'][accName] = { acq: 0, rep: 0, cur: 0 };
                    window.verifState.currentData['전체 합산'][accName].acq += acqVal;
                    window.verifState.currentData['전체 합산'][accName].rep += repVal;
                    window.verifState.currentData['전체 합산'][accName].cur += curVal;

                    if (targetSite !== '전체 합산' && window.verifState.currentData[targetSite]) {
                        if (!window.verifState.currentData[targetSite][accName]) window.verifState.currentData[targetSite][accName] = { acq: 0, rep: 0, cur: 0 };
                        window.verifState.currentData[targetSite][accName].acq += acqVal;
                        window.verifState.currentData[targetSite][accName].rep += repVal;
                        window.verifState.currentData[targetSite][accName].cur += curVal;
                    }
                }
            });
        }
    }

    const acqOrigEl = document.getElementById('verifOrigAcq'); const acqCurEl = document.getElementById('verifCurAcq'); const badgeEl = document.getElementById('verifBadge');
    if (acqOrigEl && acqCurEl && badgeEl) {
        acqOrigEl.innerText = window.verifState.totalAcqOriginal.toLocaleString('ko-KR') + ' 원';
        acqCurEl.innerText = window.verifState.totalAcqCurrent.toLocaleString('ko-KR') + ' 원';
        if (window.verifState.totalAcqOriginal > 0 && window.verifState.totalAcqOriginal === window.verifState.totalAcqCurrent) {
            badgeEl.innerHTML = "✅ 검증 PASS (일치)"; badgeEl.style.cssText = "background: #d4edda; color: #155724; border: 1px solid #c3e6cb;";
        } else if (window.verifState.totalAcqOriginal > 0) {
            const diff = window.verifState.totalAcqOriginal - window.verifState.totalAcqCurrent;
            badgeEl.innerHTML = `❌ 검증 FAIL (차액: ${diff.toLocaleString('ko-KR')})`; badgeEl.style.cssText = "background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;";
        } else {
            badgeEl.innerText = "데이터 대기중"; badgeEl.style.cssText = "background: #eee; color: #999; border: none;";
        }
    }

    window.renderVerificationTable();
};

window.openSiteMappingModal = function() {
    const locInputs = document.querySelectorAll('#locationTbody .loc-name');
    const registeredLocations = Array.from(locInputs).map(input => input.value.trim()).filter(Boolean);
    const tbody = document.getElementById('verifSiteMappingTbody');
    tbody.innerHTML = '';

    let unregSet = new Set();
    
    if (window.infState && window.infState.data) {
        const wiz = window.infState.wizard ? window.infState.wizard.mapped : {};
        const locIdx = wiz['소재지'];
        
        for (const tabName in window.infState.data) {
            unregSet.add(tabName); 
            if (locIdx !== undefined) {
                const raw = window.infState.data[tabName].raw || window.infState.data[tabName] || [];
                raw.forEach(row => {
                    const val = String(row[locIdx] || '').trim();
                    if (val && val !== '-' && val !== '소계' && val !== '총계') unregSet.add(val);
                });
            }
        }
    }

    let hasUnregistered = false;
    unregSet.forEach(siteName => {
        if (!registeredLocations.includes(siteName) && siteName !== '통합자산명세서' && siteName !== '명세서') {
            hasUnregistered = true;
            let selectHtml = `<select data-site="${siteName}" class="input-box map-site-select" style="width:100%; padding:4px;">
                <option value="">-- 분배 안 함 (전체 합산에만 포함) --</option>`;
            registeredLocations.forEach(loc => {
                const isSelected = window.verifState.siteMapping[siteName] === loc ? 'selected' : '';
                selectHtml += `<option value="${loc}" ${isSelected}>${loc} (으)로 편입</option>`;
            });
            selectHtml += `</select>`;

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight:bold; color:#d32f2f; padding:8px;">${siteName}</td>
                    <td style="padding:8px;">${selectHtml}</td>
                </tr>
            `;
        }
    });

    if (!hasUnregistered) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:30px; color:#666;">명세서 원본에 존재하는 미등록 사업장(텍스트)이 없습니다.<br>(모두 1.1에 정상적으로 일치합니다.)</td></tr>`;
    }
    document.getElementById('verifSiteMappingModal').style.display = 'flex';
};

window.applySiteMapping = function() {
    document.querySelectorAll('.map-site-select').forEach(sel => {
        if (sel.value) window.verifState.siteMapping[sel.dataset.site] = sel.value;
        else delete window.verifState.siteMapping[sel.dataset.site]; 
    });
    document.getElementById('verifSiteMappingModal').style.display = 'none';
    window.initVerificationScreen();
    alert("명세서 소재지 병합이 적용되었습니다. 검산표를 확인하세요.");
};

window.moveAccountOrder = function(idx, direction) {
    const arr = window.verifState.customOrder;
    if (direction === -1 && idx > 0) [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
    else if (direction === 1 && idx < arr.length - 1) [arr[idx+1], arr[idx]] = [arr[idx], arr[idx+1]];
    window.renderVerificationTable();
};

window.updateVerifReason = function(site, accName, val) {
    if (!window.verifState.reasons[site]) window.verifState.reasons[site] = {};
    window.verifState.reasons[site][accName] = val;
};

// ★ 핵심: 상단 포커스 뷰 (드릴다운) 표출 함수
window.showFocusView = function(accName) {
    const container = document.getElementById('verifFocusContainer');
    const row = document.getElementById('verifFocusRow');
    if (!container || !row) return;

    // 이미 열려있는 자산을 다시 누르면 닫기 기능
    if (row.style.display === 'table-row' && container.dataset.acc === accName) {
        row.style.display = 'none';
        container.dataset.acc = '';
        document.querySelectorAll('.grand-row').forEach(tr => tr.style.background = '#fff');
        return;
    }

    container.dataset.acc = accName;
    const locInputs = document.querySelectorAll('#locationTbody .loc-name');
    const registeredLocations = Array.from(locInputs).map(input => input.value.trim()).filter(Boolean);

    let html = `
        <div style="padding: 15px 25px; border: 2px solid #007bff; border-radius: 6px; margin: 15px; background: #fff; box-shadow: 0 4px 15px rgba(0,123,255,0.15);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
                <h4 style="margin:0; color:#007bff; font-weight:900; font-size:16px;">
                    <i class="fa-solid fa-magnifying-glass-location"></i> [${accName}] 사업장별 세부 합산 내역
                </h4>
                <button type="button" style="background:none; border:none; font-size:20px; color:#999; cursor:pointer;" onclick="document.getElementById('verifFocusRow').style.display='none'; document.querySelectorAll('.grand-row').forEach(tr => tr.style.background = '#fff');">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <table class="data-table" style="margin:0; width:100%;">
                <thead style="background:#f4f8fb;">
                    <tr>
                        <th style="color:#1C5691;">소재지명</th>
                        <th style="color:#666;">과거 취득가액</th>
                        <th style="color:#666;">과거 현재가액</th>
                        <th style="color:#1C5691;">당해 취득가액</th>
                        <th style="color:#1C5691;">당해 재조달가액</th>
                        <th style="color:#1C5691;">당해 현재가액</th>
                        <th style="color:#d32f2f;">현재 증감률</th>
                    </tr>
                </thead>
                <tbody>
    `;

    let hasValidData = false;
    registeredLocations.forEach(site => {
        let sitePast = window.verifState.pastData[site] && window.verifState.pastData[site][accName] ? window.verifState.pastData[site][accName] : {acq:0, rep:0, cur:0};
        // 계산 완료된 preparedSiteData에서 가져옴 (건물 값 자동반영 완료 상태)
        let siteCurr = window.verifState.preparedSiteData[site] && window.verifState.preparedSiteData[site][accName] ? window.verifState.preparedSiteData[site][accName] : {acq:0, rep:0, cur:0};

        if (sitePast.acq === 0 && sitePast.cur === 0 && siteCurr.acq === 0 && siteCurr.cur === 0) return;
        hasValidData = true;

        const calcRatio = (b, a) => {
            if (a === 0 && b === 0) return "-";
            if (a === 0 && b > 0) return "신규";
            return ((b / a) * 100).toFixed(1) + "%";
        };
        const rCur = calcRatio(siteCurr.cur, sitePast.cur);
        const getStyle = (ratioStr) => {
            if (ratioStr === "신규") return "color: #0c5460; font-weight: bold;";
            if (ratioStr === "-") return "color: #999;";
            const val = parseFloat(ratioStr.replace('%', ''));
            if (val >= 110) return "color: #d32f2f; font-weight: bold;";
            if (val <= 90) return "color: #0056b3; font-weight: bold;";
            return "color: #333;";
        };

        html += `
            <tr style="background:#fff; border-bottom:1px solid #eee;">
                <td style="text-align:center; font-weight:bold; color:#555;">${site}</td>
                <td style="text-align:right; color:#888;">${sitePast.acq === 0 ? '-' : sitePast.acq.toLocaleString('ko-KR')}</td>
                <td style="text-align:right; color:#888;">${sitePast.cur === 0 ? '-' : sitePast.cur.toLocaleString('ko-KR')}</td>
                <td style="text-align:right; color:#1C5691;">${siteCurr.acq === 0 ? '-' : siteCurr.acq.toLocaleString('ko-KR')}</td>
                <td style="text-align:right; color:#1C5691;">${siteCurr.rep === 0 ? '-' : siteCurr.rep.toLocaleString('ko-KR')}</td>
                <td style="text-align:right; color:#1C5691; font-weight:900;">${siteCurr.cur === 0 ? '-' : siteCurr.cur.toLocaleString('ko-KR')}</td>
                <td style="text-align:center; ${getStyle(rCur)}">${rCur}</td>
            </tr>
        `;
    });

    if (!hasValidData) {
        html += `<tr><td colspan="7" style="text-align:center; padding:30px; color:#999;">해당 자산의 사업장별 세부 데이터가 없습니다.</td></tr>`;
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;
    row.style.display = 'table-row';
    
    // 클릭된 행 하이라이트 표시
    document.querySelectorAll('.grand-row').forEach(tr => tr.style.background = '#fff');
    const activeTr = document.getElementById('grand_row_' + accName);
    if (activeTr) activeTr.style.background = '#e6f2ff';
};

window.renderVerificationTable = function() {
    const tbody = document.getElementById('verifTbody');
    if (!tbody) return;

    // 1. 메모리에 저장된 데이터 복제본 준비
    const currentDataClone = JSON.parse(JSON.stringify(window.verifState.currentData || {}));
    const pastDataClone = window.verifState.pastData || {};
    const reasonDataClone = window.verifState.reasons || {};

    const locInputs = document.querySelectorAll('#locationTbody .loc-name');
    const registeredLocations = Array.from(locInputs).map(input => input.value.trim()).filter(Boolean);

    // 2. 사업장별 설정된 대장 원천(표제부/화협)에서 '건물' 평가액 도출 및 계산 완료 데이터 보관소에 저장
    const preparedSiteData = {};
    let grandLedgerRep = 0, grandLedgerCur = 0;

    registeredLocations.forEach(site => {
        preparedSiteData[site] = JSON.parse(JSON.stringify(currentDataClone[site] || {}));
        const sourceMode = window.verifState.buildingSource[site];
        
        if (sourceMode && sourceMode !== 'none' && window.kbState.evalData[sourceMode] && window.kbState.evalData[sourceMode][site]) {
            let siteRep = 0, siteCur = 0;
            const siteGroups = window.kbState.evalData[sourceMode][site];
            const groups = Array.isArray(siteGroups) ? siteGroups : Object.values(siteGroups);
            groups.forEach(g => {
                siteRep += (parseFloat(g.재조달_합계) || 0);
                siteCur += (parseFloat(g.현재_합계) || 0);
            });
            
            if (!preparedSiteData[site]['건물']) preparedSiteData[site]['건물'] = { acq: 0, rep: 0, cur: 0 };
            preparedSiteData[site]['건물'].rep += siteRep;
            preparedSiteData[site]['건물'].cur += siteCur;

            grandLedgerRep += siteRep;
            grandLedgerCur += siteCur;
        }
    });
    
    // 포커스 뷰에서 즉시 꺼내 쓸 수 있도록 전역 보관
    window.verifState.preparedSiteData = preparedSiteData;

    // 전체 합산 데이터에 건물값 더하기
    if (!currentDataClone['전체 합산']) currentDataClone['전체 합산'] = {};
    if (!currentDataClone['전체 합산']['건물']) currentDataClone['전체 합산']['건물'] = { acq: 0, rep: 0, cur: 0 };
    currentDataClone['전체 합산']['건물'].rep += grandLedgerRep;
    currentDataClone['전체 합산']['건물'].cur += grandLedgerCur;

    // 3. 자산계정 목록 취합 및 정렬 상태 업데이트
    let allAccountsSet = new Set();
    Object.keys(currentDataClone['전체 합산']).forEach(acc => allAccountsSet.add(acc));
    Object.keys(pastDataClone['전체 합산'] || {}).forEach(acc => allAccountsSet.add(acc));
    
    const allAccounts = Array.from(allAccountsSet);
    if (allAccounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 60px; color:#999;">데이터가 존재하지 않습니다.</td></tr>`;
        return;
    }

    if (!window.verifState.customOrder) window.verifState.customOrder = [];
    allAccounts.forEach(acc => { if (!window.verifState.customOrder.includes(acc)) window.verifState.customOrder.push(acc); });
    window.verifState.customOrder = window.verifState.customOrder.filter(acc => allAccounts.includes(acc));

    // 유틸리티 함수
    const calcRatio = (b, a) => {
        if (a === 0 && b === 0) return "-";
        if (a === 0 && b > 0) return "신규";
        return ((b / a) * 100).toFixed(1) + "%";
    };

    const getStyle = (ratioStr) => {
        if (ratioStr === "신규") return "background: #d1ecf1; color: #0c5460; font-weight: bold;";
        if (ratioStr === "-") return "color: #999;";
        const val = parseFloat(ratioStr.replace('%', ''));
        if (val >= 110) return "background: #fff3cd; color: #856404; font-weight: bold;";
        if (val <= 90) return "background: #f8d7da; color: #721c24; font-weight: bold;";
        return "color: #333;";
    };

    // =========================================================
    // 상단 포커스 뷰 (드릴다운 컨테이너) 및 전체 합산 표 렌더링
    // =========================================================
    tbody.innerHTML = `
        <tr id="verifFocusRow" style="display:none; background:#f8f9fa;">
            <td colspan="11" id="verifFocusContainer" style="padding:0; border-bottom: 3px solid #007bff;"></td>
        </tr>
        <tr>
            <td colspan="11" style="background:#2C2C2C; font-weight:bold; font-size:16px; color:#FFCC00; text-align:left; padding:15px 20px;">
                <i class="fa-solid fa-globe"></i> 전체 사업장 총계 뷰 (자산 클릭 시 상단에 공장별 내역 표출)
            </td>
        </tr>
    `;
    
    const grandData = currentDataClone['전체 합산'] || {};
    const grandPast = pastDataClone['전체 합산'] || {};
    const grandReason = reasonDataClone['전체 합산'] || {};

    let grandTotPast = { acq: 0, rep: 0, cur: 0 };
    let grandTotCur  = { acq: 0, rep: 0, cur: 0 };

    window.verifState.customOrder.forEach((acc, idx) => {
        const past = grandPast[acc] || { acq: 0, rep: 0, cur: 0 };
        const curr = grandData[acc] || { acq: 0, rep: 0, cur: 0 };

        grandTotPast.acq += past.acq; grandTotPast.rep += past.rep; grandTotPast.cur += past.cur;
        grandTotCur.acq += curr.acq;  grandTotCur.rep += curr.rep;  grandTotCur.cur += curr.cur;

        const rAcq = calcRatio(curr.acq, past.acq); const rRep = calcRatio(curr.rep, past.rep); const rCur = calcRatio(curr.cur, past.cur);
        const savedReason = grandReason[acc] || '';

        const arrowUp = idx > 0 ? `<span style="cursor:pointer; color:#999; margin-right:5px; font-size:11px;" onclick="event.stopPropagation(); window.moveAccountOrder(${idx}, -1)" title="위로">▲</span>` : `<span style="display:inline-block; width:13px; margin-right:5px;"></span>`;
        const arrowDown = idx < window.verifState.customOrder.length - 1 ? `<span style="cursor:pointer; color:#999; margin-left:5px; font-size:11px;" onclick="event.stopPropagation(); window.moveAccountOrder(${idx}, 1)" title="아래로">▼</span>` : `<span style="display:inline-block; width:13px; margin-left:5px;"></span>`;

        // 메인 행 (클릭 시 드릴다운)
        tbody.innerHTML += `
            <tr id="grand_row_${acc}" class="grand-row" style="background: #fff; border-bottom: 2px solid #eee; cursor:pointer; transition: 0.2s;" title="클릭하여 공장별 세부내역 보기" onclick="window.showFocusView('${acc}')" onmouseover="if(this.style.background!=='rgb(230, 242, 255)') this.style.background='#f1f5f9';" onmouseout="if(this.style.background!=='rgb(230, 242, 255)') this.style.background='#fff';">
                <td style="text-align: center; font-weight: bold; color: #111; border-right: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center;">
                    ${arrowUp}
                    <span style="flex: 1; text-align: center;"><i class="fa-solid fa-magnifying-glass" style="color:#007bff; font-size:12px; margin-right:4px;"></i> ${acc}</span>
                    ${arrowDown}
                </td>
                <td style="text-align: right; color: #666;">${past.acq === 0 ? '-' : past.acq.toLocaleString('ko-KR')}</td>
                <td style="text-align: right; color: #666;">${past.rep === 0 ? '-' : past.rep.toLocaleString('ko-KR')}</td>
                <td style="text-align: right; color: #666; border-right: 1px solid #ccc;">${past.cur === 0 ? '-' : past.cur.toLocaleString('ko-KR')}</td>
                <td style="text-align: right; color: #1C5691; font-weight: 500;">${curr.acq === 0 ? '-' : curr.acq.toLocaleString('ko-KR')}</td>
                <td style="text-align: right; color: #1C5691; font-weight: 500;">${curr.rep === 0 ? '-' : curr.rep.toLocaleString('ko-KR')}</td>
                <td style="text-align: right; color: #1C5691; font-weight: 500; border-right: 1px solid #ccc;">${curr.cur === 0 ? '-' : curr.cur.toLocaleString('ko-KR')}</td>
                <td style="text-align: center; ${getStyle(rAcq)}">${rAcq}</td>
                <td style="text-align: center; ${getStyle(rRep)}">${rRep}</td>
                <td style="text-align: center; ${getStyle(rCur)}">${rCur}</td>
                <td style="text-align: center; padding: 2px;" onclick="event.stopPropagation();">
                    <input type="text" maxlength="50" value="${savedReason}" onchange="window.updateVerifReason('전체 합산', '${acc}', this.value)" style="width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; outline: none;" placeholder="증감 사유 입력...">
                </td>
            </tr>
        `;
    });

    // 최종 그랜드 토탈
    tbody.innerHTML += `
        <tr style="background-color: #2C2C2C !important; font-weight: bold; font-size: 14px;">
            <td style="background-color: #2C2C2C !important; text-align: center; border-right: 1px solid #555 !important; color: #FFCC00 !important;">총계 합산</td>
            <td style="background-color: #2C2C2C !important; text-align: right; color: #FFCC00 !important;">${grandTotPast.acq.toLocaleString('ko-KR')}</td>
            <td style="background-color: #2C2C2C !important; text-align: right; color: #FFCC00 !important;">${grandTotPast.rep.toLocaleString('ko-KR')}</td>
            <td style="background-color: #2C2C2C !important; text-align: right; border-right: 1px solid #555 !important; color: #FFCC00 !important;">${grandTotPast.cur.toLocaleString('ko-KR')}</td>
            <td style="background-color: #2C2C2C !important; text-align: right; color: #FFCC00 !important;">${grandTotCur.acq.toLocaleString('ko-KR')}</td>
            <td style="background-color: #2C2C2C !important; text-align: right; color: #FFCC00 !important;">${grandTotCur.rep.toLocaleString('ko-KR')}</td>
            <td style="background-color: #2C2C2C !important; text-align: right; border-right: 1px solid #555 !important; color: #FFCC00 !important;">${grandTotCur.cur.toLocaleString('ko-KR')}</td>
            <td style="background-color: #2C2C2C !important; text-align: center; color: #FFCC00 !important;">${calcRatio(grandTotCur.acq, grandTotPast.acq)}</td>
            <td style="background-color: #2C2C2C !important; text-align: center; color: #FFCC00 !important;">${calcRatio(grandTotCur.rep, grandTotPast.rep)}</td>
            <td style="background-color: #2C2C2C !important; text-align: center; color: #FFCC00 !important;">${calcRatio(grandTotCur.cur, grandTotPast.cur)}</td>
            <td style="background-color: #2C2C2C !important; border-right: 1px solid #555 !important;"></td>
        </tr>
    `;
};

window.loadPastVerificationExcel = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            window.verifState.tempParsed = {};
            workbook.SheetNames.forEach(sheetName => {
                const sheetJson = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {header: 1, defval: ""});
                if (sheetJson.length > 0) window.verifState.tempParsed[sheetName] = sheetJson;
            });

            if (Object.keys(window.verifState.tempParsed).length === 0) throw new Error("데이터를 찾을 수 없습니다.");
            
            window.openVerifPastModal(workbook.SheetNames.find(n => n.includes('총괄표')) || workbook.SheetNames[0]);
        } catch(err) { alert("과거 엑셀 파싱 중 오류가 발생했습니다.\n(" + err.message + ")"); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

window.openVerifPastModal = function(defaultSheetName) {
    window.updateVerifPastHeaders(false);
    document.getElementById('verifPastModal').style.display = 'flex';
};

window.updateVerifPastHeaders = function(isSheetChange = false) {
    const pastType = document.querySelector('input[name="verifPastType"]:checked').value;
    const sheetSelectWrap = document.getElementById('verifSingleSheetWrap');
    const sheetSelect = document.getElementById('verifPastSheet');
    const colLocWrap = document.getElementById('verifColLocWrap');
    
    if (pastType === 'multi') {
        sheetSelectWrap.style.display = 'none';
        colLocWrap.style.display = 'none';
    } else {
        sheetSelectWrap.style.display = 'block';
        colLocWrap.style.display = 'block';
    }

    if (!isSheetChange) {
        const sheets = Object.keys(window.verifState.tempParsed);
        sheetSelect.innerHTML = '';
        sheets.forEach(s => sheetSelect.innerHTML += `<option value="${s}">${s}</option>`);
    }

    let targetSheet = pastType === 'single' ? sheetSelect.value : Object.keys(window.verifState.tempParsed)[0];
    const data = window.verifState.tempParsed[targetSheet] || [];
    
    const selects = {
        loc: document.getElementById('verifColLoc'),
        acc: document.getElementById('verifColAcc'),
        acq: document.getElementById('verifColAcq'),
        rep: document.getElementById('verifColRep'),
        cur: document.getElementById('verifColCur')
    };

    Object.values(selects).forEach(el => el.innerHTML = '');
    selects.loc.innerHTML = `<option value="">-- 사용 안 함 --</option>`;

    let maxCols = 0;
    data.forEach(r => { if(r.length > maxCols) maxCols = r.length; });
    for (let i = 0; i < maxCols; i++) {
        let letter = String.fromCharCode(65 + (i % 26));
        if (i >= 26) letter = String.fromCharCode(64 + Math.floor(i / 26)) + letter;
        const optionHtml = `<option value="${i}">${letter} 열</option>`;
        Object.values(selects).forEach(el => el.innerHTML += optionHtml);
    }

    let auto = { loc: -1, acc: -1, acq: -1, rep: -1, cur: -1 };
    for (let r = 0; r < Math.min(15, data.length); r++) {
        for (let c = 0; c < data[r].length; c++) {
            const txt = String(data[r][c]).replace(/\s/g, '');
            if (auto.loc === -1 && (txt.includes('사업장') || txt.includes('소재지') || txt.includes('지점'))) auto.loc = c;
            if (auto.acc === -1 && (txt.includes('자산계정') || txt.includes('계정명') || txt.includes('자산명'))) auto.acc = c;
            if (auto.acq === -1 && (txt.includes('취득가액') || txt.includes('취득금액'))) auto.acq = c;
            if (auto.rep === -1 && (txt.includes('재조달가액') || txt.includes('재조달금액'))) auto.rep = c;
            if (auto.cur === -1 && (txt.includes('현재가액') || txt.includes('현재금액'))) auto.cur = c;
        }
    }

    if (auto.loc !== -1) selects.loc.value = auto.loc;
    if (auto.acc !== -1) selects.acc.value = auto.acc;
    if (auto.acq !== -1) selects.acq.value = auto.acq;
    if (auto.rep !== -1) selects.rep.value = auto.rep;
    if (auto.cur !== -1) selects.cur.value = auto.cur;
};

window.applyVerifPastMapping = function() {
    const pastType = document.querySelector('input[name="verifPastType"]:checked').value;
    const colLoc = document.getElementById('verifColLoc').value;
    const colAcc = document.getElementById('verifColAcc').value;
    const colAcq = document.getElementById('verifColAcq').value;
    const colRep = document.getElementById('verifColRep').value;
    const colCur = document.getElementById('verifColCur').value;

    if (!colAcc || !colAcq || !colRep || !colCur) return alert("필수 열(계정, 가액 3종) 지정을 확인해 주세요.");

    const locInputs = document.querySelectorAll('#locationTbody .loc-name');
    const registeredLocations = Array.from(locInputs).map(input => input.value.trim()).filter(Boolean);
    const currentView = document.getElementById('verifViewSelect') ? document.getElementById('verifViewSelect').value : '전체 합산';

    window.verifState.pastData = { '전체 합산': {} };
    registeredLocations.forEach(loc => window.verifState.pastData[loc] = {});

    const parseRows = (rawData, targetSiteOverride = null) => {
        for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            const accName = String(row[colAcc] || '').trim();

            if (!accName || accName.includes('합계') || accName.includes('총계')) continue;
            if (accName.includes('계정') || String(row[colAcq] || '').includes('가액') || String(row[colAcq] || '').includes('금액')) continue;

            const acqVal = Number(String(row[colAcq] || '').replace(/,/g, '')) || 0;
            const repVal = Number(String(row[colRep] || '').replace(/,/g, '')) || 0;
            const curVal = Number(String(row[colCur] || '').replace(/,/g, '')) || 0;

            if (acqVal === 0 && repVal === 0 && curVal === 0) continue;

            let targetSite = '전체 합산';
            if (targetSiteOverride) {
                let mappedLoc = window.verifState.siteMapping[targetSiteOverride] || targetSiteOverride;
                let matchedLoc = registeredLocations.find(l => l === mappedLoc || l.includes(mappedLoc) || mappedLoc.includes(l));
                if (matchedLoc) targetSite = matchedLoc;
            } else if (pastType === 'single') {
                if (colLoc !== "") {
                    const rowLoc = String(row[colLoc] || '').trim();
                    let mappedLoc = window.verifState.siteMapping[rowLoc] || rowLoc;
                    let matchedLoc = registeredLocations.find(l => l === mappedLoc || l.includes(mappedLoc) || mappedLoc.includes(l));
                    if (matchedLoc) targetSite = matchedLoc;
                } else {
                    if (registeredLocations.length === 1) targetSite = registeredLocations[0];
                }
            }

            if (!window.verifState.pastData['전체 합산'][accName]) window.verifState.pastData['전체 합산'][accName] = { acq: 0, rep: 0, cur: 0 };
            window.verifState.pastData['전체 합산'][accName].acq += acqVal;
            window.verifState.pastData['전체 합산'][accName].rep += repVal;
            window.verifState.pastData['전체 합산'][accName].cur += curVal;

            if (targetSite !== '전체 합산') {
                if (!window.verifState.pastData[targetSite][accName]) window.verifState.pastData[targetSite][accName] = { acq: 0, rep: 0, cur: 0 };
                window.verifState.pastData[targetSite][accName].acq += acqVal;
                window.verifState.pastData[targetSite][accName].rep += repVal;
                window.verifState.pastData[targetSite][accName].cur += curVal;
            }
        }
    };

    if (pastType === 'single') {
        const sheet = document.getElementById('verifPastSheet').value;
        parseRows(window.verifState.tempParsed[sheet] || []);
    } else {
        Object.keys(window.verifState.tempParsed).forEach(sheetName => {
            const cleanSheetName = sheetName.trim();
            parseRows(window.verifState.tempParsed[sheetName], cleanSheetName);
        });
    }

    document.getElementById('verifPastModal').style.display = 'none';
    window.renderVerificationTable();
    alert(`✅ 과거 데이터 연동 완료!`);
};

// ============================================================================
// [19] 스마트 과거 연동 마법사 완벽 하이재킹 (Deep Clean 엔진 탑재)
// ============================================================================
window.lastUploadedPastFile = null;

// 파일이 업로드되는 순간 몰래 파일을 메모리에 캡처해 둡니다.
document.addEventListener('change', function(e) {
    if (e.target.type === 'file' && e.target.files.length > 0) {
        window.lastUploadedPastFile = e.target.files[0];
    }
}, true);

// 내장 마법사의 '연동 적용하기' 버튼 클릭을 가로챕니다.
document.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (btn && btn.innerText.includes('연동 적용하기')) {
        if (!window.lastUploadedPastFile) return; // 캡처된 파일이 없으면 통과
        
        // 기존 시스템의 불안전한 내장 매칭 로직을 완전히 정지시킵니다.
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const modal = btn.closest('.modal-content') || btn.closest('div[style*="z-index"]');
        if (!modal) return;

        const selects = modal.querySelectorAll('select');
        if (selects.length < 3) return;

        const sheetName = selects[0].value;
        const keyText = selects[1].options[selects[1].selectedIndex].text;
        const valText = selects[2].options[selects[2].selectedIndex].text;

        // "H 열", "AG 열" 등에서 알파벳만 추출하여 정확한 기둥 번호(인덱스)로 변환
        const getColIdx = (str) => {
            const match = str.match(/[A-Z]+/i);
            if (!match) return 0;
            let letters = match[0].toUpperCase();
            let idx = 0;
            for (let i = 0; i < letters.length; i++) {
                idx = idx * 26 + (letters.charCodeAt(i) - 64);
            }
            return idx - 1;
        };

        const keyIdx = getColIdx(keyText);
        const valIdx = getColIdx(valText);

        const reader = new FileReader();
        reader.onload = function(re) {
            try {
                const data = new Uint8Array(re.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const worksheet = workbook.Sheets[sheetName];
                
                // 엑셀의 복잡한 헤더 병합을 무시하기 위해 순수 2차원 배열로 직접 파싱
                const rawData = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ""});
                const pastMap = new Map();

                // 1. 엑셀 원본 데이터 세척 및 Map 적재
                rawData.forEach(row => {
                    const rawKey = String(row[keyIdx] || '');
                    const rawVal = String(row[valIdx] || '');
                    
                    // 투명글자, 앞뒤 공백, 콤마 등 모든 불순물 완벽 제거 및 대문자 통일
                    const cleanKey = rawKey.replace(/[\u200B\s,]/g, '').trim().toUpperCase();
                    const cleanVal = rawVal.trim();

                    if (cleanKey && cleanVal && cleanVal !== '-' && !cleanKey.includes('자산번호') && !cleanKey.includes('합계')) {
                        pastMap.set(cleanKey, cleanVal);
                    }
                });

                // 2. 현재 시스템 데이터 세척 및 1:1 대조
                let matchCount = 0;
                if (window.infState && window.infState.data) {
                    for (const tabName in window.infState.data) {
                        window.infState.data[tabName].forEach(row => {
                            const currentKey = String(row['자산번호'] || row['신자산번호'] || '');
                            
                            // 현재 데이터도 똑같이 불순물 세척
                            const cleanCurrentKey = currentKey.replace(/[\u200B\s,]/g, '').trim().toUpperCase();

                            if (cleanCurrentKey && pastMap.has(cleanCurrentKey)) {
                                const matchedVal = pastMap.get(cleanCurrentKey);
                                row['_assetClass'] = matchedVal; 
                                row['구분'] = matchedVal; 
                                matchCount++;
                            }
                        });
                    }
                }

                // 기존 모달 닫기
                const closeIcon = modal.querySelector('i[class*="close"], i[class*="xmark"], button.close');
                if (closeIcon) closeIcon.click();
                else if (modal.parentElement) modal.parentElement.style.display = 'none';

                // 화면 즉시 갱신
                if (typeof window.infRenderTable === 'function') window.infRenderTable();
                
                // 성공 알림 (딥클린 엔진 시그니처 표출)
                alert(`🚀 [딥클린 엔진] 데이터 연동 완료!\n선택하신 시트에서 총 ${matchCount}건의 자산이 완벽하게 매칭되었습니다.`);
                
            } catch (err) {
                alert("엑셀 데이터 매칭 중 오류가 발생했습니다.\n(" + err.message + ")");
            }
        };
        reader.readAsArrayBuffer(window.lastUploadedPastFile);
    }
}, true);