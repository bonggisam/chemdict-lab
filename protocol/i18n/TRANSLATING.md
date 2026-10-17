# ChemDict Lab 번역 지침 (translators' brief)

Source: `protocol/i18n/source/content.json` — flat map key → Korean text (sensor wiring guide, troubleshooting, breadboard guide, 122 school science experiments for Korean middle/high schools).
Output: `protocol/i18n/<lang>/content.json` — the SAME keys, values translated. Also `protocol/i18n/<lang>/glossary.json` (Korean term → your term) for consistency with the app UI, which will be translated later with the same glossary.

Audience: science teachers and students (age 13–18). Style: short, clear, imperative instructions, like a good lab manual. Natural, not literal.

Rules
1. Keep every key. Do not add or drop keys. Values must be non-empty.
2. Keep placeholders like `{n}` exactly. Keep numbers, units (°C, mL, kPa, µS/cm, Ω, kΩ, µF, ppm, V, nm, psu, hPa), chemical formulas (NaOH, H2O2, CuSO4, FeSCN²⁺…), pin names (A0, D2, 5V, GND, SDA, SCL, VCC, TRIG, ECHO, DT, SCK), part names (DS18B20, DHT22, HX711, BME280, SCD40, TCS34725, HC-SR04, Qwiic, UNO R4 WiFi) unchanged.
3. App UI labels quoted with ‘ ’ or ' ' (e.g. ‘값 기록’, ‘함수 찾기 → 직선’) must use the glossary term, quoted the same way. Canonical English for these:
   값 기록 = Record value · 관찰 기록 = Add note · 한 일 = Note · 측정 시작 = Start · 정지 = Stop · 새 측정 = New run · 보정 = Calibrate · 영점 = Zero · 센서 보정 = Calibrate sensor · 센서 설정 = Sensor setup · 센서 다시 찾기 = Rescan sensors · 꽂을 포트 = Port · 예측 그리기 = Draw prediction · 함수 찾기 = Curve fit · 직선 = Linear · 비례 = Proportional · 반비례 = Inverse · 거듭제곱 = Power · 지수 = Exponential · 지수 접근 = Exponential approach · 로그 = Logarithmic · 2차 함수 = Quadratic · 3차 함수 = Cubic · 평탄 구간 찾기 = Find plateau · 당량점 찾기 = Find equivalence point · 변화율 그래프 = Rate graph · 접선 = Tangent · 넓이 = Area · 선택 구간 확대 = Zoom to selection · 가로축 = X axis · 계산 열 = Calculated column · 상용로그 = log10 · 자연로그 = ln · 저장하기 = Save · USB로 연결 = Connect USB · 측정 프로그램 설치 = Install firmware · 연결 안내 = Connection guide · 보드 바꾸기 = Change board · 실험으로 찾기 = Find by experiment · 센서로 찾기 = Find by sensor · 브레드보드 = Breadboard · 문제 해결 = Troubleshooting · 모둠 = group · 측정 = run (one recording) · 시간 기록 모드 = time mode · 값 입력 모드 = value-entry mode · 데모 데이터 = Demo data
4. Korean school context:
   - Course names: 과학 1/2/3 = Science 1/2/3 (middle school); 통합과학1·2 = Integrated Science 1·2; 과학탐구실험1·2 = Science Inquiry Lab 1·2; 물리학 = Physics; 화학 = Chemistry; 생명과학 = Life Science; 지구과학 = Earth Science; 역학과 에너지 = Mechanics and Energy; 전자기와 양자 = Electromagnetism and Quantum; 물질과 에너지 = Matter and Energy; 화학 반응의 세계 = World of Chemical Reactions; 세포와 물질대사 = Cells and Metabolism; 지구시스템과학 = Earth System Science; 행성우주과학 = Planetary and Space Science; 기후변화와 환경생태 = Climate Change and Ecology; 융합과학 탐구 = Integrated Science Inquiry; 자유 측정 = Free measurement; 기초 측정 = Basic measurement.
   - Levels: 중학교 = Middle school · 고1 공통 = Grade 10 (common) · 고2·3 선택 = Grade 11–12 (electives) · 공통 = General.
   - Achievement-standard sentences (keys `exp.*.std.*`) are official Korean curriculum statements: translate faithfully; if a value starts with "(문장 요약)" translate that tag as "(summary)".
   - Publisher names: 미래엔 = Mirae-N, 비상교육 = Visang, 천재교과서 = Chunjae; textbook page refs like "96쪽" = "p. 96".
   - Korean school labels like "3모둠", "2학년 3반" are examples; localise them naturally (e.g. "Group 3", "Grade 2, Class 3").
5. Translate into the target language using the English canonical terms above as meaning reference; choose the standard term in your language (e.g. Japanese 「値を記録」). Put every UI term you chose into glossary.json.
6. Work in chunks (the file has ~2,600 keys, ~51,000 Korean characters): read the source in slices (e.g. 300 keys at a time with a small python script), write each translated slice to `protocol/i18n/<lang>/parts/NN.json`, then merge parts into content.json with python, delete the parts folder, and run `python3 tools/i18n_check.py <lang>` until it reports 0 missing and 0 placeholder errors and 0 Hangul (except none expected). Number warnings are fine only if intentional.
7. Do not modify any other files. Do not run git.
