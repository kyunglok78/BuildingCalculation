// ============================================================================
// api_inflation.js - 3단계 프로세스(정제 -> 자산구분 -> 평가) 통합 버전
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
    lastClickedCol: -1
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

// (2) 엑셀 로드 및 마법사
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
    btnNext.onclick = infCalculateSubtotals;
    
    tData.selectedCols.clear();
    tData.selectedRows.clear();
    infRenderTable();
};

// (3) 3단계 전환 로직
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

// (4) 메인 렌더링 로직 (2, 3단계 열 동적 추가)
window.infSetFolding = function(level) {
    window.infState.foldingLevel = level;
    infRenderTable();
};

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
    
    // 단계별 추가 열 정의
    const step2Cols = ['과거 구분', '기본 구분', '평가제외 구분', '부보제외 구분'];
    const step3Cols = ['물가지수', '재조달가액', '감가율', '잔가율', '현재가액', '비고'];
    const mappedKeys = Object.keys(wiz.mapped); 

    for(let c = 0; c < colCount; c++) {
        const isSelected = tData.selectedCols.has(c) ? 'inf-sel-col' : '';
        const th = document.createElement('th');
        th.className = `inf-header ${isSelected}`;
        th.style.cssText = `background:#f8fafc; border:1px solid #ccc; padding:8px; text-align:center; font-weight:bold; min-width:80px; vertical-align:middle;`;
        
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
    
    // 2단계 이상이면 자산구분 열 추가
    if(window.infState.step >= 2) {
        step2Cols.forEach(colName => {
            headerTr.innerHTML += `<th style="background:#28A745; color:#fff; border:1px solid #ccc; padding:8px; text-align:center;">${colName}</th>`;
        });
    }
    // 3단계면 평가 열 추가
    if(window.infState.step === 3) {
        step3Cols.forEach(colName => {
            headerTr.innerHTML += `<th style="background:#1C5691; color:#fff; border:1px solid #ccc; padding:8px; text-align:center;">${colName}</th>`;
        });
    }
    thead.appendChild(headerTr);

    const yearColIdx = mappedKeys.indexOf('취득년도'); 
    
    data.forEach((row, rIdx) => {
        const yearVal = String(row[yearColIdx] || '');
        const isSubtotalRow = yearColIdx !== -1 && yearVal.includes('소계');
        const isGrandTotalRow = yearColIdx !== -1 && yearVal.includes('총계');
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
        
        // 2단계 이상이면 빈칸 렌더링 (일단 텍스트 입력용 빈칸으로 처리)
        if(window.infState.step >= 2) {
            step2Cols.forEach(c => { rowHtml += `<td style="border:1px solid #eee; ${bgStyle ? bgStyle : 'background:#e8f5e9;'}"></td>`; });
        }
        if(window.infState.step === 3) {
            step3Cols.forEach(c => { rowHtml += `<td style="border:1px solid #eee; ${bgStyle ? bgStyle : 'background:#f0fdf4;'}"></td>`; });
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

// (5) 정렬/부분합, 히스토리, 단축키 로직
window.infCalculateSubtotals = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return;

    const locIdx = Object.keys(wiz.mapped).indexOf('소재지');
    const accIdx = Object.keys(wiz.mapped).indexOf('자산계정');
    const yearIdx = Object.keys(wiz.mapped).indexOf('취득년도');
    const priceIdx = Object.keys(wiz.mapped).indexOf('취득가액');

    if(locIdx === -1 || accIdx === -1 || yearIdx === -1 || priceIdx === -1) {
        return alert("부분합을 계산하기 위한 필수 항목(소재지, 자산계정, 취득년도, 취득가액)이 매핑되지 않았습니다.");
    }

    infSaveHistory();

    const cleanRaw = tData.raw.filter(row => !String(row[yearIdx] || '').includes('소계') && !String(row[yearIdx] || '').includes('총계'));

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
    infRenderTable();
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
        
        const yearColIdx = Object.keys(window.infState.wizard.mapped).indexOf('취득년도');
        tData.hasSubtotal = yearColIdx !== -1 && tData.raw.some(r => String(r[yearColIdx] || '').includes('소계'));
        if(!tData.hasSubtotal && window.infState.step === 1 && window.infState.wizard.phase === 'row-delete') {
            const btnNext = document.getElementById('btnInfNextStep');
            btnNext.innerHTML = '<i class="fa-solid fa-layer-group"></i> 부분합(소계) 및 정렬 수행';
            btnNext.style.backgroundColor = '#6f42c1';
            btnNext.onclick = infCalculateSubtotals;
        }
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