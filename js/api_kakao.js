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
    resultsDiv.innerHTML = '<div style="padding:15px; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> 실시간 주소 검색 중...</div>';
    
    try {
        // [수정] 현재 접속 환경과 상관없이 백엔드 서버(8000포트) API 엔드포인트를 명확히 명시합니다.
        const baseUrl = 'http://localhost:8000';
        const targetUrl = `${baseUrl}/api/kakao?query=${encodeURIComponent(inputVal)}`;
        
        const res = await fetch(targetUrl);
        if(!res.ok) throw new Error(`카카오 API 프록시 서버 응답 오류 (${res.status})`);
        
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
            resultsDiv.innerHTML = '<div style="padding:15px; text-align:center;">검색 결과가 없습니다. (정확한 지번이나 도로명을 입력해 주세요)</div>';
        }
    } catch(e) {
        console.error("카카오 API 실시간 통신 에러:", e);
        resultsDiv.innerHTML = `<div style="padding:15px; text-align:center; color:#dc3545; font-weight:bold;">❌ 실시간 연동 실패<br><span style="font-size:12px; font-weight:normal;">원인: ${e.message}</span></div>`;
        alert(`주소 검색 서버 통신에 실패했습니다.\n파이썬 콘솔 창의 에러 로그를 확인해 주세요.\n\n오류 내용: ${e.message}`);
    }
}

function selectAddress(fullAddr) {
    if(currentAddressTarget) currentAddressTarget.value = fullAddr;
    closeAddressModal();
}