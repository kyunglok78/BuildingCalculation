// ============================================================================
// ui.js - 화면 전환(SPA), 모달 제어, 임시저장 관리 (One-Stop 버전)
// ============================================================================

function switchSection(sectionId) {
    const targetSection = document.getElementById(sectionId);
    const targetMenu = document.getElementById('nav-' + sectionId);
    
    // 비활성화된 메뉴는 클릭 방지
    if(targetMenu && targetMenu.classList.contains('disabled')) return;

    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(menu => menu.classList.remove('active'));

    if(targetSection) targetSection.classList.add('active');
    if(targetMenu) targetMenu.classList.add('active');
    
    // 화면 최상단으로 이동
    window.scrollTo(0, 0);
}

// 과거의 goToSlide 호출을 새로운 SPA 함수로 자동 매핑해주는 호환성 헬퍼
function goToSlide(slideId) {
    const slideMap = {
        'slide2': 'sec-1-1', 'slide3': 'sec-2-1-1', 'slide4': 'sec-2-1-2',
        'slide5': 'sec-2-1-3', 'slide6': 'sec-2-2-1', 'slide7': 'sec-2-2-2', 'slide8': 'sec-3-1'
    };
    if (slideMap[slideId]) switchSection(slideMap[slideId]);
}

function openApiKeyModal(errorMsg, actionType) {
    currentRetryAction = actionType;
    const reasonEl = document.getElementById('apiErrorReason');
    if(errorMsg === '수동 설정') reasonEl.innerHTML = '<span style="color:#1C5691;">현재 시스템에 등록된 API 키를 확인하거나 변경합니다.</span>';
    else reasonEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${errorMsg}`;
    
    document.getElementById('manualKakaoKey').value = manualKakaoKey || GLOBAL_KAKAO_KEY;
    document.getElementById('manualDataKey').value = manualDataKey || GLOBAL_DATA_KEY;
    document.getElementById('apiKeyModal').style.display = 'flex';
}

function saveApiKeys() {
    manualKakaoKey = document.getElementById('manualKakaoKey').value.trim();
    manualDataKey = document.getElementById('manualDataKey').value.trim();
    document.getElementById('apiKeyModal').style.display = 'none';
    if(currentRetryAction === 'address') searchAddress();
    else if(currentRetryAction === 'ledger') simulateApiFetch();
    else if(currentRetryAction === 'none') alert("API 키 설정이 저장되었습니다.");
}

function cancelApiKeys() {
    document.getElementById('apiKeyModal').style.display = 'none';
}

// 새로운 뱃지 및 사이드바 제어 로직
function updateMenuState() {
    let useLedger = false, useKfpa = false, useInflation = false;
    let useBI = document.getElementById('chkGlobalBI') ? document.getElementById('chkGlobalBI').checked : false;

    document.querySelectorAll('.check-ledger').forEach(cb => { if(cb.checked) useLedger = true; });
    document.querySelectorAll('.check-kfpa').forEach(cb => { if(cb.checked) useKfpa = true; });
    document.querySelectorAll('.chk-inflation').forEach(cb => { if(cb.checked) useInflation = true; });

    function setMenuState(menuIds, isActive) {
        menuIds.forEach(id => {
            const menu = document.getElementById(id);
            if(!menu) return;
            let badge = menu.querySelector('.status-badge');
            
            if(isActive) {
                menu.classList.remove('disabled');
                if(badge && badge.classList.contains('status-none')) {
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

function switchApiTab(el, index) {
    const tabs = el.parentElement.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    
    const dataContainer = document.getElementById('fetchedDataContainer');
    Array.from(dataContainer.children).forEach(c => c.style.display = 'none');
    
    const targetDiv = document.getElementById('api-loc-' + index);
    if(targetDiv) {
        targetDiv.style.display = 'block';
        targetDiv.style.opacity = 0;
        setTimeout(() => { targetDiv.style.opacity = 1; targetDiv.style.transition = 'opacity 0.2s'; }, 10);
    }
}

function quickSaveProject() {
    try {
        const contractorInputs = document.querySelectorAll('.contractor-sync');
        const contractor = (contractorInputs.length > 0 && contractorInputs[0].value) ? contractorInputs[0].value : "미지정";
        const evalYearInput = document.getElementById('evalYear');
        const evalYear = evalYearInput ? evalYearInput.value : new Date().getFullYear();
        
        const locations = [];
        // 새 HTML 테이블 행에서 데이터 수집
        const rows = document.querySelectorAll('#locationTbody tr');
        rows.forEach((row) => {
            const nameInput = row.querySelector('.loc-name');
            const addrInput = row.querySelector('.addr-input');
            const checkLedger = row.querySelector('.check-ledger');
            const checkKfpa = row.querySelector('.check-kfpa');
            
            locations.push({
                name: nameInput ? nameInput.value : "",
                addr: addrInput ? addrInput.value : "",
                checkLedger: checkLedger ? checkLedger.checked : true,
                checkKfpa: checkKfpa ? checkKfpa.checked : true
            });
        });

        const projectState = {
            contractor: contractor,
            eval_year: evalYear,
            addresses: locations,
            fetched_data: window.kbState.fetchedData || {}, 
            eval_records: window.kbState.evalData || {'title': {}, 'floor': {}, 'kfpa': {}},
            tempKfpaDataStore: window.tempKfpaDataStore || {}
        };

        const dataStr = JSON.stringify(projectState, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        a.href = url;
        a.download = `${contractor}_임시저장_${dateStr}.kbproj`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert("✅ 성공적으로 저장되었습니다! 브라우저 다운로드 폴더를 확인해주세요.");
    } catch (e) {
        alert("❌ 저장 중 오류가 발생했습니다.");
        console.error(e);
    }
}

function quickLoadProject(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const projectState = JSON.parse(e.target.result);
            
            if(projectState.contractor) {
                document.querySelectorAll('.contractor-sync').forEach(input => input.value = projectState.contractor);
            }
            if(document.getElementById('evalYear') && projectState.eval_year) {
                document.getElementById('evalYear').value = projectState.eval_year;
            }
            
            if(projectState.addresses && projectState.addresses.length > 0) {
                const tbody = document.getElementById('locationTbody');
                if(tbody) {
                    tbody.innerHTML = ""; 
                    projectState.addresses.forEach((item, index) => {
                        tbody.insertAdjacentHTML('beforeend', createLocationRowHTML(index + 1));
                        const lastRow = tbody.lastElementChild;
                        lastRow.querySelector('.loc-name').value = item.name || "";
                        lastRow.querySelector('.addr-input').value = item.addr || "";
                        
                        const checkLedger = lastRow.querySelector('.check-ledger');
                        const checkKfpa = lastRow.querySelector('.check-kfpa');
                        if(checkLedger) checkLedger.checked = item.checkLedger !== false;
                        if(checkKfpa) checkKfpa.checked = item.checkKfpa !== false;
                    });
                    if(document.getElementById('locationCount')) {
                        document.getElementById('locationCount').value = projectState.addresses.length;
                        locationCounter = projectState.addresses.length;
                    }
                }
            }
            
            window.kbState.fetchedData = projectState.fetched_data || {};
            window.kbState.evalData = projectState.eval_records || {'title': {}, 'floor': {}, 'kfpa': {}};
            window.tempKfpaDataStore = projectState.tempKfpaDataStore || {};
            
            updateMenuState();
            if(typeof runGroupedRenderTest === 'function') runGroupedRenderTest();
            alert("✅ 임시 저장 파일을 성공적으로 불러왔습니다!");
            
            event.target.value = ''; 
        } catch (err) {
            alert("❌ 파일 읽기 실패: 올바른 .kbproj 파일이 아니거나 손상되었습니다.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}