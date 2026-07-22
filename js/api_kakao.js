// =========================================================
// 카카오 API 직접 통신 및 지도(Map) 연동 기반 주소 검색
// =========================================================
let map = null;
let markers = [];
let infoWindows = [];
let selectedAddressData = null;

function initMap() {
    const mapContainer = document.getElementById('map');
    
    // 카카오 지도 JS SDK 로드 실패 또는 키 누락 시 예외 처리
    if (typeof kakao === 'undefined' || !kakao.maps) {
        document.getElementById('mapError').style.display = 'block';
        return;
    }
    document.getElementById('mapError').style.display = 'none';
    
    const mapOption = {
        center: new kakao.maps.LatLng(37.566826, 126.9786567), // 기본 중심 (서울시청)
        level: 4
    };
    
    if(!map) {
        map = new kakao.maps.Map(mapContainer, mapOption);
        const zoomControl = new kakao.maps.ZoomControl();
        map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
    } else {
        // 모달이 열릴 때 지도가 깨지지 않도록 레이아웃 재계산
        map.relayout();
    }
}

function openAddressModal(btn) {
    // [버그 수정 반영] 버튼이 속한 행(tr 또는 list-row)에서 인풋 요소를 정확히 탐색
    const row = btn.closest('tr') || btn.closest('.list-row');
    currentAddressTarget = row ? row.querySelector('.addr-input') : null;
    
    document.getElementById('addressModal').style.display = 'flex';
    document.getElementById('modalAddressInput').value = '';
    
    // UI 초기화
    document.getElementById('searchTip').style.display = 'block'; 
    document.getElementById('searchResults').style.display = 'none'; 
    document.getElementById('btnApplyAddress').style.display = 'none';
    document.getElementById('modalAddressInput').focus();
    
    selectedAddressData = null;
    clearMapData();
    
    // 모달 애니메이션 딜레이 후 지도 렌더링
    setTimeout(() => { initMap(); }, 150);
}

function closeAddressModal() {
    document.getElementById('addressModal').style.display = 'none';
}

function clearMapData() {
    if(markers.length > 0) {
        markers.forEach(m => m.setMap(null));
        markers = [];
    }
    if(infoWindows.length > 0) {
        infoWindows.forEach(i => i.close());
        infoWindows = [];
    }
}

async function searchAddress() {
    const inputVal = document.getElementById('modalAddressInput').value.trim();
    const resultsDiv = document.getElementById('searchResults');
    const tipDiv = document.getElementById('searchTip');
    
    if(inputVal === '') { alert('검색할 주소를 입력해 주세요.'); return; }
    
    tipDiv.style.display = 'none'; 
    resultsDiv.style.display = 'block';
    document.getElementById('btnApplyAddress').style.display = 'none';
    selectedAddressData = null;
    clearMapData();
    
    resultsDiv.innerHTML = '<div style="padding:40px; text-align:center; color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> 데이터 연동 및 위치 탐색 중...</div>';
    
    try {
        // REST API를 통한 주소 및 좌표 실시간 확보
        const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(inputVal)}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: { "Authorization": `KakaoAK ${GLOBAL_KAKAO_KEY}` } // config.js의 REST 키 사용
        });
        
        if(!res.ok) throw new Error(`서버 통신 에러 (${res.status})`);
        
        const data = await res.json();
        if(data.documents && data.documents.length > 0) {
            let html = '';
            const bounds = (typeof kakao !== 'undefined' && kakao.maps) ? new kakao.maps.LatLngBounds() : null;
            
            data.documents.forEach((doc, idx) => {
                const roadAddr = doc.road_address ? doc.road_address.address_name : '';
                const jibunAddr = doc.address ? doc.address.address_name : '';
                const zipcode = doc.road_address ? doc.road_address.zone_no : (doc.address && doc.address.zip_code ? doc.address.zip_code : '');
                const displayAddr = roadAddr || jibunAddr;
                
                // 좌표 데이터 (위도, 경도)
                const lat = parseFloat(doc.y);
                const lng = parseFloat(doc.x);
                
                // 1. 지도에 마커(핀) 꽂기
                if (map && !isNaN(lat) && !isNaN(lng)) {
                    const markerPos = new kakao.maps.LatLng(lat, lng);
                    const marker = new kakao.maps.Marker({ position: markerPos, map: map });
                    markers.push(marker);
                    bounds.extend(markerPos);
                    
                    // 마커 위 정보창 세팅
                    const bldName = doc.road_address && doc.road_address.building_name ? ` (${doc.road_address.building_name})` : '';
                    const infowindow = new kakao.maps.InfoWindow({
                        content: `<div class="map-marker-info">${displayAddr}${bldName}</div>`,
                        disableAutoPan: true
                    });
                    infoWindows.push(infowindow);
                    
                    // 마커 클릭 이벤트
                    kakao.maps.event.addListener(marker, 'click', function() {
                        focusOnResult(idx, displayAddr, lat, lng);
                    });
                }
                
                // 2. 우측 리스트 UI 생성
                html += `
                <div class="search-item" id="res-item-${idx}" onclick="focusOnResult(${idx}, '${displayAddr}', ${lat}, ${lng})" style="padding:12px 15px; border-bottom:1px solid #eee; cursor:pointer;">
                    ${zipcode ? `<div class="zipcode" style="color:#e74c3c; font-weight:bold; font-size:13px; margin-bottom:6px;">${zipcode}</div>` : ''}
                    ${roadAddr ? `<div style="display:flex; margin-bottom:4px; align-items:flex-start;"><span style="font-size:10px; padding:1px 4px; border:1px solid #007BFF; color:#007BFF; border-radius:2px; margin-right:6px; flex-shrink:0;">도로명</span><span style="font-size:12px; color:#111; font-weight:bold;">${roadAddr}</span></div>` : ''}
                    ${jibunAddr ? `<div style="display:flex; align-items:flex-start;"><span style="font-size:10px; padding:1px 4px; border:1px solid #6c757d; color:#6c757d; border-radius:2px; margin-right:6px; flex-shrink:0;">지번</span><span style="font-size:12px; color:#666;">${jibunAddr}</span></div>` : ''}
                </div>`;
            });
            resultsDiv.innerHTML = html;
            
            // 모든 마커가 보이도록 지도 영역 자동 줌/이동
            if (map && bounds && markers.length > 0) {
                map.setBounds(bounds);
            }
        } else {
            resultsDiv.innerHTML = '<div style="padding:40px; text-align:center; color:#666; font-size:13px;">검색 결과가 없습니다.</div>';
        }
    } catch(e) {
        console.error("API 통신 에러:", e);
        resultsDiv.innerHTML = `<div style="padding:30px; text-align:center; color:#dc3545; font-weight:bold;">❌ 검색 실패<br><span style="font-size:12px; font-weight:normal; color:#666;">원인: ${e.message}</span></div>`;
    }
}

// 리스트 클릭 또는 마커 클릭 시 발생하는 포커싱 함수
function focusOnResult(idx, fullAddr, lat, lng) {
    // 리스트 하이라이트 효과
    const items = document.querySelectorAll('.search-item');
    items.forEach(item => { item.style.backgroundColor = '#fff'; item.style.borderLeft = 'none'; });
    
    const targetItem = document.getElementById(`res-item-${idx}`);
    if(targetItem) {
        targetItem.style.backgroundColor = '#f0f8ff';
        targetItem.style.borderLeft = '4px solid #1C5691';
        targetItem.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    
    // 지도 중심 이동 및 인포윈도우 표출
    if (map && !isNaN(lat) && !isNaN(lng)) {
        const moveLatLon = new kakao.maps.LatLng(lat, lng);
        map.panTo(moveLatLon);
        
        infoWindows.forEach(i => i.close());
        if(infoWindows[idx] && markers[idx]) {
            infoWindows[idx].open(map, markers[idx]);
        }
    }
    
    // 데이터 저장 및 반영 버튼 활성화
    selectedAddressData = fullAddr;
    const btnApply = document.getElementById('btnApplyAddress');
    btnApply.style.display = 'block';
}

function applySelectedAddress() {
    if(selectedAddressData && currentAddressTarget) {
        currentAddressTarget.value = selectedAddressData;
        closeAddressModal();
    } else {
        alert('주소를 목록에서 클릭하여 먼저 선택해 주세요.');
    }
}