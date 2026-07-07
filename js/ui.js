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