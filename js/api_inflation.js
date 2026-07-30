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
    pastYear: null
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
        #infStep1Panel { display: block !important; }
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

    const tabContainers = document.querySelectorAll('.infTabsContainer');
    if(tabContainers.length === 0) return;
    
    tabContainers.forEach((container, cIdx) => {
        // 혹시 남아있을 수 있는 스위치 UI 찌꺼기 제거
        const parentId = container.parentElement.id || ('sec_' + cIdx);
        const oldProgDiv = document.getElementById('progModeContainer_' + parentId);
        if(oldProgDiv) oldProgDiv.remove();

        container.innerHTML = '';
        
        window.infState.tabs.forEach((tabName, idx) => {
            if(!window.infState.data[tabName]) {
                // ★ 각 탭마다 현재 단계를 기억할 변수(step) 추가
                window.infState.data[tabName] = { raw: [], history: [], selectedRows: new Set(), selectedCols: new Set(), hasSubtotal: false, step: 1 };
            }
            
            const tabBtn = document.createElement('div');
            tabBtn.innerText = tabName;
            tabBtn.className = 'inf-tab-btn';
            tabBtn.style.cssText = `padding:10px 20px; cursor:pointer; font-weight:normal; border:1px solid #e2e8f0; border-bottom:none; border-radius:4px 4px 0 0; margin-right:5px; background:#f1f5f9; color:#94a3b8; transition:0.2s;`;
            
            tabBtn.onclick = () => {
                document.querySelectorAll('.inf-tab-btn').forEach(c => { 
                    c.style.background = '#f1f5f9'; c.style.color = '#94a3b8'; c.style.fontWeight = 'normal'; c.style.borderColor = '#e2e8f0'; 
                });
                
                document.querySelectorAll('.infTabsContainer').forEach(tc => {
                    const matchingTab = Array.from(tc.children).find(child => child.innerText === tabName);
                    if(matchingTab) {
                        matchingTab.style.background = '#1C5691'; matchingTab.style.color = '#ffffff'; matchingTab.style.fontWeight = 'bold'; matchingTab.style.borderColor = '#1C5691';
                    }
                });

                window.infState.activeTab = tabName;
                
                // ★ 탭을 누르면, 해당 탭이 저장해둔 단계로 화면 강제 이동 (완벽 독립 진행)
                const targetStep = window.infState.data[tabName].step || 1;
                if (window.infState.step !== targetStep) {
                    if (typeof switchSection === 'function') switchSection('sec-2-3-' + targetStep);
                    window.infState.step = targetStep;
                }

                if(typeof window.infRenderTable === 'function') window.infRenderTable();
            };
            container.appendChild(tabBtn);
            
            if(idx === 0 && window.infState.activeTab === '') {
                tabBtn.style.background = '#1C5691'; tabBtn.style.color = '#ffffff'; tabBtn.style.fontWeight = 'bold'; tabBtn.style.borderColor = '#1C5691';
                window.infState.activeTab = tabName;
            } else if (window.infState.activeTab === tabName) {
                tabBtn.style.background = '#1C5691'; tabBtn.style.color = '#ffffff'; tabBtn.style.fontWeight = 'bold'; tabBtn.style.borderColor = '#1C5691';
            }
        });
    });
};

document.addEventListener("DOMContentLoaded", () => {
    const infMenu1 = document.getElementById('nav-sec-2-3-1');
    const infMenu2 = document.getElementById('nav-sec-2-3-2');
    const infMenu3 = document.getElementById('nav-sec-2-3-3');
    
    const initFn = (step) => { 
        if(window.infState.tabs.length === 0) window.infInitTabs(); 
        window.infState.step = step;
        setTimeout(() => { if(typeof window.infRenderTable === 'function') window.infRenderTable(); }, 150);
    };
    
    if(infMenu1) infMenu1.addEventListener('click', () => initFn(1));
    if(infMenu2) infMenu2.addEventListener('click', () => initFn(2));
    if(infMenu3) infMenu3.addEventListener('click', () => initFn(3));
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
            document.getElementById('infWizardText').innerHTML = `🎯 [${tabName}] 원본 데이터를 불러왔습니다. 우측의 <b>'열 매핑 마법사 시작'</b>을 눌러주세요.`;
            const btnNext = document.getElementById('btnInfNextStep');
            if(btnNext) btnNext.style.display = 'none';
            
            if(typeof infRenderTable === 'function') infRenderTable();
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
    
    if(typeof infUpdateWizardUI === 'function') infUpdateWizardUI();
    if(typeof infRenderTable === 'function') infRenderTable();
};

window.infSetMappingTarget = function(colName) {
    window.infState.wizard.activeTarget = colName;
    if(typeof infUpdateWizardUI === 'function') infUpdateWizardUI();
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
        btn.onclick = () => window.infSetMappingTarget(colName);
        btnContainer.appendChild(btn);
    });
};

window.infFinishMapping = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    
    const mappedCols = wiz.columns.map(name => ({ name, oldIdx: wiz.mapped[name] })).filter(mc => mc.oldIdx !== undefined);
    
    if (mappedCols.length === 0) return alert("매칭된 열이 하나도 없습니다. 최소 1개 이상 항목을 엑셀 열과 매칭해주세요.");
    if (!confirm(`[${window.infState.activeTab}] 탭의 열 매칭을 완료하시겠습니까?\n매칭되지 않은 불필요한 열은 모두 자동으로 삭제됩니다.`)) return;

    if(typeof window.infSaveHistory === 'function') window.infSaveHistory();

    const finalColumns = ['소재지', '자산계정', '자산번호', '자산명', '국산/외산', '취득일', '취득년도', '취득가액'];

    let mappedRaw = tData.raw.map(oldRow => {
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

    // ★ [핵심] 다른 탭으로 자동 찢어주는 로직 완전 삭제. 
    // 오직 사용자가 현재 작업 중인 탭에만 데이터를 독점 저장합니다.
    tData.raw = mappedRaw;
    alert(`✅ [${window.infState.activeTab}] 엑셀 데이터 매핑 완료!`);
    
    wiz.phase = 'row-delete';
    wiz.activeTarget = '';
    
    document.getElementById('infWizardText').innerHTML = `🧹 1.5단계: 불필요한 행(빈 줄, 합계 등)을 선택 후 <b>[Delete]</b> 키로 지우시고, <b>우측 하단의 '부분합 및 정렬' 버튼</b>을 눌러주세요.`;
    document.getElementById('btnFinishMapping').style.display = 'none';
    document.getElementById('infMappingButtons').style.display = 'none';
    
    const btnNext = document.getElementById('btnInfNextStep');
    if (btnNext) {
        btnNext.style.display = 'inline-block';
        btnNext.innerHTML = '<i class="fa-solid fa-layer-group"></i> 부분합 및 정렬 ➔ 2.3.2로 이동';
        btnNext.style.backgroundColor = '#6f42c1'; 
        btnNext.onclick = () => window.infCalculateSubtotals(false); 
    }
    
    tData.selectedCols.clear();
    tData.selectedRows.clear();
    if(typeof infRenderTable === 'function') infRenderTable();
};

// ============================================================================
// [섹션 4] 상태 표시/스텝 전환 및 테이블 렌더링 엔진 (다중 화면 연동)
// ============================================================================

window.infUpdateStatusBadges = function() {
    const step1 = document.getElementById('nav-sec-2-3-1');
    const step2 = document.getElementById('nav-sec-2-3-2');
    const step3 = document.getElementById('nav-sec-2-3-3');
    
    if(!step1 || !step2 || !step3) return;

    // ★ 파일 불러오기 시 '완료' 뱃지 상태 강제 초기화 방어
    const isS1Complete = step1.querySelector('.status-badge') && step1.querySelector('.status-badge').innerText === '완료';
    const isS2Complete = step2.querySelector('.status-badge') && step2.querySelector('.status-badge').innerText === '완료';
    const isS3Complete = step3.querySelector('.status-badge') && step3.querySelector('.status-badge').innerText === '완료';

    [step1, step2, step3].forEach(el => {
        const badge = el.querySelector('.status-badge');
        if(badge) { badge.className = 'status-badge status-wait'; badge.innerText = '대기'; }
    });

    if (window.infState.step === 1) {
        const tData = window.infState.data[window.infState.activeTab];
        if (tData && tData.raw && tData.raw.length > 0) {
            step1.querySelector('.status-badge').className = isS1Complete ? 'status-badge status-complete' : 'status-badge status-ing';
            step1.querySelector('.status-badge').innerText = isS1Complete ? '완료' : '진행';
        }
    } else if (window.infState.step === 2) {
        step1.querySelector('.status-badge').className = 'status-badge status-complete';
        step1.querySelector('.status-badge').innerText = '완료';
        step2.querySelector('.status-badge').className = isS2Complete ? 'status-badge status-complete' : 'status-badge status-ing';
        step2.querySelector('.status-badge').innerText = isS2Complete ? '완료' : '진행';
    } else if (window.infState.step === 3) {
        step1.querySelector('.status-badge').className = 'status-badge status-complete';
        step1.querySelector('.status-badge').innerText = '완료';
        step2.querySelector('.status-badge').className = 'status-badge status-complete';
        step2.querySelector('.status-badge').innerText = '완료';
        step3.querySelector('.status-badge').className = isS3Complete ? 'status-badge status-complete' : 'status-badge status-ing';
        step3.querySelector('.status-badge').innerText = isS3Complete ? '완료' : '진행';
    }
};

window.infUpdateStepper = function() {
    const wiz = window.infState.wizard;
    
    if (window.infState.step === 1) {
        const el1 = document.getElementById('step-1-1');
        const el2 = document.getElementById('step-1-2');
        const el3 = document.getElementById('step-1-3');
        if(el1) el1.style.color = '#1C5691';
        if(el2) el2.style.color = (wiz.phase === 'mapping' || wiz.phase === 'row-delete') ? '#1C5691' : '#999';
        if(el3) el3.style.color = window.infState.data[window.infState.activeTab]?.hasSubtotal ? '#1C5691' : '#999';
    } else if (window.infState.step === 2) {
        const el1 = document.getElementById('step-2-1');
        const el2 = document.getElementById('step-2-2');
        const el3 = document.getElementById('step-2-3');
        const el4 = document.getElementById('step-2-4');
        const el5 = document.getElementById('step-2-5');
        // 글로벌 wiz 대신, 고정된 매핑 컬럼수(8) 활용
        const mappedColCount = 8;
        const finalIdx = mappedColCount + 4;
        let hasFinal = false;
        const tData = window.infState.data[window.infState.activeTab];
        if (tData && tData.raw) {
            hasFinal = tData.raw.some(r => String(r[finalIdx] || '').replace(/null/gi, '').trim() !== '');
        }
        if(el1) el1.style.color = '#1C5691';
        if(el2) el2.style.color = '#1C5691';
        if(el3) el3.style.color = '#1C5691';
        if(el4) el4.style.color = '#1C5691';
        if(el5) el5.style.color = hasFinal ? '#1C5691' : '#999';
    } else if (window.infState.step === 3) {
        const el1 = document.getElementById('step-3-1');
        const el2 = document.getElementById('step-3-2');
        const el3 = document.getElementById('step-3-3');
        const el4 = document.getElementById('step-3-4');
        const mappedColCount = 8;
        const currentValIdx = mappedColCount + 9;
        let hasCurrentVal = false;
        const tData = window.infState.data[window.infState.activeTab];
        if (tData && tData.raw) {
            hasCurrentVal = tData.raw.some(r => String(r[currentValIdx] || '').replace(/null/gi, '').trim() !== '' && String(r[currentValIdx] || '').trim() !== '-');
        }
        if(el1) el1.style.color = '#1C5691';
        if(el2) el2.style.color = '#1C5691';
        if(el3) el3.style.color = '#1C5691';
        if(el4) el4.style.color = hasCurrentVal ? '#1C5691' : '#999';
    }
};

window.infProceedToStep2 = function() {
    window.infState.step = 2;
    window.infUpdateStatusBadges();
    switchSection('sec-2-3-2');
    infRenderTable();
};

window.infProceedToStep3 = function() {
    window.infState.step = 3;
    window.infUpdateStatusBadges();
    switchSection('sec-2-3-3');
    infRenderTable();
};

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
    let nextR = rIdx, nextC = cIdx, shouldMove = false;

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
        shouldMove = true; nextR++;
        while (nextR < tData.raw.length) {
            if (document.getElementById(`infInput_${nextR}_${nextC}`)) break;
            nextR++;
        }
    } else if (e.key === 'ArrowUp') {
        shouldMove = true; nextR--;
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
        if (nextEl) { e.preventDefault(); nextEl.focus(); nextEl.select(); }
    }
};

window.infRenderTable = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];

    let currentSection = window.infState.step || 1; 
    if (document.getElementById('sec-2-3-1') && document.getElementById('sec-2-3-1').classList.contains('active')) currentSection = 1;
    if (document.getElementById('sec-2-3-2') && document.getElementById('sec-2-3-2').classList.contains('active')) currentSection = 2;
    if (document.getElementById('sec-2-3-3') && document.getElementById('sec-2-3-3').classList.contains('active')) currentSection = 3;
    
    window.infState.step = currentSection;

    // 활성 탭에 현재 단계를 영구 저장
    if (window.infState.activeTab && window.infState.data[window.infState.activeTab]) {
        window.infState.data[window.infState.activeTab].step = currentSection;
    }

    window.infUpdateStatusBadges();
    window.infUpdateStepper();

    const theads = document.querySelectorAll('.infTheadGlobal');
    const tbodys = document.querySelectorAll('.infTbodyGlobal');
    
    const targetIdx = currentSection - 1;
    const thead = theads[targetIdx];
    const tbody = tbodys[targetIdx];
    if (!thead || !tbody) return;

    // ★ 1. 칠판 지우개 (이전 탭의 잔상을 테이블에서 완벽하게 제거)
    thead.innerHTML = ''; 
    tbody.innerHTML = '';

    const wizText = document.getElementById('infWizardText');
    const btnStart = document.getElementById('btnStartWizard');
    const btnFinish = document.getElementById('btnFinishMapping');
    const mapBtns = document.getElementById('infMappingButtons');
    const btnNext = document.getElementById('btnInfNextStep');

    // ★ 2. 해당 탭에 엑셀 데이터가 없다면 UI를 빈 깡통 상태로 리셋하고 즉시 종료!
    if(!tData || !tData.raw || tData.raw.length === 0) {
        if (currentSection === 1) {
            if (wizText) wizText.innerHTML = `🎯 [<b>${window.infState.activeTab}</b>] 우측 상단의 초록색 버튼을 눌러 이 사업장의 엑셀 원본 파일을 불러와 주세요.`;
            if (btnStart) btnStart.style.display = 'none';
            if (btnFinish) btnFinish.style.display = 'none';
            if (mapBtns) mapBtns.style.display = 'none';
            if (btnNext) btnNext.style.display = 'none';
            
            // 글로벌 마법사 변수도 리셋하여 꼬임 방지
            wiz.phase = 'idle';
            wiz.active = false;
        }
        return; 
    }

    // ★ 3. 데이터가 존재할 경우 테이블 그리기 및 UI 스마트 복원 시작
    const data = tData.raw;
    const finalColumns = ['소재지', '자산계정', '자산번호', '자산명', '국산/외산', '취득일', '취득년도', '취득가액'];
    
    // 데이터의 열 갯수가 딱 8개면 '매핑이 완료된 탭'으로 인식
    const isMappedPhase = (data[0] && data[0].length === finalColumns.length); 

    if (currentSection === 1) {
        if (tData.hasSubtotal) {
            // 부분합까지 모두 끝난 완벽한 탭일 경우
            if(wizText) wizText.innerHTML = `✅ [<b>${window.infState.activeTab}</b>] 명세서 정제 및 부분합 처리가 완료되었습니다. 다음 단계로 이동해 주세요.`;
            if(btnStart) btnStart.style.display = 'none';
            if(btnFinish) btnFinish.style.display = 'none';
            if(mapBtns) mapBtns.style.display = 'none';
            if(btnNext) {
                btnNext.style.display = 'inline-block';
                btnNext.innerHTML = '명세서 검증 완료 및 2.3.2(자산구분)로 전환 ▶';
                btnNext.style.backgroundColor = '#17A2B8';
                if(typeof window.infProceedToStep2 === 'function') btnNext.onclick = window.infProceedToStep2;
            }
        } else if (isMappedPhase) {
            // 매핑은 끝났고 행을 지우고 있는 탭일 경우
            if(wizText) wizText.innerHTML = `🧹 1.5단계: 불필요한 행(빈 줄, 합계 등)을 선택 후 <b>[Delete]</b> 키로 지우시고, <b>'부분합 및 정렬'</b> 버튼을 눌러주세요.`;
            if(btnStart) btnStart.style.display = 'none';
            if(btnFinish) btnFinish.style.display = 'none';
            if(mapBtns) mapBtns.style.display = 'none';
            if(btnNext) {
                btnNext.style.display = 'inline-block';
                btnNext.innerHTML = '<i class="fa-solid fa-layer-group"></i> 부분합 및 정렬 ➔ 2.3.2로 이동';
                btnNext.style.backgroundColor = '#6f42c1'; 
                btnNext.onclick = () => window.infCalculateSubtotals(false); 
            }
            wiz.phase = 'row-delete'; 
        } else {
            // 엑셀만 불러왔거나 열심히 매핑을 하고 있는 탭일 경우
            if (wiz.phase === 'mapping') {
                if(wizText) wizText.innerHTML = `🎯 아래 버튼 중 하나를 선택하고, 일치하는 엑셀 <span style="background:#FFCC00; padding:2px 5px; border-radius:3px; color:#000;">열 상단(알파벳)</span>을 클릭하세요. (없는 항목은 무시하세요)`;
                if(btnStart) btnStart.style.display = 'none';
                if(btnFinish) btnFinish.style.display = 'inline-block';
                if(mapBtns) mapBtns.style.display = 'flex';
                if(btnNext) btnNext.style.display = 'none';
            } else {
                if(wizText) wizText.innerHTML = `🎯 [<b>${window.infState.activeTab}</b>] 원본 데이터를 불러왔습니다. 우측의 <b>'열 매핑 마법사 시작'</b>을 눌러주세요.`;
                if(btnStart) btnStart.style.display = 'inline-block';
                if(btnFinish) btnFinish.style.display = 'none';
                if(mapBtns) mapBtns.style.display = 'none';
                if(btnNext) btnNext.style.display = 'none';
            }
        }
    }

    const colCount = (!isMappedPhase) ? data[0].length : finalColumns.length;
    const headerTr = document.createElement('tr');
    
    let foldHtml = '';
    if (tData.hasSubtotal && isMappedPhase) {
        foldHtml = `
            <div style="display:flex; gap:2px; justify-content:center; margin-top:4px;">
                <button class="fold-btn ${window.infState.foldingLevel === 1 ? 'active' : ''}" onclick="event.stopPropagation(); infSetFolding(1)" title="총계만 보기">1</button>
                <button class="fold-btn ${window.infState.foldingLevel === 2 ? 'active' : ''}" onclick="event.stopPropagation(); infSetFolding(2)" title="소계 표시">2</button>
                <button class="fold-btn ${window.infState.foldingLevel === 3 ? 'active' : ''}" onclick="event.stopPropagation(); infSetFolding(3)" title="전체 표시">3</button>
            </div>`;
    }
    
    headerTr.innerHTML = `<th style="width:60px; background:#f8fafc; border:1px solid #ccc; text-align:center; padding:6px 2px;">행 번호${foldHtml}</th>`; 
    
    const step2Cols = ['과거 구분', '기본 지정', '평가 제외', '부보 제외', '최종 선택'];
    const step3Cols = ['물가지수', '재조달가액', '감가율', '잔가율', '현재가액', '비고'];

    for(let c = 0; c < colCount; c++) {
        const isSelected = tData.selectedCols.has(c) ? 'inf-sel-col' : '';
        const th = document.createElement('th');
        th.className = `inf-header ${isSelected}`;
        th.style.cssText = `background:#f8fafc; border:1px solid #ccc; padding:8px; text-align:center; font-weight:bold; min-width:80px; vertical-align:bottom;`;
        
        const emptySpaceForBtn = (window.infState.step >= 2 && isMappedPhase) ? `<div style="height:25px; margin-bottom:6px;"></div>` : '';

        if (!isMappedPhase) {
            let colLetter = String.fromCharCode(65 + (c % 26)); 
            if (c >= 26) colLetter = String.fromCharCode(64 + Math.floor(c / 26)) + colLetter;
            let mappedLabel = "";
            for (const [key, val] of Object.entries(wiz.mapped)) {
                if (val === c) mappedLabel = `<br><span style="background:#FFCC00; color:#000; font-size:11px; padding:2px 4px; border-radius:3px;">${key}</span>`;
            }
            th.innerHTML = `${colLetter} ${mappedLabel}`;
        } else {
            th.innerHTML = `${emptySpaceForBtn}<div>${finalColumns[c] || `데이터 ${c+1}`}</div>`;
            th.style.background = '#e9ecef';
            th.style.color = '#1C5691';
        }
        
        th.onclick = (e) => {
            if (window.infState.step === 1 && wiz.phase === 'mapping' && !isMappedPhase) {
                if (!wiz.activeTarget) return alert("위에서 매칭할 항목 버튼을 먼저 선택해주세요.");
                wiz.mapped[wiz.activeTarget] = c;
                const unmapped = wiz.columns.find(col => wiz.mapped[col] === undefined);
                wiz.activeTarget = unmapped || ''; 
                if(typeof window.infUpdateWizardUI === 'function') window.infUpdateWizardUI();
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
        const currentYear = evalYearEl ? evalYearEl.value : new Date().getFullYear();

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
                topButtonHtml = `<button type="button" style="display:block; width:100%; margin-bottom:6px; background:#007BFF; color:#fff; border:none; padding:4px 0; border-radius:3px; font-weight:bold; font-size:11px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="event.stopPropagation(); window.applyInflationIndex()"><i class="fa-solid fa-bolt"></i> 지수/재조달 계산</button>`;
            } else if (colName === '감가율') {
                topButtonHtml = `<button type="button" style="display:block; width:100%; margin-bottom:6px; background:#28A745; color:#fff; border:none; padding:4px 0; border-radius:3px; font-weight:bold; font-size:11px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="event.stopPropagation(); window.openDeprBatchModal()"><i class="fa-solid fa-bolt"></i> 감가율 일괄지정(팝업)</button>`;
            } else if (colName === '잔가율') {
                topButtonHtml = `<button type="button" style="display:block; width:100%; margin-bottom:6px; background:#17A2B8; color:#fff; border:none; padding:4px 0; border-radius:3px; font-weight:bold; font-size:11px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="event.stopPropagation(); window.applyCurrentValue()"><i class="fa-solid fa-bolt"></i> 잔가/현재 계산</button>`;
            }

            headerTr.innerHTML += `<th style="background:#e9ecef; color:#1C5691; border:1px solid #ccc; padding:8px 4px; text-align:center; vertical-align:bottom; min-width:90px;">
                ${topButtonHtml}
                <div>${colName}</div>
            </th>`;
        });
    }
    thead.appendChild(headerTr);

    const yearColIdx = isMappedPhase ? finalColumns.indexOf('취득년도') : wiz.mapped['취득년도']; 
    
    data.forEach((row, rIdx) => {
        const yearVal = String(row[yearColIdx] || '').replace(/null/gi, '');
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
            let cellVal = (row[c] !== undefined && row[c] !== null && String(row[c]).toLowerCase() !== "null") ? row[c] : '';
            let align = 'left';
            
            if (isMappedPhase) {
                const headerName = finalColumns[c];
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
            const finalVal = String(row[finalDataIdx] || '').replace(/null/gi, '').trim();
            
            let sourceMatchIdx = -1;
            if (finalVal !== '') {
                const pastV = String(row[colCount + 0] || '').replace(/null/gi, '').trim();
                const basicV = String(row[colCount + 1] || '').replace(/null/gi, '').trim();
                const evalExV = String(row[colCount + 2] || '').replace(/null/gi, '').trim();
                const covExV = String(row[colCount + 3] || '').replace(/null/gi, '').trim();
                
                if (pastV === finalVal) sourceMatchIdx = colCount + 0;
                else if (evalExV === finalVal) sourceMatchIdx = colCount + 2;
                else if (covExV === finalVal) sourceMatchIdx = colCount + 3;
                else if (basicV === finalVal) sourceMatchIdx = colCount + 1;
            }

            step2Cols.forEach((cName, idx) => {
                if (window.infState.step === 3 && idx < 4) return;
                
                const dataIdx = colCount + idx;
                const savedVal = (row[dataIdx] !== undefined && row[dataIdx] !== null && String(row[dataIdx]).toLowerCase() !== "null") ? row[dataIdx] : '';
                
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
        
        if(window.infState.step === 3) {
            step3Cols.forEach((cName, idx) => { 
                const dataIdx = colCount + 5 + idx; 
                const savedVal = (row[dataIdx] !== undefined && row[dataIdx] !== null && String(row[dataIdx]).toLowerCase() !== "null") ? row[dataIdx] : '';
                
                if (isSubtotalRow || isGrandTotalRow) {
                    let displayVal = savedVal;
                    if (displayVal !== '' && !isNaN(String(displayVal).replace(/,/g, ''))) {
                        displayVal = Number(String(displayVal).replace(/,/g, '')).toLocaleString('ko-KR');
                    }
                    rowHtml += `<td style="border:1px solid #eee; text-align:right; font-weight:bold; color:#1C5691; padding:6px 10px; ${bgStyle}">${displayVal}</td>`; 
                } else {
                    let displayVal = savedVal;
                    let textAlign = 'center'; 
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
            if (window.infState.step === 1 && !isMappedPhase) return;

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

    if(typeof window.infSaveHistory === 'function') window.infSaveHistory();

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
    
    if(typeof window.infRenderTable === 'function') window.infRenderTable();
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

    if (!silent && typeof window.infSaveHistory === 'function') window.infSaveHistory();

    const cleanRaw = tData.raw.filter(row => !String(row[yearIdx] || '').includes('소계') && !String(row[yearIdx] || '').includes('총계'));

    if (cleanRaw.length === 0) {
        tData.raw = [];
        tData.hasSubtotal = false;
        if (!silent && typeof window.infRenderTable === 'function') window.infRenderTable();
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
    if (btnNext) {
        btnNext.innerHTML = '명세서 검증 완료 및 2.3.2(자산구분)로 전환 ▶';
        btnNext.style.backgroundColor = '#17A2B8';
        if(typeof window.infProceedToStep2 === 'function') btnNext.onclick = window.infProceedToStep2;
    }
    
    tData.selectedRows.clear();
    tData.selectedCols.clear();
    
    if (!silent && typeof window.infRenderTable === 'function') window.infRenderTable();
};

window.infSaveHistory = function() {
    const tData = window.infState.data[window.infState.activeTab];
    if(tData.history.length > 10) tData.history.shift();
    tData.history.push(JSON.parse(JSON.stringify(tData.raw)));
};

document.addEventListener('keydown', function(e) {
    const sec1 = document.getElementById('sec-2-3-1');
    const sec2 = document.getElementById('sec-2-3-2');
    const sec3 = document.getElementById('sec-2-3-3');
    const isActive = (sec1 && sec1.classList.contains('active')) || 
                     (sec2 && sec2.classList.contains('active')) || 
                     (sec3 && sec3.classList.contains('active'));
                     
    if (!isActive) return;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData) return;

    // 되돌리기(Undo) 로직
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if(tData.history.length === 0) return alert("더 이상 되돌릴 작업이 없습니다.");
        tData.raw = tData.history.pop();
        tData.selectedRows.clear(); tData.selectedCols.clear();
        
        const yearColIdx = window.infState.wizard.mapped['취득년도'];
        tData.hasSubtotal = yearColIdx !== undefined && tData.raw.some(r => String(r[yearColIdx] || '').includes('소계'));
        if(!tData.hasSubtotal && window.infState.step === 1 && window.infState.wizard.phase === 'row-delete') {
            const btnNext = document.getElementById('btnInfNextStep');
            if (btnNext) {
                btnNext.innerHTML = '<i class="fa-solid fa-layer-group"></i> 부분합 및 정렬 ➔ 2.3.2로 이동';
                btnNext.style.backgroundColor = '#6f42c1';
                btnNext.onclick = () => window.infCalculateSubtotals(false);
            }
        }
        if(typeof window.infRenderTable === 'function') window.infRenderTable();
    }
    
    // ★ [핵심] 행/열 삭제 로직 (Delete 키, Backspace 키 연동 및 인풋박스 삭제 시 행 날아감 방어)
    const isDeleteKey = e.key === 'Delete' || e.key === 'Backspace' || ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_'));
    
    if (isDeleteKey) {
        // 인풋 박스(텍스트 입력칸) 안에서 글씨를 지우는 중이라면 행 전체 삭제 방지
        const activeTag = document.activeElement.tagName.toUpperCase();
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

        if (tData.selectedRows.size === 0 && tData.selectedCols.size === 0) return;
        
        e.preventDefault();
        if(typeof window.infSaveHistory === 'function') window.infSaveHistory();
        
        if (tData.selectedRows.size > 0) {
            Array.from(tData.selectedRows).sort((a,b) => b - a).forEach(rIdx => tData.raw.splice(rIdx, 1));
            tData.selectedRows.clear();
        } else if (tData.selectedCols.size > 0) {
            const colsToDelete = Array.from(tData.selectedCols).sort((a,b) => b - a);
            tData.raw.forEach(row => colsToDelete.forEach(cIdx => row.splice(cIdx, 1)));
            tData.selectedCols.clear();
        }
        
        if (tData.hasSubtotal && typeof window.infCalculateSubtotals === 'function') {
            window.infCalculateSubtotals(true); 
        }
        if(typeof window.infRenderTable === 'function') window.infRenderTable();
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
// [섹션 9] 3단계 가액평가 일괄 계산 및 감가율 엑셀 참고 모달 로직 (검색 포함)
// ============================================================================

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

// ★ 엑셀 데이터 압축 내장 (4개 시트 - 업종감가율 100% 원본 포함)
window.DEPR_REF_DATA = {
    // ... sheet1, sheet2 유지 ...
    sheet1: {
        head: `<tr><th rowspan="2" style="background:#e9ecef;">건물 구조별</th><th colspan="2" style="background:#d1e7dd;">우기 이외 (일반건물)</th><th colspan="2" style="background:#ffe69c;">창고, 공장</th><th colspan="2" style="background:#f8d7da;">특수건물 (냉장, 화학 등)</th></tr>
               <tr><th style="background:#d1e7dd;">내용연수</th><th style="background:#d1e7dd;">감가율(%)</th><th style="background:#ffe69c;">내용연수</th><th style="background:#ffe69c;">감가율(%)</th><th style="background:#f8d7da;">내용연수</th><th style="background:#f8d7da;">감가율(%)</th></tr>`,
        body: [
            ["철골·철근콘크리트조, 철근콘크리트조", "75", "1.07", "57", "1.40", "38", "2.11"],
            ["철골조, 석조, 연와석조", "60", "1.33", "45", "1.78", "30", "2.67"],
            ["콘크리트, 연와, 벽돌, 보강블럭, 목조(한식)", "50", "1.60", "38", "2.11", "25", "3.20"],
            ["블럭조, 경량철골, 단열판넬, 목조(절충식)", "40", "2.00", "30", "2.67", "20", "4.00"],
            ["토조, 토벽조, 목골몰탈조", "30", "2.67", "23", "3.48", "15", "5.33"],
            ["간이목조, 간이철재 파이프, 컨테이너", "10", "8.00", "7", "11.43", "7", "11.43"]
        ]
    },
    sheet2: {
        head: `<tr><th rowspan="2" style="background:#e9ecef;">구축물 구조별</th><th colspan="2" style="background:#d1e7dd;">일반 구축물</th><th colspan="2" style="background:#f8d7da;">가혹한 구축물 (하수도, 굴뚝 등)</th></tr>
               <tr><th style="background:#d1e7dd;">내용연수</th><th style="background:#d1e7dd;">감가율(%)</th><th style="background:#f8d7da;">내용연수</th><th style="background:#f8d7da;">감가율(%)</th></tr>`,
        body: [
            ["철골·철근콘크리트조, 철근콘크리트조", "75", "1.07", "38", "2.11"],
            ["철골조, 석조, 연와석조", "60", "1.33", "30", "2.67"],
            ["콘크리트, 연와, 벽돌, 보강블럭조", "45", "1.78", "23", "3.48"],
            ["블록조, 경량철골, 단열판넬, 목조", "38", "2.11", "18", "4.45"],
            ["토조, 토벽조, 목골몰탈조", "30", "2.67", "15", "5.33"]
        ]
    },
    sheet3: {
        // ★ 열 너비(폭)를 조정하여 우측 숫자가 잘리지 않도록 강제 배분
        head: `<tr>
            <th style="background:#e9ecef; width:22%;">대분류</th>
            <th style="background:#e9ecef; width:22%;">중분류</th>
            <th style="background:#e9ecef; width:36%;">소분류</th>
            <th style="background:#d1e7dd; width:10%;">내용연수(년)</th>
            <th style="background:#ffe69c; width:10%;">감가율(%)</th>
        </tr>`,
        body: [
            ["농업, 임업 및 어업", "농업", "작물 재배업", "8", "10.0"],
            ["", "", "축산업", "8", "10.0"],
            ["", "", "작물재배 및 축산 복합농업", "8", "10.0"],
            ["", "", "작물재배 및 축산 관련 서비스업", "8", "10.0"],
            ["", "", "수렵 및 관련 서비스업", "8", "10.0"],
            ["", "", "과수", "30", "2.67"],
            ["", "임업", "임업", "8", "10.0"],
            ["", "어업", "어로 어업", "10", "8.0"],
            ["", "", "양식어업 및 어업관련 서비스업", "10", "8.0"],
            ["광업", "석탄, 원유 및 천연가스 광업 금속 광업", "석탄 광업", "10", "8.0"],
            ["", "", "원유 및 천영가스 채굴업", "10", "8.0"],
            ["", "금속광업", "철 광업", "15", "5.33"],
            ["", "", "비철금속 광업", "15", "5.33"],
            ["", "비금속광물 광업; 연료용 제외", "토사석 광업", "15", "5.33"],
            ["", "", "기타 비금속광물 광업", "15", "5.33"],
            ["", "광업 지원 서비스업", "광업 지원 서비스업", "8", "10.0"],
            ["제조업", "식료품제조업", "도축, 육류 가공 및 저장 처리업", "12", "6.67"],
            ["", "", "수산물 가공 및 저장 처리업", "12", "6.67"],
            ["", "", "과일, 재소 가공 및 저장 처리업", "12", "6.67"],
            ["", "", "동물성 및 식물성 유지 제조업", "12", "6.67"],
            ["", "", "낙농제품 및 식용빙과류 제조업", "12", "6.67"],
            ["", "", "곡물가공품, 전분 및 전분 제품 제조업", "12", "6.67"],
            ["", "", "기타 식품 제조업", "12", "6.67"],
            ["", "", "동물용 사료 및 조제 식품 제조업", "12", "6.67"],
            ["", "음료제조업", "알코올음료 제조업", "12", "6.67"],
            ["", "", "비알콜음료 및 얼음 제조업", "12", "6.67"],
            ["", "담배 제조업", "담배 제조업", "15", "5.33"],
            ["", "섬유제품제조업 ; 의복제외", "방적 및 가공사 제조업", "12", "6.67"],
            ["", "", "직물직조 및 직물제품 제조업", "12", "6.67"],
            ["", "", "편조원단 및 편조제품 제조업", "12", "6.67"],
            ["", "", "기타 섬유제품 제조업", "12", "6.67"],
            ["", "", "섬유제품 염색, 정리 및 마무리 가공업", "10", "8.0"],
            ["", "의복, 의복액세서리 및 모피제품 제조업", "봉제의복 제조업", "10", "8.0"],
            ["", "", "모피가공 및 모피제품 제조업", "10", "8.0"],
            ["", "", "편조 의복 제조업", "10", "8.0"],
            ["", "", "의복 액세서리 제조업", "10", "8.0"],
            ["", "가죽, 가방 및 신발 제조업", "가죽, 가방 및 유사제품 제조업", "12", "6.67"],
            ["", "", "신발 및 신발부부품 제조업", "12", "6.67"],
            ["", "", "가죽, 가방 및 유사제품 제조업 중 원피가공 및 가죽제조업", "10", "8.0"],
            ["", "목재 및 나무제품 제조업 ;가구제외", "제재 및 목재 가공업", "12", "6.67"],
            ["", "", "나무제품 제조업", "12", "6.67"],
            ["", "", "코르크 및 조물 제품 제조업", "12", "6.67"],
            ["", "펄프, 종이 및 종이제품 제조업", "펄프, 종이 및 판지 제조업", "15", "5.33"],
            ["", "", "골판지, 종이 상자 및 종이 용기 제조업", "15", "5.33"],
            ["", "", "기타 종이 및 판지 제품제조업", "15", "5.33"],
            ["", "인쇄 및 기록매체 복제업", "인쇄 및 인쇄관련 산업", "10", "8.0"],
            ["", "", "기록매체 복제업", "10", "8.0"],
            ["", "코크스, 연탄 및 석유정제품 제조업", "코크스 및 연탄 제조업", "10", "8.0"],
            ["", "", "석유 정제품 제조업", "10", "8.0"],
            ["", "화학물질 및 화학제품 제조업 ;의약품 제외", "기초화학물질 제조업", "10", "8.0"],
            ["", "", "합성 고무 및 플라스틱 물질  제조업", "10", "8.0"],
            ["", "", "기타화학제품 제조업", "10", "8.0"],
            ["", "", "화학섬유 제조업", "10", "8.0"],
            ["", "", "비료 및 질소화합물 제조업", "6", "13.33"],
            ["", "", "기타 화학제품 제조업 중 살충제 및 기타농약제조업", "6", "13.33"],
            ["", "의료용 물질 및 의약품 제조업", "기초 의약물질 및 생물학적 제제 제조업", "6", "13.33"],
            ["", "", "의약품 제조업", "6", "13.33"],
            ["", "", "의료용품 및 기타의약 관련제품 제조업", "6", "13.33"],
            ["", "고무제품 및 플라스틱제품 제조업", "고무제품 제조업", "12", "6.67"],
            ["", "", "플라스틱제품 제조업", "12", "6.67"],
            ["", "비금속 광물제품 제조업", "도자기 및 기타 요업제품 제조업", "12", "6.67"],
            ["", "", "시멘트, 석회, 플라스터 및 그 제품 제조업", "12", "6.67"],
            ["", "", "기타 비금속 광물제품 제조업", "12", "6.67"],
            ["", "", "유리 및 유리제품 제조업", "10", "8.0"],
            ["", "1차 금속 제조업", "1차 철강 제조업", "15", "5.33"],
            ["", "", "1차 비철 금속제조업", "15", "5.33"],
            ["", "", "금속 주조업", "15", "5.33"],
            ["", "금속가공제품 제조업  ;기계 및 가구제외", "구조용 금속제품, 탱크 및 증기발생기 제조업", "15", "5.33"],
            ["", "", "무기 및 총포탄 제조업", "15", "5.33"],
            ["", "", "기타 금속 가공제품 제조업", "15", "5.33"],
            ["", "전자부품, 컴퓨터, 영상, 음향 및 통신장비 제조업", "반도체 제조업", "6", "13.33"],
            ["", "", "전자부품 제조업", "6", "13.33"],
            ["", "", "통신 및 방송 장비 제조업", "6", "13.33"],
            ["", "", "영상 및 음향기기 제조업", "6", "13.33"],
            ["", "", "컴퓨터 및 주변장치 제조업", "6", "13.33"],
            ["", "의료, 정밀, 광학기기 및 시계 제조업", "의료용 기기 제조업", "12", "6.67"],
            ["", "", "측정, 시험, 항해, 제어 및 기타 정밀기기 제조업: 공학기기 제외", "12", "6.67"],
            ["", "", "안경, 사진장비 및 기타 광학기기 제조업", "12", "6.67"],
            ["", "", "시계 및 시계 부품 제조업", "12", "6.67"],
            ["", "전기장비 제조업", "전동기, 발전기 및 전기 변환, 공급, 제어장치 제조업", "10", "8.0"],
            ["", "", "일차전치 및 축전지 제조업", "10", "8.0"],
            ["", "", "절연선 및 케이블 제조업", "10", "8.0"],
            ["", "", "가정용 기기 제조업", "10", "8.0"],
            ["", "", "기타 전기장비 제조업", "10", "8.0"],
            ["", "기타 기계 및 장비 제조업", "일반목적용기계제조업", "12", "6.67"],
            ["", "", "특수목적용 기계제조업", "12", "6.67"],
            ["", "자동차 및 트레일러제조업", "자동차용 엔진 및 자동차 제조업", "10", "8.0"],
            ["", "", "자동차 차체 및 트레일러제조업", "10", "8.0"],
            ["", "", "자동차 부품 제조업", "10", "8.0"],
            ["", "기타 운송장비 제조업", "선박 및 보트 건조업", "12", "6.67"],
            ["", "", "철도장비제조업", "12", "6.67"],
            ["", "", "항공기, 우주선 및 부품 제조업", "12", "6.67"],
            ["", "", "그외 기타 운송장비제조업", "12", "6.67"],
            ["", "가구제조업", "가구제조업", "12", "6.67"],
            ["", "기타 제품 제조업", "귀금속 및 장신용품 제조업", "12", "6.67"],
            ["", "", "악기 제조업", "12", "6.67"],
            ["", "", "운동 및 경기 용구 제조업", "12", "6.67"],
            ["", "", "인형, 장난감 및 오락용구 제조업", "12", "6.67"],
            ["", "", "그외 기타 제품 제조업", "12", "6.67"],
            ["전기, 가스, 증기 및 수도사업", "전기, 가스, 증기 및 공기조절 공급업", "전기업", "30", "2.67"],
            ["", "", "가스 제조 및 배관 공급업", "30", "2.67"],
            ["", "", "증기, 냉온수 및 공기조절 공급업", "30", "2.67"],
            ["", "수도사업", "수도사업", "30", "2.67"],
            ["하수, 폐기물 처리, 원료재생 및 환경복원업", "하수, 폐수 및 분뇨 처리업", "하수, 폐수 및 분뇨 처리업", "12", "6.67"],
            ["", "폐기물 수집운반, 처리 및 원료재생업", "폐기물 수집운반업", "12", "6.67"],
            ["", "", "폐기물 처리업", "12", "6.67"],
            ["", "", "금속 및 비금속 원료 재생업", "12", "6.67"],
            ["", "환경 정화 및 복원업", "환경 정화 및 복원업", "12", "6.67"],
            ["건설업", "종합 건설업", "건물 건설업", "10", "8.0"],
            ["", "", "토목 건설업", "10", "8.0"],
            ["", "전문직별 공사업", "기반조성 및 시설물 축조관련 전문공사업", "10", "8.0"],
            ["", "", "건물설비 설치 공사업", "10", "8.0"],
            ["", "", "전기 및 통신 공사업", "10", "8.0"],
            ["", "", "실내건축 및 건축마무리 공사업", "10", "8.0"],
            ["", "", "건설장비 운영업", "10", "8.0"],
            ["도매 및 소매업", "자동차 및 부품 판매업", "자동차 판매업", "10", "8.0"],
            ["", "", "자동차 부품 및 내장품 판매업", "10", "8.0"],
            ["", "", "모터사이클 및 부품 판매업", "10", "8.0"],
            ["", "도매 및 상품중개업", "상품 중개업", "10", "8.0"],
            ["", "", "산업용 농축산물 및 산동물 도매업", "10", "8.0"],
            ["", "", "음,식료품 및 담배 도매업", "10", "8.0"],
            ["", "", "기계장비 및 관련 물품 도매업", "10", "8.0"],
            ["", "", "건축자재, 철물 및 난방장치 도매업", "10", "8.0"],
            ["", "", "기타 전문 도매업", "10", "8.0"],
            ["", "", "상품종합 도매업", "10", "8.0"],
            ["", "소매업 ;자동차 제외", "종합 소매업", "10", "8.0"],
            ["", "", "음,식료품 및 담배 소매업", "10", "8.0"],
            ["", "", "정보통신장비 소매업", "10", "8.0"],
            ["", "", "섬유, 위복 신발 및 가죽제품 소매업", "10", "8.0"],
            ["", "", "기타 가정 용품 소매업", "10", "8.0"],
            ["", "", "문화, 오락 및 여가용품 소매업", "10", "8.0"],
            ["", "", "연료 소매업", "10", "8.0"],
            ["", "", "기타상품 소매업", "10", "8.0"],
            ["", "", "무점포 소매업", "10", "8.0"],
            ["운수업", "육상운송 및 파이프라인 운송업", "철도운송업", "8", "10.0"],
            ["", "", "육상 여객 우송업", "8", "10.0"],
            ["", "", "도로 화물 운송업", "8", "10.0"],
            ["", "", "소화물 전문 운송업", "8", "10.0"],
            ["", "", "파이프 라인 운송업", "8", "10.0"],
            ["", "", "철도운송업", "24", "3.33"],
            ["", "수상 운송업", "해상 운송업", "15", "5.33"],
            ["", "", "내륙 수상 및 항만내 운송업", "15", "5.33"],
            ["", "", "외항운송업 중 외항화물운송업", "24", "3.33"],
            ["", "항공 운송업", "정기 항공 운송업", "15", "5.33"],
            ["", "", "부정기 항공 운송업", "15", "5.33"],
            ["", "창고 및 운송관련 서비스업", "보관 및 창고업", "12", "6.67"],
            ["", "", "기타 운송관련 서비스업", "12", "6.67"],
            ["숙박 및 음식점업", "숙박업", "숙박시설 운영업", "10", "8.0"],
            ["", "", "기타 숙박업", "10", "8.0"],
            ["", "음식점 및 주점업", "음식점업", "10", "8.0"],
            ["", "", "주점 및 비알콜음료점업", "10", "8.0"],
            ["출판, 영상, 방송통신 및 정보 서비스업", "출판업", "서적, 잡지 및 기타 인쇄물 출판업", "10", "8.0"],
            ["", "", "소프트웨어 개발 및 공급업", "10", "8.0"],
            ["", "영상,오디오 기록물 제작 및 배급업", "영화, 비디오물, 방송프로그램 제작 및 배급업", "10", "8.0"],
            ["", "방송업", "라디오 방송업", "10", "8.0"],
            ["", "", "텔레비전 방송업", "10", "8.0"],
            ["", "통신업", "우편업", "10", "8.0"],
            ["", "", "전기통신업", "10", "8.0"],
            ["", "컴퓨터 프로그래밍, 시스템 통합 및 관리업", "컴퓨터 프로그래밍 시스템 통합 및 관리업", "10", "8.0"],
            ["", "정보서비스업", "자료처리, 호스팅, 포털 및 기타 인터넷 정보매개서비스업", "10", "8.0"],
            ["", "", "기타 정보 서비스업", "10", "8.0"],
            ["금융 및 보험업", "금융업", "은행 및 저축기관", "8", "10.0"],
            ["", "", "투자기관", "8", "10.0"],
            ["", "", "기타 금융업", "8", "10.0"],
            ["", "보험 및 연금업", "보험업", "8", "10.0"],
            ["", "", "재 보험업", "8", "10.0"],
            ["", "", "연금 및 공제업", "8", "10.0"],
            ["", "금융 및 보험관련 서비스업", "금융지원 서비스업", "8", "10.0"],
            ["", "", "보험 및 연금관련 서비스업", "8", "10.0"],
            ["부동산업 및 임대업", "부동산업", "부동산 임대 및 공급업", "10", "8.0"],
            ["", "", "부동산 관련 서비스업", "10", "8.0"],
            ["", "임대업 ;부동산 제외", "운송장비 임대업", "6", "13.33"],
            ["", "", "개인 및 가정용품 임대업", "6", "13.33"],
            ["", "", "산업용 기계 및 장비 임대업", "6", "13.33"],
            ["", "", "무형재산권 임대업", "6", "13.33"],
            ["전문, 과학 및 기술 서비스업", "연구개발업", "자연과학 및 공학 연구개발업", "8", "10.0"],
            ["", "", "인문 및 사회과학 연구개발업", "8", "10.0"],
            ["", "전문서비스업", "법무관련 서비스업", "8", "10.0"],
            ["", "", "회계 및 세무관련 서비스업", "8", "10.0"],
            ["", "", "광고업", "8", "10.0"],
            ["", "", "시장조사 및 여론조사업", "8", "10.0"],
            ["", "", "회사본부, 지주회사 및 경영 컨설팅 서비스업", "8", "10.0"],
            ["", "건축기술, 엔지니어링 및 기타 과학기술 서비스업", "건축기술, 엔지니어링 및 관련기술 서비스업", "8", "10.0"],
            ["", "", "기타 과학기술 서비스업", "8", "10.0"],
            ["", "기타 전문, 과학 및 기술 서비스업", "수의업", "8", "10.0"],
            ["", "", "전문디자인업", "8", "10.0"],
            ["", "", "사진촬영 및 처리업", "8", "10.0"],
            ["", "", "그외 기타전문, 과학 및 기술서비스업", "8", "10.0"],
            ["사업시설 관리 및 사업지원 서비스업", "사업시설 관리 및 조경 서비스업", "사업시설 유지관리 서비스업", "8", "10.0"],
            ["", "", "건물, 산업설비 청소 및 방제 서비스업", "8", "10.0"],
            ["", "", "조경 관리 및 유지 서비스업", "8", "10.0"],
            ["", "사업지원 서비스업", "인력공급 및 고용알선업", "8", "10.0"],
            ["", "", "여행사 및 기타 여행보조 서비스업", "8", "10.0"],
            ["", "", "경비, 경호 및 탐정업", "8", "10.0"],
            ["", "", "기타 사업지원 서비스업", "8", "10.0"],
            ["공공행정, 국방 및 사회보장 행정", "공공행정, 국방 및 사회보장 행정", "입법 및 일반 정부 행정", "10", "8.0"],
            ["", "", "사회 및 산업정책 행정", "10", "8.0"],
            ["", "", "외무 및 국방 행정", "10", "8.0"],
            ["", "", "사법 및 공공질서 행정", "10", "8.0"],
            ["", "", "사회보장 행정", "10", "8.0"],
            ["교육 서비스업", "교육 서비스업", "초등 교육기관", "8", "10.0"],
            ["", "", "중등 교육기관", "8", "10.0"],
            ["", "", "고등 교육기관", "8", "10.0"],
            ["", "", "특수학교, 외국인학교 및 대안학교", "8", "10.0"],
            ["", "", "일반 교습 학원", "8", "10.0"],
            ["", "", "기타 교육기관", "8", "10.0"],
            ["", "", "교육지원 서비스업", "8", "10.0"],
            ["보건업 및 사회복지 서비스업", "보건업", "병원", "8", "10.0"],
            ["", "", "의원", "8", "10.0"],
            ["", "", "공중 보건 의료업", "8", "10.0"],
            ["", "", "기타 보건업", "8", "10.0"],
            ["", "사회복지 서비스업", "거주 복지시설 운영업", "8", "10.0"],
            ["", "", "비거주 복지시설 운영업", "8", "10.0"],
            ["예술, 스포츠 및 여가관련 서비스업", "창작, 예술 및 여가관련 서비스업", "창작 및 예술관련 서비스업", "8", "10.0"],
            ["", "", "도서관, 사적지 및 유사", "8", "10.0"],
            ["", "", "여가관련 서비스업", "8", "10.0"],
            ["", "스포츠 및 오락관련 서비스업", "스포츠 서비스업", "8", "10.0"],
            ["", "", "유원지 및 테마파크 운영업", "8", "10.0"],
            ["협회 및 단체, 수리 및 기타 개인 서비스업", "협회 및 단체", "산업 및 전문가 단체", "10", "8.0"],
            ["", "", "노동조합", "10", "8.0"],
            ["", "", "기타 협회 및 단체", "10", "8.0"],
            ["", "수리업", "기계 및 장비 수리업", "8", "10.0"],
            ["", "", "자동차 및 모터사이클 수리업", "8", "10.0"],
            ["", "", "개인 및 가정용품수리업", "8", "10.0"],
            ["", "기타 개인 서비스업", "미용, 욕탕 및 유사 서비스업", "8", "10.0"],
            ["", "", "그외 기타 개인 서비스업", "8", "10.0"],
            ["가구내 고용활동 및 달리 분류 되지 않은 자기소비 생환활동", "가구내 고용활동", "가구내 고용활동", "8", "10.0"],
            ["", "달리 분류되지 않은 자가소비를 위한 기구의 재화 및 서비스 생산활동", "자가 소비를 위한 가사 생산 활동", "8", "10.0"],
            ["", "", "자가 소비를 위한 서비스 활동", "8", "10.0"],
            ["국제 및 외국기관", "국제 및 외국기관", "국제 및 외국기관", "10", "8.0"],
            ["시험연구용 자산", "건물부속설비, 구축물, 기계장치", "", "10", "8.0"],
            ["", "광학기기, 시험기기, 측정기기, 공구, 기타설비", "", "6", "13.33"]
        ]
    },
    sheet4: {
        head: `<tr><th style="background:#e9ecef;">세목 (공기구 종류)</th><th style="background:#d1e7dd;">내용연수(년)</th><th style="background:#ffe69c;">경년 감가율(%)</th></tr>`,
        body: [
            ["유압, 전동, 수동 공기구와 금속제의 공기구 등", "8", "10.0"],
            ["금형, 주형 및 금속제모형의 틀 및 기타 이와 유사한 것", "5", "16.0"],
            ["목형, 지형 및 비금속제모형, 틀, 필름, 활자 등", "4", "20.0"]
        ]
    }
};

// ★ 엑셀 데이터 뷰어 탭 전환 기능 (가로 폭 및 글씨 꺾임 처리 적용)
window.switchDeprRefTab = function(tabIndex) {
    document.querySelectorAll('.ref-tab-btn').forEach((btn, idx) => {
        btn.className = (idx === tabIndex - 1) ? 'ref-tab-btn active' : 'ref-tab-btn';
    });

    const thead = document.getElementById('deprRefThead');
    const tbody = document.getElementById('deprRefTbody');
    const data = window.DEPR_REF_DATA['sheet' + tabIndex];
    
    // 탭을 바꿀 때마다 검색창 내용 초기화
    const searchInput = document.getElementById('deprRefSearchInput');
    if (searchInput) searchInput.value = '';

    thead.innerHTML = data.head;
    tbody.innerHTML = '';
    
    data.body.forEach((row, rIdx) => {
        const tr = document.createElement('tr');
        tr.id = `deprRefRow_${rIdx}`; 
        
        tr.dataset.searchContent = row.join(" ").toLowerCase();
        
        row.forEach((cell, cellIdx) => {
            const td = document.createElement('td');
            td.innerText = cell;
            
            // ★ 3. 업종 감가율 탭일 경우 (글씨가 밀리지 않도록 자동 줄바꿈)
            if(tabIndex === 3) {
                if(cellIdx > 2) {
                    td.style.textAlign = 'center';
                    td.style.fontWeight = 'bold';
                } else {
                    td.style.whiteSpace = 'normal';
                    td.style.wordBreak = 'keep-all';
                }
            } else {
                if(cellIdx > 0) td.style.textAlign = 'center'; 
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
};

// ★ 실시간 검색(필터링) 기능
window.filterDeprRefTable = function() {
    const searchInput = document.getElementById('deprRefSearchInput');
    if(!searchInput) return;
    
    const keyword = searchInput.value.trim().toLowerCase();
    const tbody = document.getElementById('deprRefTbody');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(tr => {
        if(keyword === "") {
            tr.classList.remove('depr-row-hide');
        } else {
            const content = tr.dataset.searchContent || "";
            if(content.includes(keyword)) {
                tr.classList.remove('depr-row-hide');
            } else {
                tr.classList.add('depr-row-hide');
            }
        }
    });
};

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
    
    const defaultDepr = { '건물': 1.78, '구축물': 1.33, '기계장치': 5.33, '공기구': 5.33, '공구와 기구': 5.33, '차량운반구': 5.33, '비품': '-' };
    
    const defaultMinRes = { 
        '건물': 30, '건물부속설비': 30, '구축물': 20, '기계장치': 30, '금형': 30, 
        '시설장치': 20, '차량운반구': 20, '공구와기구': 20, '공구와 기구': 20, 
        '공기구': 20, '집기비품': 20, '비품': 20, '기타유형자산': 20 
    };

    uniqueAccounts.forEach(acc => {
        const defaultVal = defaultDepr[acc] !== undefined ? defaultDepr[acc] : ''; 
        const defaultMinVal = defaultMinRes[acc] !== undefined ? defaultMinRes[acc] : 0; 
        
        tbody.innerHTML += `
            <tr>
                <td style="text-align:center; font-weight:bold; color:#1C5691; vertical-align:middle;">${acc}</td>
                <td style="padding:4px;">
                    <input type="text" id="deprInput_${acc}" class="input-box" value="${defaultVal}" style="width:100%; text-align:center; box-sizing:border-box; font-weight:bold; color:#333;">
                </td>
                <td style="padding:4px;">
                    <input type="number" id="minResInput_${acc}" class="input-box" value="${defaultMinVal}" style="width:100%; text-align:center; box-sizing:border-box; font-weight:bold; color:#d32f2f;">
                </td>
            </tr>
        `;
    });

    // 팝업이 열릴 때 우측 엑셀 뷰어의 '1. 건물' 탭을 기본으로 띄워줌
    if(typeof window.switchDeprRefTab === 'function') {
        window.switchDeprRefTab(1);
    }

    const modal = document.getElementById('deprBatchModal');
    if(modal) modal.style.display = 'flex';
    else alert("감가율 팝업창 HTML 코드가 index.html에 추가되지 않았습니다.");
};

window.applyDeprBatch = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    const accIdx = wiz.mapped['자산계정'];
    const yearIdx = wiz.mapped['취득년도'];
    
    const mappedColCount = Object.keys(wiz.mapped).length;
    const finalIdx = mappedColCount + 4; // 최종 구분 열
    const deprIdx = mappedColCount + 7;  // 감가율 열

    const inputMap = {};
    if (!window.infState.minResidualMap) window.infState.minResidualMap = {};

    document.querySelectorAll('[id^="deprInput_"]').forEach(input => {
        const acc = input.id.replace('deprInput_', '');
        inputMap[acc] = input.value.trim();
        
        const minResInput = document.getElementById(`minResInput_${acc}`);
        if (minResInput) {
            window.infState.minResidualMap[acc] = Number(minResInput.value) || 0;
        }
    });

    if(typeof window.infSaveHistory === 'function') window.infSaveHistory();

    let applyCount = 0;
    tData.raw.forEach(row => {
        const yearVal = String(row[yearIdx] || '');
        if (yearVal.includes('소계') || yearVal.includes('총계')) return;

        const acc = String(row[accIdx] || '').trim();
        const finalVal = String(row[finalIdx] || '').trim(); // 최종 구분 확인

        if (inputMap[acc] !== undefined && inputMap[acc] !== "") {
            const inputVal = inputMap[acc];

            // 부보제외 또는 평가제외인 경우 감가율 강제 제외(-) 처리
            if (finalVal.includes('부보제외') || finalVal.includes('평가제외')) {
                row[deprIdx] = '-';
            } 
            else if (inputVal === '-' || inputVal === '0' || inputVal === 0) {
                row[deprIdx] = '-';
            } else {
                row[deprIdx] = Number(inputVal).toFixed(2);
            }
            applyCount++;
        }
    });

    document.getElementById('deprBatchModal').style.display = 'none';
    if(typeof window.infRenderTable === 'function') window.infRenderTable(); 
    alert(`✅ 총 ${applyCount}건의 감가율 및 최종 잔가율 기준이 저장되었습니다.\n표 상단의 [⚡ 잔가/현재 계산] 버튼을 클릭해 가액을 산출해 주세요.`);
};

window.applyCurrentValue = function() {
    const wiz = window.infState.wizard;
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return alert("데이터가 없습니다.");

    const mappedColCount = Object.keys(wiz.mapped).length;
    const accIdx = wiz.mapped['자산계정'];
    const yearIdx = wiz.mapped['취득년도'];
    const finalIdx = mappedColCount + 4; // 최종 구분 열
    const replacementIdx = mappedColCount + 6; 
    const deprIdx = mappedColCount + 7;        
    const residualIdx = mappedColCount + 8;    
    const currentValIdx = mappedColCount + 9;  

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

        const accVal = String(row[accIdx] || '').trim();
        const finalVal = String(row[finalIdx] || '').trim(); // 최종 구분 확인
        const repCostStr = String(row[replacementIdx] || '').replace(/,/g, '');
        const deprStr = String(row[deprIdx] || '').replace(/,/g, ''); 
        
        // 부보제외거나 재조달가액이 없는 경우 강제 제외
        if (finalVal.includes('부보제외') || repCostStr === '-' || repCostStr === '') { 
            row[deprIdx] = '-'; 
            row[residualIdx] = '-'; 
            row[currentValIdx] = '-'; 
            return;
        }

        const repCost = Number(repCostStr);
        const acqYear = parseInt(yearVal);
        const deprRate = Number(deprStr);

        // 평가제외인 경우 강제 유지 (현재가액 = 재조달가액)
        if (finalVal.includes('평가제외')) {
            row[deprIdx] = '-';
            row[residualIdx] = '-';
            row[currentValIdx] = repCost; 
            subCur += repCost;
            totCur += repCost;
            applyCount++;
            return;
        }
        
        // 메모리에 저장해둔 최종 잔가율(하한선) 가져오기 (없으면 0)
        const minResRate = (window.infState.minResidualMap && window.infState.minResidualMap[accVal] !== undefined) 
                            ? window.infState.minResidualMap[accVal] : 0;

        if (!isNaN(repCost) && !isNaN(acqYear)) {
            if (deprStr === '-' || deprRate === 0) {
                row[deprIdx] = '-';
                row[residualIdx] = '-';  
                row[currentValIdx] = repCost; 
                subCur += repCost; 
                totCur += repCost;
                applyCount++;
            } 
            else if (!isNaN(deprRate)) {
                const elapsed = Math.max(0, evalYear - acqYear);
                
                let residualRate = 100 - (elapsed * deprRate);
                residualRate = Math.max(minResRate, residualRate);

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