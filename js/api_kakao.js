function openAddressModal(btn) {
    currentAddressTarget = btn.parentElement.querySelector('.input-long.addr-input');
    document.getElementById('addressModal').style.display = 'flex';
    document.getElementById('modalAddressInput').value = '';
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('modalAddressInput').focus();
}

function closeAddressModal() {
    document.getElementById('addressModal').style.display = 'none';
}

async function searchAddress() {
    const inputVal = document.getElementById('modalAddressInput').value.trim();
    const resultsDiv = document.getElementById('searchResults');
    
    if(inputVal === '') { alert('검색할 주소를 입력해 주세요.'); return; }
    
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '<div style="padding:15px; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> 데이터 수집 중...</div>';
    
    try {
        const baseUrl = (window.location.protocol === 'file:' || window.location.protocol === 'blob:') ? 'http://localhost:8000' : '';
        const targetUrl = `${baseUrl}/api/kakao?query=${encodeURIComponent(inputVal)}`;
        
        const res = await fetch(targetUrl);
        if(!res.ok) throw new Error(`서버 오류 발생 (${res.status})`);
        
        const data = await res.json();
        if(data.documents && data.documents.length > 0) {
            let html = '';
            data.documents.forEach(doc => {
                const roadAddr = doc.road_address ? doc.road_address.address_name : '';
                const jibunAddr = doc.address ? doc.address.address_name : '';
                const zipcode = doc.road_address ? doc.road_address.zone_no : '';
                const displayAddr = roadAddr || jibunAddr;
                
                html += `
                <div class="search-item" onclick="selectAddress('${displayAddr}')">
                    ${zipcode ? `<div class="zipcode">${zipcode}</div>` : ''}
                    ${roadAddr ? `<div style="display:flex; margin-bottom:4px; align-items:flex-start;"><span class="addr-type">도로명</span><span class="addr-text">${roadAddr}</span></div>` : ''}
                    ${jibunAddr ? `<div style="display:flex; align-items:flex-start;"><span class="addr-type">지번</span><span class="jibun-text">${jibunAddr}</span></div>` : ''}
                </div>`;
            });
            resultsDiv.innerHTML = html;
        } else {
            resultsDiv.innerHTML = '<div style="padding:15px; text-align:center;">검색 결과가 없습니다.</div>';
        }
    } catch(e) {
        console.error("카카오 API 에러:", e);
        executeMockAddressSearch();
    }
}

function executeMockAddressSearch() {
    const inputVal = document.getElementById('modalAddressInput').value.trim();
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = `
        <div class="search-item" onclick="selectAddress('서울특별시 강남구 ${inputVal}')">
            <div style="display:flex; margin-bottom:4px; align-items:flex-start;">
                <span class="addr-type">도로명</span>
                <span class="addr-text">서울 강남구 ${inputVal} <span style="color:#e74c3c; font-size:11px;">(가상 데이터 매핑)</span></span>
            </div>
        </div>`;
}

function selectAddress(fullAddr) {
    if(currentAddressTarget) currentAddressTarget.value = fullAddr;
    closeAddressModal();
}