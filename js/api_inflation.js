// ============================================================================
// api_inflation.js - 2.3 물가보정 평가 모듈 (마법사 및 엑셀형 다중 선택 적용)
// ============================================================================

window.infState = {
    mode: 'location',
    tabs: [],
    activeTab: '',
    step: 1, // 1: 정제, 2: 평가
    data: {}, // { tabName: { raw: [], history: [], selectedRows: Set, selectedCols: Set } }
    
    // 마법사 관련 상태
    wizard: {
        active: false,
        columns: ['소재지', '자산계정', '자산번호', '자산명', '취득일', '취득년도', '취득가액'],
        currentIndex: 0,
        mapped: {} // { '소재지': 2 (colIndex) }
    },
    
    // 다중 선택을 위한 마지막 클릭 인덱스 보관 (Shift-click 구현용)
    lastClickedRow: -1,
    lastClickedCol: -1
};

// CSS 동적 추가 (엑셀 선택 효과용)
(function addInfStyles() {
    if(document.getElementById('inf-dynamic-styles')) return;
    const style = document.createElement('style');
    style.id = 'inf-dynamic-styles';
    style.innerHTML = `
        .inf-sel-col { background-color: #dbeafe !important; }
        .inf-sel-row { background-color: #dbeafe !important; }
        .inf-header:hover { background-color: #e2e8f0; cursor: pointer; }
        .inf-row-header:hover { background-color: #e2e8f0; cursor: pointer; }
    `;
    document.head.appendChild(style);
})();

// (1) 탭 초기화 (1.1 일반정보에서 가져오기)
window.infInitTabs = function() {
    const modeObj = document.querySelector('input[name="infMode"]:checked');
    if(!modeObj) return;
    const mode = modeObj.value;
    window.infState.mode = mode;
    window.infState.tabs = [];
    
    if(mode === 'integrated') {
        window.infState.tabs = ['통합자산명세서'];
    } else {
        document.querySelectorAll('#locationTbody tr').forEach(row => {
            const name = row.querySelector('.loc-name') ? row.querySelector('.loc-name').value.trim() : '';
            // 물가보정 체크된 항목만 가져오려면 여기서 필터링 가능 (현재는 이름 있으면 가져옴)
            if(name) window.infState.tabs.push(name);
        });
        if(window.infState.tabs.length === 0) window.infState.tabs = ['기본 사업장'];
    }

    const tabContainer = document.getElementById('infTabs');
    if(!tabContainer) return;
    tabContainer.innerHTML = '';
    
    window.infState.tabs.forEach((tabName, idx) => {
        if(!window.infState.data[tabName]) {
            window.infState.data[tabName] = { raw: [], history: [], selectedRows: new Set(), selectedCols: new Set() };
        }
        
        const tabBtn = document.createElement('div');
        tabBtn.innerText = tabName;
        tabBtn.className = 'inf-tab-btn';
        tabBtn.style.cssText = `padding:10px 20px; cursor:pointer; font-weight:normal; border:1px solid #e2e8f0; border-bottom:none; border-radius:4px 4px 0 0; margin-right:5px; background:#f1f5f9; color:#94a3b8;`;
        
        tabBtn.onclick = () => {
            document.querySelectorAll('.inf-tab-btn').forEach(c => { c.style.background = '#f1f5f9'; c.style.color = '#94a3b8'; c.style.fontWeight = 'normal'; c.style.borderColor = '#e2e8f0'; });
            tabBtn.style.background = '#1C5691'; tabBtn.style.color = '#ffffff'; tabBtn.style.fontWeight = 'bold'; tabBtn.style.borderColor = '#1C5691';
            window.infState.activeTab = tabName;
            infRenderTable();
        };
        tabContainer.appendChild(tabBtn);
        
        if(idx === 0) tabBtn.click();
    });
};

// 탭 표시 화면 진입 시 초기화 트리거
document.addEventListener("DOMContentLoaded", () => {
    const infMenu = document.getElementById('nav-sec-2-3');
    if(infMenu) {
        infMenu.addEventListener('click', () => {
            if(window.infState.tabs.length === 0) infInitTabs();
        });
    }
});

// ==========================================
// 엑셀 데이터 로드 및 매핑 마법사
// ==========================================

window.infLoadExcel = function(event) {
    const file = event.target.files[0];
    if(!file) return;
    const tabName = window.infState.activeTab;
    if(!tabName) return alert("선택된 탭이 없습니다.");

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ""});
            
            if(jsonData.length === 0) return alert("엑셀 파일이 비어있습니다.");

            window.infState.data[tabName].raw = jsonData;
            window.infState.data[tabName].history = [];
            
            document.getElementById('infWizardArea').style.display = 'flex';
            document.getElementById('btnInfNextStep').style.display = 'inline-block';
            infRenderTable();
        } catch(err) { alert("엑셀 로드 오류: " + err); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

// 마법사 시작
window.infStartWizard = function() {
    window.infState.wizard.active = true;
    window.infState.wizard.currentIndex = 0;
    window.infState.wizard.mapped = {};
    infUpdateWizardUI();
};

window.infUpdateWizardUI = function() {
    const wiz = window.infState.wizard;
    const targetText = document.getElementById('infWizardText');
    const statusText = document.getElementById('infWizardStatus');
    
    if (wiz.currentIndex >= wiz.columns.length) {
        targetText.innerHTML = `🎉 열 매핑 완료! 이제 <kbd>Ctrl + -</kbd> 로 불필요한 행을 지우거나 우측 하단의 <b>'2단계로 전환'</b>을 누르세요.`;
        statusText.innerText = `(7/7 완료)`;
        wiz.active = false;
        return;
    }
    
    const currColName = wiz.columns[wiz.currentIndex];
    targetText.innerHTML = `🎯 1단계: <b>[${currColName}]</b> 데이터가 있는 <span style="background:#FFCC00; padding:2px 5px; border-radius:3px;">열 상단(알파벳)</span>을 클릭해 주세요!`;
    statusText.innerText = `(${wiz.currentIndex}/7 완료)`;
};

// 2단계 워크시트로 전환
window.infProceedToStep2 = function() {
    window.infState.step = 2;
    document.getElementById('infStep1Panel').style.display = 'none';
    document.getElementById('btnInfNextStep').style.display = 'none';
    document.getElementById('infStep2Panel').style.display = 'block';
    document.getElementById('btnInfComplete').style.display = 'inline-block';
    
    infRenderTable(); // 2단계용 테이블 렌더링
};

window.infBackToStep1 = function() {
    window.infState.step = 1;
    document.getElementById('infStep1Panel').style.display = 'block';
    document.getElementById('btnInfNextStep').style.display = 'inline-block';
    document.getElementById('infStep2Panel').style.display = 'none';
    document.getElementById('btnInfComplete').style.display = 'none';
    
    infRenderTable(); // 1단계용 테이블 렌더링
};

// ==========================================
// 테이블 렌더링, 다중 선택 및 단축키 (Ctrl+- / Ctrl+Z)
// ==========================================

window.infRenderTable = function() {
    const tabName = window.infState.activeTab;
    const tData = window.infState.data[tabName];
    if(!tData || !tData.raw || tData.raw.length === 0) return;

    const data = tData.raw;
    const thead = document.getElementById('infThead');
    const tbody = document.getElementById('infTbody');
    thead.innerHTML = ''; tbody.innerHTML = '';

    const colCount = data[0].length;
    
    // --- 헤더 그리기 ---
    const headerTr = document.createElement('tr');
    headerTr.innerHTML = `<th style="width:40px; background:#f8fafc; border:1px solid #ccc;"></th>`; // 좌상단 빈칸
    
    // 2단계 전환 시 추가될 표준 컬럼 배열
    const step2Cols = ['구분', '물가지수', '재조달가액', '감가율', '잔가율', '현재가액', '비고'];

    for(let c = 0; c < colCount; c++) {
        const isSelected = tData.selectedCols.has(c) ? 'inf-sel-col' : '';
        const th = document.createElement('th');
        th.className = `inf-header ${isSelected}`;
        th.style.cssText = `background:#f8fafc; border:1px solid #ccc; padding:8px; text-align:center; font-weight:bold; min-width:80px; position:relative;`;
        
        // 엑셀처럼 알파벳 표시 (A, B, C...)
        let colLetter = String.fromCharCode(65 + (c % 26)); 
        if (c >= 26) colLetter = String.fromCharCode(64 + Math.floor(c / 26)) + colLetter;
        
        // 마법사 매핑 라벨 표시
        let mappedLabel = "";
        for (const [key, val] of Object.entries(window.infState.wizard.mapped)) {
            if (val === c) mappedLabel = `<br><span style="background:#FFCC00; color:#000; font-size:11px; padding:2px 4px; border-radius:3px;">${key}</span>`;
        }

        th.innerHTML = `${colLetter} ${mappedLabel}`;
        
        // 열 클릭 이벤트 (선택 및 마법사 연동)
        th.onclick = (e) => {
            if (window.infState.step === 1 && window.infState.wizard.active) {
                const currColName = window.infState.wizard.columns[window.infState.wizard.currentIndex];
                window.infState.wizard.mapped[currColName] = c;
                window.infState.wizard.currentIndex++;
                infUpdateWizardUI();
                infRenderTable();
                return;
            }
            
            // Shift 다중 선택 로직
            if (e.shiftKey && window.infState.lastClickedCol !== -1) {
                const start = Math.min(window.infState.lastClickedCol, c);
                const end = Math.max(window.infState.lastClickedCol, c);
                for(let i=start; i<=end; i++) tData.selectedCols.add(i);
            } else {
                if (!e.ctrlKey && !e.metaKey) tData.selectedCols.clear();
                if (tData.selectedCols.has(c)) tData.selectedCols.delete(c);
                else tData.selectedCols.add(c);
            }
            window.infState.lastClickedCol = c;
            tData.selectedRows.clear(); // 열 선택시 행 선택 초기화
            infRenderTable();
        };
        headerTr.appendChild(th);
    }
    
    // 2단계일 경우 우측에 표준 컬럼 추가
    if(window.infState.step === 2) {
        step2Cols.forEach(colName => {
            headerTr.innerHTML += `<th style="background:#1C5691; color:#fff; border:1px solid #ccc; padding:8px; text-align:center;">${colName}</th>`;
        });
    }
    thead.appendChild(headerTr);

    // --- 바디(행) 그리기 ---
    data.forEach((row, rIdx) => {
        const isRowSel = tData.selectedRows.has(rIdx) ? 'inf-sel-row' : '';
        const tr = document.createElement('tr');
        tr.className = isRowSel;
        
        // 행 번호 (클릭 시 선택)
        const tdNum = document.createElement('td');
        tdNum.className = `inf-row-header`;
        tdNum.style.cssText = `background:#f8fafc; border:1px solid #ccc; text-align:center; font-weight:bold; color:#666;`;
        tdNum.innerText = rIdx + 1;
        tdNum.onclick = (e) => {
            if (e.shiftKey && window.infState.lastClickedRow !== -1) {
                const start = Math.min(window.infState.lastClickedRow, rIdx);
                const end = Math.max(window.infState.lastClickedRow, rIdx);
                for(let i=start; i<=end; i++) tData.selectedRows.add(i);
            } else {
                if (!e.ctrlKey && !e.metaKey) tData.selectedRows.clear();
                if (tData.selectedRows.has(rIdx)) tData.selectedRows.delete(rIdx);
                else tData.selectedRows.add(rIdx);
            }
            window.infState.lastClickedRow = rIdx;
            tData.selectedCols.clear();
            infRenderTable();
        };
        tr.appendChild(tdNum);

        // 데이터 셀
        for(let c = 0; c < colCount; c++) {
            const isColSel = tData.selectedCols.has(c) ? 'inf-sel-col' : '';
            tr.innerHTML += `<td class="${isColSel}" style="border:1px solid #eee; padding:6px 10px; max-width:200px; overflow:hidden; text-overflow:ellipsis;">${row[c] !== undefined ? row[c] : ''}</td>`;
        }
        
        // 2단계일 경우 빈 인풋 셀 추가
        if(window.infState.step === 2) {
            step2Cols.forEach(c => { tr.innerHTML += `<td style="border:1px solid #eee; background:#f0fdf4;">-</td>`; });
        }
        tbody.appendChild(tr);
    });
};

// 히스토리 저장
window.infSaveHistory = function() {
    const tData = window.infState.data[window.infState.activeTab];
    if(tData.history.length > 10) tData.history.shift();
    tData.history.push(JSON.parse(JSON.stringify(tData.raw)));
};

// Ctrl + '-' 지우기 & Ctrl + 'Z' 되돌리기
document.addEventListener('keydown', function(e) {
    const sec = document.getElementById('sec-2-3');
    if (!sec || !sec.classList.contains('active')) return;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData) return;

    // Ctrl + Z (되돌리기)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if(tData.history.length === 0) return alert("더 이상 되돌릴 작업이 없습니다.");
        tData.raw = tData.history.pop();
        tData.selectedRows.clear(); tData.selectedCols.clear();
        infRenderTable();
    }
    
    // Ctrl + - (선택된 행/열 삭제)
    if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        if (tData.selectedRows.size === 0 && tData.selectedCols.size === 0) return;
        infSaveHistory();
        
        if (tData.selectedRows.size > 0) {
            const rowsToDelete = Array.from(tData.selectedRows).sort((a,b) => b - a);
            rowsToDelete.forEach(rIdx => tData.raw.splice(rIdx, 1));
            tData.selectedRows.clear();
        } else if (tData.selectedCols.size > 0) {
            const colsToDelete = Array.from(tData.selectedCols).sort((a,b) => b - a);
            tData.raw.forEach(row => colsToDelete.forEach(cIdx => row.splice(cIdx, 1)));
            tData.selectedCols.clear();
        }
        infRenderTable();
    }
});