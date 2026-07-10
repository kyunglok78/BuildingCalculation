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

    tabContainer.innerHTML = ''; // 탭 초기화
    tbody.innerHTML = ''; // 테이블 초기화

    if (!dataObj || Object.keys(dataObj).length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" style="padding: 30px; color: #999; text-align: center;">연동된 데이터가 없습니다.</td></tr>';
        return;
    }

    const sites = Object.keys(dataObj);
    // 현재 모드의 활성화된 탭이 없거나, 삭제되어서 없어진 경우 첫 번째 사업장으로 세팅
    if (!window.kbState.activeSite[mode] || !sites.includes(window.kbState.activeSite[mode])) {
        window.kbState.activeSite[mode] = sites[0];
    }
    const currentSite = window.kbState.activeSite[mode];

    // 1. 탭 버튼 동적 생성
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
            window.kbState.activeSite[mode] = siteName; // 탭 전환
            renderEvalTabsAndTable(mode, tbodyId, tabContainerId); // 화면 갱신
        };
        tabContainer.appendChild(tabBtn);
    });

    // 2. 선택된 탭(사업장)의 데이터만 3단 콤보로 렌더링
    const selectedData = dataObj[currentSite];
    renderEvalTableGrouped(tbody, selectedData);
}

// ============================================================================
// [4] 3단 콤보(그룹핑) 테이블 렌더링 엔진 (한국어 Key 완벽 매핑)
// ============================================================================
function renderEvalTableGrouped(tbody, groupedData) {
    let grandTotalArea = 0, grandTotalReco = 0, grandTotalCur = 0;
    const groups = Array.isArray(groupedData) ? groupedData : Object.values(groupedData);

    groups.forEach(group => {
        let groupArea = 0;
        const records = group.records || group.데이터리스트 || [group]; 

        // [1행: 건축공사비 루프]
        records.forEach(record => {
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

            const codeDisp = (strctCode && strctCode !== "nan" && strctCode !== "-") ? strctCode : "<span style='color: #0056b3; font-weight: bold; cursor: pointer;'>[ 🔍 더블클릭 ]</span>";
            const depDisp = (depRate === 1.78) ? "<span style='color: #0056b3; font-weight: bold; cursor: pointer;'>[ 🔍 더블클릭 (기본 1.78%) ]</span>" : `${depRate.toFixed(2)}%`;

            const trArch = document.createElement('tr');
            trArch.style.backgroundColor = '#ffffff';
            trArch.innerHTML = `
                <td>${seq}</td><td style="color:#0056b3; font-weight:bold;">${dongName}</td><td style="color:#0056b3;">건축공사비</td>
                <td>${usage}</td><td style="text-align:right;">${formatArea(area)}</td><td>${strct}</td><td>${buildYear}</td>
                <td>${codeDisp}</td><td style="text-align:right;">${formatPrice(unitPrice)}</td><td>${formatPrice(laborCost)}</td>
                <td>${priceIdx.toFixed(4)}</td><td style="text-align:right; color:#0056b3;">${formatPrice(recoArch)}</td>
                <td>${depDisp}</td><td>${remainRate.toFixed(2)}%</td><td style="text-align:right; color:#0056b3;">${formatPrice(curArch)}</td>
            `;
            tbody.appendChild(trArch);
        });

        // [부속설비 및 소계 추출]
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
            <td style="font-weight:bold;">${accRate.toFixed(1)}%</td><td style="text-align:right;">${formatPrice(recoSub)}</td>
            <td colspan="2"></td><td style="text-align:right;">${formatPrice(curSub)}</td>
        `;
        tbody.appendChild(trSub);

        // [3행: 소계]
        const trTotal = document.createElement('tr');
        trTotal.style.backgroundColor = '#e2e8f0'; trTotal.style.fontWeight = 'bold';
        trTotal.innerHTML = `
            <td colspan="2"></td><td>[${mainDongName}] 소계</td><td></td><td style="text-align:right;">${formatArea(groupArea)}</td>
            <td colspan="6"></td><td style="text-align:right;">${formatPrice(recoTotal)}</td><td colspan="2"></td>
            <td style="text-align:right;">${formatPrice(curTotal)}</td>
        `;
        tbody.appendChild(trTotal);
    });

    // [마지막 행: 사업장 합계]
    const trGrandTotal = document.createElement('tr');
    trGrandTotal.style.backgroundColor = '#cbd5e1'; trGrandTotal.style.fontWeight = 'bold';
    trGrandTotal.innerHTML = `
        <td colspan="4" style="text-align:center;">사업장 합계</td><td style="text-align:right;">${formatArea(grandTotalArea)}</td>
        <td colspan="6"></td><td style="text-align:right;">${formatPrice(grandTotalReco)}</td><td colspan="2"></td>
        <td style="text-align:right;">${formatPrice(grandTotalCur)}</td>
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
    // 1. 공공데이터 조회가 완료된 원본 데이터가 있는지 확인
    // (api_ledger.js 등의 공공데이터 조회 기능 완료 후 window.kbState.fetchedData 에 값이 들어있어야 합니다.)
    const fetchedData = window.kbState.fetchedData;
    if (!fetchedData || Object.keys(fetchedData).length === 0) {
        alert("연동할 수 없습니다. 먼저 [건축물대장 조회시작]을 완료해 주세요.");
        return;
    }

    // 2. 기존 작업 내역 초기화 및 경고
    if (Object.keys(window.kbState.evalData.title || {}).length > 0) {
        if (!confirm("기존에 작업 중이던 표제부 평가 데이터가 초기화됩니다. 계속하시겠습니까?")) return;
    }
    
    const newTitleData = {};

    // 3. 사업장(소재지)별 순회하며 데이터 맵핑
    Object.keys(fetchedData).forEach(siteName => {
        const siteData = fetchedData[siteName];
        // 파이썬 원본 로직: df_title (표제부 상세), df_recap (총괄표제부 정보)
        const dfTitle = siteData["표제부 상세"] || [];
        const dfRecap = siteData["총괄표제부 정보"] || [];
        
        let fallbackYear = 2000;
        
        // 총괄표제부에서 기준 준공연도(사용승인일) 추출
        if (dfRecap.length > 0 && dfRecap[0]["사용승인일"]) {
            const aprDate = String(dfRecap[0]["사용승인일"]).replace(/[-/]/g, "").trim();
            if (aprDate.length >= 4 && !isNaN(aprDate.substring(0, 4))) {
                fallbackYear = parseInt(aprDate.substring(0, 4));
            }
        }

        const siteRecords = [];

        // 표제부 상세 데이터를 평가 데이터 규격으로 변환
        dfTitle.forEach((row, idx) => {
            let dongNm = (row["동명칭"] || "").trim();
            if (!dongNm || dongNm === "-" || dongNm === "nan") dongNm = "본동";
            
            const areaVal = String(row["연면적(m²)"] || "0").replace(/,/g, "").trim();
            const area = isNaN(parseFloat(areaVal)) ? 0.0 : parseFloat(areaVal);
            
            const strct = (row["구조코드명"] || "-").trim();
            const purps = (row["주용도(건물별)"] || "-").trim();
            
            let buildYear = fallbackYear;
            const rowAprDate = String(row["사용승인일"] || "").replace(/[-/]/g, "").trim();
            if (rowAprDate.length >= 4 && !isNaN(rowAprDate.substring(0, 4))) {
                buildYear = parseInt(rowAprDate.substring(0, 4));
            }

            // 파이썬 원본 _create_empty_record 와 동일한 구조 객체 생성
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

    // 4. 중앙 상태 업데이트 및 화면 다시 그리기
    window.kbState.evalData.title = newTitleData;
    // 연동 직후 첫 번째 탭으로 화면 전환 세팅
    window.kbState.activeSite.title = Object.keys(newTitleData)[0] || null;
    
    renderEvalTabsAndTable('title', 'tbodyTitleEval', 'tabsTitleEval');
    alert("표제부 데이터 연동이 완료되었습니다.");
}}