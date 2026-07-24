// ============================================================================
// api_inflation.js - [섹션 4] 테이블 렌더링 (헤더 지정 버튼 추가 및 내비게이션 유지)
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
        
        // 2단계 이상이면 좌측 일반 컬럼들도 버튼 높이만큼 여백을 줌
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
    
    // ★ [2단계] 구분 열 헤더 + 실행 단추(버튼) 추가!
    if(window.infState.step >= 2) {
        step2Cols.forEach((colName, idx) => {
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
                topButtonHtml = `<div style="height:23px; margin-bottom:6px;"></div>`;
            }

            headerTr.innerHTML += `<th style="background:#e9ecef; color:#1C5691; border:1px solid #ccc; padding:8px 4px; text-align:center; vertical-align:bottom; min-width:90px;">
                ${topButtonHtml}
                <div>${displayName}</div>
            </th>`;
        });
    }

    if(window.infState.step === 3) {
        step3Cols.forEach(colName => {
            headerTr.innerHTML += `<th style="background:#e9ecef; color:#1C5691; border:1px solid #ccc; padding:8px; text-align:center; vertical-align:bottom;">
                <div style="height:23px; margin-bottom:6px;"></div>
                <div>${colName}</div>
            </th>`;
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
        
        if(window.infState.step >= 2) {
            step2Cols.forEach((cName, idx) => {
                const dataIdx = colCount + idx;
                const savedVal = row[dataIdx] || '';
                
                if (isSubtotalRow || isGrandTotalRow) {
                    rowHtml += `<td style="border:1px solid #eee; ${bgStyle}"></td>`;
                } else {
                    rowHtml += `<td style="border:1px solid #ccc; padding:0; background:#fff; min-width:70px;">
                        <input type="text" id="infInput_${rIdx}_${dataIdx}" maxlength="20" value="${savedVal}" 
                               style="width:100%; height:100%; min-height:28px; border:none; text-align:center; outline:none; background:transparent; font-family:inherit; font-size:13px; color:#333;" 
                               onchange="window.infUpdateCellData(${rIdx}, ${dataIdx}, this.value)"
                               onkeydown="window.infHandleInputKey(event, ${rIdx}, ${dataIdx})"
                               onclick="event.stopPropagation();">
                    </td>`;
                }
            });
        }
        
        if(window.infState.step === 3) {
            step3Cols.forEach((cName, idx) => { 
                rowHtml += `<td style="border:1px solid #eee; ${bgStyle ? bgStyle : 'background:#f0fdf4;'}"></td>`; 
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
// api_inflation.js - [섹션 5] 정렬/부분합, 히스토리, 단축키 로직 및 행 추가 로직
// ============================================================================

// ★ 신규: 선택한 행 밑에 빈 행을 추가하는 로직
window.infAddEmptyRow = function() {
    const tData = window.infState.data[window.infState.activeTab];
    if(!tData || !tData.raw || tData.raw.length === 0) return;

    infSaveHistory();

    const wiz = window.infState.wizard;
    const mappedKeys = Object.keys(wiz.mapped);
    let totalCols = (wiz.phase === 'mapping' || wiz.phase === 'idle') ? tData.raw[0].length : mappedKeys.length;
    
    // 추가 열(구분 5개, 평가 6개)을 포함하여 빈 배열 크기 잡기
    if (window.infState.step >= 2) totalCols += 5;
    if (window.infState.step === 3) totalCols += 6;

    const newRow = new Array(totalCols).fill('');

    let insertIdx = tData.raw.length;
    if (tData.selectedRows.size > 0) {
        insertIdx = Math.max(...Array.from(tData.selectedRows)) + 1;
    } else {
        const yearIdx = mappedKeys.indexOf('취득년도');
        if (yearIdx !== -1 && tData.raw.length > 0 && String(tData.raw[tData.raw.length-1][yearIdx]).includes('총계')) {
            insertIdx = tData.raw.length - 1; // 총계 바로 위에 삽입
        }
    }

    tData.raw.splice(insertIdx, 0, newRow);
    tData.selectedRows.clear();
    tData.selectedRows.add(insertIdx);
    
    infRenderTable();
};

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


// ============================================================================
// api_inflation.js - [섹션 6] 과거 데이터 연동 매칭 알고리즘
// ============================================================================

window.infState.pastYear = null; 

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
// api_inflation.js - [섹션 7] 자산 구분 일괄 지정 (이벤트 준비)
// ============================================================================

window.assignBasicClass = function() {
    alert("준비 중: '기본구분' 일괄 지정 로직이 곧 적용됩니다.");
};

window.assignExcludeEval = function() {
    alert("준비 중: '평가제외' 일괄 지정 로직이 곧 적용됩니다.");
};

window.assignExcludeCoverage = function() {
    alert("준비 중: '부보제외' 일괄 지정 로직이 곧 적용됩니다.");
};