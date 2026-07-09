function goToSlide(slideId) {
    const slides = document.querySelectorAll('.slide-container');
    slides.forEach(slide => { slide.style.display = 'none'; });
    const targetSlide = document.getElementById(slideId);
    if (targetSlide) {
        targetSlide.style.display = 'block';
        window.scrollTo(0, 0);
    }
}

function openApiKeyModal(errorMsg, actionType) {
    currentRetryAction = actionType;
    const reasonEl = document.getElementById('apiErrorReason');
    if(errorMsg === '수동 설정') {
        reasonEl.innerHTML = '<span style="color:#1C5691;">현재 시스템에 등록된 API 키를 확인하거나 변경합니다.</span>';
    } else {
        reasonEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${errorMsg}`;
    }
    
    document.getElementById('manualKakaoKey').value = manualKakaoKey || GLOBAL_KAKAO_KEY;
    document.getElementById('manualDataKey').value = manualDataKey || GLOBAL_DATA_KEY;
    document.getElementById('apiKeyModal').style.display = 'flex';
}

function saveApiKeys() {
    manualKakaoKey = document.getElementById('manualKakaoKey').value.trim();
    manualDataKey = document.getElementById('manualDataKey').value.trim();
    document.getElementById('apiKeyModal').style.display = 'none';
    
    if(currentRetryAction === 'address') {
        searchAddress();
    } else if(currentRetryAction === 'ledger') {
        simulateApiFetch();
    } else if(currentRetryAction === 'none') {
        alert("API 키 설정이 저장되었습니다.");
    }
}

function cancelApiKeys() {
    document.getElementById('apiKeyModal').style.display = 'none';
    if(currentRetryAction === 'address') {
        executeMockAddressSearch();
    } else if(currentRetryAction === 'ledger') {
        executeMockLedgerFetch();
    }
}

function toggleMenuUI(type, isEnabled) {
    const slides = document.querySelectorAll('.slide-container');
    slides.forEach(slide => {
         const links = slide.querySelectorAll(`div[data-menu-type="${type}"]`);
         links.forEach(link => {
            const badge = link.querySelector('.status-badge');
            const isActive = link.classList.contains('menu-active');
            if (!isEnabled) {
                if(!isActive) link.classList.add('disabled-link');
                if (badge) {
                    if(!badge.dataset.origSaved) {
                        badge.dataset.origText = badge.textContent;
                        badge.dataset.origClass = badge.className;
                        badge.dataset.origSaved = 'true';
                    }
                    badge.textContent = '미평가';
                    badge.className = 'status-badge status-none';
                }
            } else {
                link.classList.remove('disabled-link');
                if (badge && badge.dataset.origSaved) {
                    badge.textContent = badge.dataset.origText;
                    badge.className = badge.dataset.origClass;
                }
            }
        });
    });
}

function updateMenuState() {
    const slide2 = document.getElementById('slide2');
    if(!slide2) return;
    const ledgerChecks = slide2.querySelectorAll('.check-ledger');
    const kfpaChecks = slide2.querySelectorAll('.check-kfpa');
    toggleMenuUI('ledger', Array.from(ledgerChecks).some(cb => cb.checked));
    toggleMenuUI('kfpa', Array.from(kfpaChecks).some(cb => cb.checked));
}

function switchApiTab(el, index) {
    const tabs = el.parentElement.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    
    const dataContainer = document.getElementById('fetchedDataContainer');
    const children = dataContainer.children;
    for(let i=0; i<children.length; i++) { children[i].style.display = 'none'; }
    
    const targetDiv = document.getElementById('api-loc-' + index);
    if(targetDiv) {
        targetDiv.style.display = 'block';
        targetDiv.style.opacity = 0;
        setTimeout(() => { targetDiv.style.opacity = 1; targetDiv.style.transition = 'opacity 0.2s'; }, 10);
    }
}

// ==========================================
// [추가 기능] .kbproj 빠른 임시 저장 및 불러오기
// ==========================================

// 1. 임시 저장 기능 (.kbproj 파일 다운로드)
function quickSaveProject() {
    const contractorInputs = document.querySelectorAll('.contractor-sync');
    const contractor = (contractorInputs.length > 0 && contractorInputs[0].value) ? contractorInputs[0].value : "미지정";
    const evalYearInput = document.getElementById('evalYear');
    const evalYear = evalYearInput ? evalYearInput.value : new Date().getFullYear();
    
    const locations = [];
    const rows = document.querySelectorAll('#locationListBox .list-row');
    rows.forEach((row) => {
        const nameInput = row.querySelector('.input-short');
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
        fetched_data: window.fetchedData || {}, 
        eval_records: window.evalRecords || {'title': {}, 'floor': {}, 'kfpa': {}}
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
    
    alert("현재 작업 상태가 '.kbproj' 파일로 안전하게 저장(다운로드)되었습니다! ^^");
}

// 2. 임시 저장 불러오기 기능 (.kbproj 파일 읽기)
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
                const listBox = document.getElementById('locationListBox');
                if(listBox) {
                    listBox.innerHTML = ""; 
                    projectState.addresses.forEach((item, index) => {
                        if(typeof createLocationRowHTML === 'function') {
                            listBox.insertAdjacentHTML('beforeend', createLocationRowHTML(index + 1));
                            const lastRow = listBox.lastElementChild;
                            lastRow.querySelector('.input-short').value = item.name;
                            lastRow.querySelector('.addr-input').value = item.addr;
                            lastRow.querySelector('.check-ledger').checked = item.checkLedger;
                            lastRow.querySelector('.check-kfpa').checked = item.checkKfpa;
                        }
                    });
                    if(document.getElementById('locationCount')) {
                        document.getElementById('locationCount').value = projectState.addresses.length;
                        if(typeof locationCounter !== 'undefined') locationCounter = projectState.addresses.length;
                    }
                }
            }
            
            window.fetchedData = projectState.fetched_data || {};
            window.evalRecords = projectState.eval_records || {'title': {}, 'floor': {}, 'kfpa': {}};
            
            if(typeof updateMenuState === 'function') updateMenuState();
            alert("저장된 파일을 성공적으로 불러왔습니다!");
            
        } catch (err) {
            alert("파일 읽기 실패: 올바른 .kbproj 파일이 아니거나 손상되었습니다 ㅠㅠ");
        }
    };
    reader.readAsText(file);
}