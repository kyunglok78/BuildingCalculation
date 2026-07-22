// ============================================================================
// location.js - 소재지 동적 추가 및 삭제 제er (One-Stop 버전)
// ============================================================================
let locationCounter = 1;

function syncContractor(val) {
    document.querySelectorAll('.contractor-sync').forEach(input => {
        if (input !== document.activeElement) input.value = val;
    });
}

function createLocationRowHTML(index) {
    return `
        <tr id="loc_row_${index}">
            <td>
                <input type="text" class="form-control loc-name input-short" placeholder="예: 공장/지점명" value="소재지 ${index}" style="width:100%; box-sizing:border-box; padding:8px; border:1px solid #ccc; border-radius:4px;">
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn-search btn-blue" onclick="openAddressModal(this); return false;" style="background-color: var(--kb-blue); padding: 6px 12px; border-radius: 4px; color: white; border: none; cursor: pointer; font-size: 13px; white-space: nowrap;">
                        <i class="fa-solid fa-magnifying-glass-location"></i> 주소조회
                    </button>
                    <input type="text" class="form-control loc-addr addr-input input-long" id="addr_${index}" placeholder="주소를 검색해주세요" readonly style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px;">
                </div>
            </td>
            <td style="text-align: center;"><label class="eval-check-wrap"><input type="checkbox" class="chk-ledger check-ledger" checked onchange="updateMenuStatus()"> 대상</label></td>
            <td style="text-align: center;"><label class="eval-check-wrap"><input type="checkbox" class="chk-kfpa check-kfpa" checked onchange="updateMenuStatus()"> 대상</label></td>
            <td style="text-align: center;"><label class="eval-check-wrap"><input type="checkbox" class="chk-inflation" onchange="updateMenuStatus()"> 대상</label></td>
            <td style="text-align: center;"><label class="eval-check-wrap"><input type="checkbox" class="chk-bi" onchange="updateMenuStatus()"> 대상</label></td>
            <td style="text-align: center;"><button type="button" class="btn-remove" onclick="removeLocationRow(${index})" style="background-color: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>
    `;
}

function generateLocationRows() {
    const countInput = document.getElementById('locationCount');
    const targetCount = parseInt(countInput.value, 10);
    const tbody = document.getElementById('locationTbody');
    if(!tbody) return;
    
    if (isNaN(targetCount) || targetCount < 1) { 
        countInput.value = tbody.children.length || 1; 
        return; 
    }
    
    tbody.innerHTML = '';
    for (let i = 1; i <= targetCount; i++) {
        tbody.insertAdjacentHTML('beforeend', createLocationRowHTML(i));
    }
    locationCounter = targetCount;
    if(typeof updateMenuStatus === 'function') updateMenuStatus();
}

function addLocationRow() {
    const tbody = document.getElementById('locationTbody');
    if(!tbody) return;
    
    locationCounter = tbody.children.length + 1;
    tbody.insertAdjacentHTML('beforeend', createLocationRowHTML(locationCounter));
    
    // [+ 추가] 버튼 누를 때 상단 '소재지 개수' 입력창 숫자가 실시간으로 동기화되도록 수정
    const countInput = document.getElementById('locationCount');
    if(countInput) countInput.value = tbody.children.length;
    
    if(typeof updateMenuStatus === 'function') updateMenuStatus();
}

function removeLocationRow(index) {
    const tr = document.getElementById(`loc_row_${index}`);
    if (tr) tr.remove();
    
    const tbody = document.getElementById('locationTbody');
    if(!tbody) return;

    // 삭제 후 번호 재정렬 및 상단 '소재지 개수' 입력창 숫자 실시간 동기화
    const rows = tbody.querySelectorAll('tr');
    rows.forEach((row, i) => {
        row.id = `loc_row_${i + 1}`;
        const input = row.querySelector('.loc-name');
        if(input && input.value.startsWith('소재지')) input.value = `소재지 ${i + 1}`;
        const delBtn = row.querySelector('.btn-remove');
        if(delBtn) delBtn.setAttribute('onclick', `removeLocationRow(${i + 1})`);
    });
    
    locationCounter = rows.length;
    const countInput = document.getElementById('locationCount');
    if(countInput) countInput.value = rows.length;
    
    if(typeof updateMenuStatus === 'function') updateMenuStatus();
}

// 페이지가 로드될 때 첫 번째 소재지 행이 기본으로 뜰 수 있도록 자동 실행
document.addEventListener("DOMContentLoaded", function() {
    setTimeout(() => {
        if(document.getElementById('locationTbody') && document.getElementById('locationTbody').children.length === 0) {
            generateLocationRows();
        }
    }, 100);
});