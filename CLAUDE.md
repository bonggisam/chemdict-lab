# ChemDict Lab — 작업 규칙

- 사용자: 고등학교 화학 교사. 설명과 UI 문구는 한국어, 짧고 명확하게.
- 보드↔앱 통신 규칙은 `protocol/PROTOCOL.md`가 기준이다. 펌웨어·웹앱·애플 앱 중 하나를 바꾸면 나머지와 문서를 함께 맞춘다.
- 실험 템플릿은 `protocol/experiments/*.json` 하나만 고친다 (웹앱은 import.meta.glob, 애플 앱은 폴더 참조로 같은 파일을 읽음).
- 기준 보드: Arduino UNO R4 WiFi. 아날로그 5 V, Qwiic는 Wire1(3.3 V).
- BLE: Nordic UART 방식 UUID, 20바이트 조각 + '\n' 줄 단위. 한글이 조각 경계에서 잘리므로 받는 쪽은 바이트 단위로 모은 뒤 디코딩한다.
- 웹앱 확인: `cd web && npx tsc -b && npx vite build`
- 생성 파일 이름은 영문만 (한글 파일명은 다운로드 오류가 남).
