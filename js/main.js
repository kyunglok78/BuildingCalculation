window.onload = function() {
    // 로컬 서버(localhost)가 아니고 파일(file://)이나 미리보기(blob://) 환경일 경우 경고창 띄우기
    if (!isLocalServer && (window.location.protocol === 'file:' || window.location.protocol === 'blob:')) {
        const warning = document.getElementById('fileWarning');
        if(warning) warning.style.display = 'block';
    }
    
    // [기능 1] 첫 번째 페이지(인트로)를 건너뛰고 2번째 슬라이드로 즉시 이동
    goToSlide('slide2');
    updateMenuState();
};