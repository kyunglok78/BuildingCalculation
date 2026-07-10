// ============================================================================
// [BLOCK 1] 전역 상태 관리 (State Management)
// ============================================================================
// 시스템 전체의 데이터를 담는 거대한 그릇입니다. 임시저장 시 이 객체가 통째로 저장됩니다.
window.kbState = {
    generalInfo: { contractor: "", locationCount: 1 },
    addresses: [], // 조회할 사업장 주소 목록
    evalData: { title: {}, floor: {}, kfpa: {} }, // 백엔드에서 받아온 정제된 평가 데이터
    activeSite: null // 현재 선택된 사업장 탭
};

// ============================================================================
// [BLOCK 2] 사업장별 탭(Tab) 동적 생성 및 렌더링 로직
// ============================================================================
function renderEvalTabsAndTable(mode, targetTbodyId, targetTabContainerId) {
    const dataObj = window.kbState.evalData[mode];
    if (!dataObj || Object.keys(dataObj).length === 0) return;

    const sites = Object.keys(dataObj);
    if (!window.kbState.activeSite || !sites.includes(window.kbState.activeSite)) {
        window.kbState.activeSite = sites[0]; // 기본적으로 첫 번째 사업장 선택
    }

    // 1. 탭 UI 생성 (테이블 상단에 동적으로 추가됨)
    let tabContainer = document.getElementById(targetTabContainerId);
    if (!tabContainer) {
        // HTML에 탭 컨테이너가 없으면 동적으로 생성하여 테이블 바로 위에 삽입
        const tableWrapper = document.getElementById(targetTbodyId).closest('.data-table-wrapper');
        tabContainer = document.createElement('div');
        tabContainer.id = targetTabContainerId;
        tabContainer.style.cssText = "display: flex; margin-bottom: 10px; border-bottom: 2px solid #1C5691;";
        tableWrapper.parentNode.insertBefore(tabContainer, tableWrapper);
    }
    
    tabContainer.innerHTML = ''; // 기존 탭 초기화
    
    sites.forEach(siteName => {
        const isSelected = (siteName === window.kbState.activeSite);
        const tabBtn = document.createElement('div');
        tabBtn.innerText = siteName;
        tabBtn.style.cssText = `
            padding: 10px 25px; cursor: pointer; font-weight: bold; border: 1px solid #ddd; border-bottom: none;
            background-color: ${isSelected ? '#1C5691' : '#f8f9fa'};
            color: ${isSelected ? '#ffffff' : '#333333'};
        `;
        // 탭 클릭 이벤트: activeSite를 변경하고 테이블 다시 그리기
        tabBtn.onclick = () => {
            window.kbState.activeSite = siteName;
            renderEvalTabsAndTable(mode, targetTbodyId, targetTabContainerId);
        };
        tabContainer.appendChild(tabBtn);
    });

    // 2. 선택된 사업장의 데이터만 테이블에 렌더링 (이전에 작성한 3단 콤보 렌더링 함수 재활용)
    const selectedData = dataObj[window.kbState.activeSite];
    renderEvalTableGrouped(targetTbodyId, selectedData);
}

// ============================================================================
// [BLOCK 3] 전체 상태 임시저장 및 불러오기 (.kbproj)
// ============================================================================
// 저장: 현재 화면의 모든 데이터를 JSON으로 묶어 .kbproj 확장자로 다운로드
function quickSaveProject() {
    // 1. 최신 일반정보 화면 데이터 긁어오기
    window.kbState.generalInfo.contractor = document.querySelector('.contractor-sync').value;
    
    // 2. JSON 문자열 변환 및 암호화/인코딩 (Base64)
    const stateString = JSON.stringify(window.kbState);
    const blob = new Blob([stateString], { type: "application/json" });
    
    // 3. 다운로드 트리거
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${window.kbState.generalInfo.contractor || "가액평가"}_임시저장.kbproj`;
    a.click();
    alert("현재 진행 상태가 성공적으로 저장되었습니다.");
}

// 불러오기: .kbproj 파일을 읽어들여 화면 상태 100% 복구
function quickLoadProject(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            // 1. 상태 복원
            window.kbState = JSON.parse(e.target.result);
            
            // 2. 일반정보 UI 복원
            document.querySelectorAll('.contractor-sync').forEach(el => el.value = window.kbState.generalInfo.contractor);
            
            // 3. 평가 화면 탭 및 테이블 UI 복원
            renderEvalTabsAndTable('title', 'tbodyTitleEval', 'tabsTitleEval');
            renderEvalTabsAndTable('floor', 'tbodyFloorEval', 'tabsFloorEval');
            renderEvalTabsAndTable('kfpa', 'tbodyKfpaEval', 'tabsKfpaEval');
            
            alert("프로젝트 복구가 완료되었습니다.");
            goToSlide('slide4'); // 데이터 확인을 위해 표제부 화면으로 자동 이동
        } catch (error) {
            alert("파일이 손상되었거나 올바른 .kbproj 파일이 아닙니다.");
        }
    };
    reader.readAsText(file);
}