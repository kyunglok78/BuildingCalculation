// [BLOCK 1: 초기화 및 이벤트 바인딩]
window.onload = function() {
    // 로컬 서버(localhost)가 아니고 파일(file://)이나 미리보기(blob://) 환경일 경우 경고창 띄우기
    if (typeof isLocalServer !== 'undefined' && !isLocalServer && (window.location.protocol === 'file:' || window.location.protocol === 'blob:')) {
        const warning = document.getElementById('fileWarning');
        if(warning) warning.style.display = 'block';
    }
    
    // 첫 번째 페이지(인트로)를 건너뛰고 2번째 슬라이드로 즉시 이동 (기존 함수 존재 시 호출)
    if(typeof goToSlide === 'function') goToSlide('slide2');
    if(typeof updateMenuState === 'function') updateMenuState();

    // ★ UI 확인을 위한 임시 데이터 렌더링 실행
    runRenderTest();
};

// [BLOCK 2: 유틸리티 포맷팅 함수]
// 숫자를 천 단위 콤마가 포함된 문자열로 변환 (0 이하이거나 잘못된 값은 하이픈 처리)
function formatNumber(num) {
    if (!num || isNaN(num) || num <= 0) return "-";
    return Math.round(num).toLocaleString('ko-KR');
}

// [BLOCK 3: 3단 콤보 테이블 렌더링 핵심 로직]
// 파이썬 원본의 refresh_all_eval_treeviews() 로직을 완벽히 구현한 함수
function renderEvalTable(tbodyId, dataArray) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    tbody.innerHTML = ''; // 렌더링 전 기존 내용 초기화

    // 데이터가 없을 경우 안내 문구 출력
    if (!dataArray || dataArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" style="padding: 30px; color: #999; text-align: center;">연동된 평가 데이터가 없습니다.</td></tr>';
        return;
    }

    let totalArea = 0, totalReco = 0, totalCur = 0;

    dataArray.forEach((record) => {
        // 전체 합계 누적 (연면적, 재조달가액, 현재가액)
        totalArea += (record.area || 0);
        totalReco += (record.recoTotal || 0);
        totalCur += (record.curTotal || 0);

        // 파이썬의 [ 🔍 더블클릭 ] UI 로직 구현
        const codeDisp = record.structureCode ? record.structureCode : "<span style='color: #0056b3; font-weight: bold; cursor: pointer;'>[ 🔍 더블클릭 ]</span>";
        const depDisp = record.depRate === 1.78 ? "<span style='color: #0056b3; font-weight: bold; cursor: pointer;'>[ 🔍 더블클릭 (기본 1.78%) ]</span>" : `${record.depRate}%`;

        // 1행: 건축공사비 생성
        const tr1 = document.createElement('tr');
        tr1.style.backgroundColor = '#ffffff';
        tr1.innerHTML = `
            <td>${record.seq || '-'}</td>
            <td style="color: #0056b3; font-weight: bold; cursor: pointer;">${record.dongName || '-'} ▲▼</td>
            <td style="color: #0056b3;">건축공사비</td>
            <td>${record.usage || '-'}</td>
            <td style="text-align: right;">${formatNumber(record.area)}</td>
            <td>${record.structureName || '-'}</td>
            <td>${record.buildYear || '-'}</td>
            <td>${codeDisp}</td>
            <td style="text-align: right;">${formatNumber(record.unitPrice)}</td>
            <td>${formatNumber(record.laborCost)}</td>
            <td>${record.priceIndex ? record.priceIndex.toFixed(4) : '-'}</td>
            <td style="text-align: right; color: #0056b3;">${formatNumber(record.recoArch)}</td>
            <td>${depDisp}</td>
            <td>${record.remainRate ? record.remainRate.toFixed(2) + '%' : '-'}</td>
            <td style="text-align: right; color: #0056b3;">${formatNumber(record.curArch)}</td>
        `;
        tbody.appendChild(tr1);

        // 2행: 부속설비 생성
        const tr2 = document.createElement('tr');
        tr2.style.backgroundColor = '#f8f9fa';
        tr2.innerHTML = `
            <td></td><td></td>
            <td>부속설비</td>
            <td>[${record.dongName || '-'}] 일괄부속</td>
            <td></td><td></td><td></td><td></td><td></td><td></td>
            <td style="font-weight:bold;">${record.accessoryRate ? record.accessoryRate.toFixed(1) + '%' : '-'}</td>
            <td style="text-align: right;">${formatNumber(record.recoSub)}</td>
            <td></td><td></td>
            <td style="text-align: right;">${formatNumber(record.curSub)}</td>
        `;
        tbody.appendChild(tr2);

        // 3행: 소계 생성
        const tr3 = document.createElement('tr');
        tr3.style.backgroundColor = '#e2e8f0';
        tr3.style.fontWeight = 'bold';
        tr3.innerHTML = `
            <td></td><td></td>
            <td>[${record.dongName || '-'}] 소계</td>
            <td></td>
            <td style="text-align: right;">${formatNumber(record.area)}</td>
            <td></td><td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: right;">${formatNumber(record.recoTotal)}</td>
            <td></td><td></td>
            <td style="text-align: right;">${formatNumber(record.curTotal)}</td>
        `;
        tbody.appendChild(tr3);
    });

    // 마지막 행: 소재지 전체 합계 렌더링 (파이썬의 total tag 구현)
    const trTotal = document.createElement('tr');
    trTotal.style.backgroundColor = '#cbd5e1';
    trTotal.style.fontWeight = 'bold';
    trTotal.innerHTML = `
        <td colspan="4" style="text-align: center;">소재지 합계</td>
        <td style="text-align: right;">${formatNumber(totalArea)}</td>
        <td colspan="6"></td>
        <td style="text-align: right;">${formatNumber(totalReco)}</td>
        <td colspan="2"></td>
        <td style="text-align: right;">${formatNumber(totalCur)}</td>
    `;
    tbody.appendChild(trTotal);
}

// [BLOCK 4: 임시 목업(Mock) 데이터 연동 테스트]
// 실제로는 엑셀 파싱이나 서버(API)에서 받아올 데이터 포맷입니다.
function runRenderTest() {
    const sampleValuationData = [
        {
            seq: "1-1", dongName: "A동/B동/주물", usage: "-", area: 0.00, structureName: "-", buildYear: 2026,
            structureCode: "", unitPrice: 0, laborCost: 0, priceIndex: 1.0, 
            recoArch: 0, depRate: 1.78, remainRate: 100.00, curArch: 0,
            accessoryRate: 20.0, recoSub: 0, curSub: 0, 
            recoTotal: 0, curTotal: 0
        },
        {
            seq: "1-2", dongName: "A동(주2)", usage: "기계실", area: 125.60, structureName: "1.0", buildYear: 1977,
            structureCode: "6-1-5-6-3", unitPrice: 1170000, laborCost: 71, priceIndex: 1.0245, 
            recoArch: 150552000, depRate: 1.78, remainRate: 30.00, curArch: 45165000,
            accessoryRate: 20.0, recoSub: 30110000, curSub: 9033000, 
            recoTotal: 180662000, curTotal: 54198000
        }
    ];

    // Slide 4(표제부), Slide 5(층별), Slide 7(화협) 테이블에 샘플 데이터 밀어넣기
    renderEvalTable('tbodyTitleEval', sampleValuationData);
    renderEvalTable('tbodyFloorEval', sampleValuationData);
    renderEvalTable('tbodyKfpaEval', sampleValuationData);
}