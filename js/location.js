// ============================================================================
// location.js - 소재지 동적 추가 및 삭제 제어 (최종 완성본)
// ============================================================================
if (typeof window.locationCounter === 'undefined') {
    window.locationCounter = 1;
}

document.addEventListener("DOMContentLoaded", function() {
    setTimeout(() => {
        const tbody = document.getElementById('locationTbody');
        if (tbody && tbody.children.length === 0) {
            generateLocationRows();
        }
    }, 50);
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
                    <!-- [개선] 주소 입력 박스 폭을 조절하여 우측 체크박스 공간 확보 -->
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
    if(typeof updateMenuStatus === 'function') updateMenuStatus();
}

function addLocationRow() {
    const tbody = document.getElementById('locationTbody');
    if(!tbody) return;
    
    window.locationCounter = tbody.children.length + 1;
    tbody.insertAdjacentHTML('beforeend', createLocationRowHTML(window.locationCounter));
    
    const countInput = document.getElementById('locationCount');
    if(countInput) countInput.value = tbody.children.length;
    
    if(typeof updateMenuStatus === 'function') updateMenuStatus();
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
    
    if(typeof updateMenuStatus === 'function') updateMenuStatus();
}

// [개선] 체크박스 해제 시 미평가 전환 및 상태 동기화 함수 보완
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
}