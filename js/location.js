// ============================================================================
// location.js - 소재지 동적 추가 및 삭제 제어 (One-Stop 버전)
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
                <input type="text" class="form-control loc-name input-short" placeholder="예: 공장/지점명" value="소재지 ${index}" style="width:100%; box-sizing:border-box;">
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn-search btn-blue" onclick="openAddressModal(this); return false;" style="background-color: var(--kb-blue); padding: 5px 10px; border-radius: 4px; color: white; border: none; cursor: pointer; font-size: 13px; white-space: nowrap;">
                        <i class="fa-solid fa-magnifying-glass-location"></i> 주소조회
                    </button>
                    <input type="text" class="form-control loc-addr addr-input input-long" id="addr_${index}" placeholder="주소를 검색해주세요" readonly style="flex:1; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
            </td>
            <td style="text-align: center;"><label class="eval-check-wrap"><input type="checkbox" class="chk-ledger check-ledger" checked onchange="updateMenuState()"> 대상</label></td>
            <td style="text-align: center;"><label class="eval-check-wrap"><input type="checkbox" class="chk-kfpa check-kfpa" checked onchange="updateMenuState()"> 대상</label></td>
            <td style="text-align: center;"><label class="eval-check-wrap"><input type="checkbox" class="chk-inflation" onchange="updateMenuState()"> 대상</label></td>
            <td style="text-align: center;"><button type="button" class="btn-remove" onclick="removeLocationRow(${index})" style="background-color: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>
    `;
}

function generateLocationRows() {
    const countInput = document.getElementById('locationCount');
    const targetCount = parseInt(countInput.value, 10);
    const tbody = document.getElementById('locationTbody');
    
    if (isNaN(targetCount) || targetCount < 1) { 
        countInput.value = tbody.children.length || 1; 
        return; 
    }
    
    tbody.innerHTML = '';
    locationCounter = 0;
    for (let i = 1; i <= targetCount; i++) {
        tbody.insertAdjacentHTML('beforeend', createLocationRowHTML(i));
        locationCounter = i;
    }
    updateMenuState();
}

function addLocationRow() {
    locationCounter++;
    document.getElementById('locationTbody').insertAdjacentHTML('beforeend', createLocationRowHTML(locationCounter));
    document.getElementById('locationCount').value = document.getElementById('locationTbody').children.length;
    updateMenuState();
}

function removeLocationRow(index) {
    const tr = document.getElementById(`loc_row_${index}`);
    if (tr) tr.remove();
    
    // 번호 재정렬
    const rows = document.getElementById('locationTbody').querySelectorAll('tr');
    rows.forEach((row, i) => {
        const input = row.querySelector('.loc-name');
        if(input && input.value.startsWith('소재지')) input.value = `소재지 ${i + 1}`;
    });
    
    locationCounter = rows.length;
    document.getElementById('locationCount').value = locationCounter;
    updateMenuState();
}