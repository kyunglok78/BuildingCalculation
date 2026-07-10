// ============================================================================
// 1. 초기화 및 이벤트 바인딩
// ============================================================================
window.onload = function() {
    // 로컬 서버(localhost)가 아니고 파일(file://)이나 미리보기(blob://) 환경일 경우 경고창 띄우기
    if (typeof isLocalServer !== 'undefined' && !isLocalServer && (window.location.protocol === 'file:' || window.location.protocol === 'blob:')) {
        const warning = document.getElementById('fileWarning');
        if(warning) warning.style.display = 'block';
    }
    
    // 첫 번째 페이지(인트로)를 건너뛰고 2번째 슬라이드로 즉시 이동
    if(typeof goToSlide === 'function') goToSlide('slide2');
    if(typeof updateMenuState === 'function') updateMenuState();

    // ★ UI 그룹핑 렌더링 테스트 실행
    runGroupedRenderTest();
};

// ============================================================================
// 2. 포맷팅 헬퍼 함수 (파이썬 원본의 fmt_num 로직 완벽 구현)
// ============================================================================
function formatPrice(num) {
    return num > 0 ? Math.round(num).toLocaleString('ko-KR') : "-";
}

function formatArea(num) {
    if (num === null || num === undefined) return "-";
    return Number(num).toLocaleString('ko-KR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// ============================================================================
// 3. ★ 핵심: 3단 콤보 (그룹핑) 테이블 렌더링 로직 ★
// 동일한 동명칭에 대해 건축공사비(N개) -> 부속설비(1개) -> 소계(1개) 세트 구성
// ============================================================================
function renderEvalTableGrouped(tbodyId, groupedData) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    tbody.innerHTML = ''; // 렌더링 전 초기화

    if (!groupedData || groupedData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" style="padding: 30px; color: #999; text-align: center;">데이터가 없습니다.</td></tr>';
        return;
    }

    let grandTotalArea = 0, grandTotalReco = 0, grandTotalCur = 0;

    // 각 동(Group) 단위로 순회
    groupedData.forEach(group => {
        let groupArea = 0;

        // [STEP 1] 해당 동의 '건축공사비' 리스트 N개 렌더링
        group.records.forEach(record => {
            groupArea += (record.area || 0);
            
            // 파이썬 원본 스타일의 [ 🔍 더블클릭 ] 예외 처리
            const codeDisp = (record.structureCode && record.structureCode !== "nan" && record.structureCode !== "-") 
                             ? record.structureCode 
                             : "<span style='color: #0056b3; font-weight: bold; cursor: pointer;'>[ 🔍 더블클릭 ]</span>";
                             
            const depDisp = record.depRate === 1.78 
                             ? "<span style='color: #0056b3; font-weight: bold; cursor: pointer;'>[ 🔍 더블클릭 (기본 1.78%) ]</span>" 
                             : `${record.depRate.toFixed(2)}%`;

            const trArch = document.createElement('tr');
            trArch.style.backgroundColor = '#ffffff'; // 1행 배경색 (흰색)
            trArch.innerHTML = `
                <td>${record.seq || '-'}</td>
                <td style="color: #0056b3; font-weight: bold;">${record.dongName || '-'}</td>
                <td style="color: #0056b3;">건축공사비</td>
                <td>${record.usage || '-'}</td>
                <td style="text-align: right;">${formatArea(record.area)}</td>
                <td>${record.structureName || '-'}</td>
                <td>${record.buildYear || '-'}</td>
                <td>${codeDisp}</td>
                <td style="text-align: right;">${formatPrice(record.unitPrice)}</td>
                <td>${formatPrice(record.laborCost)}</td>
                <td>${record.priceIndex ? record.priceIndex.toFixed(4) : '-'}</td>
                <td style="text-align: right; color: #0056b3;">${formatPrice(record.recoArch)}</td>
                <td>${depDisp}</td>
                <td>${record.remainRate ? record.remainRate.toFixed(2) + '%' : '-'}</td>
                <td style="text-align: right; color: #0056b3;">${formatPrice(record.curArch)}</td>
            `;
            tbody.appendChild(trArch);
        });

        // 누적 합산 업데이트
        grandTotalArea += groupArea;
        grandTotalReco += group.recoTotal;
        grandTotalCur += group.curTotal;

        // [STEP 2] 해당 동의 '부속설비' 1개 렌더링
        const trSub = document.createElement('tr');
        trSub.style.backgroundColor = '#f8f9fa'; // 2행 배경색 (연한 회색)
        trSub.innerHTML = `
            <td></td><td></td>
            <td>부속설비</td>
            <td>[${group.dongName}] 일괄부속</td>
            <td></td><td></td><td></td><td></td><td></td><td></td>
            <td style="font-weight:bold;">${group.accessoryRate ? group.accessoryRate.toFixed(1) + '%' : '-'}</td>
            <td style="text-align: right;">${formatPrice(group.recoSub)}</td>
            <td></td><td></td>
            <td style="text-align: right;">${formatPrice(group.curSub)}</td>
        `;
        tbody.appendChild(trSub);

        // [STEP 3] 해당 동의 '소계' 1개 렌더링
        const trTotal = document.createElement('tr');
        trTotal.style.backgroundColor = '#e2e8f0'; // 3행 배경색 (강조된 회색)
        trTotal.style.fontWeight = 'bold';
        trTotal.innerHTML = `
            <td></td><td></td>
            <td>[${group.dongName}] 소계</td>
            <td></td>
            <td style="text-align: right;">${formatArea(groupArea)}</td>
            <td></td><td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: right;">${formatPrice(group.recoTotal)}</td>
            <td></td><td></td>
            <td style="text-align: right;">${formatPrice(group.curTotal)}</td>
        `;
        tbody.appendChild(trTotal);
    });
}

// ============================================================================
// 4. 올려주신 파이썬 스크린샷과 100% 동일한 Mock 데이터 주입 로직
// ============================================================================
function runGroupedRenderTest() {
    // 파이썬의 eval_records['floor'] 또는 ['kfpa'] 와 동일한 자료구조
    const sampleGroupedData = [
        {
            dongName: "A동/B동/주물",
            records: [
                { seq: "1-1", dongName: "A동/B동/주물", usage: "-", area: 0, structureName: "-", buildYear: 2026, structureCode: "nan", unitPrice: 0, laborCost: 0, priceIndex: 1.0, recoArch: 0, depRate: 1.78, remainRate: 100, curArch: 0 }
            ],
            accessoryRate: 20.0, recoSub: 0, curSub: 0, recoTotal: 0, curTotal: 0
        },
        {
            dongName: "A동(주2)",
            records: [
                { seq: "1-2", dongName: "A동(주2)", usage: "기계실", area: 125.60, structureName: "1.0", buildYear: 1977, structureCode: "6-1-5-6-3", unitPrice: 1170000, laborCost: 71, priceIndex: 1.0245, recoArch: 150552000, depRate: 1.78, remainRate: 30, curArch: 45165000 }
            ],
            accessoryRate: 20.0, recoSub: 30110000, curSub: 9033000, recoTotal: 180662000, curTotal: 54198000
        },
        {
            dongName: "(가공공장)",
            // 가공공장 그룹은 건축공사비가 4개! -> 4개 출력 후 부속/소계 1개씩 출력됨
            records: [
                { seq: "1-3", dongName: "(가공공장)", usage: "작업장", area: 12178.01, structureName: "3.0", buildYear: 1977, structureCode: "6-1-6-12-3", unitPrice: 1356000, laborCost: 63, priceIndex: 1.0282, recoArch: 16979058000, depRate: 1.78, remainRate: 30, curArch: 5093717000 },
                { seq: "1-4", dongName: "(가공공장)", usage: "1층(증축작업장)", area: 80.37, structureName: "3.0", buildYear: 2020, structureCode: "6-1-6-22-3", unitPrice: 800000, laborCost: 53, priceIndex: 1.0328, recoArch: 66404000, depRate: 1.78, remainRate: 89.32, curArch: 59312000 },
                { seq: "1-5", dongName: "(가공공장)", usage: "2층(증축작업장_변전실)", area: 80.37, structureName: "3.0", buildYear: 2020, structureCode: "6-1-6-22-3", unitPrice: 800000, laborCost: 53, priceIndex: 1.0328, recoArch: 66404000, depRate: 1.78, remainRate: 89.32, curArch: 59312000 },
                { seq: "1-6", dongName: "(가공공장)", usage: "작업장", area: 533.04, structureName: "3.0", buildYear: 1977, structureCode: "6-1-6-11-3", unitPrice: 1135000, laborCost: 65, priceIndex: 1.0272, recoArch: 621456000, depRate: 1.78, remainRate: 30, curArch: 186436000 }
            ],
            accessoryRate: 20.0, recoSub: 3599544000, curSub: 1079863000, recoTotal: 21597268000, curTotal: 6681156000
        }
    ];

    // 표제부(Slide 4), 층별(Slide 5), 화협(Slide 7) 각각의 테이블 바디에 렌더링
    renderEvalTableGrouped('tbodyTitleEval', sampleGroupedData);
    renderEvalTableGrouped('tbodyFloorEval', sampleGroupedData);
    renderEvalTableGrouped('tbodyKfpaEval', sampleGroupedData);
}