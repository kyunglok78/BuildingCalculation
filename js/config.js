// 전역 시스템 키 (파이썬 서버를 쓰면 HTML에는 키가 노출될 필요 없으나 예비용으로 둠)
const GLOBAL_KAKAO_KEY = "c48e895cae6e16bc82fc1ed089539352";
const GLOBAL_DATA_KEY = "1oOOTG+s4eO71/a5Xn4xV2l7/d+k0G8w3QZ2+29e612B1R0nOq91xH5t5WwI/n5yD9vP4o7zQ7s6+V6e+368lA==";

// 전역 상태 변수
let manualKakaoKey = "";
let manualDataKey = "";
let currentRetryAction = "";
let locationCounter = 2; 
let currentAddressTarget = null;

// 로컬 파이썬 서버 환경 감지
const isLocalServer = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');