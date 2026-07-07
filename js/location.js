function syncContractor(val) {
    document.querySelectorAll('.contractor-sync').forEach(input => {
        if (input !== document.activeElement) input.value = val;
    });
}

function createLocationRowHTML(index) {
    return `
        <div class="list-row">
            <input type="checkbox" class="row-checkbox"><span>소재지 ${index}</span><input type="text" class="input-short" value="신규 사업장 ${index}">
            <button type="button" class="btn-blue" onclick="openAddressModal(this); return false;"><i class="fa-solid fa-magnifying-glass"></i> 주소 검색</button>
            <span>주소</span><input type="text" class="input-long addr-input" value="">
            <div class="check-group">
                <label class="check-item"><input type="checkbox" class="check-ledger" checked onchange="updateMenuState()"> 건축물대장</label>
                <label class="check-item"><input type="checkbox" class="check-kfpa" checked onchange="updateMenuState()"> 화협자료평가</label>
            </div>
        </div>
    `;
}

function generateLocationRows() {
    const countInput = document.getElementById('locationCount');
    const targetCount = parseInt(countInput.value, 10);
    const listBox = document.getElementById('locationListBox');
    const currentCount = listBox.querySelectorAll('.list-row').length;
    
    if (isNaN(targetCount) || targetCount < 1) { countInput.value = currentCount; return; }
    
    if (targetCount > currentCount) {
        for (let i = currentCount + 1; i <= targetCount; i++) listBox.insertAdjacentHTML('beforeend', createLocationRowHTML(i));
    } else if (targetCount < currentCount) {
        for (let i = 0; i < currentCount - targetCount; i++) listBox.lastElementChild.remove();
    }
    locationCounter = targetCount;
    updateMenuState();
}

function addLocationRow() {
    locationCounter++;
    document.getElementById('locationListBox').insertAdjacentHTML('beforeend', createLocationRowHTML(locationCounter));
    document.getElementById('locationCount').value = document.getElementById('locationListBox').children.length;
    updateMenuState();
}

function deleteSelectedLocations() {
    const rows = document.getElementById('locationListBox').querySelectorAll('.list-row');
    let deletedCount = 0;
    rows.forEach(row => { if (row.querySelector('.row-checkbox').checked) { row.remove(); deletedCount++; }});
    if (deletedCount > 0) {
        document.getElementById('locationListBox').querySelectorAll('.list-row').forEach((row, index) => {
            const span = row.querySelector('span');
            if(span && span.textContent.startsWith('소재지')) span.textContent = `소재지 ${index + 1}`;
        });
        locationCounter = document.getElementById('locationListBox').children.length;
        document.getElementById('locationCount').value = locationCounter;
        updateMenuState();
    } else {
        alert('삭제할 소재지를 선택해주세요.');
    }
}