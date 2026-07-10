// ============================================================================
// [1] 전역 상태 관리 (백엔드와 통신하는 중앙 데이터 저장소)
// ============================================================================
window.kbState = {
    evalData: { title: {}, floor: {}, kfpa: {} }, 
    activeSite: { title: null, floor: null, kfpa: null } // 모드별로 현재 선택된 탭(사업장) 저장
};

window.onload = function() {
    if (typeof goToSlide === 'function') goToSlide('slide2');
    // UI 확인용 임시 데이터 세팅 및 렌더링 실행
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
// [6] 테스트용 Mock 데이터 연동
// ============================================================================
function runGroupedRenderTest() {
    // 백엔드에서 정제되어 내려온 데이터 형태를 시뮬레이션 합니다. (탭 2개가 생기도록 안산/시흥 분리)
    window.kbState.evalData = {
        title: {
            "안산공장": [
                { 동명칭: "1동", 부속비율: 20.0, 재조달_부속: 30110000, 재조달_합계: 180662000, 현재_부속: 9033000, 현재_합계: 54198000, records: [{ 일련번호: "1", 동명칭: "1동", 용도: "공장", 연면적: 125.60, 구조명: "일반철골구조", 준공연도: 1977, 구조코드: "6-1-5-6-3", 단가: 1170000, 노무비: 71, 물가지수: 1.0245, 감가율: 1.78, 재조달_건축: 150552000, 잔가율: 30, 현재_건축: 45165000 }] }
            ],
            "시흥공장": [
                { 동명칭: "주건축물제1동", 부속비율: 20.0, 재조달_부속: 0, 재조달_합계: 0, 현재_부속: 0, 현재_합계: 0, records: [{ 일련번호: "1", 동명칭: "주건축물제1동", 용도: "공장", 연면적: 3993.0, 구조명: "일반철골구조", 준공연도: 2026, 구조코드: "-", 단가: 0, 노무비: 0, 물가지수: 1.0, 감가율: 1.78, 재조달_건축: 0, 잔가율: 100, 현재_건축: 0 }] }
            ]
        },
        floor: {}, kfpa: {}
    };
    
    // 깊은 복사로 층별, 화협 테스트 데이터 삽입
    window.kbState.evalData.floor = JSON.parse(JSON.stringify(window.kbState.evalData.title));
    window.kbState.evalData.kfpa = JSON.parse(JSON.stringify(window.kbState.evalData.title));

    // 화면 그리기 실행
    renderEvalTabsAndTable('title', 'tbodyTitleEval', 'tabsTitleEval');
    renderEvalTabsAndTable('floor', 'tbodyFloorEval', 'tabsFloorEval');
    renderEvalTabsAndTable('kfpa', 'tbodyKfpaEval', 'tabsKfpaEval');
}