// ============================================================================
// api_inflation.js - KB손해보험 가액평가 시스템 (물가보정 통합 완성본)
// ============================================================================

// ============================================================================
// [섹션 2] 코어 상태 관리 및 초기화 
// ============================================================================
window.infState = {
    mode: 'location',
    tabs: [],
    activeTab: '',
    step: 1, // 1: 정제, 2: 구분, 3: 평가
    data: {},
    
    wizard: {
        active: false,
        phase: 'idle',
        columns: ['소재지', '자산계정', '자산번호', '자산명', '국산/외산', '취득일', '취득가액'],
        activeTarget: '', 
        mapped: {} 
    },
    
    foldingLevel: 3, 
    lastClickedRow: -1,
    lastClickedCol: -1,
    pastYear: null // 과거 데이터 연도 저장
};

// CSS 동적 추가
(function addInfStyles() {
    if(document.getElementById('inf-dynamic-styles')) document.getElementById('inf-dynamic-styles').remove();
    const style = document.createElement('style');
    style.id = 'inf-dynamic-styles';
    style.innerHTML = `
        .inf-sel-col { background-color: #dbeafe !important; }
        tr.inf-sel-row td { background-color: #dbeafe !important; }
        .inf-header:hover { background-color: #e2e8f0; cursor: pointer; }
        .inf-row-header:hover { background-color: #e2e8f0; cursor: pointer; }
        .wiz-btn { padding:6px 14px; border-radius:20px; font-size:13px; font-weight:bold; cursor:pointer; transition: 0.2s; }
        .wiz-btn.active { background:#1C5691 !important; color:#fff !important; border:2px solid #1C5691 !important; box-shadow:0 0 8px rgba(28,86,145,0.4); }
        .wiz-btn.mapped { background:#e2e8f0 !important; color:#64748b !important; border:2px solid #cbd5e1 !important; }
        .wiz-btn.default { background:#fff; color:#333; border:2px solid #ccc; }
        .fold-btn { padding: 2px 8px; border: 1px solid #94a3b8; background: #fff; cursor: pointer; font-weight: bold; font-size: 11px; border-radius: 3px; color: #64748b; }
        .fold-btn:hover { background: #e2e8f0; }
        .fold-btn.active { background: #1C5691; color: #fff; border-color: #1C5691; }
    `;
    document.head.appendChild(style);
})();

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
        if(!window.infState.data[tabName]) window.infState.data[tabName] = { raw: [], history: [], selectedRows: new Set(), selectedCols: new Set(), hasSubtotal: false };
        
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
// [섹션 3] 엑셀 로드 및 1단계 매핑 마법사 로직
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
            window.infState.data[tabName].hasSubtotal = false;
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

window.infFinishMapping = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    
    const mappedCols = wiz.columns.map(name => ({ name, oldIdx: wiz.mapped[name] })).filter(mc => mc.oldIdx !== undefined);
    
    if (mappedCols.length === 0) return alert("매칭된 열이 하나도 없습니다. 최소 1개 이상 항목을 엑셀 열과 매칭해주세요.");
    if (!confirm("매칭되지 않은 불필요한 열은 모두 자동으로 삭제됩니다.\n'행 지우기' 단계로 넘어가시겠습니까?")) return;

    infSaveHistory();

    const finalColumns = ['소재지', '자산계정', '자산번호', '자산명', '국산/외산', '취득일', '취득년도', '취득가액'];

    tData.raw = tData.raw.map(oldRow => {
        const newRow = [];
        finalColumns.forEach((colName, newIdx) => {
            if (colName === '취득년도') {
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
    
    document.getElementById('infWizardText').innerHTML = `🧹 1.5단계: 불필요한 행(빈 줄, 합계 등)을 <b>[Ctrl + -]</b> 단축키로 지우시고, <b>우측 하단의 '부분합 및 정렬' 버튼</b>을 눌러 명세서를 검증하세요.`;
    document.getElementById('btnFinishMapping').style.display = 'none';
    document.getElementById('infMappingButtons').style.display = 'none';
    
    const btnNext = document.getElementById('btnInfNextStep');
    btnNext.style.display = 'inline-block';
    btnNext.innerHTML = '<i class="fa-solid fa-layer-group"></i> 부분합(소계) 및 정렬 수행';
    btnNext.style.backgroundColor = '#6f42c1'; 
    btnNext.onclick = () => window.infCalculateSubtotals(false); 
    
    tData.selectedCols.clear();
    tData.selectedRows.clear();
    infRenderTable();
};

window.infProceedToStep2 = function() {
    window.infState.step = 2;
    document.getElementById('infStep1Panel').style.display = 'none';
    document.getElementById('infStep2Panel').style.display = 'block';
    document.getElementById('infStep3Panel').style.display = 'none';
    
    document.getElementById('btnInfNextStep').style.display = 'none';
    document.getElementById('btnInfToStep3').style.display = 'inline-block';
    document.getElementById('btnInfComplete').style.display = 'none';
    infRenderTable();
};

window.infProceedToStep3 = function() {
    window.infState.step = 3;
    document.getElementById('infStep1Panel').style.display = 'none';
    document.getElementById('infStep2Panel').style.display = 'none';
    document.getElementById('infStep3Panel').style.display = 'block';
    
    document.getElementById('btnInfNextStep').style.display = 'none';
    document.getElementById('btnInfToStep3').style.display = 'none';
    document.getElementById('btnInfComplete').style.display = 'inline-block';
    infRenderTable();
};

window.infBackToStep1 = function() {
    window.infState.step = 1;
    document.getElementById('infStep1Panel').style.display = 'block';
    document.getElementById('infStep2Panel').style.display = 'none';
    document.getElementById('infStep3Panel').style.display = 'none';
    
    document.getElementById('btnInfNextStep').style.display = 'inline-block';
    document.getElementById('btnInfToStep3').style.display = 'none';
    document.getElementById('btnInfComplete').style.display = 'none';
    infRenderTable(); 
};

window.infBackToStep2 = function() {
    window.infState.step = 2;
    document.getElementById('infStep1Panel').style.display = 'none';
    document.getElementById('infStep2Panel').style.display = 'block';
    document.getElementById('infStep3Panel').style.display = 'none';
    
    document.getElementById('btnInfNextStep').style.display = 'none';
    document.getElementById('btnInfToStep3').style.display = 'inline-block';
    document.getElementById('btnInfComplete').style.display = 'none';
    infRenderTable(); 
};

// ============================================================================
// [섹션 4] 테이블 렌더링 (헤더 지정 버튼 추가 및 방향키 이동)
// ============================================================================
window.infSetFolding = function(level) {
    window.infState.foldingLevel = level;
    infRenderTable();
};

window.infUpdateCellData = function(rIdx, cIdx, val) {
    const tData = window.infState.data[window.infState.activeTab];
    if(tData && tData.raw[rIdx]) {
        tData.raw[rIdx][cIdx] = val;
    }
};

window.syncToFinal = function(rIdx, finalCIdx, val, currentCIdx) {
    if (!val) return; 
    
    const tData = window.infState.data[window.infState.activeTab];
    if(tData && tData.raw[rIdx]) {
        tData.raw[rIdx][finalCIdx] = val; 
        
        const finalInput = document.getElementById(`infInput_${rIdx}_${finalCIdx}`);
        if (finalInput) {
            finalInput.value = val; 
            finalInput.parentElement.style.backgroundColor = '#ffe5e5'; 
        }
        
        if (currentCIdx !== undefined) {
            const startIdx = finalCIdx - 4;
            for (let i = 0; i < 4; i++) {
                const colIdx = startIdx + i;
                const cellInput = document.getElementById(`infInput_${rIdx}_${colIdx}`);
                if (cellInput) {
                    cellInput.parentElement.style.backgroundColor = (colIdx === currentCIdx) ? '#ffe5e5' : '#fff';
                }
            }
        }
    }
};

window.infHandleInputKey = function(e, rIdx, cIdx) {
    const tData = window.infState.data[window.infState.activeTab];
    let nextR = rIdx;
    let nextC = cIdx;
    let shouldMove = false;

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
        shouldMove = true;
        nextR++;
        while (nextR < tData.raw.length) {
            if (document.getElementById(`infInput_${nextR}_${nextC}`)) break;
            nextR++;
        }
    } else if (e.key === 'ArrowUp') {
        shouldMove = true;
        nextR--;
        while (nextR >= 0) {
            if (document.getElementById(`infInput_${nextR}_${nextC}`)) break;
            nextR--;
        }
    } else if (e.key === 'ArrowLeft') {
        if (e.target.selectionStart === 0) { shouldMove = true; nextC--; }
    } else if (e.key === 'ArrowRight') {
        if (e.target.selectionEnd === e.target.value.length) { shouldMove = true; nextC++; }
    }

    if (shouldMove) {
        let nextEl = document.getElementById(`infInput_${nextR}_${nextC}`);
        if (nextEl) {
            e.preventDefault();
            nextEl.focus();
            nextEl.select(); 
        }
    }
};

window.infRenderTable = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return;

    const data = tData.raw;
    const thead = document.getElementById('infThead');
    const tbody = document.getElementById('infTbody');
    thead.innerHTML = ''; tbody.innerHTML = '';

    const mappedKeys = Object.keys(wiz.mapped); 
    const colCount = (wiz.phase === 'mapping' || wiz.phase === 'idle') ? data[0].length : mappedKeys.length;
    
    const headerTr = document.createElement('tr');
    
    let foldHtml = '';
    if (tData.hasSubtotal && wiz.phase !== 'mapping' && wiz.phase !== 'idle') {
        foldHtml = `
            <div style="display:flex; gap:2px; justify-content:center; margin-top:4px;">
                <button class="fold-btn ${window.infState.foldingLevel === 1 ? 'active' : ''}" onclick="event.stopPropagation(); infSetFolding(1)" title="총계만 보기">1</button>
                <button class="fold-btn ${window.infState.foldingLevel === 2 ? 'active' : ''}" onclick="event.stopPropagation(); infSetFolding(2)" title="소계 표시">2</button>
                <button class="fold-btn ${window.infState.foldingLevel === 3 ? 'active' : ''}" onclick="event.stopPropagation(); infSetFolding(3)" title="전체 표시">3</button>
            </div>`;
    }
    
    headerTr.innerHTML = `<th style="width:60px; background:#f8fafc; border:1px solid #ccc; text-align:center; padding:6px 2px;">행 번호${foldHtml}</th>`; 
    
    const step2Cols = ['과거 구분', '기본 구분', '평가제외 구분', '부보제외 구분', '최종 구분'];
    const step3Cols = ['물가지수', '재조달가액', '감가율', '잔가율', '현재가액', '비고'];

    for(let c = 0; c < colCount; c++) {
        const isSelected = tData.selectedCols.has(c) ? 'inf-sel-col' : '';
        const th = document.createElement('th');
        th.className = `inf-header ${isSelected}`;
        th.style.cssText = `background:#f8fafc; border:1px solid #ccc; padding:8px; text-align:center; font-weight:bold; min-width:80px; vertical-align:bottom;`;
        
        const emptySpaceForBtn = (window.infState.step >= 2 && wiz.phase !== 'mapping' && wiz.phase !== 'idle') ? `<div style="height:25px; margin-bottom:6px;"></div>` : '';

        if (wiz.phase === 'mapping' || wiz.phase === 'idle') {
            let colLetter = String.fromCharCode(65 + (c % 26)); 
            if (c >= 26) colLetter = String.fromCharCode(64 + Math.floor(c / 26)) + colLetter;
            let mappedLabel = "";
            for (const [key, val] of Object.entries(wiz.mapped)) {
                if (val === c) mappedLabel = `<br><span style="background:#FFCC00; color:#000; font-size:11px; padding:2px 4px; border-radius:3px;">${key}</span>`;
            }
            th.innerHTML = `${colLetter} ${mappedLabel}`;
        } else {
            th.innerHTML = `${emptySpaceForBtn}<div>${mappedKeys[c] || `데이터 ${c+1}`}</div>`;
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
    
    if(window.infState.step >= 2) {
        const evalYearEl = document.getElementById('evalYear');
        const currentYear = evalYearEl ? evalYearEl.value : '2026';

        step2Cols.forEach((colName, idx) => {
            if (window.infState.step === 3 && idx < 4) return;

            let topButtonHtml = '';
            let displayName = colName;
            
            if (idx === 0) {
                topButtonHtml = `<button type="button" style="display:block; width:100%; margin-bottom:6px; background:#17A2B8; color:#fff; border:none; padding:4px 0; border-radius:3px; font-weight:bold; font-size:11px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="document.getElementById('infPastExcelFile').click()"><i class="fa-solid fa-file-import"></i> 과거 연동</button>`;
                if (window.infState.pastYear) {
                    displayName = `과거 구분<br><span style="font-size:11px; color:#888;">(${window.infState.pastYear})</span>`;
                }
            } else if (idx === 1) {
                topButtonHtml = `<button type="button" style="display:block; width:100%; margin-bottom:6px; background:#6c757d; color:#fff; border:none; padding:4px 0; border-radius:3px; font-weight:bold; font-size:11px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="window.assignBasicClass()"><i class="fa-solid fa-wand-magic-sparkles"></i> 기본 지정</button>`;
            } else if (idx === 2) {
                topButtonHtml = `<button type="button" style="display:block; width:100%; margin-bottom:6px; background:#6c757d; color:#fff; border:none; padding:4px 0; border-radius:3px; font-weight:bold; font-size:11px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="window.assignExcludeEval()"><i class="fa-solid fa-ban"></i> 평가 제외</button>`;
            } else if (idx === 3) {
                topButtonHtml = `<button type="button" style="display:block; width:100%; margin-bottom:6px; background:#6c757d; color:#fff; border:none; padding:4px 0; border-radius:3px; font-weight:bold; font-size:11px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="window.assignExcludeCoverage()"><i class="fa-solid fa-ban"></i> 부보 제외</button>`;
            } else if (idx === 4) {
                if(window.infState.step === 3) {
                    topButtonHtml = `<div style="height:25px; margin-bottom:6px;"></div>`;
                    displayName = `${currentYear} 구분`;
                } else {
                    topButtonHtml = `<button type="button" style="display:block; width:100%; margin-bottom:6px; background:#1C5691; color:#fff; border:none; padding:4px 0; border-radius:3px; font-weight:bold; font-size:11px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="window.assignFinalClass()"><i class="fa-solid fa-check-double"></i> 최종 선택 시작</button>`;
                }
            }

            headerTr.innerHTML += `<th style="background:#e9ecef; color:#1C5691; border:1px solid #ccc; padding:8px 4px; text-align:center; vertical-align:bottom; min-width:90px;">
                ${topButtonHtml}
                <div>${displayName}</div>
            </th>`;
        });
    }

    if(window.infState.step === 3) {
        step3Cols.forEach(colName => {
            let topButtonHtml = `<div style="height:25px; margin-bottom:6px;"></div>`;
            
            if (colName === '물가지수') {
                topButtonHtml = `<button type="button" style="display:block; width:100%; margin-bottom:6px; background:#007BFF; color:#fff; border:none; padding:4px 0; border-radius:3px; font-weight:bold; font-size:11px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="window.applyInflationIndex()"><i class="fa-solid fa-bolt"></i> 지수/재조달 계산</button>`;
            } else if (colName === '감가율') {
                topButtonHtml = `<button type="button" style="display:block; width:100%; margin-bottom:6px; background:#28A745; color:#fff; border:none; padding:4px 0; border-radius:3px; font-weight:bold; font-size:11px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="window.applyCurrentValue()"><i class="fa-solid fa-bolt"></i> 감가/현재 계산</button>`;
            }

            headerTr.innerHTML += `<th style="background:#e9ecef; color:#1C5691; border:1px solid #ccc; padding:8px 4px; text-align:center; vertical-align:bottom; min-width:90px;">
                ${topButtonHtml}
                <div>${colName}</div>
            </th>`;
        });
    }
    thead.appendChild(headerTr);


    const yearColIdx = wiz.mapped['취득년도']; 
    
    data.forEach((row, rIdx) => {
        const yearVal = String(row[yearColIdx] || '');
        const isSubtotalRow = yearColIdx !== undefined && yearVal.includes('소계');
        const isGrandTotalRow = yearColIdx !== undefined && yearVal.includes('총계');
        const isDetailRow = !isSubtotalRow && !isGrandTotalRow;

        if (tData.hasSubtotal) {
            if (window.infState.foldingLevel === 1 && !isGrandTotalRow) return; 
            if (window.infState.foldingLevel === 2 && isDetailRow) return;
        }

        const isRowSel = tData.selectedRows.has(rIdx);
        const rowSelClass = isRowSel ? 'inf-sel-row' : '';
        const tr = document.createElement('tr');
        tr.className = rowSelClass; 
        tr.style.cursor = 'pointer'; 
        
        let bgStyle = '';
        let rowTitle = rIdx + 1;
        if (isSubtotalRow) { bgStyle = 'background:#e2e8f0; font-weight:bold; color:#1C5691;'; rowTitle = '-'; }
        if (isGrandTotalRow) { bgStyle = 'background:#1C5691; font-weight:bold; color:#fff;'; rowTitle = 'Σ'; }

        let rowHtml = `<td class="inf-row-header" style="background:#f8fafc; border:1px solid #ccc; text-align:center; font-weight:bold; color:#666;">${rowTitle}</td>`;

        for(let c = 0; c < colCount; c++) {
            const isColSel = tData.selectedCols.has(c) ? 'inf-sel-col' : '';
            let cellVal = row[c] !== undefined ? row[c] : '';
            let align = 'left';
            
            if (wiz.phase !== 'mapping' && wiz.phase !== 'idle') {
                const headerName = mappedKeys[c];
                if (headerName === '취득년도') {
                    align = 'center';
                } else {
                    const isNumericCol = headerName === '취득가액' || headerName === '재조달가액' || headerName === '현재가액' || (cellVal !== '' && !isNaN(String(cellVal).replace(/,/g, '')));
                    if (isNumericCol && cellVal !== '') {
                        const num = Number(String(cellVal).replace(/,/g, ''));
                        if (!isNaN(num)) {
                            cellVal = num.toLocaleString('ko-KR');
                            align = 'right';
                        }
                    }
                }
            }
            rowHtml += `<td class="${isColSel}" style="border:1px solid #eee; padding:6px 10px; max-width:200px; overflow:hidden; text-overflow:ellipsis; text-align:${align}; ${bgStyle}">${cellVal}</td>`;
        }
        
        if(window.infState.step >= 2) {
            const finalDataIdx = colCount + 4;
            const finalVal = String(row[finalDataIdx] || '').trim();
            
            let sourceMatchIdx = -1;
            if (finalVal !== '') {
                const pastV = String(row[colCount + 0] || '').trim();
                const basicV = String(row[colCount + 1] || '').trim();
                const evalExV = String(row[colCount + 2] || '').trim();
                const covExV = String(row[colCount + 3] || '').trim();
                
                if (pastV === finalVal) sourceMatchIdx = colCount + 0;
                else if (evalExV === finalVal) sourceMatchIdx = colCount + 2;
                else if (covExV === finalVal) sourceMatchIdx = colCount + 3;
                else if (basicV === finalVal) sourceMatchIdx = colCount + 1;
            }

            step2Cols.forEach((cName, idx) => {
                if (window.infState.step === 3 && idx < 4) return;
                
                const dataIdx = colCount + idx;
                const savedVal = row[dataIdx] || '';
                
                if (isSubtotalRow || isGrandTotalRow) {
                    rowHtml += `<td style="border:1px solid #eee; ${bgStyle}"></td>`;
                } else {
                    const isFinalCol = (idx === 4);
                    const cellBg = ((isFinalCol && savedVal !== '') || (dataIdx === sourceMatchIdx)) ? '#ffe5e5' : '#fff';
                    
                    let syncEvent = '';
                    let onClickEvent = `onclick="event.stopPropagation();"`;
                    
                    if (!isFinalCol) { 
                        syncEvent = `oninput="window.syncToFinal(${rIdx}, ${finalDataIdx}, this.value, ${dataIdx})" onfocus="window.syncToFinal(${rIdx}, ${finalDataIdx}, this.value, ${dataIdx})"`;
                        onClickEvent = `onclick="event.stopPropagation(); window.syncToFinal(${rIdx}, ${finalDataIdx}, this.value, ${dataIdx});"`;
                    } else { 
                        syncEvent = `oninput="this.parentElement.style.backgroundColor = this.value ? '#ffe5e5' : '#fff';"`;
                    }

                    rowHtml += `<td style="border:1px solid #ccc; padding:0; background:${cellBg}; min-width:70px; transition: background 0.3s;">
                        <input type="text" id="infInput_${rIdx}_${dataIdx}" maxlength="20" value="${savedVal}" 
                               style="width:100%; height:100%; min-height:28px; border:none; text-align:center; outline:none; background:transparent; font-family:inherit; font-size:13px; color:#333;" 
                               onchange="window.infUpdateCellData(${rIdx}, ${dataIdx}, this.value)"
                               onkeydown="window.infHandleInputKey(event, ${rIdx}, ${dataIdx})"
                               ${onClickEvent}
                               ${syncEvent}>
                    </td>`;
                }
            });
        }
        
        // ★ 3단계 렌더링 (소계 텍스트 표시 및 우측 정렬 반영)
        if(window.infState.step === 3) {
            step3Cols.forEach((cName, idx) => { 
                const dataIdx = colCount + 5 + idx; 
                const savedVal = row[dataIdx] !== undefined ? row[dataIdx] : '';
                
                if (isSubtotalRow || isGrandTotalRow) {
                    let displayVal = savedVal;
                    if (displayVal !== '' && !isNaN(String(displayVal).replace(/,/g, ''))) {
                        displayVal = Number(String(displayVal).replace(/,/g, '')).toLocaleString('ko-KR');
                    }
                    // 소계/합계 행은 텍스트로 우측 정렬 표출
                    rowHtml += `<td style="border:1px solid #eee; text-align:right; font-weight:bold; color:#1C5691; padding:6px 10px; ${bgStyle}">${displayVal}</td>`; 
                } else {
                    let displayVal = savedVal;
                    let textAlign = 'center'; 
                    // 재조달가액, 현재가액은 우측 정렬 지정
                    if (cName === '재조달가액' || cName === '현재가액') textAlign = 'right';

                    if (displayVal !== '' && !isNaN(String(displayVal).replace(/,/g, '')) && cName !== '비고' && cName !== '물가지수') {
                        displayVal = Number(String(displayVal).replace(/,/g, '')).toLocaleString('ko-KR');
                    }

                    rowHtml += `<td style="border:1px solid #ccc; padding:0; background:#f0fdf4; min-width:80px;">
                        <input type="text" id="infInput_${rIdx}_${dataIdx}" maxlength="20" value="${displayVal}" 
                               style="width:100%; height:100%; min-height:28px; border:none; text-align:${textAlign}; outline:none; background:transparent; font-family:inherit; font-size:13px; color:#333; padding: 0 8px; box-sizing:border-box;" 
                               onchange="window.infUpdateCellData(${rIdx}, ${dataIdx}, this.value)"
                               onkeydown="window.infHandleInputKey(event, ${rIdx}, ${dataIdx})"
                               onclick="event.stopPropagation();">
                    </td>`;
                }
            });
        }
        
        tr.innerHTML = rowHtml;

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

// ============================================================================
// [섹션 5] 정렬/부분합, 히스토리, 단축키 로직 및 행 추가 로직
// ============================================================================
window.infAddEmptyRow = function() {
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return;

    infSaveHistory();

    const wiz = window.infState.wizard;
    const mappedKeys = Object.keys(wiz.mapped);
    let totalCols = (wiz.phase === 'mapping' || wiz.phase === 'idle') ? tData.raw[0].length : mappedKeys.length;
    
    if (window.infState.step >= 2) totalCols += 5;
    if (window.infState.step === 3) totalCols += 6;

    const newRow = new Array(totalCols).fill('');

    let insertIdx = tData.raw.length;
    if (tData.selectedRows.size > 0) {
        insertIdx = Math.max(...Array.from(tData.selectedRows)) + 1;
    } else {
        const yearIdx = wiz.mapped['취득년도'];
        if (yearIdx !== undefined && tData.raw.length > 0 && String(tData.raw[tData.raw.length-1][yearIdx]).includes('총계')) {
            insertIdx = tData.raw.length - 1; 
        }
    }

    tData.raw.splice(insertIdx, 0, newRow);
    tData.selectedRows.clear();
    tData.selectedRows.add(insertIdx);
    
    infRenderTable();
};

window.infCalculateSubtotals = function(isSilent) {
    const silent = (isSilent === true);

    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return;

    const locIdx = wiz.mapped['소재지'];
    const accIdx = wiz.mapped['자산계정'];
    const yearIdx = wiz.mapped['취득년도'];
    const priceIdx = wiz.mapped['취득가액'];

    if(locIdx === undefined || accIdx === undefined || yearIdx === undefined || priceIdx === undefined) {
        if (!silent) alert("부분합을 계산하기 위한 필수 항목(소재지, 자산계정, 취득년도, 취득가액)이 매핑되지 않았습니다.");
        return;
    }

    if (!silent) infSaveHistory();

    const cleanRaw = tData.raw.filter(row => !String(row[yearIdx] || '').includes('소계') && !String(row[yearIdx] || '').includes('총계'));

    if (cleanRaw.length === 0) {
        tData.raw = [];
        tData.hasSubtotal = false;
        if (!silent) infRenderTable();
        return;
    }

    const locOrder = [];
    const accOrder = [];
    cleanRaw.forEach(row => {
        const l = String(row[locIdx] || '').trim();
        const a = String(row[accIdx] || '').trim();
        if(l && !locOrder.includes(l)) locOrder.push(l);
        if(a && !accOrder.includes(a)) accOrder.push(a);
    });

    cleanRaw.sort((a, b) => {
        const lA = locOrder.indexOf(String(a[locIdx] || '').trim());
        const lB = locOrder.indexOf(String(b[locIdx] || '').trim());
        if(lA !== lB) return lA - lB;
        
        const aA = accOrder.indexOf(String(a[accIdx] || '').trim());
        const aB = accOrder.indexOf(String(b[accIdx] || '').trim());
        if(aA !== aB) return aA - aB;
        
        const yA = String(a[yearIdx] || '').trim();
        const yB = String(b[yearIdx] || '').trim();
        return yA.localeCompare(yB);
    });

    const newRaw = [];
    let currentGroupKey = null;
    let groupSum = 0;
    let grandSum = 0;
    let currentGroupNames = [];

    for(let i=0; i<cleanRaw.length; i++) {
        const row = cleanRaw[i];
        const loc = String(row[locIdx] || '').trim();
        const acc = String(row[accIdx] || '').trim();
        const key = `${loc}|${acc}`; 
        
        const priceStr = String(row[priceIdx] || '').replace(/,/g, '');
        const price = Number(priceStr) || 0;

        if(currentGroupKey !== null && currentGroupKey !== key) {
            const subtotalRow = new Array(row.length).fill('');
            subtotalRow[locIdx] = currentGroupNames[0];
            subtotalRow[accIdx] = currentGroupNames[1];
            subtotalRow[yearIdx] = "소계";
            subtotalRow[priceIdx] = groupSum;
            newRaw.push(subtotalRow);
            groupSum = 0; 
        }

        newRaw.push(row);
        currentGroupKey = key;
        currentGroupNames = [loc, acc];
        groupSum += price;
        grandSum += price;
    }

    if(currentGroupKey !== null) {
        const subtotalRow = new Array(cleanRaw[0].length).fill('');
        subtotalRow[locIdx] = currentGroupNames[0];
        subtotalRow[accIdx] = currentGroupNames[1];
        subtotalRow[yearIdx] = "소계";
        subtotalRow[priceIdx] = groupSum;
        newRaw.push(subtotalRow);
    }
    
    if(newRaw.length > 0) {
        const grandTotalRow = new Array(cleanRaw[0].length).fill('');
        grandTotalRow[yearIdx] = "총계";
        grandTotalRow[priceIdx] = grandSum;
        newRaw.push(grandTotalRow);
    }

    tData.raw = newRaw;
    tData.hasSubtotal = true;
    window.infState.foldingLevel = 3; 

    const btnNext = document.getElementById('btnInfNextStep');
    btnNext.innerHTML = '명세서 검증 완료 및 2단계(자산구분)로 전환 ▶';
    btnNext.style.backgroundColor = '#17A2B8';
    btnNext.onclick = infProceedToStep2;
    
    tData.selectedRows.clear();
    tData.selectedCols.clear();
    
    if (!silent) infRenderTable();
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
        
        const yearColIdx = window.infState.wizard.mapped['취득년도'];
        tData.hasSubtotal = yearColIdx !== undefined && tData.raw.some(r => String(r[yearColIdx] || '').includes('소계'));
        if(!tData.hasSubtotal && window.infState.step === 1 && window.infState.wizard.phase === 'row-delete') {
            const btnNext = document.getElementById('btnInfNextStep');
            btnNext.innerHTML = '<i class="fa-solid fa-layer-group"></i> 부분합(소계) 및 정렬 수행';
            btnNext.style.backgroundColor = '#6f42c1';
            btnNext.onclick = () => window.infCalculateSubtotals(false);
        }
        infRenderTable();
    }
    
    // ★ 행/열 삭제 로직 (동적 재계산 지원)
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
        
        if (tData.hasSubtotal) {
            window.infCalculateSubtotals(true); 
        }
        infRenderTable();
    }
});

// ============================================================================
// [섹션 6] 과거 데이터 연동 매칭 알고리즘
// ============================================================================
window.infLoadPastData = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    const yearMatch = file.name.match(/(19|20)\d{2}/);
    window.infState.pastYear = yearMatch ? yearMatch[0] : '연도미상';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
            const pastData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1, defval: ""});
            
            if(pastData.length < 2) return alert("과거 데이터 파일이 비어있습니다.");

            const pastHeader = pastData[0];
            const pastAssetNumIdx = pastHeader.findIndex(h => String(h).includes('자산번호'));
            const pastAssetNameIdx = pastHeader.findIndex(h => String(h).includes('자산명'));
            const pastClassIdx = pastHeader.findIndex(h => String(h).includes('최종 구분') || String(h).includes('과거 구분')); 

            if(pastClassIdx === -1) {
                return alert("과거 파일에서 '최종 구분' 또는 '과거 구분' 열을 찾을 수 없어 연동할 수 없습니다.");
            }

            const wiz = window.infState.wizard;
            const tData = window.infState.data[window.infState.activeTab];
            const curAssetNumIdx = Object.keys(wiz.mapped).indexOf('자산번호');
            const curAssetNameIdx = Object.keys(wiz.mapped).indexOf('자산명');
            const curPastClassIdx = wiz.columns.length;

            let matchCount = 0;

            tData.raw.forEach(curRow => {
                const yearColIdx = Object.keys(wiz.mapped).indexOf('취득년도');
                if (String(curRow[yearColIdx] || '').includes('소계') || String(curRow[yearColIdx] || '').includes('총계')) return;

                const curNum = String(curRow[curAssetNumIdx] || '').trim();
                const curName = String(curRow[curAssetNameIdx] || '').trim();
                let matchedPastRow = null;

                if (curNum && pastAssetNumIdx !== -1) {
                    matchedPastRow = pastData.find((pRow, idx) => idx > 0 && String(pRow[pastAssetNumIdx] || '').trim() === curNum);
                }
                
                if (!matchedPastRow && curName && pastAssetNameIdx !== -1) {
                    matchedPastRow = pastData.find((pRow, idx) => idx > 0 && String(pRow[pastAssetNameIdx] || '').trim() === curName);
                }

                if (matchedPastRow) {
                    curRow[curPastClassIdx] = matchedPastRow[pastClassIdx];
                    matchCount++;
                }
            });

            infSaveHistory();
            infRenderTable();
            alert(`✅ 과거 데이터 연동 완료\n- 기준 연도: ${window.infState.pastYear}년\n- 총 ${matchCount}건의 자산 구분이 매칭되었습니다.`);

        } catch(err) {
            alert("파일을 읽는 중 오류가 발생했습니다: " + err);
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
};

// ============================================================================
// [섹션 7] 자산 구분 일괄 지정 (기본/평가제외/부보제외 자동화)
// ============================================================================

// ★ 안전한 룰 로드 함수: 메모리가 초기화되어도 내장된 사전을 복구합니다.
window.getSafeMappingRules = function() {
    if (window.infState && window.infState.mappingRules) return window.infState.mappingRules;
    
    const defaultRules = {
        basic: [
            { keyword: '건물', val: '50' }, { keyword: '구축물', val: '50' }, { keyword: '기계장치', val: '47' }, 
            { keyword: '공기구', val: '47' }, { keyword: '공구', val: '47' }, { keyword: '기구', val: '47' }, 
            { keyword: '시설', val: '47' }, { keyword: '시설장치', val: '47' }, { keyword: '차량운반구', val: '47' }, 
            { keyword: '건물부속설비', val: '50' }, { keyword: '금형', val: '47' }
        ],
        evalExclude: [
            {'keyword': 'SOFTWARE', 'val': '평가제외(S/W)'}, {'keyword': 'S.W', 'val': '평가제외(S/W)'}, {'keyword': 'PROGRAM', 'val': '평가제외(S/W)'}, {'keyword': '소프트웨어', 'val': '평가제외(S/W)'}, {'keyword': '프로그램', 'val': '평가제외(S/W)'}, {'keyword': 'S/W', 'val': '평가제외(S/W)'}, {'keyword': 'LICENSE', 'val': '평가제외(S/W)'}, {'keyword': '설계비', 'val': '평가제외(설계/감리/용역)'}, {'keyword': '감리비', 'val': '평가제외(설계/감리/용역)'}, {'keyword': '용역비', 'val': '평가제외(설계/감리/용역)'}, {'keyword': '설계', 'val': '평가제외(설계/감리/용역)'}, {'keyword': '감리', 'val': '평가제외(설계/감리/용역)'}, {'keyword': '용역', 'val': '평가제외(설계/감리/용역)'}, {'keyword': '운송비', 'val': '평가제외(운송비용)'}, {'keyword': '운송', 'val': '평가제외(운송비용)'}, {'keyword': '운임', 'val': '평가제외(운임비용)'}, {'keyword': '운임비', 'val': '평가제외(운임비용)'}, {'keyword': '조사비', 'val': '평가제외(조사비용)'}, {'keyword': '인건비', 'val': '평가제외(인건비용)'}, {'keyword': '미술품', 'val': '평가제외(미술품)'}, {'keyword': '예술품', 'val': '평가제외(예술품)'}, {'keyword': '조각상', 'val': '평가제외(조각상)'}, {'keyword': '시운전', 'val': '평가제외(건설중인자산)'}, {'keyword': '중고', 'val': '평가제외(중고자산)'}, {'keyword': '조경', 'val': '평가제외(조경)'}, {'keyword': '연못', 'val': '평가제외(조경)'}, {'keyword': '정원', 'val': '평가제외(조경)'}, {'keyword': '이전공사', 'val': '평가제외(이전/이설자산)'}, {'keyword': '이설공사', 'val': '평가제외(이전/이설자산)'}, {'keyword': '이전', 'val': '평가제외(이전/이설자산)'}, {'keyword': '이설', 'val': '평가제외(이전/이설자산)'}, {'keyword': 'OVERHAUL', 'val': '평가제외(오버홀)'}, {'keyword': '오버홀', 'val': '평가제외(오버홀)'}, {'keyword': '레이아웃변경', 'val': '평가제외(레이아웃변경)'}, {'keyword': 'LAYOUT', 'val': '평가제외(레이아웃변경)'}, {'keyword': 'LAY OUT', 'val': '평가제외(레이아웃변경)'}, {'keyword': '수리', 'val': '평가제외(수리비용)'}, {'keyword': '보수', 'val': '평가제외(보수비용)'}, {'keyword': '인허가', 'val': '평가제외(인허가비용)'}, {'keyword': '검사', 'val': '평가제외(검사)'}, {'keyword': '컨설팅업체 선정', 'val': '평가제외(업체선정용역)'}, {'keyword': '광고판', 'val': '평가제외(간판)'}, {'keyword': '아스콘작업', 'val': '평가제외(아스콘)'}, {'keyword': '임대', 'val': '평가제외(임대비)'}, {'keyword': '입목', 'val': '평가제외(입목)'}, {'keyword': '시설분담금', 'val': '평가제외(시설분담금)'}, {'keyword': '개발비', 'val': '평가제외(개발비)'}, {'keyword': '투자비', 'val': '평가제외(투자비)'}, {'keyword': 'USED', 'val': '평가제외(중고자산)'}, {'keyword': '아파트', 'val': '평가제외(주택화재보험대상)'}, {'keyword': '기숙사', 'val': '평가제외(주택화재보험대상)'}, {'keyword': '사택', 'val': '평가제외(주택화재보험대상)'}, {'keyword': '숙소', 'val': '평가제외(주택화재보험대상)'}, {'keyword': '비품', 'val': '평가제외(비품)'}, {'keyword': '건설중 자산', 'val': '평가제외(건설중 자산)'}, {'keyword': '건설중자산', 'val': '평가제외(건설중 자산)'}
        ],
        covExclude: [
            {'keyword': '토지', 'val': '부보제외(토지)'}, {'keyword': '취득세', 'val': '부보제외(세금)'}, {'keyword': '등록세', 'val': '부보제외(세금)'}, {'keyword': '농특세', 'val': '부보제외(세금)'}, {'keyword': '상표권', 'val': '부보제외(상표권)'}, {'keyword': '회원권', 'val': '부보제외(회원권)'}, {'keyword': '콘도', 'val': '부보제외(회원권)'}, {'keyword': '이용권', 'val': '부보제외(이용권)'}, {'keyword': '특허권', 'val': '부보제외(특허권)'}, {'keyword': '특허', 'val': '부보제외(특허권)'}, {'keyword': '철거', 'val': '부보제외(철거비용)'}, {'keyword': '복구', 'val': '부보제외(복구비용)'}, {'keyword': '이자', 'val': '부보제외(이자비용)'}, {'keyword': '부담금', 'val': '부보제외(부담금)'}, {'keyword': '분담금', 'val': '부보제외(분담금)'}, {'keyword': '사용료', 'val': '부보제외(사용료)'}, {'keyword': '수수료', 'val': '부보제외(수수료)'}, {'keyword': '양도', 'val': '부보제외(양도자산)'}, {'keyword': '실용신안', 'val': '부보제외(실용신안권)'}, {'keyword': '디자인등록', 'val': '부보제외(의장권)'}, {'keyword': '지하수개발', 'val': '부보제외(지하자산)'}, {'keyword': '수수료 및 이자, 등기비용', 'val': '부보제외(비용성격)'}, {'keyword': '한전불입금', 'val': '부보제외(한전불입금)'}, {'keyword': '무형자산', 'val': '부보제외(무형자산)'}, {'keyword': '안전진단비', 'val': '부보제외(비용성격)'}, {'keyword': '구조검토비용', 'val': '부보제외(비용성격)'}, {'keyword': '등기비', 'val': '부보제외(비용성격)'}, {'keyword': '시설부담금', 'val': '부보제외(시설부담금)'}, {'keyword': '권리금', 'val': '부보제외(권리금)'}, {'keyword': '지질조사', 'val': '부보제외(지질조사)'}, {'keyword': '도로부담금', 'val': '부보제외(도로부담금)'}, {'keyword': '측량비', 'val': '부보제외(비용성격)'}, {'keyword': '자동차보험가입대상', 'val': '부보제외(중복보험)'}, {'keyword': '주택화재보험가입대상', 'val': '부보제외(중복보험)'}
        ]
    };
    
    let storedRules = null;
    try { storedRules = JSON.parse(localStorage.getItem('kb_mapping_rules_v3')); } catch(e) {}
    
    if (!window.infState) window.infState = {};
    window.infState.mappingRules = storedRules || defaultRules;
    return window.infState.mappingRules;
};

window.getDynamicMapping = function(accountName) {
    if (!accountName) return "";
    const acc = accountName.trim();
    const rules = window.getSafeMappingRules().basic || [];
    
    let matched = rules.find(r => r.keyword === acc);
    if (matched) return matched.val;
    
    matched = rules.find(r => acc.includes(r.keyword));
    if (matched) return matched.val;
    
    return "";
};

window.assignBasicClass = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return alert("데이터가 없습니다.");

    const accIdx = wiz.mapped['자산계정'];
    const yearIdx = wiz.mapped['취득년도'];

    if (accIdx === undefined) return alert("자산계정 열이 매핑되지 않았습니다.");

    let uniqueAccounts = new Set();
    tData.raw.forEach(row => {
        const yearVal = String(row[yearIdx] || '');
        if (yearVal.includes('소계') || yearVal.includes('총계')) return;
        const acc = String(row[accIdx] || '').trim();
        if (acc) uniqueAccounts.add(acc);
    });

    if (uniqueAccounts.size === 0) return alert("명세서에 자산계정 데이터가 없습니다.");

    const tbody = document.getElementById('basicClassTbody');
    tbody.innerHTML = '';
    uniqueAccounts.forEach(acc => {
        const defaultVal = window.getDynamicMapping(acc); 
        tbody.innerHTML += `
            <tr>
                <td style="text-align:center; font-weight:bold; color:#1C5691; vertical-align:middle;">${acc}</td>
                <td style="padding:4px;">
                    <input type="text" id="basicInput_${acc}" class="input-box" maxlength="20" value="${defaultVal}" style="width:100%; text-align:center; box-sizing:border-box; font-weight:bold; color:#333;">
                </td>
            </tr>
        `;
    });

    document.getElementById('basicClassModal').style.display = 'flex';
};

window.applyBasicClass = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    const accIdx = wiz.mapped['자산계정'];
    const yearIdx = wiz.mapped['취득년도'];
    const basicClassIdx = Object.keys(wiz.mapped).length + 1; 

    const inputMap = {};
    document.querySelectorAll('[id^="basicInput_"]').forEach(input => {
        const acc = input.id.replace('basicInput_', '');
        inputMap[acc] = input.value.trim();
    });

    if(typeof window.infSaveHistory === 'function') window.infSaveHistory();

    let applyCount = 0;
    tData.raw.forEach((row, rIdx) => {
        const yearVal = String(row[yearIdx] || '');
        if (yearVal.includes('소계') || yearVal.includes('총계')) return;

        const acc = String(row[accIdx] || '').trim();
        if (inputMap[acc] !== undefined && inputMap[acc] !== "") {
            row[basicClassIdx] = inputMap[acc]; 
            
            // ★ 값이 들어가면 최종 구분 열도 함께 업데이트되도록 연동!
            const finalIdx = Object.keys(wiz.mapped).length + 4;
            if(typeof window.syncToFinal === 'function') {
                window.syncToFinal(rIdx, finalIdx, inputMap[acc], basicClassIdx);
            }
            applyCount++;
        }
    });

    document.getElementById('basicClassModal').style.display = 'none';
    if(typeof window.infRenderTable === 'function') window.infRenderTable(); 
};

window.assignExcludeEval = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return alert("데이터가 없습니다.");

    const accIdx = wiz.mapped['자산계정'];
    const nameIdx = wiz.mapped['자산명'];
    const yearIdx = wiz.mapped['취득년도'];
    const targetIdx = Object.keys(wiz.mapped).length + 2;
    const finalIdx = Object.keys(wiz.mapped).length + 4;

    if (accIdx === undefined || nameIdx === undefined) return alert("자산계정 및 자산명 열이 매핑되지 않았습니다.");

    if(typeof window.infSaveHistory === 'function') window.infSaveHistory();
    let applyCount = 0;
    const rules = window.getSafeMappingRules().evalExclude || [];

    tData.raw.forEach((row, rIdx) => {
        const yearVal = String(row[yearIdx] || '');
        if (yearVal.includes('소계') || yearVal.includes('총계')) return;

        const accStr = String(row[accIdx] || '').toUpperCase();
        const nameStr = String(row[nameIdx] || '').toUpperCase();
        
        const matched = rules.find(r => accStr.includes(r.keyword.toUpperCase()) || nameStr.includes(r.keyword.toUpperCase()));
        if (matched) {
            row[targetIdx] = matched.val;
            // ★ 값이 들어가면 최종 구분 열도 함께 업데이트되도록 연동!
            if(typeof window.syncToFinal === 'function') {
                window.syncToFinal(rIdx, finalIdx, matched.val, targetIdx);
            }
            applyCount++;
        }
    });

    if(typeof window.infRenderTable === 'function') window.infRenderTable();
    alert(`✅ 평가제외 일괄 지정 완료!\n총 ${applyCount}건의 데이터에 평가제외 구분이 자동 적용되었습니다.`);
};

window.assignExcludeCoverage = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return alert("데이터가 없습니다.");

    const accIdx = wiz.mapped['자산계정'];
    const nameIdx = wiz.mapped['자산명'];
    const yearIdx = wiz.mapped['취득년도'];
    const targetIdx = Object.keys(wiz.mapped).length + 3;
    const finalIdx = Object.keys(wiz.mapped).length + 4;

    if (accIdx === undefined || nameIdx === undefined) return alert("자산계정 및 자산명 열이 매핑되지 않았습니다.");

    if(typeof window.infSaveHistory === 'function') window.infSaveHistory();
    let applyCount = 0;
    const rules = window.getSafeMappingRules().covExclude || [];

    tData.raw.forEach((row, rIdx) => {
        const yearVal = String(row[yearIdx] || '');
        if (yearVal.includes('소계') || yearVal.includes('총계')) return;

        const accStr = String(row[accIdx] || '').toUpperCase();
        const nameStr = String(row[nameIdx] || '').toUpperCase();
        
        const matched = rules.find(r => accStr.includes(r.keyword.toUpperCase()) || nameStr.includes(r.keyword.toUpperCase()));
        if (matched) {
            row[targetIdx] = matched.val;
            // ★ 값이 들어가면 최종 구분 열도 함께 업데이트되도록 연동!
            if(typeof window.syncToFinal === 'function') {
                window.syncToFinal(rIdx, finalIdx, matched.val, targetIdx);
            }
            applyCount++;
        }
    });

    if(typeof window.infRenderTable === 'function') window.infRenderTable();
    alert(`✅ 부보제외 일괄 지정 완료!\n총 ${applyCount}건의 데이터에 부보제외 구분이 자동 적용되었습니다.`);
};

window.assignFinalClass = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return alert("데이터가 없습니다.");

    const mappedColCount = Object.keys(wiz.mapped).length;
    const pastIdx = mappedColCount + 0;
    const basicIdx = mappedColCount + 1;
    const evalExIdx = mappedColCount + 2;
    const covExIdx = mappedColCount + 3;
    const finalIdx = mappedColCount + 4;
    const yearIdx = wiz.mapped['취득년도'];

    if(typeof window.infSaveHistory === 'function') window.infSaveHistory(); 
    let applyCount = 0;

    tData.raw.forEach(row => {
        const yearVal = String(row[yearIdx] || '');
        if (yearVal.includes('소계') || yearVal.includes('총계')) return; 

        const past = String(row[pastIdx] || '').trim();
        const basic = String(row[basicIdx] || '').trim();
        const evalEx = String(row[evalExIdx] || '').trim();
        const covEx = String(row[covExIdx] || '').trim();

        let finalVal = "";
        
        // ★ 우선순위 평가: 1.과거 -> 2.평가제외 -> 3.부보제외 -> 4.기본
        if (past) finalVal = past;
        else if (evalEx) finalVal = evalEx;
        else if (covEx) finalVal = covEx;
        else if (basic) finalVal = basic;

        if (finalVal !== "") {
            row[finalIdx] = finalVal;
            applyCount++;
        }
    });

    if(typeof window.infRenderTable === 'function') window.infRenderTable(); 
    alert(`✅ '최종 구분' 일괄 지정 완료!\n\n우선순위 [과거 연동 > 평가제외 > 부보제외 > 기본 지정] 규칙에 따라 총 ${applyCount}건이 확정되었습니다.`);
};

// ============================================================================
// [섹션 8] 매핑 마스터 데이터 관리 (3가지 정책 통합 관리)
// ============================================================================

// ★ 초기 엑셀 데이터 100% 내장 (기본, 평가제외, 부보제외)
const initialRules = {
    basic: [
        { keyword: '건물', val: '50' },
        { keyword: '토지', val: '부보제외(토지)' },
        { keyword: '구축물', val: '50' },
        { keyword: '기계장치', val: '47' },
        { keyword: '공기구', val: '47' },
        { keyword: '공구', val: '47' }, 
        { keyword: '기구', val: '47' }, 
        { keyword: '시설', val: '47' },
        { keyword: '시설장치', val: '47' },
        { keyword: '비품', val: '평가제외(비품)' },
        { keyword: '차량운반구', val: '47' },
        { keyword: '건설중 자산', val: '평가제외(건설중 자산)' },
        { keyword: '건설중자산', val: '평가제외(건설중 자산)' },
        { keyword: '건물부속설비', val: '50' },
        { keyword: '금형', val: '47' }
    ],
    evalExclude: [
        {'keyword': 'SOFTWARE', 'val': '평가제외(S/W)'}, {'keyword': 'S.W', 'val': '평가제외(S/W)'}, {'keyword': 'PROGRAM', 'val': '평가제외(S/W)'}, {'keyword': '소프트웨어', 'val': '평가제외(S/W)'}, {'keyword': '프로그램', 'val': '평가제외(S/W)'}, {'keyword': 'S/W', 'val': '평가제외(S/W)'}, {'keyword': 'LICENSE', 'val': '평가제외(S/W)'}, {'keyword': '설계비', 'val': '평가제외(설계/감리/용역)'}, {'keyword': '감리비', 'val': '평가제외(설계/감리/용역)'}, {'keyword': '용역비', 'val': '평가제외(설계/감리/용역)'}, {'keyword': '설계', 'val': '평가제외(설계/감리/용역)'}, {'keyword': '감리', 'val': '평가제외(설계/감리/용역)'}, {'keyword': '용역', 'val': '평가제외(설계/감리/용역)'}, {'keyword': '운송비', 'val': '평가제외(운송비용)'}, {'keyword': '운송', 'val': '평가제외(운송비용)'}, {'keyword': '운임', 'val': '평가제외(운임비용)'}, {'keyword': '운임비', 'val': '평가제외(운임비용)'}, {'keyword': '조사비', 'val': '평가제외(조사비용)'}, {'keyword': '인건비', 'val': '평가제외(인건비용)'}, {'keyword': '미술품', 'val': '평가제외(미술품)'}, {'keyword': '예술품', 'val': '평가제외(예술품)'}, {'keyword': '조각상', 'val': '평가제외(조각상)'}, {'keyword': '시운전', 'val': '평가제외(건설중인자산)'}, {'keyword': '중고', 'val': '평가제외(중고자산)'}, {'keyword': '조경', 'val': '평가제외(조경)'}, {'keyword': '연못', 'val': '평가제외(조경)'}, {'keyword': '정원', 'val': '평가제외(조경)'}, {'keyword': '이전공사', 'val': '평가제외(이전/이설자산)'}, {'keyword': '이설공사', 'val': '평가제외(이전/이설자산)'}, {'keyword': '이전', 'val': '평가제외(이전/이설자산)'}, {'keyword': '이설', 'val': '평가제외(이전/이설자산)'}, {'keyword': 'OVERHAUL', 'val': '평가제외(오버홀)'}, {'keyword': '오버홀', 'val': '평가제외(오버홀)'}, {'keyword': '레이아웃변경', 'val': '평가제외(레이아웃변경)'}, {'keyword': 'LAYOUT', 'val': '평가제외(레이아웃변경)'}, {'keyword': 'LAY OUT', 'val': '평가제외(레이아웃변경)'}, {'keyword': '수리', 'val': '평가제외(수리비용)'}, {'keyword': '보수', 'val': '평가제외(보수비용)'}, {'keyword': '인허가', 'val': '평가제외(인허가비용)'}, {'keyword': '검사', 'val': '평가제외(검사)'}, {'keyword': '컨설팅업체 선정', 'val': '평가제외(업체선정용역)'}, {'keyword': '광고판', 'val': '평가제외(간판)'}, {'keyword': '아스콘작업', 'val': '평가제외(아스콘)'}, {'keyword': '임대', 'val': '평가제외(임대비)'}, {'keyword': '입목', 'val': '평가제외(입목)'}, {'keyword': '시설분담금', 'val': '평가제외(시설분담금)'}, {'keyword': '개발비', 'val': '평가제외(개발비)'}, {'keyword': '투자비', 'val': '평가제외(투자비)'}, {'keyword': 'USED', 'val': '평가제외(중고자산)'}, {'keyword': '아파트', 'val': '평가제외(주택화재보험대상)'}, {'keyword': '기숙사', 'val': '평가제외(주택화재보험대상)'}, {'keyword': '사택', 'val': '평가제외(주택화재보험대상)'}, {'keyword': '숙소', 'val': '평가제외(주택화재보험대상)'}
    ],
    covExclude: [
        {'keyword': '취득세', 'val': '부보제외(세금)'}, {'keyword': '등록세', 'val': '부보제외(세금)'}, {'keyword': '농특세', 'val': '부보제외(세금)'}, {'keyword': '상표권', 'val': '부보제외(상표권)'}, {'keyword': '회원권', 'val': '부보제외(회원권)'}, {'keyword': '콘도', 'val': '부보제외(회원권)'}, {'keyword': '이용권', 'val': '부보제외(이용권)'}, {'keyword': '특허권', 'val': '부보제외(특허권)'}, {'keyword': '특허', 'val': '부보제외(특허권)'}, {'keyword': '철거', 'val': '부보제외(철거비용)'}, {'keyword': '복구', 'val': '부보제외(복구비용)'}, {'keyword': '이자', 'val': '부보제외(이자비용)'}, {'keyword': '부담금', 'val': '부보제외(부담금)'}, {'keyword': '분담금', 'val': '부보제외(분담금)'}, {'keyword': '사용료', 'val': '부보제외(사용료)'}, {'keyword': '수수료', 'val': '부보제외(수수료)'}, {'keyword': '양도', 'val': '부보제외(양도자산)'}, {'keyword': '실용신안', 'val': '부보제외(실용신안권)'}, {'keyword': '디자인등록', 'val': '부보제외(의장권)'}, {'keyword': '지하수개발', 'val': '부보제외(지하자산)'}, {'keyword': '수수료 및 이자, 등기비용', 'val': '부보제외(비용성격)'}, {'keyword': '한전불입금', 'val': '부보제외(한전불입금)'}, {'keyword': '무형자산', 'val': '부보제외(무형자산)'}, {'keyword': '안전진단비', 'val': '부보제외(비용성격)'}, {'keyword': '구조검토비용', 'val': '부보제외(비용성격)'}, {'keyword': '등기비', 'val': '부보제외(비용성격)'}, {'keyword': '시설부담금', 'val': '부보제외(시설부담금)'}, {'keyword': '권리금', 'val': '부보제외(권리금)'}, {'keyword': '지질조사', 'val': '부보제외(지질조사)'}, {'keyword': '도로부담금', 'val': '부보제외(도로부담금)'}, {'keyword': '측량비', 'val': '부보제외(비용성격)'}, {'keyword': '자동차보험가입대상', 'val': '부보제외(중복보험)'}, {'keyword': '주택화재보험가입대상', 'val': '부보제외(중복보험)'}
    ]
};

// 캐시에서 가져오기 (없으면 엑셀 데이터 초기값 적용)
window.infState.mappingRules = JSON.parse(localStorage.getItem('kb_mapping_rules_v3')) || initialRules;

window.openRuleManager = function() {
    document.getElementById('ruleTypeSelect').value = 'basic';
    window.renderRuleManagerRows();
    document.getElementById('ruleManagerModal').style.display = 'flex';
};

window.renderRuleManagerRows = function() {
    const ruleType = document.getElementById('ruleTypeSelect').value;
    const tbody = document.getElementById('ruleManagerTbody');
    tbody.innerHTML = '';
    const rules = window.infState.mappingRules[ruleType] || [];
    
    rules.forEach((rule, idx) => {
        window.renderRuleRow(tbody, rule.keyword, rule.val, idx);
    });
};

window.renderRuleRow = function(tbody, keyword, val, idx) {
    const tr = document.createElement('tr');
    tr.id = `ruleRow_${idx}`;
    tr.innerHTML = `
        <td style="padding:4px;"><input type="text" class="input-box rule-keyword" value="${keyword}" placeholder="검색할 키워드" style="width:100%; box-sizing:border-box;"></td>
        <td style="padding:4px;"><input type="text" class="input-box rule-val" value="${val}" placeholder="입력할 구분 값" style="width:100%; box-sizing:border-box;"></td>
        <td style="text-align:center;"><button type="button" style="background:#dc3545; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer;" onclick="document.getElementById('ruleRow_${idx}').remove()"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
};

window.addRuleRow = function() {
    const tbody = document.getElementById('ruleManagerTbody');
    const newIdx = Date.now();
    window.renderRuleRow(tbody, "", "", newIdx);
};

window.saveRules = function() {
    const ruleType = document.getElementById('ruleTypeSelect').value;
    const tbody = document.getElementById('ruleManagerTbody');
    const newRules = [];
    
    Array.from(tbody.children).forEach(tr => {
        const keyword = tr.querySelector('.rule-keyword').value.trim();
        const val = tr.querySelector('.rule-val').value.trim();
        if(keyword) {
            newRules.push({ keyword, val });
        }
    });

    window.infState.mappingRules[ruleType] = newRules;
    localStorage.setItem('kb_mapping_rules_v3', JSON.stringify(window.infState.mappingRules)); 
    
    alert(`✅ 현재 선택된 규칙 카테고리가 성공적으로 영구 저장되었습니다.`);
};

// ============================================================================
// [섹션 9] 3단계 가액평가 일괄 계산 및 감가율 모달 로직
// ============================================================================

// ★ 감가율 일괄 지정 모달창을 HTML에 동적으로 삽입 (최초 1회)
(function addDeprModal() {
    if(document.getElementById('deprBatchModal')) return;
    const modalHtml = `
    <div class="modal-overlay" id="deprBatchModal" style="display:none; z-index: 1000; justify-content: center; align-items: center;">
        <div class="modal-content" style="width: 500px; max-width: 95%; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
            <div class="modal-header" style="background:#6c757d; color:white; padding:15px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight:bold;"><i class="fa-solid fa-wand-magic-sparkles"></i> 자산계정별 감가율 일괄 지정</span>
                <i class="fa-solid fa-xmark modal-close" style="cursor:pointer; font-size:18px;" onclick="document.getElementById('deprBatchModal').style.display='none'"></i>
            </div>
            <div class="modal-body" style="padding: 20px; background:#f4f5f7;">
                <p style="font-size:13px; color:#555; margin-bottom:10px;">👉 현재 명세서에 존재하는 <b>자산계정</b> 항목들입니다. 소수점 둘째자리까지 숫자를 기입해 주세요.</p>
                <div style="max-height: 350px; overflow-y: auto; background:#fff; border:1px solid #ddd; border-radius:4px; margin-bottom: 15px;">
                    <table class="data-table" style="margin-bottom:0;">
                        <thead style="position: sticky; top: 0; z-index: 1; background: #eee;">
                            <tr><th>자산계정 항목</th><th>감가율 입력 (%)</th></tr>
                        </thead>
                        <tbody id="deprBatchTbody"></tbody>
                    </table>
                </div>
                <div style="text-align: right;">
                    <button type="button" class="btn-dark" style="background:#17A2B8; padding:8px 25px; border:none; font-size:14px;" onclick="window.applyDeprBatch()">⚡ 일괄 적용하기</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
})();

// 1.2 평가지수 등록 시 물가보정용 3개 시트를 캐싱하도록 main.js 함수 오버라이딩
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
            
            window.kbState.inflationSheets = {
                const: XLSX.utils.sheet_to_json(workbook.Sheets['건축지수'] || workbook.Sheets[workbook.SheetNames[0]], {header: 1, defval: ""}),
                prod: XLSX.utils.sheet_to_json(workbook.Sheets['생산자물가'] || workbook.Sheets[workbook.SheetNames[0]], {header: 1, defval: ""}),
                imp: XLSX.utils.sheet_to_json(workbook.Sheets['수입물가'] || workbook.Sheets[workbook.SheetNames[0]], {header: 1, defval: ""})
            };
            
            alert(`✅ 건축물가지수 및 물가보정용 엑셀 분석 완료!`);
            if(window.retroactiveApplyPriceIndex) window.retroactiveApplyPriceIndex();
        } catch(err) { alert("물가지수 파싱 중 오류 발생: " + err); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
};

// 1. 물가지수 불러오기 및 재조달가액 계산
window.applyInflationIndex = function() {
    if (!window.kbState.inflationSheets) {
        alert("⚠️ 1.2 평가지수 등록 메뉴에서 [물가지수] 엑셀 파일을 한 번 더 첨부해 주세요.\n(시스템 업데이트로 인한 최초 1회 캐싱 작업이 필요합니다.)");
        const fileInput = document.getElementById('priceIndexFile');
        if (fileInput) fileInput.click();
        return;
    }

    try {
        const sheetConst = window.kbState.inflationSheets.const;
        const sheetProd  = window.kbState.inflationSheets.prod;
        const sheetImp   = window.kbState.inflationSheets.imp;

        const wiz = window.infState.wizard;
        const tData = window.infState.data[window.infState.activeTab];

        const mappedColCount = Object.keys(wiz.mapped).length;
        const accIdx = wiz.mapped['자산계정'];
        const yearIdx = wiz.mapped['취득년도'];
        const originIdx = wiz.mapped['국산/외산'];
        const priceIdx = wiz.mapped['취득가액']; 
        
        const finalIdx = mappedColCount + 4;
        const inflationIdx = mappedColCount + 5;
        const replacementIdx = mappedColCount + 6;

        if(typeof window.infSaveHistory === 'function') window.infSaveHistory();
        let applyCount = 0, missingCount = 0;
        let subRep = 0, totRep = 0;

        const getYearColIndex = (sheet, yearStr) => {
            if (!sheet) return null;
            for (let i = 0; i < Math.min(5, sheet.length); i++) {
                const colIdx = sheet[i].findIndex(cell => String(cell).includes(yearStr));
                if (colIdx !== -1) return { rowIdx: i, colIdx: colIdx };
            }
            return null;
        };

        tData.raw.forEach(row => {
            const yearVal = String(row[yearIdx] || '').trim();
            
            if (yearVal.includes('소계')) {
                row[replacementIdx] = subRep > 0 ? Math.round(subRep) : '';
                subRep = 0; 
                return;
            } else if (yearVal.includes('총계')) {
                row[replacementIdx] = totRep > 0 ? Math.round(totRep) : '';
                return;
            }

            const finalVal = String(row[finalIdx] || '').trim();
            const accVal = String(row[accIdx] || '').trim();
            const originVal = String(row[originIdx] || '').trim();
            const acqPrice = Number(String(row[priceIdx] || '').replace(/,/g, '')) || 0;

            if (!finalVal) return;

            let indexValue = "";
            let replacementCost = 0;

            if (finalVal.includes('부보제외')) {
                indexValue = "-"; replacementCost = "-"; 
            } else if (finalVal.includes('평가제외')) {
                indexValue = "1"; replacementCost = acqPrice * 1; 
            } else {
                let targetSheet = ['건물', '구축물', '건물부속설비'].includes(accVal) ? sheetConst : (originVal === '외산' ? sheetImp : sheetProd);
                let isConstSheet = ['건물', '구축물', '건물부속설비'].includes(accVal);

                if (targetSheet && targetSheet.length > 0) {
                    const yearInfo = getYearColIndex(targetSheet, yearVal);
                    if (yearInfo) {
                        let matchRow = null;
                        if (isConstSheet) matchRow = targetSheet.find((r, i) => i > yearInfo.rowIdx && String(r[1] || '').trim() === finalVal);
                        else matchRow = targetSheet.find((r, i) => i > yearInfo.rowIdx && String(r[0] || '').trim() === finalVal);

                        if (matchRow) {
                            indexValue = Number(matchRow[yearInfo.colIdx]);
                            if (!isNaN(indexValue)) replacementCost = acqPrice * indexValue;
                        }
                    }
                }
            }

            if (indexValue !== "") {
                row[inflationIdx] = isNaN(indexValue) ? indexValue : Number(indexValue).toFixed(4); 
                row[replacementIdx] = isNaN(replacementCost) ? replacementCost : Math.round(replacementCost); 
                
                if (!isNaN(replacementCost)) {
                    subRep += replacementCost;
                    totRep += replacementCost;
                }
                applyCount++;
            } else { 
                missingCount++; 
            }
        });

        if(typeof window.infRenderTable === 'function') window.infRenderTable();
        alert(`✅ 물가지수 및 재조달가액 산출 완료!\n- 적용 완료: ${applyCount}건\n- 누락(연도/코드 없음): ${missingCount}건`);
    } catch (err) { alert("계산 중 오류가 발생했습니다.\n" + err.message); }
};

// 2. 감가율 팝업 모달 열기
window.openDeprBatchModal = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return alert("데이터가 없습니다.");

    const accIdx = wiz.mapped['자산계정'];
    const yearIdx = wiz.mapped['취득년도'];

    if (accIdx === undefined) return alert("자산계정 열이 매핑되지 않았습니다.");

    let uniqueAccounts = new Set();
    tData.raw.forEach(row => {
        const yearVal = String(row[yearIdx] || '');
        if (yearVal.includes('소계') || yearVal.includes('총계')) return;
        const acc = String(row[accIdx] || '').trim();
        if (acc) uniqueAccounts.add(acc);
    });

    if (uniqueAccounts.size === 0) return alert("명세서에 자산계정 데이터가 없습니다.");

    const tbody = document.getElementById('deprBatchTbody');
    tbody.innerHTML = '';
    
    // 편의를 위한 기본 추천값 세팅
    const defaultDepr = { '건물': 1.78, '구축물': 1.33, '기계장치': 5.33, '공기구': 5.33, '공구와 기구': 5.33, '차량운반구': 5.33 };

    uniqueAccounts.forEach(acc => {
        const defaultVal = defaultDepr[acc] || ''; 
        tbody.innerHTML += `
            <tr>
                <td style="text-align:center; font-weight:bold; color:#1C5691; vertical-align:middle;">${acc}</td>
                <td style="padding:4px;">
                    <input type="number" step="0.01" id="deprInput_${acc}" class="input-box" value="${defaultVal}" style="width:100%; text-align:center; box-sizing:border-box; font-weight:bold; color:#333;">
                </td>
            </tr>
        `;
    });

    document.getElementById('deprBatchModal').style.display = 'flex';
};

// 3. 팝업에서 입력한 감가율 값을 데이터에 반영
window.applyDeprBatch = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    const accIdx = wiz.mapped['자산계정'];
    const yearIdx = wiz.mapped['취득년도'];
    
    const mappedColCount = Object.keys(wiz.mapped).length;
    const deprIdx = mappedColCount + 7; // 감가율 열

    const inputMap = {};
    document.querySelectorAll('[id^="deprInput_"]').forEach(input => {
        const acc = input.id.replace('deprInput_', '');
        inputMap[acc] = input.value.trim();
    });

    if(typeof window.infSaveHistory === 'function') window.infSaveHistory();

    let applyCount = 0;
    tData.raw.forEach(row => {
        const yearVal = String(row[yearIdx] || '');
        if (yearVal.includes('소계') || yearVal.includes('총계')) return;

        const acc = String(row[accIdx] || '').trim();
        if (inputMap[acc] !== undefined && inputMap[acc] !== "") {
            const deprVal = Number(inputMap[acc]);
            row[deprIdx] = deprVal === 0 ? "-" : deprVal.toFixed(2);
            applyCount++;
        }
    });

    document.getElementById('deprBatchModal').style.display = 'none';
    if(typeof window.infRenderTable === 'function') window.infRenderTable(); 
    alert(`✅ 총 ${applyCount}건의 감가율이 표에 입력되었습니다.\n표 상단의 [⚡ 감가/현재 계산] 버튼을 클릭해 가액을 산출해 주세요.`);
};

// 4. 감가율 기반 잔가율 및 현재가액 일괄 계산
window.applyCurrentValue = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return alert("데이터가 없습니다.");

    const mappedColCount = Object.keys(wiz.mapped).length;
    const yearIdx = wiz.mapped['취득년도'];
    const replacementIdx = mappedColCount + 6; 
    const deprIdx = mappedColCount + 7;        
    const residualIdx = mappedColCount + 8;    
    const currentValIdx = mappedColCount + 9;  

    // 인덱스 HTML의 '평가시점 연도' 가져오기
    const evalYearInput = document.getElementById('evalYear');
    const evalYear = parseInt(evalYearInput ? evalYearInput.value : new Date().getFullYear());

    if(typeof window.infSaveHistory === 'function') window.infSaveHistory();
    let applyCount = 0;
    let subCur = 0, totCur = 0; 

    tData.raw.forEach(row => {
        const yearVal = String(row[yearIdx] || '').trim();
        
        if (yearVal.includes('소계')) {
            row[currentValIdx] = subCur > 0 ? Math.round(subCur) : '';
            subCur = 0; 
            return;
        } else if (yearVal.includes('총계')) {
            row[currentValIdx] = totCur > 0 ? Math.round(totCur) : '';
            return;
        }

        const repCostStr = String(row[replacementIdx] || '').replace(/,/g, '');
        const deprStr = String(row[deprIdx] || '').replace(/,/g, ''); 
        
        if (repCostStr === '-' || repCostStr === '') { 
            row[residualIdx] = '-'; row[currentValIdx] = '-'; return;
        }

        const repCost = Number(repCostStr);
        const acqYear = parseInt(yearVal);
        const deprRate = Number(deprStr);

        if (!isNaN(repCost) && !isNaN(acqYear)) {
            // 감가율이 0이거나 '-'로 입력된 경우 -> 잔가율 100%, 값 유지
            if (deprStr === '-' || deprRate === 0) {
                row[deprIdx] = '-';
                row[residualIdx] = 100;
                row[currentValIdx] = repCost;
                subCur += repCost; 
                totCur += repCost;
                applyCount++;
            } 
            // 감가율 값이 정상적으로 있을 경우 계산 수행
            else if (!isNaN(deprRate)) {
                const elapsed = Math.max(0, evalYear - acqYear);
                
                // ★ 잔가율 = 100 - ((현재평가년도 - 취득년도) * 감가율)
                let residualRate = 100 - (elapsed * deprRate);
                residualRate = Math.max(0, residualRate); // 0 미만 방지

                // 잔가율이 0인 경우 "-"로 표시 (요구사항 반영)
                row[residualIdx] = residualRate === 0 ? "-" : residualRate.toFixed(2);
                
                const currentVal = repCost * (residualRate / 100);
                row[currentValIdx] = Math.round(currentVal); 
                
                subCur += currentVal; 
                totCur += currentVal;
                applyCount++;
            }
        }
    });

    if(typeof window.infRenderTable === 'function') window.infRenderTable();
    alert(`✅ 잔가율 및 현재가액 산출 완료!\n- 총 ${applyCount}건의 현재가액이 계산되었습니다.`);
};