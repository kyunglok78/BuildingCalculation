// ============================================================================
// api_inflation.js - [섹션 2] 코어 상태 관리 및 초기화 (마법사 항목 수정 및 CSS 개선)
// ============================================================================

window.infState = {
    mode: 'location',
    tabs: [],
    activeTab: '',
    step: 1, // 1: 정제, 2: 평가
    data: {}, // { tabName: { raw: [], history: [], selectedRows: Set, selectedCols: Set } }
    
    wizard: {
        active: false,
        phase: 'idle', // 'idle' -> 'mapping' -> 'row-delete'
        // '취득년도' 제거 (자동 생성됨)
        columns: ['소재지', '자산계정', '자산번호', '자산명', '취득일', '취득가액'],
        activeTarget: '', 
        mapped: {} 
    },
    
    lastClickedRow: -1,
    lastClickedCol: -1
};

// CSS 동적 추가 (행 선택 하이라이트 문제 완벽 해결!)
(function addInfStyles() {
    if(document.getElementById('inf-dynamic-styles')) document.getElementById('inf-dynamic-styles').remove();
    const style = document.createElement('style');
    style.id = 'inf-dynamic-styles';
    style.innerHTML = `
        /* 열과 행 선택 시 내부 셀 색상까지 우선 적용되도록 수정 */
        .inf-sel-col { background-color: #dbeafe !important; }
        tr.inf-sel-row td { background-color: #dbeafe !important; }
        .inf-header:hover { background-color: #e2e8f0; cursor: pointer; }
        .inf-row-header:hover { background-color: #e2e8f0; cursor: pointer; }
        .wiz-btn { padding:6px 14px; border-radius:20px; font-size:13px; font-weight:bold; cursor:pointer; transition: 0.2s; }
        .wiz-btn.active { background:#1C5691 !important; color:#fff !important; border:2px solid #1C5691 !important; box-shadow:0 0 8px rgba(28,86,145,0.4); }
        .wiz-btn.mapped { background:#e2e8f0 !important; color:#64748b !important; border:2px solid #cbd5e1 !important; }
        .wiz-btn.default { background:#fff; color:#333; border:2px solid #ccc; }
    `;
    document.head.appendChild(style);
})();

// (1) 탭 초기화
window.infInitTabs = function() {
    const modeObj = document.querySelector('input[name="infMode"]:checked');
    if(!modeObj) return;
    window.infState.mode = modeObj.value;
    window.infState.tabs = window.infState.mode === 'integrated' ? ['통합자산명세서'] : 
        Array.from(document.querySelectorAll('#locationTbody tr')).map(row => row.querySelector('.loc-name') ? row.querySelector('.loc-name').value.trim() : '').filter(n => n);
    
    if(window.infState.tabs.length === 0) window.infState.tabs = ['기본 사업장'];

    const tabContainer = document.getElementById('infTabs');
    if(!tabContainer) return;
    tabContainer.innerHTML = '';
    
    window.infState.tabs.forEach((tabName, idx) => {
        if(!window.infState.data[tabName]) window.infState.data[tabName] = { raw: [], history: [], selectedRows: new Set(), selectedCols: new Set() };
        
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

document.addEventListener("DOMContentLoaded", () => {
    const infMenu = document.getElementById('nav-sec-2-3');
    if(infMenu) infMenu.addEventListener('click', () => { if(window.infState.tabs.length === 0) infInitTabs(); });
});

// ============================================================================
// api_inflation.js - [섹션 3] 엑셀 데이터 로드 및 매핑 마법사 (취득년도 자동 생성 로직 추가)
// ============================================================================

window.infLoadExcel = function(event) {
    const file = event.target.files[0];
    if(!file) return;
    const tabName = window.infState.activeTab;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), {type: 'array'}).Sheets[XLSX.read(new Uint8Array(e.target.result), {type: 'array'}).SheetNames[0]], {header: 1, defval: ""});
            if(jsonData.length === 0) return alert("엑셀 파일이 비어있습니다.");
            
            window.infState.data[tabName].raw = jsonData;
            window.infState.data[tabName].history = [];
            window.infState.wizard.phase = 'idle';
            
            document.getElementById('infWizardArea').style.display = 'flex';
            document.getElementById('btnStartWizard').style.display = 'inline-block';
            document.getElementById('btnFinishMapping').style.display = 'none';
            document.getElementById('infMappingButtons').style.display = 'none';
            document.getElementById('infWizardText').innerHTML = `🎯 원본 데이터를 불러왔습니다. 우측의 <b>'열 매핑 마법사 시작'</b>을 눌러주세요.`;
            document.getElementById('btnInfNextStep').style.display = 'none';
            
            infRenderTable();
        } catch(err) { alert("엑셀 로드 오류: " + err); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

window.infStartWizard = function() {
    const wiz = window.infState.wizard;
    wiz.active = true;
    wiz.phase = 'mapping';
    wiz.mapped = {};
    wiz.activeTarget = wiz.columns[0];
    
    document.getElementById('btnStartWizard').style.display = 'none';
    document.getElementById('btnFinishMapping').style.display = 'inline-block';
    document.getElementById('infMappingButtons').style.display = 'flex';
    document.getElementById('infWizardText').innerHTML = `🎯 아래 버튼 중 하나를 선택하고, 일치하는 엑셀 <span style="background:#FFCC00; padding:2px 5px; border-radius:3px; color:#000;">열 상단(알파벳)</span>을 클릭하세요. (없는 항목은 무시하세요)`;
    
    infUpdateWizardUI();
    infRenderTable();
};

window.infSetMappingTarget = function(colName) {
    window.infState.wizard.activeTarget = colName;
    infUpdateWizardUI();
};

window.infUpdateWizardUI = function() {
    const wiz = window.infState.wizard;
    const btnContainer = document.getElementById('infMappingButtons');
    if(!btnContainer) return;
    
    btnContainer.innerHTML = '';
    wiz.columns.forEach(colName => {
        const isMapped = wiz.mapped[colName] !== undefined;
        const isActive = wiz.activeTarget === colName;
        
        const btn = document.createElement('button');
        btn.innerText = colName + (isMapped ? ' ✓' : '');
        btn.className = `wiz-btn ${isActive ? 'active' : (isMapped ? 'mapped' : 'default')}`;
        btn.onclick = () => infSetMappingTarget(colName);
        btnContainer.appendChild(btn);
    });
};

// ★ 핵심: 매핑 완료 시 '취득년도' 자동 추출 및 삽입 ★
window.infFinishMapping = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    
    const mappedCols = wiz.columns.map(name => ({ name, oldIdx: wiz.mapped[name] })).filter(mc => mc.oldIdx !== undefined);
    
    if (mappedCols.length === 0) return alert("매칭된 열이 하나도 없습니다. 최소 1개 이상 항목을 엑셀 열과 매칭해주세요.");
    if (!confirm("매칭되지 않은 불필요한 열은 모두 자동으로 삭제됩니다.\n'행 지우기' 단계로 넘어가시겠습니까?")) return;

    infSaveHistory();

    // 우리가 최종적으로 원하는 표준 열 순서 (취득년도 포함)
    const finalColumns = ['소재지', '자산계정', '자산번호', '자산명', '취득일', '취득년도', '취득가액'];

    // 매칭된 열 추출 + 취득년도 파싱 
    tData.raw = tData.raw.map(oldRow => {
        const newRow = [];
        finalColumns.forEach((colName, newIdx) => {
            if (colName === '취득년도') {
                // 취득일에서 년도 4자리 추출
                const dateCol = mappedCols.find(mc => mc.name === '취득일');
                let year = '';
                if (dateCol && oldRow[dateCol.oldIdx] !== undefined) {
                    const match = String(oldRow[dateCol.oldIdx]).match(/(19|20)\d{2}/);
                    if (match) year = match[0];
                }
                newRow[newIdx] = year;
            } else {
                const mappedCol = mappedCols.find(mc => mc.name === colName);
                newRow[newIdx] = (mappedCol && oldRow[mappedCol.oldIdx] !== undefined) ? oldRow[mappedCol.oldIdx] : '';
            }
        });
        return newRow;
    });
    
    wiz.mapped = {};
    finalColumns.forEach((colName, idx) => { wiz.mapped[colName] = idx; });
    
    wiz.phase = 'row-delete';
    wiz.activeTarget = '';
    
    document.getElementById('infWizardText').innerHTML = `🧹 2단계: 불필요한 행(빈 줄, 합계 등)을 지워주세요!<br><span style="font-size:13px; font-weight:normal; color:#666;">여러 행의 번호를 선택 후 키보드 <kbd>Ctrl + -</kbd> (삭제) / 실수했다면 <kbd>Ctrl + Z</kbd> (되돌리기)</span>`;
    document.getElementById('btnFinishMapping').style.display = 'none';
    document.getElementById('infMappingButtons').style.display = 'none';
    document.getElementById('btnInfNextStep').style.display = 'inline-block'; 
    
    tData.selectedCols.clear();
    tData.selectedRows.clear();
    infRenderTable();
};

window.infProceedToStep2 = function() {
    window.infState.step = 2;
    document.getElementById('infStep1Panel').style.display = 'none';
    document.getElementById('btnInfNextStep').style.display = 'none';
    document.getElementById('infStep2Panel').style.display = 'block';
    document.getElementById('btnInfComplete').style.display = 'inline-block';
    infRenderTable();
};

window.infBackToStep1 = function() {
    window.infState.step = 1;
    document.getElementById('infStep1Panel').style.display = 'block';
    document.getElementById('btnInfNextStep').style.display = 'inline-block';
    document.getElementById('infStep2Panel').style.display = 'none';
    document.getElementById('btnInfComplete').style.display = 'none';
    infRenderTable(); 
};


// ============================================================================
// api_inflation.js - [섹션 3] 엑셀 데이터 로드 및 매핑 마법사 (취득년도 자동 생성 로직 추가)
// ============================================================================

window.infLoadExcel = function(event) {
    const file = event.target.files[0];
    if(!file) return;
    const tabName = window.infState.activeTab;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), {type: 'array'}).Sheets[XLSX.read(new Uint8Array(e.target.result), {type: 'array'}).SheetNames[0]], {header: 1, defval: ""});
            if(jsonData.length === 0) return alert("엑셀 파일이 비어있습니다.");
            
            window.infState.data[tabName].raw = jsonData;
            window.infState.data[tabName].history = [];
            window.infState.wizard.phase = 'idle';
            
            document.getElementById('infWizardArea').style.display = 'flex';
            document.getElementById('btnStartWizard').style.display = 'inline-block';
            document.getElementById('btnFinishMapping').style.display = 'none';
            document.getElementById('infMappingButtons').style.display = 'none';
            document.getElementById('infWizardText').innerHTML = `🎯 원본 데이터를 불러왔습니다. 우측의 <b>'열 매핑 마법사 시작'</b>을 눌러주세요.`;
            document.getElementById('btnInfNextStep').style.display = 'none';
            
            infRenderTable();
        } catch(err) { alert("엑셀 로드 오류: " + err); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

window.infStartWizard = function() {
    const wiz = window.infState.wizard;
    wiz.active = true;
    wiz.phase = 'mapping';
    wiz.mapped = {};
    wiz.activeTarget = wiz.columns[0];
    
    document.getElementById('btnStartWizard').style.display = 'none';
    document.getElementById('btnFinishMapping').style.display = 'inline-block';
    document.getElementById('infMappingButtons').style.display = 'flex';
    document.getElementById('infWizardText').innerHTML = `🎯 아래 버튼 중 하나를 선택하고, 일치하는 엑셀 <span style="background:#FFCC00; padding:2px 5px; border-radius:3px; color:#000;">열 상단(알파벳)</span>을 클릭하세요. (없는 항목은 무시하세요)`;
    
    infUpdateWizardUI();
    infRenderTable();
};

window.infSetMappingTarget = function(colName) {
    window.infState.wizard.activeTarget = colName;
    infUpdateWizardUI();
};

window.infUpdateWizardUI = function() {
    const wiz = window.infState.wizard;
    const btnContainer = document.getElementById('infMappingButtons');
    if(!btnContainer) return;
    
    btnContainer.innerHTML = '';
    wiz.columns.forEach(colName => {
        const isMapped = wiz.mapped[colName] !== undefined;
        const isActive = wiz.activeTarget === colName;
        
        const btn = document.createElement('button');
        btn.innerText = colName + (isMapped ? ' ✓' : '');
        btn.className = `wiz-btn ${isActive ? 'active' : (isMapped ? 'mapped' : 'default')}`;
        btn.onclick = () => infSetMappingTarget(colName);
        btnContainer.appendChild(btn);
    });
};

// ★ 핵심: 매핑 완료 시 '취득년도' 자동 추출 및 삽입 ★
window.infFinishMapping = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    
    const mappedCols = wiz.columns.map(name => ({ name, oldIdx: wiz.mapped[name] })).filter(mc => mc.oldIdx !== undefined);
    
    if (mappedCols.length === 0) return alert("매칭된 열이 하나도 없습니다. 최소 1개 이상 항목을 엑셀 열과 매칭해주세요.");
    if (!confirm("매칭되지 않은 불필요한 열은 모두 자동으로 삭제됩니다.\n'행 지우기' 단계로 넘어가시겠습니까?")) return;

    infSaveHistory();

    // 우리가 최종적으로 원하는 표준 열 순서 (취득년도 포함)
    const finalColumns = ['소재지', '자산계정', '자산번호', '자산명', '취득일', '취득년도', '취득가액'];

    // 매칭된 열 추출 + 취득년도 파싱 
    tData.raw = tData.raw.map(oldRow => {
        const newRow = [];
        finalColumns.forEach((colName, newIdx) => {
            if (colName === '취득년도') {
                // 취득일에서 년도 4자리 추출
                const dateCol = mappedCols.find(mc => mc.name === '취득일');
                let year = '';
                if (dateCol && oldRow[dateCol.oldIdx] !== undefined) {
                    const match = String(oldRow[dateCol.oldIdx]).match(/(19|20)\d{2}/);
                    if (match) year = match[0];
                }
                newRow[newIdx] = year;
            } else {
                const mappedCol = mappedCols.find(mc => mc.name === colName);
                newRow[newIdx] = (mappedCol && oldRow[mappedCol.oldIdx] !== undefined) ? oldRow[mappedCol.oldIdx] : '';
            }
        });
        return newRow;
    });
    
    wiz.mapped = {};
    finalColumns.forEach((colName, idx) => { wiz.mapped[colName] = idx; });
    
    wiz.phase = 'row-delete';
    wiz.activeTarget = '';
    
    document.getElementById('infWizardText').innerHTML = `🧹 2단계: 불필요한 행(빈 줄, 합계 등)을 지워주세요!<br><span style="font-size:13px; font-weight:normal; color:#666;">여러 행의 번호를 선택 후 키보드 <kbd>Ctrl + -</kbd> (삭제) / 실수했다면 <kbd>Ctrl + Z</kbd> (되돌리기)</span>`;
    document.getElementById('btnFinishMapping').style.display = 'none';
    document.getElementById('infMappingButtons').style.display = 'none';
    document.getElementById('btnInfNextStep').style.display = 'inline-block'; 
    
    tData.selectedCols.clear();
    tData.selectedRows.clear();
    infRenderTable();
};

window.infProceedToStep2 = function() {
    window.infState.step = 2;
    document.getElementById('infStep1Panel').style.display = 'none';
    document.getElementById('btnInfNextStep').style.display = 'none';
    document.getElementById('infStep2Panel').style.display = 'block';
    document.getElementById('btnInfComplete').style.display = 'inline-block';
    infRenderTable();
};

window.infBackToStep1 = function() {
    window.infState.step = 1;
    document.getElementById('infStep1Panel').style.display = 'block';
    document.getElementById('btnInfNextStep').style.display = 'inline-block';
    document.getElementById('infStep2Panel').style.display = 'none';
    document.getElementById('btnInfComplete').style.display = 'none';
    infRenderTable(); 
};


// ============================================================================
// api_inflation.js - [섹션 4] 테이블 렌더링 (행 선택 하이라이트 버그 완벽 수정!)
// ============================================================================

window.infRenderTable = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return;

    const data = tData.raw;
    const thead = document.getElementById('infThead');
    const tbody = document.getElementById('infTbody');
    thead.innerHTML = ''; tbody.innerHTML = '';

    const colCount = data[0].length;
    const headerTr = document.createElement('tr');
    headerTr.innerHTML = `<th style="width:40px; background:#f8fafc; border:1px solid #ccc;"></th>`; 
    
    const step2Cols = ['구분', '물가지수', '재조달가액', '감가율', '잔가율', '현재가액', '비고'];
    const mappedKeys = Object.keys(wiz.mapped); 

    for(let c = 0; c < colCount; c++) {
        const isSelected = tData.selectedCols.has(c) ? 'inf-sel-col' : '';
        const th = document.createElement('th');
        th.className = `inf-header ${isSelected}`;
        th.style.cssText = `background:#f8fafc; border:1px solid #ccc; padding:8px; text-align:center; font-weight:bold; min-width:80px;`;
        
        if (wiz.phase === 'mapping' || wiz.phase === 'idle') {
            let colLetter = String.fromCharCode(65 + (c % 26)); 
            if (c >= 26) colLetter = String.fromCharCode(64 + Math.floor(c / 26)) + colLetter;
            
            let mappedLabel = "";
            for (const [key, val] of Object.entries(wiz.mapped)) {
                if (val === c) mappedLabel = `<br><span style="background:#FFCC00; color:#000; font-size:11px; padding:2px 4px; border-radius:3px;">${key}</span>`;
            }
            th.innerHTML = `${colLetter} ${mappedLabel}`;
        } else {
            th.innerHTML = mappedKeys[c] || `데이터 ${c+1}`;
            th.style.background = '#e9ecef';
            th.style.color = '#1C5691';
        }
        
        th.onclick = (e) => {
            if (window.infState.step === 1 && wiz.phase === 'mapping') {
                if (!wiz.activeTarget) return alert("위에서 매칭할 항목 버튼을 먼저 선택해주세요.");
                wiz.mapped[wiz.activeTarget] = c;
                const unmapped = wiz.columns.find(col => wiz.mapped[col] === undefined);
                wiz.activeTarget = unmapped || ''; 
                infUpdateWizardUI();
                infRenderTable();
                return;
            }
            
            if (e.shiftKey && window.infState.lastClickedCol !== -1) {
                const start = Math.min(window.infState.lastClickedCol, c), end = Math.max(window.infState.lastClickedCol, c);
                for(let i=start; i<=end; i++) tData.selectedCols.add(i);
            } else {
                if (!e.ctrlKey && !e.metaKey) tData.selectedCols.clear();
                tData.selectedCols.has(c) ? tData.selectedCols.delete(c) : tData.selectedCols.add(c);
            }
            window.infState.lastClickedCol = c;
            tData.selectedRows.clear(); 
            infRenderTable();
        };
        headerTr.appendChild(th);
    }
    
    if(window.infState.step === 2) {
        step2Cols.forEach(colName => {
            headerTr.innerHTML += `<th style="background:#1C5691; color:#fff; border:1px solid #ccc; padding:8px; text-align:center;">${colName}</th>`;
        });
    }
    thead.appendChild(headerTr);

    // ★ 행 렌더링 (버그 수정됨) ★
    data.forEach((row, rIdx) => {
        const isRowSel = tData.selectedRows.has(rIdx);
        const tr = document.createElement('tr');
        
        // 핵심 수정: tr 태그 자체에 클래스를 줘야 CSS가 완벽히 적용됩니다!
        tr.className = isRowSel ? 'inf-sel-row' : ''; 
        tr.style.cursor = 'pointer'; // 어느 칸이든 누를 수 있게 마우스 커서 변경
        
        let rowHtml = `<td class="inf-row-header" style="background:#f8fafc; border:1px solid #ccc; text-align:center; font-weight:bold; color:#666;">${rIdx + 1}</td>`;

        for(let c = 0; c < colCount; c++) {
            const isColSel = tData.selectedCols.has(c) ? 'inf-sel-col' : '';
            let cellVal = row[c] !== undefined ? row[c] : '';
            let align = 'left';
            
            if (wiz.phase !== 'mapping' && wiz.phase !== 'idle') {
                const headerName = mappedKeys[c];
                const isNumericCol = headerName === '취득가액' || headerName === '재조달가액' || headerName === '현재가액' || (cellVal !== '' && !isNaN(String(cellVal).replace(/,/g, '')));
                
                if (isNumericCol && cellVal !== '') {
                    const num = Number(String(cellVal).replace(/,/g, ''));
                    if (!isNaN(num)) {
                        cellVal = num.toLocaleString('ko-KR');
                        align = 'right';
                    }
                }
            }
            rowHtml += `<td class="${isColSel}" style="border:1px solid #eee; padding:6px 10px; max-width:200px; overflow:hidden; text-overflow:ellipsis; text-align:${align};">${cellVal}</td>`;
        }
        
        if(window.infState.step === 2) {
            step2Cols.forEach(c => { rowHtml += `<td style="border:1px solid #eee; background:#f0fdf4;">-</td>`; });
        }
        
        tr.innerHTML = rowHtml;

        // 행 전체 클릭 이벤트
        tr.onclick = (e) => {
            if (window.infState.step === 1 && wiz.phase === 'mapping') return;

            if (e.shiftKey && window.infState.lastClickedRow !== -1) {
                const start = Math.min(window.infState.lastClickedRow, rIdx), end = Math.max(window.infState.lastClickedRow, rIdx);
                for(let i=start; i<=end; i++) tData.selectedRows.add(i);
            } else if (e.ctrlKey || e.metaKey) {
                tData.selectedRows.has(rIdx) ? tData.selectedRows.delete(rIdx) : tData.selectedRows.add(rIdx);
            } else {
                tData.selectedRows.clear();
                tData.selectedRows.add(rIdx);
            }
            window.infState.lastClickedRow = rIdx;
            tData.selectedCols.clear();
            infRenderTable();
        };

        tbody.appendChild(tr);
    });
};

window.infSaveHistory = function() {
    const tData = window.infState.data[window.infState.activeTab];
    if(tData.history.length > 10) tData.history.shift();
    tData.history.push(JSON.parse(JSON.stringify(tData.raw)));
};

document.addEventListener('keydown', function(e) {
    const sec = document.getElementById('sec-2-3');
    if (!sec || !sec.classList.contains('active')) return;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData) return;

    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if(tData.history.length === 0) return alert("더 이상 되돌릴 작업이 없습니다.");
        tData.raw = tData.history.pop();
        tData.selectedRows.clear(); tData.selectedCols.clear();
        infRenderTable();
    }
    
    if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        if (tData.selectedRows.size === 0 && tData.selectedCols.size === 0) return;
        infSaveHistory();
        
        if (tData.selectedRows.size > 0) {
            Array.from(tData.selectedRows).sort((a,b) => b - a).forEach(rIdx => tData.raw.splice(rIdx, 1));
            tData.selectedRows.clear();
        } else if (tData.selectedCols.size > 0) {
            const colsToDelete = Array.from(tData.selectedCols).sort((a,b) => b - a);
            tData.raw.forEach(row => colsToDelete.forEach(cIdx => row.splice(cIdx, 1)));
            tData.selectedCols.clear();
        }
        infRenderTable();
    }
});



// 히스토리 및 단축키 로직
window.infSaveHistory = function() {
    const tData = window.infState.data[window.infState.activeTab];
    if(tData.history.length > 10) tData.history.shift();
    tData.history.push(JSON.parse(JSON.stringify(tData.raw)));
};

document.addEventListener('keydown', function(e) {
    const sec = document.getElementById('sec-2-3');
    if (!sec || !sec.classList.contains('active')) return;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData) return;

    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if(tData.history.length === 0) return alert("더 이상 되돌릴 작업이 없습니다.");
        tData.raw = tData.history.pop();
        tData.selectedRows.clear(); tData.selectedCols.clear();
        infRenderTable();
    }
    
    if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        if (tData.selectedRows.size === 0 && tData.selectedCols.size === 0) return;
        infSaveHistory();
        
        if (tData.selectedRows.size > 0) {
            Array.from(tData.selectedRows).sort((a,b) => b - a).forEach(rIdx => tData.raw.splice(rIdx, 1));
            tData.selectedRows.clear();
        } else if (tData.selectedCols.size > 0) {
            const colsToDelete = Array.from(tData.selectedCols).sort((a,b) => b - a);
            tData.raw.forEach(row => colsToDelete.forEach(cIdx => row.splice(cIdx, 1)));
            tData.selectedCols.clear();
        }
        infRenderTable();
    }
});