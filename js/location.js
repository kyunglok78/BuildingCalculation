// ============================================================================
// location.js - 동적 생성, 상태 동기화 및 섀도우 백업/복원 시스템 적용
// ============================================================================
if (typeof window.locationCounter === 'undefined') {
    window.locationCounter = 1;
}

let lastSavedJSON = "";

document.addEventListener("DOMContentLoaded", function() {
    setTimeout(() => {
        const tbody = document.getElementById('locationTbody');
        if (tbody && tbody.children.length === 0) {
            generateLocationRows();
        }
        
        // 입력창에 글자를 치거나 체크박스를 누를 때마다 실시간 백업 (이벤트 위임)
        if(tbody) {
            tbody.addEventListener('input', backupLocationData);
            tbody.addEventListener('change', backupLocationData);
        }
    }, 50);

    // main.js 파일 로드 감지 및 자동 복원 감시자 (0.5초 주기)
    setInterval(() => {
        const backupInput = document.getElementById('kb_location_backup');
        if(backupInput && backupInput.value && backupInput.value !== lastSavedJSON) {
            // main.js가 파일 로드를 통해 백업 데이터를 채워 넣은 것을 감지!
            restoreLocationFromJSON(backupInput.value);
            lastSavedJSON = backupInput.value;
        }
    }, 500);
});

function syncContractor(val) {
    document.querySelectorAll('.contractor-sync').forEach(input => {
        if (input !== document.activeElement) input.value = val;
    });
}

function createLocationRowHTML(index) {
    return `
        <tr id="loc_row_${index}">
            <td>
                <input type="text" class="form-control loc-name input-short" placeholder="예: 공장명" value="소재지 ${index}" style="width:100%; box-sizing:border-box; padding:8px; border:1px solid #ccc; border-radius:4px;">
            </td>
            <td>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button type="button" class="btn-search btn-blue" onclick="openAddressModal(this); return false;" style="background-color: var(--kb-blue); padding: 6px 10px; border-radius: 4px; color: white; border: none; cursor: pointer; font-size: 12px; white-space: nowrap;">
                        <i class="fa-solid fa-magnifying-glass-location"></i> 주소조회
                    </button>
                    <input type="text" class="form-control loc-addr addr-input input-long" id="addr_${index}" placeholder="주소를 검색해주세요" readonly style="flex:1; width:70%; padding:8px; border:1px solid #ccc; border-radius:4px;">
                </div>
            </td>
            <td style="text-align: center;"><label class="eval-check-wrap"><input type="checkbox" class="chk-ledger check-ledger" checked onchange="updateMenuStatus()"> 대상</label></td>
            <td style="text-align: center;"><label class="eval-check-wrap"><input type="checkbox" class="chk-kfpa check-kfpa" checked onchange="updateMenuStatus()"> 대상</label></td>
            <td style="text-align: center;"><label class="eval-check-wrap"><input type="checkbox" class="chk-inflation" onchange="updateMenuStatus()"> 대상</label></td>
            <td style="text-align: center;"><label class="eval-check-wrap"><input type="checkbox" class="chk-bi" onchange="updateMenuStatus()"> 대상</label></td>
            <td style="text-align: center;"><button type="button" class="btn-remove" onclick="removeLocationRow(${index})" style="background-color: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>
    `;
}

// ---------------------------------------------------------
// [핵심] 테이블 상태를 JSON으로 압축하여 숨김 필드에 저장
// ---------------------------------------------------------
function backupLocationData() {
    const rows = [];
    document.querySelectorAll('#locationTbody tr').forEach(tr => {
        const index = tr.id.split('_')[2];
        rows.push({
            index: index,
            name: tr.querySelector('.loc-name').value,
            addr: tr.querySelector('.loc-addr').value,
            ledger: tr.querySelector('.chk-ledger').checked,
            kfpa: tr.querySelector('.chk-kfpa').checked,
            inflation: tr.querySelector('.chk-inflation').checked,
            bi: tr.querySelector('.chk-bi').checked
        });
    });
    
    const jsonString = JSON.stringify(rows);
    const backupInput = document.getElementById('kb_location_backup');
    if(backupInput) {
        backupInput.value = jsonString;
        lastSavedJSON = jsonString; 
    }
}

// ---------------------------------------------------------
// [핵심] JSON 데이터를 읽어와 테이블을 완벽하게 재구성
// ---------------------------------------------------------
function restoreLocationFromJSON(jsonString) {
    try {
        const rows = JSON.parse(jsonString);
        const tbody = document.getElementById('locationTbody');
        if(!tbody) return;
        
        tbody.innerHTML = '';
        rows.forEach(r => {
            tbody.insertAdjacentHTML('beforeend', createLocationRowHTML(r.index));
            const tr = document.getElementById(`loc_row_${r.index}`);
            tr.querySelector('.loc-name').value = r.name || '';
            tr.querySelector('.loc-addr').value = r.addr || '';
            tr.querySelector('.chk-ledger').checked = r.ledger;
            tr.querySelector('.chk-kfpa').checked = r.kfpa;
            tr.querySelector('.chk-inflation').checked = r.inflation;
            tr.querySelector('.chk-bi').checked = r.bi;
        });
        
        window.locationCounter = rows.length ? Math.max(...rows.map(r => parseInt(r.index))) : 1;
        const countInput = document.getElementById('locationCount');
        if(countInput) countInput.value = rows.length;
        
        updateMenuStatus();
    } catch(e) {
        console.error("데이터 복원 실패:", e);
    }
}

function generateLocationRows() {
    const countInput = document.getElementById('locationCount');
    const targetCount = countInput ? parseInt(countInput.value, 10) : 1;
    const tbody = document.getElementById('locationTbody');
    if(!tbody) return;
    
    if (isNaN(targetCount) || targetCount < 1) { 
        if(countInput) countInput.value = tbody.children.length || 1; 
        return; 
    }
    
    tbody.innerHTML = '';
    for (let i = 1; i <= targetCount; i++) {
        tbody.insertAdjacentHTML('beforeend', createLocationRowHTML(i));
    }
    window.locationCounter = targetCount;
    updateMenuStatus();
    backupLocationData(); // 생성 후 백업
}

function addLocationRow() {
    const tbody = document.getElementById('locationTbody');
    if(!tbody) return;
    
    window.locationCounter = tbody.children.length + 1;
    tbody.insertAdjacentHTML('beforeend', createLocationRowHTML(window.locationCounter));
    
    const countInput = document.getElementById('locationCount');
    if(countInput) countInput.value = tbody.children.length;
    
    updateMenuStatus();
    backupLocationData(); // 추가 후 백업
}

function removeLocationRow(index) {
    const tr = document.getElementById(`loc_row_${index}`);
    if (tr) tr.remove();
    
    const tbody = document.getElementById('locationTbody');
    if(!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    rows.forEach((row, i) => {
        row.id = `loc_row_${i + 1}`;
        const input = row.querySelector('.loc-name');
        if(input && input.value.startsWith('소재지')) input.value = `소재지 ${i + 1}`;
        const delBtn = row.querySelector('.btn-remove');
        if(delBtn) delBtn.setAttribute('onclick', `removeLocationRow(${i + 1})`);
    });
    
    window.locationCounter = rows.length;
    const countInput = document.getElementById('locationCount');
    if(countInput) countInput.value = rows.length;
    
    updateMenuStatus();
    backupLocationData(); // 삭제 후 백업
}

function updateMenuStatus() {
    let useLedger = false, useKfpa = false, useInflation = false, useBI = false;

    document.querySelectorAll('.chk-ledger').forEach(cb => { if(cb.checked) useLedger = true; });
    document.querySelectorAll('.chk-kfpa').forEach(cb => { if(cb.checked) useKfpa = true; });
    document.querySelectorAll('.chk-inflation').forEach(cb => { if(cb.checked) useInflation = true; });
    document.querySelectorAll('.chk-bi').forEach(cb => { if(cb.checked) useBI = true; });

    function setMenuState(menuIds, isActive) {
        menuIds.forEach(id => {
            const menu = document.getElementById(id);
            if(!menu) return;
            let badge = menu.querySelector('.status-badge');
            
            if(isActive) {
                menu.classList.remove('disabled');
                // 기존 '완료' 뱃지 상태는 덮어쓰지 않도록 보호
                if(badge && (badge.classList.contains('status-none') || badge.textContent === '미평가')) {
                    badge.className = 'status-badge status-wait';
                    badge.textContent = '대기';
                }
            } else {
                menu.classList.add('disabled');
                if(badge) {
                    badge.className = 'status-badge status-none';
                    badge.textContent = '미평가';
                }
            }
        });
    }

    setMenuState(['nav-sec-2-1-1', 'nav-sec-2-1-2', 'nav-sec-2-1-3'], useLedger);
    setMenuState(['nav-sec-2-2-1', 'nav-sec-2-2-2'], useKfpa);
    setMenuState(['nav-sec-2-3'], useInflation);
    setMenuState(['nav-sec-2-4'], useBI);
    
    backupLocationData(); // 체크박스 상태 변경 시 백업
}