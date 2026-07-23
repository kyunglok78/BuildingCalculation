// ============================================================================
// api_inflation.js - 2.3 물가보정 평가 모듈 (고정자산명세서 정리)
// ============================================================================

window.infState = {
    mode: 'location',     // 'location' (소재지별) 또는 'integrated' (통합)
    rawArray: [],         // 엑셀에서 불러온 원본 2차원 배열 데이터
    currentArray: [],     // 현재 화면에 렌더링 중인 2차원 배열 데이터
    history: []           // Ctrl+Z (되돌리기)를 위한 스택
};

// (1) 평가 방식 변경
window.infChangeMode = function() {
    const modes = document.getElementsByName('inflationMode');
    modes.forEach(radio => { if(radio.checked) window.infState.mode = radio.value; });
    // TODO: 데이터가 이미 로드된 상태라면 탭을 새로 그리는 로직 연동
};

// (2) 엑셀 불러오기
window.infLoadExcel = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // 행렬 조작을 쉽게 하기 위해 header: 1 옵션 사용 (2차원 배열 형태)
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ""});
            
            if(jsonData.length === 0) return alert("엑셀 파일에 데이터가 없습니다.");

            window.infState.rawArray = JSON.parse(JSON.stringify(jsonData));
            window.infState.currentArray = JSON.parse(JSON.stringify(jsonData));
            window.infState.history = []; // 히스토리 초기화

            infRenderTable();
            alert("✅ 고정자산명세서를 성공적으로 불러왔습니다.\n불필요한 행과 열을 체크하여 삭제해 주세요.");
        } catch(err) {
            alert("엑셀 파일 읽기 중 오류 발생: " + err);
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

// 테이블 렌더링 (체크박스 포함)
window.infRenderTable = function() {
    const thead = document.getElementById('infThead');
    const tbody = document.getElementById('infTbody');
    const data = window.infState.currentArray;
    
    thead.innerHTML = ''; tbody.innerHTML = '';
    if(!data || data.length === 0) return;

    // 첫 번째 행은 열 삭제용 체크박스를 생성
    const colCount = data[0].length;
    const headerTr = document.createElement('tr');
    
    // 좌측 상단 모서리 빈 칸 (행 삭제용 체크박스 자리)
    headerTr.innerHTML = `<th style="width: 40px; background:#e9ecef; text-align:center;">행/열</th>`;
    
    for(let c = 0; c < colCount; c++) {
        headerTr.innerHTML += `<th style="background:#e9ecef; text-align:center;">
            <input type="checkbox" class="inf-col-chk" data-col="${c}" style="cursor:pointer;" title="이 열 삭제">
            <div style="font-size:11px; margin-top:3px; font-weight:normal;">열 선택</div>
        </th>`;
    }
    thead.appendChild(headerTr);

    // 실제 데이터 렌더링
    data.forEach((row, rIdx) => {
        const tr = document.createElement('tr');
        tr.style.backgroundColor = rIdx % 2 === 0 ? '#ffffff' : '#f8f9fa';
        
        // 맨 좌측: 행 삭제용 체크박스
        tr.innerHTML = `<td style="text-align:center; border-right:2px solid #ccc; background:#f4f5f7;">
            <input type="checkbox" class="inf-row-chk" data-row="${rIdx}" style="cursor:pointer;" title="이 행 삭제">
            <span style="font-size:10px; margin-left:4px;">${rIdx+1}</span>
        </td>`;
        
        // 열 데이터
        for(let c = 0; c < colCount; c++) {
            tr.innerHTML += `<td style="padding: 6px 10px;">${row[c] || ''}</td>`;
        }
        tbody.appendChild(tr);
    });
};

// 현재 상태를 히스토리에 저장 (되돌리기 용도)
window.infSaveHistory = function() {
    // 최대 10번까지만 기억
    if(window.infState.history.length > 10) window.infState.history.shift(); 
    window.infState.history.push(JSON.parse(JSON.stringify(window.infState.currentArray)));
};

// (3) 선택 열 삭제
window.infDeleteCols = function() {
    const colChks = document.querySelectorAll('.inf-col-chk:checked');
    if(colChks.length === 0) return alert("삭제할 열 상단의 체크박스를 선택해주세요.");
    
    infSaveHistory();
    
    // 삭제할 인덱스를 내림차순으로 정렬하여 앞에서부터 지워질 때 인덱스가 꼬이지 않게 함
    const colsToDelete = Array.from(colChks).map(chk => parseInt(chk.dataset.col)).sort((a,b) => b - a);
    
    window.infState.currentArray.forEach(row => {
        colsToDelete.forEach(cIdx => row.splice(cIdx, 1));
    });
    
    infRenderTable();
};

// (4) 선택 행 삭제
window.infDeleteRows = function() {
    const rowChks = document.querySelectorAll('.inf-row-chk:checked');
    if(rowChks.length === 0) return alert("삭제할 행 좌측의 체크박스를 선택해주세요.");
    
    infSaveHistory();
    
    const rowsToDelete = Array.from(rowChks).map(chk => parseInt(chk.dataset.row)).sort((a,b) => b - a);
    rowsToDelete.forEach(rIdx => {
        window.infState.currentArray.splice(rIdx, 1);
    });
    
    infRenderTable();
};

// (5) 되돌리기 (Ctrl+Z 효과)
window.infUndo = function() {
    if(window.infState.history.length === 0) return alert("더 이상 되돌릴 작업이 없습니다.");
    window.infState.currentArray = window.infState.history.pop();
    infRenderTable();
};

// 단축키 연동 (Ctrl + Z)
document.addEventListener('keydown', function(event) {
    // 물가보정 섹션이 화면에 보일 때만 작동하도록 조건 처리 필요
    const sec = document.getElementById('sec-2-3');
    if (sec && sec.classList.contains('active') && (event.ctrlKey || event.metaKey) && event.key === 'z') {
        infUndo();
    }
});

// (6~7) 소계 및 부분합 검증
window.infCalculateSubtotals = function() {
    alert("현재 남은 데이터를 기준으로 [소재지] 및 [자산계정별] 부분합을 계산하는 로직이 들어갈 자리입니다.");
    // 1단계 열 정리가 완료된 후 어느 열이 '소재지'이고 어느 열이 '금액'인지 매핑하는 로직 필요
};

// (8) 물가지수 넣기 로직으로 전환
window.infProceedToPriceIndex = function() {
    alert("행렬 정리가 완료되었습니다. 2단계인 '자산 구분' 및 '물가지수 적용' 단계로 넘어갑니다.");
    // 이후 스텝 전개 로직 추가 예정
};