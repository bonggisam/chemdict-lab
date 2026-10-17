# ChemDict Lab — 작업 규칙

- 사용자: 고등학교 화학 교사. 설명과 UI 문구는 한국어, 짧고 명확하게.
- 보드↔앱 통신 규칙은 `protocol/PROTOCOL.md`가 기준이다. 펌웨어·웹앱·애플 앱 중 하나를 바꾸면 나머지와 문서를 함께 맞춘다.
- 연결 안내(보드·센서·배선)는 `tools/make_guide.py`를 고치고 실행해 `protocol/guide.json`을 만든다 (json 직접 수정 금지).
- 실험 템플릿은 `protocol/experiments/*.json` 하나만 고친다 (웹앱은 import.meta.glob, 애플 앱은 폴더 참조로 같은 파일을 읽음).
- 기준 보드: Arduino UNO R4 WiFi. 아날로그 5 V, Qwiic는 Wire1(3.3 V).
- BLE: Nordic UART 방식 UUID, 20바이트 조각 + '\n' 줄 단위. 한글이 조각 경계에서 잘리므로 받는 쪽은 바이트 단위로 모은 뒤 디코딩한다.
- 웹앱 확인: `cd web && npx tsc -b && npx vite build`
- 생성 파일 이름은 영문만 (한글 파일명은 다운로드 오류가 남).
- 화면 디자인은 `docs/DESIGN.md`가 기준이다 (색·글자·44px 터치·그래프 규칙). 측정 색을 바꾸면 dataviz 검증기를 다시 돌린다. 웹 토큰(styles.css)과 애플 Theme.swift 값을 같이 맞춘다.
- 펌웨어를 바꾸면 web/public/firmware/*.hex 를 다시 내보내고 BUNDLED_FW 를 맞춘다 (PROTOCOL.md "웹앱에서 측정 프로그램 설치").
- 화면 흐름은 3단계: 1 보드 연결(고르기·연결·설치) → 2 실험(센서 카드·측정) → 3 연결 방법·문제 해결.
- 목표: 학생·교사가 클릭만으로 센서를 고르고 바로 데이터를 얻는 것. 새 기능은 준비 단계를 늘리지 않는다 (센서 카드 → 연결 그림 → 측정 시작).
