// ============================================================================
// 1. 초기화 및 이벤트 바인딩
// ============================================================================
window.onload = function() {
    if (typeof isLocalServer !== 'undefined' && !isLocalServer && (window.location.protocol === 'file:' || window.location.protocol === 'blob:')) {
        const warning = document.getElementById('fileWarning');
        if(warning) warning.style.display = 'block';
    }
    
    if(typeof goToSlide === 'function') goToSlide('slide2');
    if(typeof updateMenuState === 'function') updateMenuState();

    // ★ 임시 데이터 렌더링 테스트 (실제 API 연결 시 이 부분은 삭제하거나 주석처리 하세요)
    runGroupedRenderTest();
};

// ============================================================================
// 2. 포맷팅 헬퍼 함수 (소수점 및 천단위 콤마 완벽 처리)
// ============================================================================
function formatPrice(num) {
    return (num && num > 0) ? Math.round(num).toLocaleString('ko-KR') : "-";
}

function formatArea(num) {
    if (num === null || num === undefined || num === "" || num === "-") return "-";
    // 소수점 2자리까지 강제 표시 (126이 아닌 125.60으로 나오도록 수정)
    return Number(num).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================================
// 3. ★ 핵심: 파이썬 API 한국어 키 완벽 대응 3단 콤보 렌더링 로직 ★
// ============================================================================
function renderEvalTableGrouped(tbodyId, groupedData) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = ''; // 렌더링 전 초기화

    if (!groupedData || Object.keys(groupedData).length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" style="padding: 30px; color: #999; text-align: center;">연동된 평가 데이터가 없습니다.</td></tr>';
        return;
    }

    let grandTotalArea = 0, grandTotalReco = 0, grandTotalCur = 0;

    // 객체(Object) 형태든 배열(Array) 형태든 모두 순회 가능하도록 변환
    const groups = Array.isArray(groupedData) ? groupedData : Object.values(groupedData);

    groups.forEach(group => {
        let groupArea = 0;
        
        // 파이썬 층별/화협 모드처럼 'records' 배열이 내부에 있거나, 표제부처럼 플랫한 배열일 경우 모두 대응
        const records = group.records || group.데이터리스트 || [group]; 

        records.forEach(record => {
            // ★ 파이썬 API에서 넘어오는 한국어 키와 영문 키를 모두 호환하도록 추출 (API 연동 에러 해결의 핵심)
            const seq = record['일련번호'] || record.seq || '-';
            const dongName = record['동명칭'] || record.dongName || '-';
            const usage = record['용도'] || record.usage || '-';
            const area = parseFloat(record['연면적'] || record.area || 0);
            const strct = record['구조'] || record['구조명'] || record.structureName || '-';
            const buildYear = record['준공연도'] || record.buildYear || '-';
            const strctCode = record['구조코드'] || record.structureCode || '-';
            const unitPrice = parseFloat(record['단가'] || record.unitPrice || 0);
            const laborCost = parseFloat(record['노무비'] || record.laborCost || 0);
            const priceIdx = parseFloat(record['물가지수'] || record.priceIndex || 1.0);
            
            const recoArch = parseFloat(record['재조달_건축'] || record.recoArch || 0);
            const depRate = parseFloat(record['감가율'] || record.depRate || 1.78);
            const remainRate = parseFloat(record['잔가율'] || record.remainRate || 100);
            const curArch = parseFloat(record['현재_건축'] || record.curArch || 0);

            groupArea += area;

            const codeDisp = (strctCode && strctCode !== "nan" && strctCode !== "-") 
                             ? strctCode 
                             : "<span style='color: #0056b3; font-weight: bold; cursor: pointer;'>[ 🔍 더블클릭 ]</span>";
            const depDisp = (depRate === 1.78) 
                             ? "<span style='color: #0056b3; font-weight: bold; cursor: pointer;'>[ 🔍 더블클릭 (기본 1.78%) ]</span>" 
                             : `${depRate.toFixed(2)}%`;

            // [1행: 건축공사비]
            const trArch = document.createElement('tr');
            trArch.style.backgroundColor = '#ffffff';
            trArch.innerHTML = `
                <td>${seq}</td>
                <td style="color: #0056b3; font-weight: bold;">${dongName}</td>
                <td style="color: #0056b3;">건축공사비</td>
                <td>${usage}</td>
                <td style="text-align: right;">${formatArea(area)}</td>
                <td>${strct}</td>
                <td>${buildYear}</td>
                <td>${codeDisp}</td>
                <td style="text-align: right;">${formatPrice(unitPrice)}</td>
                <td>${formatPrice(laborCost)}</td>
                <td>${priceIdx.toFixed(4)}</td>
                <td style="text-align: right; color: #0056b3;">${formatPrice(recoArch)}</td>
                <td>${depDisp}</td>
                <td>${remainRate.toFixed(2)}%</td>
                <td style="text-align: right; color: #0056b3;">${formatPrice(curArch)}</td>
            `;
            tbody.appendChild(trArch);
        });

        // [부속설비 및 소계 데이터 추출] (API 한국어 키 매핑)
        const accRate = parseFloat(group['부속비율'] || group.accessoryRate || 20.0);
        const recoSub = parseFloat(group['재조달_부속'] || group.recoSub || 0);
        const curSub = parseFloat(group['현재_부속'] || group.curSub || 0);
        const recoTotal = parseFloat(group['재조달_합계'] || group.recoTotal || 0);
        const curTotal = parseFloat(group['현재_합계'] || group.curTotal || 0);
        const mainDongName = group['동명칭'] || group.dongName || '-';

        grandTotalArea += groupArea;
        grandTotalReco += recoTotal;
        grandTotalCur += curTotal;

        // [2행: 부속설비]
        const trSub = document.createElement('tr');
        trSub.style.backgroundColor = '#f8f9fa';
        trSub.innerHTML = `
            <td colspan="2"></td>
            <td>부속설비</td>
            <td>[${mainDongName}] 일괄부속</td>
            <td colspan="6"></td>
            <td style="font-weight:bold;">${accRate.toFixed(1)}%</td>
            <td style="text-align: right;">${formatPrice(recoSub)}</td>
            <td colspan="2"></td>
            <td style="text-align: right;">${formatPrice(curSub)}</td>
        `;
        tbody.appendChild(trSub);

        // [3행: 소계]
        const trTotal = document.createElement('tr');
        trTotal.style.backgroundColor = '#e2e8f0';
        trTotal.style.fontWeight = 'bold';
        trTotal.innerHTML = `
            <td colspan="2"></td>
            <td>[${mainDongName}] 소계</td>
            <td></td>
            <td style="text-align: right;">${formatArea(groupArea)}</td>
            <td colspan="6"></td>
            <td style="text-align: right;">${formatPrice(recoTotal)}</td>
            <td colspan="2"></td>
            <td style="text-align: right;">${formatPrice(curTotal)}</td>
        `;
        tbody.appendChild(trTotal);
    });

    // [마지막 행: 소재지 전체 합계]
    const trGrandTotal = document.createElement('tr');
    trGrandTotal.style.backgroundColor = '#cbd5e1';
    trGrandTotal.style.fontWeight = 'bold';
    trGrandTotal.innerHTML = `
        <td colspan="4" style="text-align: center;">소재지 합계</td>
        <td style="text-align: right;">${formatArea(grandTotalArea)}</td>
        <td colspan="6"></td>
        <td style="text-align: right;">${formatPrice(grandTotalReco)}</td>
        <td colspan="2"></td>
        <td style="text-align: right;">${formatPrice(grandTotalCur)}</td>
    `;
    tbody.appendChild(trGrandTotal);
}

// ============================================================================
// 4. 오류를 수정한 샘플(Mock) 데이터 및 렌더링 호출
// ============================================================================
function runGroupedRenderTest() {
    // API 연결 전, 화면 확인용 오타 수정본 데이터
    const sampleGroupedData = [
        {
            동명칭: "A동/B동/주물",
            records: [
                { 일련번호: "1-1", 동명칭: "A동/B동/주물", 용도: "-", 연면적: 0, 구조명: "-", 준공연도: 2026, 구조코드: "nan", 단가: 0, 노무비: 0, 물가지수: 1.0, 재조달_건축: 0, 감가율: 1.78, 잔가율: 100, 현재_건축: 0 }
            ],
            부속비율: 20.0, 재조달_부속: 0, 현재_부속: 0, 재조달_합계: 0, 현재_합계: 0
        },
        {
            동명칭: "A동(주2)",
            records: [
                { 일련번호: "1-2", 동명칭: "A동(주2)", 용도: "기계실", 연면적: 125.60, 구조명: "일반철골구조", 준공연도: 1977, 구조코드: "6-1-5-6-3", 단가: 1170000, 노무비: 71, 물가지수: 1.0245, 재조달_건축: 150552000, 감가율: 1.78, 잔가율: 30, 현재_건축: 45165000 }
            ],
            부속비율: 20.0, 재조달_부속: 30110000, 현재_부속: 9033000, 재조달_합계: 180662000, 현재_합계: 54198000
        }
    ];

    renderEvalTableGrouped('tbodyTitleEval', sampleGroupedData);
    renderEvalTableGrouped('tbodyFloorEval', sampleGroupedData);
    renderEvalTableGrouped('tbodyKfpaEval', sampleGroupedData);
}