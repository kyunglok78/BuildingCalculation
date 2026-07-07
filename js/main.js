window.onload = function() {
    // 로컬 서버(localhost)가 아니고 파일(file://)이나 미리보기(blob://) 환경일 경우 경고창 띄우기
    if (!isLocalServer && (window.location.protocol === 'file:' || window.location.protocol === 'blob:')) {
        const warning = document.getElementById('fileWarning');
        if(warning) warning.style.display = 'block';
    }
    
    // 초기 메뉴 상태 점검
    updateMenuState();
};

