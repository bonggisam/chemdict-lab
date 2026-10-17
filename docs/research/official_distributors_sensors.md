# 국내 아두이노 공식 판매처 센서 조사 (2026-10-17)

공식 판매처: Arduino 공식 유통사 목록(https://store.arduino.cc/distributors) 기준 한국 5곳 — 엘레파츠, 아이씨뱅큐, 메카솔루션, 엔티렉스(=디바이스마트 운영사), 오스코(반도체 유통사, 쇼핑몰 없음 → Arduino 공식 제품으로 대체 조사).

각 사이트 상품 목록이 스크립트로 불려 와서, 도메인 한정 검색 결과의 상품명·URL로 판매 여부를 확인했다. 가격·재고는 미확인. 검색 한도 때문에 일부 분류는 끝까지 못 찾았다.

적용 결과(펌웨어 0.5.0)는 protocol/PROTOCOL.md "추가 센서 2" 참고.



---

## 엘레파츠(eleparts.co.kr) 센서 조사 — ChemDict Lab 미등록 후보

조사일: 2026-10-17

### 방법과 한계

- 엘레파츠 도메인 한정 웹검색 약 30회 + WebFetch(상품·카탈로그·브랜드 페이지)로 확인. **웹검색 한도(세션 공유 200회)가 조사 중간에 소진**되어 Adafruit·SparkFun·DFRobot 개별 칩 검색, 소리·심박·토양·유량 등 일부 분류는 더 찾지 못했다. 필요하면 후속 요청으로 이어서 검색.
- 카탈로그 페이지는 WebFetch로 첫 페이지만 보임(페이지 넘김 파라미터 무시됨). 일부 상품 페이지는 빈 응답.
- 표의 상품명·URL은 모두 검색 결과나 WebFetch 응답에 실제로 나온 것. 칩·주소 중 페이지에 없고 데이터시트 기준으로 적은 값은 †, 상품 페이지에서 칩명을 확인하지 못한 것은 "칩 미표기".
- 가격·재고: 미확인 (Adafruit 1231 ADXL345만 24,000원 확인).
- "포함됨" 판정: 같은 칩 또는 레지스터·프로토콜 호환 칩이 current_parts에 있으면 제외(아래 3절에 따로 정리).

통신 표기: A 아날로그 / D1 디지털 켜짐·꺼짐 / I2C(주소) / UART / SPI / 1-Wire / 펄스·주파수

---

### 1. 현재 목록에 없는 센서 (엘레파츠에서 확인)

### 1-1. 온도

| 상품명 (보인 그대로) | URL | 칩 | 통신 | 측정량·단위 | 학교 활용 |
|---|---|---|---|---|---|
| [SEEED] 그로브 열전대 증폭기 Grove - I2C Thermocouple Amplifier (MCP9600) | https://www.eleparts.co.kr/goods/view?no=9535999 | MCP9600 | I2C (0x60~0x67†, 기본 0x60) | 열전대 온도 °C (K/J/T/N/S/E/B/R, 냉접점 보상 내장) | 화학: 불꽃·가열·연소 고온. MAX6675(SPI)보다 배선 단순, Grove→Qwiic 변환 시 Wire1 사용 가능 — **추천** |
| [TEXAS INSTRUMENTS] TMP117AIYBGT | https://eleparts.co.kr/goods/view?no=9065779 | TMP117 (IC 단품) | I2C (0x48†) | 온도 °C, ±0.1 °C† | 정밀 열량계. 단 IC 단품이라 학생용 아님(모듈 아님) |
| [PANASONIC] AMG8833 | https://www.eleparts.co.kr/goods/view?no=6030490 | AMG8833 (센서 단품) | I2C (0x68/0x69†) | 8×8 열화상 °C | 물리·화학: 발열 분포. 단품 부품 |

### 1-2. 온습도·기압·기체 압력

| 상품명 | URL | 칩 | 통신 | 측정량·단위 | 학교 활용 |
|---|---|---|---|---|---|
| [ASAIR (Aosong)] AM2320 정밀 소형 온습도센서 | https://www.eleparts.co.kr/goods/view?no=4106652 | AM2320 | I2C (0x5C†) 또는 단선 | 온도 °C, 습도 %RH | 증산·호흡 습도 (DHT22 후속형) |
| [ADAFRUIT] 4832 "STEMMA QT HTU31 HUMIDITY & TEMP, HTU31D 습도, 온도 센서" | https://eleparts.co.kr/goods/catalog?code=001700310002 (카탈로그 목록에서 확인) | HTU31D (HTU21D와 명령 체계 다름) | I2C (0x40/0x41†), Qwiic | 온도 °C, 습도 %RH | 습도 측정, Qwiic 바로 연결 |
| [온시스텍] [OSTSen-6130] HIH-6130 고신뢰성, 고안정성 습도, 온도 센서 모듈 | https://eleparts.co.kr/goods/brand?code=3679&iframe=&page=1&popup= (브랜드 목록) | Honeywell HIH-6130 | I2C (0x27†) | 온도 °C, 습도 %RH | 습도 측정 |
| [Waveshare] 기압 센서 BMP388 Barometric Pressure Sensor | https://www.eleparts.co.kr/goods/view?no=7458600 | BMP388 (BMP280과 레지스터 다름) | I2C (0x76/0x77†), SPI | 기압 hPa, 온도 °C, ±0.08 hPa 상대† | 보일 법칙, 기체 발생 압력 — 고정밀 |
| [GY SENSOR] GY-63 (MS5611 고정밀 압력센서모듈) | https://eleparts.co.kr/goods/view?no=3217900 | MS5611 | I2C (0x77/0x76†), SPI | 기압 10~1200 mbar†, 온도 °C | 고도·기압 변화(분해능 높음) |
| [온시스텍] [OSTSen-3115] MPL3115A2 압력, 온도 센서 모듈 | https://eleparts.co.kr/goods/brand?code=3679&iframe=&page=1&popup= (브랜드 목록) | MPL3115A2 | I2C (0x60†) | 기압 Pa / 고도 m, 온도 °C | 기압·고도 |
| [LK임베디드] 아두이노 센서 MS5540 수압측정 ("디지털 수압센서MS5540-CM") | https://eleparts.co.kr/goods/view?no=8057058 | MS5540C | 3선 직렬(페이지 표기 "SPI"), 16비트 | 압력 mbar (페이지 표기 "10-100mbar" — 데이터시트는 10~1100 mbar†, 오기 가능), 온도 °C | 수압·수심(방수형). 3선 전용 프로토콜이라 구현 부담 |
| [SENSIRION] SDP810-125PA | https://eleparts.co.kr/goods/view?no=6064088 | SDP810 (차압) | I2C (0x25†) | 차압 ±125 Pa | 공기 흐름·호흡 유량(심화). 단품 |
| [Panasonic Industry] DPH-102-M5-C5 · [마블덱스] RA30P 압력센서 | https://eleparts.co.kr/goods/view?no=1406735 · https://eleparts.co.kr/goods/view?no=4049292 | 산업용 압력 스위치 / 박막 압력 | 미확인 | 미확인 | RA30P는 FSR류로 보이나 미확인 |

### 1-3. 기체 (CO2·VOC·가스)

| 상품명 | URL | 칩 | 통신 | 측정량·단위 | 학교 활용 |
|---|---|---|---|---|---|
| [DFRobot] [SEN0335] 환경 센서-Multi-function Environmental Module - CCS811+BME280 | https://eleparts.co.kr/goods/view?no=9621250 | CCS811 (+BME280) | I2C (CCS811 0x5A/0x5B†, BME280 0x76/0x77) | eCO2 ppm, TVOC ppb (추정값) + 온습도·기압 | 휘발성 물질 정성. SGP30/ENS160과 같은 부류 |
| [SENSIRION] SGP40-D-R4 | https://eleparts.co.kr/goods/view?no=10382114 | SGP40 (IC 단품) | I2C (0x59†) | VOC Index 0~500 | 정성. 단품이라 모듈 아님 |
| [WINSEN] MH-Z14A NDIR방식 CO2 센서 모듈 | https://eleparts.co.kr/goods/view?no=3186568 | MH-Z14A | UART (+PWM, 아날로그) | CO2 ppm | 광합성·호흡. **MH-Z19와 UART 명령(0x86) 같음† → mhz19 카드로 처리 가능**, 별칭만 추가하면 됨 |
| [WINSEN] MH711A NDIR CO2 SENSOR | https://eleparts.co.kr/goods/view?no=4302295 | MH711A | 미확인 (UART/아날로그†) | CO2 ppm | CO2 측정 |
| [디웰전자] CO2센서 CM1108 | https://eleparts.co.kr/goods/view?no=4088246 | Cubic CM1108 | UART / I2C† | CO2 ppm | CO2 측정 (국내 유통 많음) |
| [Amphenol Advanced Sensors] T6615 | https://www.eleparts.co.kr/goods/view?no=1082970 | Telaire T6615 | UART† | CO2 ppm | CO2 측정 |
| [econarae] [COZIR-AH5000]CO2센서모듈 · [Gas Sensing Solutions] COZIR-AH-1 · COZIR-AH-E-1 · SPRINTIR-WF-20 · EXPLORIR-M-E-100 | https://www.eleparts.co.kr/goods/view?epx=EPXCPRTW · https://eleparts.co.kr/goods/view?no=8779818 · https://eleparts.co.kr/goods/view?no=10382102 · https://eleparts.co.kr/goods/view?no=8779838 · https://eleparts.co.kr/goods/view?no=10382103 | GSS COZIR/SprintIR/ExplorIR (LED NDIR) | UART (3.3 V, ASCII 명령†) | CO2 ppm (SprintIR 20 Hz 고속†) | 광합성·호흡. SprintIR는 빠른 응답 — 반응 속도 실험에 유리. 고가 |
| [WINSEN] MQ-6 반도체식 LPG가스센서 | https://eleparts.co.kr/goods/view?no=3175830 | MQ-6 (센서 단품) | A (회로 필요) | LPG·부탄 상대값 | 부탄가스 감지(정성) |
| [WINSEN] MQ137 반도체식 암모니아가스센서 | https://eleparts.co.kr/goods/view?no=3175812 | MQ137 (단품) | A | NH3 상대값 | 화학: 암모니아 발생(염화암모늄+수산화칼슘) 정성 — 쓸모 있음 |
| [WINSEN] MQ138 반도체식 VOC가스센서 | https://eleparts.co.kr/goods/view?no=3175825 | MQ138 (단품) | A | VOC(알데하이드·아세톤 등) 상대값 | 휘발성 유기물 정성 |
| [WINSEN] FC-22 가스센서보드 | https://eleparts.co.kr/goods/view?no=3206184 | MQ 소켓용 보드(LM393) | A (+D1) | — | MQ 단품을 모듈처럼 쓰는 기판. MQ-6/137/138은 이 보드와 같이 쓰면 기존 MQ 카드 패턴으로 등록 가능 |

### 1-4. 미세먼지

| 상품명 | URL | 칩 | 통신 | 측정량·단위 | 학교 활용 |
|---|---|---|---|---|---|
| [Honeywell] HPMA115C0-003 | https://eleparts.co.kr/goods/view?no=8981572 | HPMA115C0 | UART (자체 명령†) | PM2.5·PM10 µg/m³ | 미세먼지. PMS 프로토콜과 다름 |

### 1-5. 빛 (조도·UV·분광)

| 상품명 | URL | 칩 | 통신 | 측정량·단위 | 학교 활용 |
|---|---|---|---|---|---|
| [DFRobot] [SEN0364] 11채널 가시광선 센서 AS7341 11-Channel Visible Light Sensor | https://www.eleparts.co.kr/goods/catalog?code=001700310002 (카탈로그 목록) | AS7341 | I2C (0x39†) | 415~680 nm 8채널 + Clear + NIR, 상대 세기 | **화학 핵심 후보**: 간이 분광광도계, 흡광도·비어-람베르트, 지시약 색 — 강력 추천 |
| [ADAFRUIT] 4831 "STEMMA QT LTR390 ALS UV SENSOR" | https://eleparts.co.kr/goods/catalog?code=001700310002 (카탈로그 목록) | LTR-390UV | I2C (0x53†), Qwiic | UV 지수, 주변광 lx | 자외선 차단제 비교(UV 지수로 정량) — 추천 |
| [Waveshare] 자외선 센서 UV Sensor (B) "Ultraviolet Sensor, I2C Interface, UV Index Value Output" | https://www.eleparts.co.kr/goods/catalog?code=001700310002 (카탈로그 목록) | 칩 미표기 (Waveshare 자료상 LTR390 계열로 알려짐, 미확인) | I2C | UV 지수 | 위와 같음 |
| [ADAFRUIT] 4162 "STEMMA QT VEML7700 SENSOR" | https://eleparts.co.kr/goods/catalog?code=001700310002 (카탈로그 목록) | VEML7700 | I2C (0x10†), Qwiic | 조도 lx (0~120k lx†) | 광합성 광량, 빛 세기 역제곱 |
| [Waveshare] 자외선 센서 UV Sensor (WVS-9537) | https://www.eleparts.co.kr/goods/view?no=3020576 | 칩 미표기 | A (AOUT, 3.3~5 V) | UV 상대값, 응답 200~370 nm | 기존 uv(GUVA) 카드 방식으로 대응 가능(보정식 다름) |
| [Parallax] 28091 "SENSOR OPT UV MODULE, 광학 센서 자외선(UV) 아날로그 모듈" | https://www.eleparts.co.kr/goods/view?no=8427349 | 칩 미표기 | A | UV 상대값 | 위와 같음 |
| [온시스텍] [OSTSen-THL100] 온습도, 조도 센서 모듈 | https://eleparts.co.kr/goods/view?no=4064052 | 칩 미표기 | UART | 온도·습도·조도 (범위 미표기) | 칩·프로토콜 미상이라 보류 |
| [Inolux] IN-S32GTLS (주변광센서) · [ROHM] BH1790GLC-E2 (PPG) · [TI] OPT3101RHFR (ToF AFE) | https://eleparts.co.kr/goods/view?no=8427070 · https://eleparts.co.kr/goods/view?no=6215731 · https://eleparts.co.kr/goods/view?no=8509119 | IC 단품 | — | — | 부품이라 제외 권장 |

### 1-6. 거리·속도

| 상품명 | URL | 칩 | 통신 | 측정량·단위 | 학교 활용 |
|---|---|---|---|---|---|
| [Waveshare] 거리 측정 센서 VL53L1X Distance Sensor · [온시스텍] [OSTSen-53L1X] VL53L1X ToF 레이저 거리 측정 센서 모듈 | https://www.eleparts.co.kr/goods/view?no=6503479 · https://eleparts.co.kr/goods/brand?code=3679&iframe=&page=1&popup= | VL53L1X (VL53L0X와 레지스터 다름) | I2C (0x29†) | 거리 mm, 최대 4 m, 50 Hz (상품 설명) | 운동 분석(카트·낙하) — VL53L0X보다 길고 빠름, 추천 |
| [DFRobot] [SEN0340] 거리 측정 라이다 센서-TF-Luna · [Benewake] TF Luna I2C · [Waveshare] TF-Luna LiDAR Range Sensor | https://eleparts.co.kr/goods/view?no=9621253 · https://www.eleparts.co.kr/goods/catalog?code=000500350009 | Benewake TF-Luna | UART (115200) 또는 I2C (0x10†) | 거리 cm, 0.2~8 m† | 긴 거리 운동 분석 |
| [Benewake] TFmini-S LiDAR Module · [Waveshare] TFmini Plus / TFmini-S / TFmini-i | https://www.eleparts.co.kr/goods/catalog?code=000500350009 | TFmini 계열 | UART (TF-Luna와 같은 9바이트 프레임†) | 거리 cm, 0.1~12 m† | 위와 같음 |
| [DFRobot] [SEN0588] SDM15 · [SEN0586] LPB40B · [SEN0587] LPB60B (UART) · [Terabee] TR-EVO-40M-I2C | https://www.eleparts.co.kr/goods/catalog?code=000500350009 | 각 제조사 | UART / I2C | 거리 (15 m, 0.05~40 m, 0.05~60 m — 상품명) | 심화. 우선순위 낮음 |
| [MaxBotix] MB7388-100 | https://eleparts.co.kr/goods/view?no=8114246 | MaxBotix HRXL (방수 초음파) | A / 펄스폭 / UART† | 거리 mm, 최대 5 m† | 실외 거리, 수위 |
| [네오틱스] 초음파사용 물체감지 및 거리측정 센서 모듈 ( NS-USDM ) | https://www.eleparts.co.kr/goods/view?no=7540885 | 칩·통신 미표기 | 미확인 | 거리 | 보류 |
| [OmniPreSense] OPS7243-C-FC-R2 (거리측정센서 분류) | https://eleparts.co.kr/goods/view?no=10079799 | 24 GHz 도플러 레이더† | UART/USB† | 속도 m/s† | 물리: 공 속도·운동(심화). 페이지 사양 미확인 |
| [한진데이타] 아두이노 호환 풍속센서(P2531-1) | https://eleparts.co.kr/goods/view?no=3344802 | 칩 미표기 (컵 풍속계) | 펄스·주파수 (5 V) | 풍속 m/s, 0~45 m/s; 풍속 = 0.062 × 주파수 + 0.578 (상품 페이지) | 지구과학: 기상 관측 — 주파수 입력만 있으면 쉬움, 추천 |

### 1-7. 움직임·자기

| 상품명 | URL | 칩 | 통신 | 측정량·단위 | 학교 활용 |
|---|---|---|---|---|---|
| [온시스텍] [OSTSen-B055] BNO055 9축 가속도/자이로/지자기 IMU 모듈 | https://eleparts.co.kr/EPXJ3XV4 | BNO055 | I2C (0x28/0x29†) | 가속도 m/s², 각속도 °/s, 자기 µT, 자세각 ° (내장 융합) | 회전·진자 각도 — 각도를 바로 줌, 추천 |
| [온시스텍] [OSTSen-20649] ICM-20649 6축 가속도/자이로 센서 모듈 | https://eleparts.co.kr/goods/brand?code=3679&iframe=&page=2&popup= | ICM-20649 (뱅크 레지스터, MPU6050과 다름) | I2C (0x68/0x69†) | 가속도 ±30 g†, 각속도 | 충돌·충격(고 g) |
| [DFRobot] SEN0250 | https://eleparts.co.kr/goods/view?no=6907407 | 페이지 빈 응답 — DFRobot 번호상 BMI160 6축† (미확인) | I2C (0x68/0x69†) | 가속도·각속도 | 확인 후 등록 |
| [Waveshare] 센서보드 LSM303DLHC Board | https://www.eleparts.co.kr/goods/catalog?code=001700310002 (카탈로그 목록) | LSM303DLHC | I2C (가속도 0x19, 자기 0x1E†) | 가속도 g, 자기 gauss | 자기장·기울기 |
| [Waveshare] 센서보드 L3G4200D Board | 위 카탈로그 목록 | L3G4200D | I2C / SPI | 각속도 °/s | 회전 운동 |
| [STMicroelectronics] L3GD20TR 등 (가속도센서 분류) | https://www.eleparts.co.kr/goods/catalog?code=000500520009 | L3GD20, LIS2HH12, LIS2DTW12, MEMSIC MC34xx·MXC 등 | IC 단품 | — | 부품이라 제외 |
| [SparkFun] SEN-17241 (ADXL313 Breakout) | https://eleparts.co.kr/goods/view?no=9876271 | ADXL313 | I2C (0x1D/0x53†), Qwiic | 가속도 ±4 g, 13비트 (상품 페이지) | 저잡음 기울기·진동 |
| [DIGILENT] 410-255 "ADXL362 Accelerometer Sensor Development Tool" | 위 카탈로그 목록 | ADXL362 | SPI | 가속도 g | SPI 전용, 우선순위 낮음 |
| [LK임베디드] 아두이노 센서 MAG3110 | https://www.eleparts.co.kr/goods/catalog?code=000500520009 (목록) | MAG3110 | I2C (0x0E†) | 자기장 µT (3축) | 자기장·전류 주위 자기장 |
| [마이센] [P0-MAA-00-01] 3축 아날로그 지자기센서 모듈 | https://www.eleparts.co.kr/goods/view?no=4464 | 칩 미표기 | A (3채널) | 자기장 3축 상대값 | 자기장 세기 아날로그 측정 — 선형 홀 대체 후보 |
| [위드로봇] Biscuit WIFI 관성센서 · [울랄라랩] 3축 진동센서 | 위 가속도 카탈로그 | 완제품 | Wi-Fi 등 | — | 아두이노 연결형 아님 |

### 1-8. 전기

| 상품명 | URL | 칩 | 통신 | 측정량·단위 | 학교 활용 |
|---|---|---|---|---|---|
| [LK임베디드] 아두이노 센서 ZMCT103C 교류 AC 전류 측정 5A B185 | https://eleparts.co.kr/goods/view?no=8107693 | ZMCT103C (전류 변류기) | A | 교류 전류 A (최대 5 A) | 교사 시연(가전 전류). 학생 실험엔 비추천 |
| [ACEINNA] EVB MCR1101 / MCA1101 / MCR2101 | 위 센서/통신 카탈로그 | ACEINNA 전류 센서 | A† | 전류 A | 평가보드, 우선순위 낮음 |

### 1-9. 생체

| 상품명 | URL | 칩 | 통신 | 측정량·단위 | 학교 활용 |
|---|---|---|---|---|---|
| [SparkFun] SEN-15219 "SparkFun Pulse Oximeter and Heart Rate Sensor" | https://eleparts.co.kr/goods/view?no=8236399 | MAX32664(허브) + MAX30101 | I2C (0x55†) + 리셋·MFIO 핀 | 심박 BPM, SpO2 % (허브가 계산) | 생명과학: 운동 전후 심박 — BPM을 바로 얻음 |
| [SEEED] 그로브 심박수 측정 센서 Grove - Ear-clip Heart Rate Sensor | https://eleparts.co.kr/goods/view?no=7652501 | 귀 클립 광센서 | D1 (박동마다 펄스†) | 박동 → BPM 계산 | 심박 측정(기존 pulse는 아날로그 파형이라 방식 다름) |

---

### 2. 데이터 센서가 아닌 것 (제외)

- 제스처: [DFRobot] [SEN0315] PAJ7620U2 Gesture Sensor, [SEEED] Grove - Gesture
- 터치·버튼: [DFRobot] [DFR0030] 디지털 접촉식 터치센서, [SEEED] Grove - Touch Sensor, Grove - I2C 터치 센서, [ADAFRUIT] 1375 AT42QT1012, [온시스텍] [OSTSen-BTN100] 푸쉬 버튼 센서 모듈
- 조이스틱·입력: [DFRobot] [DFR0061] 아날로그 조이스틱, [ShenzenAV] Joystick Module, [SEEED] Grove - Mini Track Ball
- 적외선 리모컨 수신: [LK임베디드] 아두이노 적외선 TV리모콘 수신모듈 LE20
- GPS: [SparkFun] GPS-18774
- 액추에이터·기타: [SEEED] Grove - Water Atomization(초음파 가습기), [LK임베디드] 센서 릴레이 조도 감지 C61(릴레이 보드), [네오틱스] NC-DVDM 전압 표시 모듈(표시기), [Devantech] USB I2C Interface Module, [SparkFun] 08891 GAS SENSOR BREAKOUT BOARD(MQ용 빈 기판)
- 움직임 감지(켜짐·꺼짐만, 측정값 아님): [DFRobot] [SEN0192] 마이크로웨이브 모션 센서, [DFRobot] [SEN0018] 디지털 적외선 물체 감지 센서, [SEEED] Grove - Magnetic Switch(리드 스위치) — 필요하면 기존 DOUT 카드로 처리 가능
- 레이더·360° 라이다·CAN 센서: RPLIDAR A1/C1, D500·D200·STL27L, 씨랩 E300, AIM24-SB 레이더 EVK, 로비텍 SONIC2CAN·GA2CAN·RGB2CAN, Banner PBB — 교실 데이터 기록용 아님
- 키트(개별 센서가 아님): 한진데이타 [P1357] 30종 센서키트, YFROBOT 28종 센서키트, 엘레파츠 아두이노 미세먼지센서 키트, Kocoafab 미세먼지 측정키트, Grove Smart Plant Care Kit, HX711 저울키트 5 kg/10 kg
- 완제품 측정기: Coms TDS 테스터기, IoT팝 스마트 온습도+조도 측정기, OMEGA EWS-TX

### 3. 엘레파츠에서 보였지만 이미 목록에 있는 것 (참고)

DS18B20(DFR0024·DFR0198), LM35(DFR0023), DHT11(DFR0067)·DHT22(Waveshare), SHT30(Adafruit 5064)·SHT41, BME280(보쉬 단품·Waveshare·SEN0236·OSTSen-E280), BMP280(Grove), MCP9808(Adafruit 1782·5027), Si7020(SI7021 호환), MQ-2/4/7/8/9(DFRobot·Winsen), PMS5003·PMS7003·PMS7003M·SEN0177(같은 Plantower 프로토콜), TCS34725(SEN0212), GUVA(SEN0162), TSL2591(Adafruit 1980), Grove Light Sensor(LDR), HC-SR04(ShenzenAV·Adafruit 3942), VL53L0X(OSTSen·Grove), MPU6050/6500/9150/9250(MPU6050 호환 레지스터 — 단 WHO_AM_I 값 다름: 6500=0x70, 9250=0x71†), GY-85·GY-87(ADXL345·HMC5883L·BMP180 조합), ADXL345(Adafruit 1231·한진 P0073-2·ShenzenAV)·ADXL343(ADXL345 호환), GY-61(ADXL335), LIS3DH(Adafruit 2809), MAX30101/30102(OSTSen), Pulse sensor(CJMCU), HX711·로드셀, ACS712(한진 P0302·Allegro), FSR 4채널 브릿지, 피에조(DFR0052), 진동(DFR0027·OSTSen-VIB100), 홀(DFR0033), PIR(SEN0171·Adafruit 4871·OSTSen-PIR100), 토양(SEN0114·SEN0193·Grove Moisture·OSTSen-MOS), 광전 수위(SEN0205), pH(SEN0161), 가변저항(Grove Rotary Angle), 무게(SEN0160).

확인 못 함(검색 한도): EC·TDS·탁도·DO·ORP DFRobot 모듈, 소리 센서, AD8232, EMG·GSR, 유량 센서, ENS160·SCD4x·SCD30·SGP30, BH1750, MLX90614, INA219/INA260, MAX6675/MAX31855/MAX31865, O2 센서(AO2 단품은 확인: https://www.eleparts.co.kr/goods/view?no=4432).


---

## 아이씨뱅큐(ICbanq) 센서 모듈 조사 — ChemDict Lab에 없는 센서

조사일: 2026-10-17 · 비교 기준: `current_parts.txt` (86종)

### 확인 방법과 한계
- 확인 방법: icbanq.com 도메인으로 한정한 웹검색을 약 60번 했다(한국어·영어 혼합). **아래 상품명과 URL은 모두 검색 결과에 실제로 나온 것이다.**
- WebFetch는 카테고리 1쪽(아두이노 호환 센서 > 온/습도, 18개 상품)만 열렸다. 그 뒤 페이지는 모두 `ROBOTS_DISALLOWED`로 막혔다. 그래서 상품 상세 스펙·가격·재고는 **전부 미확인**이다.
- 웹검색 한도(200회/턴, 에이전트 공유)를 다 써서 조사를 멈췄다. 사운드 레벨(SEN0232), I2S 마이크, VEML7700/LTR390, Modulino 단품은 **검색으로 확인하지 못했다**. Modulino 검색에서는 아이씨뱅큐 상품이 나오지 않았다.
- 칩·주소에 † 표시가 있으면 상품명에 칩이 없어서 제조사 데이터시트/제품 지식으로 적은 값이다. 실제 모듈로 확인해야 한다.
- "covered" 판정 기준: 같은 칩이거나 레지스터·프로토콜이 호환되는 칩이 목록에 있으면 제외했다(예: SHT35→sht3x, BMP085→bmp180, PMS5003→pms7003, MH-Z16→mhz19, JSN-SR04T→hcsr04).

통신 표기: A 아날로그 · D1 디지털 켜짐/꺼짐 · I2C(주소) · UART · SPI · 펄스/주파수 · RS485

---

### 1. 목록에 없는 센서 (아이씨뱅큐에서 확인)

### 1-1 온도
| 상품명(검색 결과 그대로) | URL | 칩 | 통신 | 측정량·단위 | 학교 활용 |
|---|---|---|---|---|---|
| [4821]Adafruit TMP117 ±0.1°C 고정밀 I2C 온도 센서 | https://www.icbanq.com/P013154122 | TMP117 | I2C(0x48~0x4B) | 온도 °C, ±0.1 °C | ★ 정밀 열량계, 어는점 내림, 중화열 |
| SparkFun 디지털 온도 센서 - TMP102(Qwiic) | https://www.icbanq.com/P013737175 | TMP102 | I2C(0x48~0x4B) | 온도 °C, ±0.5 °C† | 기본 온도(Qwiic 연결) |
| 열전대 앰프 MAX31855 브레이크 아웃 보드 (MAX6675 업그레이드) - v2.0 [269] · 아두이노 라즈베리파이 MAX31855K SPI Thermocouple Temperature Sensor | https://www.icbanq.com/P007533717 · https://www.icbanq.com/P007421215 | MAX31855K | SPI(읽기 전용 32비트, MAX6675와 형식 다름) | K형 −200~1350 °C† | ★ 불꽃·가열 (MAX6675보다 넓은 범위) |
| [3263]Adafruit 범용 열전쌍 증폭기 MAX31856 브레이크아웃 | https://www.icbanq.com/P013154271 · https://www.icbanq.com/P007536214 | MAX31856 | SPI | 열전대 B/E/J/K/N/R/S/T, °C | 고온(여러 열전대 종류) |
| [3328]Adafruit PT100 RTD 온도 센서 증폭기 - MAX31865 · [3648] PT1000 버전 · [3290] 백금 RTD 센서 PT100 3선 | https://www.icbanq.com/P013154300 · https://www.icbanq.com/P016320947 · https://www.icbanq.com/P013154301 · https://www.icbanq.com/P013154299 | MAX31865 | SPI | RTD 온도 °C, 약 0.03 °C 분해능† | ★ 정밀 열량계, 비열 |
| 온도센서 NTC 서미스터 모듈 | https://www.icbanq.com/P013990182 · https://www.icbanq.com/P014160039 | NTC 서미스터 | A (+D1) | 온도(β식 변환 필요) | 싼 온도 센서 ('raw'로는 측정 가능, 전용 변환식은 없음) |
| 그루브 고온 센서 Grove - High Temperature Sensor [111020002] | 카테고리 페이지에서 확인(P006196802) | K형 열전대 + OP앰프† | A | 고온 °C, −50~600 °C† | 가열 실험(아날로그) |
| 그루브 디지털 적외선 온도 센서 Grove - Digital Infrared Temperature Sensor [101020077] | 카테고리 페이지에서 확인(P006189668) | MLX90615† (MLX90614와 RAM 주소 다름) | I2C(0x5B)† | 물체·주변 온도 °C | 비접촉 온도 |
| 적외선온도센서모듈 (DTS-SIL300-B) · 온도 센서 모듈(DTS-M300) | https://www.icbanq.com/P002343136 · https://www.icbanq.com/P001252646 | 디웰 서모파일 모듈 | 미확인 (SPI†) | 비접촉 온도 °C | 비접촉 온도 |
| [3538]Adafruit AMG8833 IR 열화상 카메라 브레이크아웃 · AMG8833 열 화상 카메라 [3622] | https://www.icbanq.com/P013154346 · https://www.icbanq.com/P008174912 | AMG8833 | I2C(0x69/0x68) | 8×8 온도 배열 °C, 0~80 °C† | 발열·흡열 반응 열 분포 |
| [4469]Adafruit MLX90640 24x32 IR 열화상 카메라 브레이크아웃 · Grove - Thermal Imaging Camera MLX90640 [114020142] | https://www.icbanq.com/P013154348 · https://www.icbanq.com/P014005111 · https://www.icbanq.com/P013158396 | MLX90640 | I2C(0x33) | 32×24 온도 배열 °C | 열 분포 (UNO R4는 RAM 한계, 심화용) |
| 디지털 온도 및 습도 센서 (스테인레스 스틸 프로브 포함) [SEN0148] | https://www.icbanq.com/P005607911 | SHT1x† | 전용 2선 | 온도 °C, 습도 %RH | 용액 위 습도·온도 |
| 토양 온도/습도 센서 - SHT10 [1298] | https://www.icbanq.com/P007505370 | SHT10 | 전용 2선 | 온도 °C, 습도 %RH | 토양 온습도 |
| 4 ~20mA 아날로그 출력 온/습도 센서모듈(P5554) | https://www.icbanq.com/P013989853 | 미확인 | 4~20 mA (전류-전압 변환 필요) | 온도·습도 | 낮음 (산업용) |

### 1-2 습도
| 상품명 | URL | 칩 | 통신 | 측정량 | 활용 |
|---|---|---|---|---|---|
| Grove - 온도 및 습도 센서 (고정밀 및 소형) | https://www.icbanq.com/P005700448 | TH02† | I2C(0x40)† (HTU21D와 레지스터 다름) | 온도 °C, 습도 %RH | 증산·습도 |

### 1-3 기압·압력
| 상품명 | URL | 칩 | 통신 | 측정량 | 활용 |
|---|---|---|---|---|---|
| [4816]Adafruit BMP390 - 정밀 기압 및 고도계 | https://www.icbanq.com/P013152782 | BMP390 | I2C(0x77/0x76), SPI | 기압 hPa(±0.03 hPa 상대†), 온도 | ★ 기체 법칙, 고도 차이 기압 |
| Gravity: BMX160 + BMP388 10 DOF 센서 | https://www.icbanq.com/P010228804 | BMP388 + BMX160 | I2C | 기압 hPa, 가속도·자이로·지자기 | 기압+운동 |
| Grove - High Precision Barometric Pressure Sensor (DPS310) | https://www.icbanq.com/P010328209 | DPS310 | I2C(0x77/0x76) | 기압 hPa(±0.002 hPa 분해능†), 온도 | ★ 정밀 기압 |
| [SEN0517] Gravity: ICP-10111 압력 센서 (대기압, 온도 측정) | https://www.icbanq.com/P013130540 | ICP-10111 | I2C(0x63) | 기압 Pa, 온도 °C | 정밀 기압 |
| MPL115A2 - I2C 기압 / 온도 센서 [992] | 카테고리 페이지에서 확인(P007503680) | MPL115A2 | I2C(0x60) | 기압 kPa(50~115), 온도 | 기압(구형) |
| SparkFun 환경 센서 - BME688(Qwiic) | https://www.icbanq.com/P013737007 | BME688 | I2C(0x77/0x76) | 기압·온습도 + 가스저항 Ω | 기상 관측, VOC(정성) |
| 아날로그 수압 센서 (DFRobot) | https://www.icbanq.com/P012244796 | 압력 트랜스미터 (SEN0257†) | A (0.5~4.5 V†) | 액체 압력 MPa (0~1.6 MPa†) | 수압(물리), 해상도 낮음 |

### 1-4 기체
| 상품명 | URL | 칩 | 통신 | 측정량 | 활용 |
|---|---|---|---|---|---|
| MQ-5 아두이노 가스 센서 모듈 [SZH-SSBH-062] | https://www.icbanq.com/P008113571 | MQ-5 | A (+D1) | LPG·도시가스(상대값) | 연소 가스(정성) |
| MQ-6 아두이노 LPG/프로판 가스 센서 모듈 [SZH-SSBH-077] | https://www.icbanq.com/P008113608 | MQ-6 | A (+D1) | LPG·부탄(상대값) | 부탄가스(정성) |
| MQ137 암모니아 가스 감지 센서 | https://www.icbanq.com/P005699168 | MQ-137 (소자) | A (회로 필요) | NH3(상대값) | 암모니아 발생 반응 |
| MQ131 오존 가스 감지 센서(저농도) | https://www.icbanq.com/P005699164 | MQ-131 (소자) | A (회로 필요) | O3(상대값) | 오존(정성) |
| [SEN0321]중력: I2C 오존 센서(0-10ppm) | https://www.icbanq.com/P013130538 | 전기화학식 O3 | I2C(0x70~0x73)† | O3 ppm | 대기 오존 |
| 그래비티: MEMS 가스 센서(CO, 알코올, NO2 및 NH3) - I2C - MiCS-4514 | https://www.icbanq.com/P012842202 | MiCS-4514 | I2C(0x75)† | CO·NO2·NH3·에탄올(근사 ppm) | 연소 가스, 암모니아(정성) |
| 페르미온: MEMS 가스 센서 - MiCS-5524(브레이크아웃) | https://www.icbanq.com/P012842204 | MiCS-5524 | A | CO·에탄올·VOC(상대값) | 정성 |
| [101020820]Grove - Multichannel Gas Sensor v2 | https://www.icbanq.com/P013471327 | GM-102B/302B/502B/702B | I2C(0x08)† | NO2·C2H5OH·VOC·CO(상대값) | 정성 |
| [4829]Adafruit SGP40 공기질 센서 - VOC 지수 · [101021095]Grove - VOC Gas Sensor (SGP40) | https://www.icbanq.com/P013154582 · https://www.icbanq.com/P015430906 | SGP40 | I2C(0x59) | VOC 지수 0~500 | 휘발성 물질(정성) |
| Adafruit CCS811 Air Quality Sensor Breakout VOC and eCO2 [3566] | https://www.icbanq.com/P008114182 | CCS811 | I2C(0x5A/0x5B) | TVOC ppb, eCO2 ppm(추정) | 정성 (단종 칩) |
| Gravity: 포름알데히드 (HCHO) 센서 [SEN0231] | https://www.icbanq.com/P007999966 | 전기화학식 HCHO | UART·A† | HCHO ppm | 실내 공기질 |
| Gravity: 알코올 센서 (0-5ppm) | https://www.icbanq.com/P012834801 | 전기화학식 (SEN0376†) | I2C·UART† | 에탄올 ppm | 저농도 에탄올 |
| CO2센서 CM1108 | https://www.icbanq.com/P007486125 | Cubic CM1108 | UART/I2C† (MH-Z19 명령과 다름) | CO2 ppm | 광합성·호흡 |
| 이엘티센서 NDIR 이산화탄소(CO2)센서모듈 T-200(3V,5V) | https://www.icbanq.com/P013972726 | ELT T-200 | 미확인 | CO2 ppm | 광합성·호흡 (국산) |
| 이산화탄소(CO2) 측정 모듈 SH-NDC | https://www.icbanq.com/P008860325 | 미확인 | 미확인 | CO2 ppm | — |
| 이산화탄소센서 CWT-THLCO2-1 | https://www.icbanq.com/P016297309 | 미확인 | RS485† | CO2·온습도·조도† | 낮음 (산업용) |
| MC105 가연성 촉매가스 감지 센서 | https://www.icbanq.com/P005699176 | 촉매연소식 소자 | 브리지 회로 필요 | 가연성 가스 | 낮음 |

### 1-5 미세먼지
| 상품명 | URL | 칩 | 통신 | 측정량 | 활용 |
|---|---|---|---|---|---|
| 아두이노 GP2Y1014AU PM2.5 미세먼지센서 · SHARP GP2Y1010AU0F 먼지 측정 센서(HAM3403) | https://www.icbanq.com/P012835033 · https://www.icbanq.com/P008165315 | Sharp GP2Y1014AU / GP2Y1010AU0F | A (LED 펄스 구동 필요) | 먼지 mg/m³(근사) | 연기·먼지 비교 |
| 공기질 모니터(PM 2.5, 포름알데히드, 온습도 센서) [SEN0233] | https://www.icbanq.com/P008178843 | PMS5003ST† | UART (PMS7003 형식 + 추가 필드) | PM1/2.5/10 µg/m³, HCHO, 온습도 | 실내 공기질 (프레임 확장만 하면 됨) |
| 아두이노 I2C 미세먼지 간이 측정기 DSM101 | https://www.icbanq.com/P014971634 | DSM101 | I2C | PM µg/m³ | 학교 미세먼지 (환경부 성능인증 1등급) |
| 레이저 미세먼지 센서 PM1.0, PM 2.5, PM10 실시간출력 (2종) | https://www.icbanq.com/P011958747 · https://www.icbanq.com/P011958790 | 미확인 | UART† | PM µg/m³ | 미세먼지 |

### 1-6 빛·색
| 상품명 | URL | 칩 | 통신 | 측정량 | 활용 |
|---|---|---|---|---|---|
| Gravity : 아날로그 자외선 센서(ML8511) [SEN0175] · ML8511 UV Sensor 3.3/5V 공용 | https://www.icbanq.com/P005637364 · https://www.icbanq.com/P016052872 | ML8511 | A (1~2.8 V, GUVA와 변환식 다름) | UV 세기 mW/cm² | 자외선 차단제 비교 |
| TCS3200 컬러 센서 [SEN0101] · keyestudio TCS3200 · TCS3200-LZ (P0234) · 색상감지 GY-31 TCS3200 | https://www.icbanq.com/P005637345 · https://www.icbanq.com/P008202453 · https://www.icbanq.com/P005670200 · https://www.icbanq.com/P012835109 | TCS3200 | 펄스/주파수 (S0~S3 + OUT) | R·G·B 상대값(Hz) | 지시약 색 변화 (TCS34725 대안, 많이 팔림) |
| SparkFun Triad 분광기 센서 - AS7265x(Qwiic) | https://www.icbanq.com/P013736952 | AS72651/2/3 | I2C(0x49) | 410~940 nm 18채널 | ★ 간이 분광광도계, 흡광도 |
| SparkFun 스펙트럼 센서 브레이크아웃 - AS7263 NIR(Qwiic) | https://www.icbanq.com/P013736981 | AS7263 | I2C(0x49) | 610~860 nm 6채널 | 엽록소·식물 반사 |
| Adafruit 제스처, RGB 색상, 근접, 주변 광선 감지센서 [APDS9960] [3595] | https://www.icbanq.com/P008165743 | APDS-9960 | I2C(0x39) | RGBC·근접 | 간이 색·근접 |
| 주변 조도 센서(0-200klx) (DFRobot) | https://www.icbanq.com/P012834731 | 미확인 (SEN0390†) | I2C† | 조도 lx, 0~200 klx | 야외 직사광 (BH1750은 65 klx에서 포화) |
| 조도 센서 모듈 [Digital Ambient Light Sensor Module] | https://www.icbanq.com/P012842134 | 미확인 | 미확인 | 조도 | — |

### 1-7 거리
| 상품명 | URL | 칩 | 통신 | 측정량 | 활용 |
|---|---|---|---|---|---|
| SparkFun ToF 거리 측정기 센서 - VL6180 · 페르미온: VL6180X · [3316]Adafruit VL6180X | https://www.icbanq.com/P013737185 · https://www.icbanq.com/P012834749 · https://www.icbanq.com/P013154308 · https://www.icbanq.com/P006176334 | VL6180X | I2C(0x29) | 거리 mm (0~100 mm†) + 조도 | 용수철 늘어남, 짧은 변위 |
| 레이저 거리 측정 센서 모듈 OSTSen-53L1X | https://www.icbanq.com/P011952703 | VL53L1X (VL53L0X와 레지스터 다름) | I2C(0x29) | 거리 mm, ~4 m† | ★ 운동 분석 |
| SparkFun Qwiic dToF 이미저 - TMF8820 | https://www.icbanq.com/P013737180 | TMF8820 | I2C(0x41) | 거리 mm(3×3 영역) | 심화 |
| Garmin LIDAR-Lite v4 LED - 거리 측정 센서(Qwiic) | https://www.icbanq.com/P013736362 | LIDAR-Lite v4 | I2C(0x62) | 거리 cm, ~10 m† | 긴 거리 운동 |
| TF-Luna (ToF) Micro Single-point Ranging LiDAR [SEN0340] | https://www.icbanq.com/P011442809 | TF-Luna | UART / I2C(0x10) | 거리 cm, 0.2~8 m | 긴 거리 운동 |
| TF Mini Plus(ToF) 레이저 거리 센서(12m) · TOF IR 거리 센서 (0.2~12m) · TFmini-i LiDAR | https://www.icbanq.com/P010412239 · https://www.icbanq.com/P012834899 · https://www.icbanq.com/P012842201 | Benewake TFmini 계열 | UART (TFmini-i는 RS485/CAN†) | 거리 cm, ~12 m | 긴 거리 운동 |
| 아두이노 센서 GP2Y0A21 IR 거리측정 C29 · 아두이노 SHARP 적외선 거리측정센서 4종 | https://www.icbanq.com/P008562136 · https://www.icbanq.com/P012835086 | Sharp GP2Y0A21 등 | A (비선형) | 거리 cm, 10~80 cm | 거리(변환식 필요) |
| A02YYUW Waterproof Ultrasonic Sensor | https://www.icbanq.com/P010372843 | A02YYUW | UART(9600) | 거리 mm, 3~450 cm† | 수위·거리 (방수) |
| URM37 V4.0 초음파 센서 [SEN0001] | https://www.icbanq.com/P006972591 | URM37 | UART / PWM / A† | 거리 cm + 온도 | 거리 |
| URM13 초음파 센서 (15-900cm) | https://www.icbanq.com/P012244808 | URM13 | I2C / UART / Trig† | 거리 cm | 긴 거리 |
| 레이저 거리 측정 센서 RS485 (4m) | https://www.icbanq.com/P012842126 | 미확인 | RS485 | 거리 | 낮음 |

### 1-8 움직임·자기·각도
| 상품명 | URL | 칩 | 통신 | 측정량 | 활용 |
|---|---|---|---|---|---|
| Adafruit 9-DOF 절대 방향 IMU BNO055 STEMMA QT [4646] · Fermion: BNO055 · Gravity: BNO055+BMP280 [SEN0253] · OSTSen-B055 | https://www.icbanq.com/P011856191 · https://www.icbanq.com/P013471445 · https://www.icbanq.com/P014061241 · https://www.icbanq.com/P008409213 | BNO055 | I2C(0x28/0x29) | 자세각 °, 가속도 m/s², 자이로, 지자기 | ★ 진자 각도·회전 (자세각을 칩이 계산) |
| Adafruit ICM-20948 9-DoF IMU (MPU-9250 업그레이드) [4554] | https://www.icbanq.com/P011857512 · https://www.icbanq.com/P016441378 | ICM-20948 (MPU9250과 레지스터 다름) | I2C(0x68/0x69) | 가속도·자이로·지자기 µT | 운동·자기장 |
| [101020584]Grove - 6-Axis Accelerometer&Gyroscope (BMI088) | https://www.icbanq.com/P014228418 | BMI088 | I2C(0x19/0x69)† | 가속도 ±24 g, 자이로 | 충돌·운동 |
| KEYES MMA8452Q 모듈 3축 디지털 가속 센서 | https://www.icbanq.com/P008109716 | MMA8452Q | I2C(0x1C/0x1D) | 가속도 ±2~8 g | 운동 |
| MinIMU-9 v3 (L3GD20H 및 LSM303D 캐리어) | https://www.icbanq.com/P005713918 | LSM303D + L3GD20H | I2C | 가속도·지자기·자이로 | 운동·방위 |
| LIS3MDL 3축 지자기 센서 모듈 · [4517]LSM6DSOX + LIS3MDL 9 DoF · ISM330DHCX + LIS3MDL 페더윙 | https://www.icbanq.com/P007324712 · https://www.icbanq.com/P013156291 · https://www.icbanq.com/P011851052 | LIS3MDL (+LSM6DSOX/ISM330DHCX) | I2C(0x1C/0x1E) | 자기장 µT, ±4~16 gauss | ★ 전류 주위 자기장, 코일 |
| BMM150 지자기 센서 | https://www.icbanq.com/P007324889 | BMM150 | I2C(0x10~0x13) | 자기장 µT | 자기장 |
| SparkFun Linear 3D Hall-Effect Sensor - TMAG5273 (Qwiic) | https://www.icbanq.com/P016014947 | TMAG5273 | I2C(0x22/0x35) | 3축 자기장 mT, ±40/80 mT† | ★ 자석·코일 자기장 세기 (지자기 센서보다 넓은 범위) |
| 3축 아날로그 지자기 센서모듈(P0-MMA-00-01) | https://www.icbanq.com/P000524117 | 미확인 | A | 자기장 | — |
| MG910 Linear GaAs 홀센서 | https://www.icbanq.com/P009234415 | MG910 (소자) | A (증폭 필요) | 자기장 | 낮음 |
| [101020692]Grove - 12-bit Magnetic Rotary Position Sensor / Encoder (AS5600) | https://www.icbanq.com/P013158384 | AS5600 | I2C(0x36) / A | 회전각 ° (12비트) | ★ 진자 각도, 회전 운동 |
| Gravity: 360도 홀 각도 센서 [SEN0221] | https://www.icbanq.com/P007531483 | 미확인 | A | 회전각 ° | 진자 각도 |
| 베리IMU 라즈베리 가속도, 자이로, 지자계, 대기압고도 센서 | https://www.icbanq.com/P007402127 | 미확인 (판에 따라 다름) | I2C | 9축 + 기압 | — |

### 1-9 힘·무게
| 상품명 | URL | 칩 | 통신 | 측정량 | 활용 |
|---|---|---|---|---|---|
| SparkFun Qwiic 스케일 - NAU7802 · [4538]Adafruit NAU7802 24-Bit ADC | https://www.icbanq.com/P013736967 · https://www.icbanq.com/P013158966 | NAU7802 | I2C(0x2A) | 로드셀 → 질량 g | ★ 질량 변화 (Qwiic, HX711 대안) |
| Gravity: I2C 1kg 무게 센서 키트 - HX711 | https://www.icbanq.com/P012834753 · https://www.icbanq.com/P012842024 | HX711 + 내장 MCU (일반 HX711 2선과 다름) | I2C(0x64)† | 질량 g, 1 kg | 질량 변화 |

### 1-10 유량
| 상품명 | URL | 칩 | 통신 | 측정량 | 활용 |
|---|---|---|---|---|---|
| 물 유량 센서 G1/4 [314150002] · G3/4 [314150003] · G1/8 [314150001] (Seeed) · Gravity: Liquid Flow Sensor (G1/4) | https://www.icbanq.com/P005700542 · https://www.icbanq.com/P005700546 · https://www.icbanq.com/P005700549 · https://www.icbanq.com/P013472795 | 홀 효과 터빈 | 펄스/주파수 | 유량 L/min | 유속·유량 (물리) — **목록에 유량 센서가 없음** |

### 1-11 전기
| 상품명 | URL | 칩 | 통신 | 측정량 | 활용 |
|---|---|---|---|---|---|
| ADS1115 16Bit ADC 모듈 (JK전자) · Gravity: I2C ADS1115 (DFR0553) · Grove 4채널 16비트 ADC(ADS1115) · Adafruit ADS1115 [1085] | https://www.icbanq.com/P015770214 · https://www.icbanq.com/P008341827 · https://www.icbanq.com/P011450210 · https://www.icbanq.com/P005710067 | ADS1115 | I2C(0x48~0x4B) | 전압 mV, 16비트, 차동 입력 | ★ 화학 전지 기전력·농담 전지(mV 정밀), 음수 전압 |
| 아날로그 AC 전류 센서 / Gravity: Analog AC Current Sensor [SEN0211] | https://www.icbanq.com/P007317751 | CT + 변환 회로 | A | 교류 전류 A | 교사 시연 |
| 전류센서(비접촉) TESN35A · TD30A-LTC2 · TMF1000A | https://www.icbanq.com/P005044159 · https://www.icbanq.com/P005044157 · https://www.icbanq.com/P005044158 | CT | A | 교류 전류 | 낮음 |
| WCS2702(전류센서) | https://www.icbanq.com/P001252598 | WCS2702 (홀) | A | 전류 A | 낮음 |
| [SEN0262] Gravity: 아날로그 전류-전압 변환기(4~20mA) | https://www.icbanq.com/P013130480 | 변환기 | A | 4~20 mA → V | 산업용 센서 연결용 |

### 1-12 물·토양
| 상품명 | URL | 칩 | 통신 | 측정량 | 활용 |
|---|---|---|---|---|---|
| 12인치 표준 eTape 액체 레벨 센서 [2656] | https://www.icbanq.com/P007528482 | eTape (저항식) | A | 수위 (연속값) | 수위 변화·증발 (연속) |
| 액체 레벨 센서 [314990619] (Seeed) | https://www.icbanq.com/P011450901 | 미확인 | 미확인 | 수위 | — |
| 비접촉 유연한 액체 레벨 센서 | https://www.icbanq.com/P013048588 | 미확인 | 미확인 | 수위 | — |
| CWT-BL Water EC/TDS sensor | https://www.icbanq.com/P016297214 | 미확인 | RS485† | EC·TDS | 낮음 |
| 산업 토양 수분·온도·EC 센서 MODBUS-RTU RS485 (S-Soil MTEC-02A) · DFRobot RS485 Soil EC and pH · 4-in-1 Soil Moisture, Temperature, pH EC · RS485 Soil Temperature and Moisture · CWT-SOIL-NPKTHC-S | https://www.icbanq.com/P011565751 · https://www.icbanq.com/P016086635 · https://www.icbanq.com/P016086636 · https://www.icbanq.com/P016069430 · https://www.icbanq.com/P016292724 | 산업용 프로브 | RS485 Modbus-RTU (UNO R4에 RS485 변환 모듈 필요) | 토양 수분 %, 온도, EC, pH, N·P·K | 지구과학·생명 (준비가 많아 목표와 충돌) |

### 1-13 생체
| 상품명 | URL | 칩 | 통신 | 측정량 | 활용 |
|---|---|---|---|---|---|
| 그루브 손가락 심박 센서 Grove - Finger-clip Heart Rate Sensor with shell [101020082] | https://www.icbanq.com/P005716572 | PAH8001 + MCU† | I2C(0x50)† | 심박 BPM | 운동 전후 심박 |
| 그루브 심박 센서 Grove - Ear-clip Heart Rate Sensor [101020033] | https://www.icbanq.com/P006960921 | 귀 클립 PPG | D1 펄스 (박동마다 1번) | 심박 BPM (펄스 세기) | 심박 |
| 심박측정 초급자 교육용 팩, 폴라 무선 센서 [1077] | https://www.icbanq.com/P007503980 | Polar 수신기 | D1 펄스 | 심박 BPM | 운동 중 심박 (무선) |
| [SEN0518] Gravity: MAX30102 심박수 및 산소 농도계 센서 | https://www.icbanq.com/P013130549 | MAX30102 + MCU† (원시 MAX30102 레지스터 아님†) | I2C(0x57)† | BPM, SpO2 % | 확인 필요 — 펌웨어가 원시 레지스터를 읽으면 안 맞을 수 있음 |
| MyoWare 근육 센서 [2699] | https://www.icbanq.com/P007504053 | MyoWare | A (포락선) | 근전도 | emg와 비슷 (출력 형태만 확인) |

---

### 2. 이미 목록에 있는 것 (아이씨뱅큐에서 판매 확인, 참고)
DS18B20(KIT0021·DFR0024 등), LM35, DHT11/DHT22(DFR0067·SEN0137), SHT31(Grove 101020212·Adafruit 2857·P4422-3 SHT30), SHT35(SEN0333→sht3x), AHT20/DHT20(5183·4566·Gravity DHT20), HTU21D, BME280(Grove 101020193·SEN0236), BMP280(Adafruit 2651·SEN0372), Grove Barometer(BMP085→bmp180), SCD41(SEN0536), SEN0219, MG811(SEN0159), Grove CO2(MH-Z16→mhz19 프로토콜), O2 I2C(SEN0322), SGP30(Adafruit 3709), PM2.5 SEN0177(PMS5003→pms7003), MQ-2/3/4/8/9/135, BH1750(SEN0097·GY-302), TSL2591(1980), TCS34725(1334·SEN0212·KS0407), GUVA(Grove UV·Analog UV V2), VL53L0X(SEN0245·Grove 101020532), SEN0207 방수 초음파(트리거·에코), MPU6050(3886·OSTSen-6050), ADXL345, LIS3DH(2809), HMC5883L, Grove 3-Axis Compass(HMC5883L†), INA219(904 외), ACS712 5/20/30A(감도만 다름), 전압 분압 모듈(SZH-SSBH-043·DFR0051), HX711(여러 종·SEN0160), FSR(Grove FSR402), pH(SEN0169-V2·SEN0249), EC(SEN0451 K=1·DFR0300-H K=10*), TDS, 탁도(SEN0189·Grove), ORP(Grove 501Z), DO(SEN0237-A), 정전식 토양(SEN0193·Grove), 비접촉 수위(SEN0204·D1), 맥박 센서, MAX30102(Keyestudio·HAM1817-2·OSTSen-30102), ECG(SEN0213), EMG(SEN0240), GSR(Grove), 사운드(LM393·KB40), 피에조(Grove), 흔들림(Gravity Shake·D1), 홀 D1(Grove·SEN0185·keyestudio), 가변저항(DFR0054·DFR0058·Grove Rotary).
\* EC K=10 프로브는 측정 범위가 달라 셀 상수 선택 옵션이 있으면 좋다.

### 3. 제외 (데이터 센서가 아님)
- 음성인식 모듈: 아두이노 보이스 음성인식 모듈 https://www.icbanq.com/P012835031
- 조이스틱: 아두이노 5핀 조이스틱 모듈 https://www.icbanq.com/P012835112
- 제스처: Grove - Gesture [101020083] https://www.icbanq.com/P006161499 (APDS9960은 RGB 때문에 1-6에 넣음)
- GPS: Adafruit Mini GPS PA1010D [4415] https://www.icbanq.com/P013154176
- NFC/RFID: Gravity UART 및 I2C NFC 모듈 https://www.icbanq.com/P010412240
- 적외선 리모컨 수신기: Grove - Infrared Receiver https://www.icbanq.com/P006960961
- 입력 장치: 로터리 엔코더(스위치 포함) https://www.icbanq.com/P006963592 · Adafruit 로터리 엔코더 [377] https://www.icbanq.com/P013152525 · 자기접점스위치(도어센서) https://www.icbanq.com/P013154262
- 완제품 계측기·컨트롤러: TESTO 300 연소가스 분석기 https://www.icbanq.com/P016203367 · Coms 디지털 조도계 https://www.icbanq.com/P013036926 · CO2 온습도 컨트롤러 SH-VT200C https://www.icbanq.com/P005534028 · 코코아팹 미세먼지측정키트 https://www.icbanq.com/P013148887
- 부속품: I2C 허브(Grove TCA9548A), Qwiic/Gravity 케이블, ECG 전극(FIT0510), EMG 전극(2773), 1602 LCD, PLC 모듈, Grove MOSFET
- 폼팩터 불일치: Xadow - UV Sensor https://www.icbanq.com/P005609844 (Xadow 전용 커넥터)


---

## 메카솔루션 센서 모듈 조사 (ChemDict Lab 등록 후보)

조사일: 2026-10-17 · 비교 기준: current_parts.txt (86종)

### 확인 방법과 한계

- 상품 목록(`goods_list.php?cateCd=...`)은 JS로 불러와 WebFetch 응답에 상품이 없음. 상품 페이지(`goods_view.php?goodsNo=`)는 열리지만 **제목만 있고 스펙·가격·칩 정보는 없음** (3건 시도).
- 그래서 **판매 여부는 mechasolution.com 한정 웹검색 결과의 상품 제목·URL로만 확인**. 아래 상품명·URL은 모두 검색 결과에 실제로 나온 것.
- 칩·통신·범위는 상품 제목에 적힌 것 + 칩 데이터시트 기준(†). 제목에 칩이 없어 추정한 것은 **(추정)** 표시.
- 검색 인덱스가 얕음: 약 60회 검색에서 같은 상품이 반복 노출. BME280·BMP280·SHT3x·SCD4x·SGP30·PMS·BH1750·INA219·VL53L1X·MAX30102 등은 검색에 **안 나옴** (판매 안 함이 아니라 '확인 못 함'). 검색 한도에 걸려 추가 조사 중단.
- 사이트의 센서 카테고리(참고): 온도/습도 129003, 고도/대기압/수압 129008, 빛 129004, 미세먼지 129005, 진동 129006, 휨 129007, UV 129009, 가속도/자이로/지자기 129014, 적외선 거리/라이다 129015, 초음파 129016, 로드셀 129017, 수분/유량/수위 129018, 생체 129024, 전류/전압 129025, 가스/산소 129026, 수질/PH 129033, 압력/FSR 129028, 불꽃 129030, 바람/풍속 129034, 레이더 129039.

통신 표기: A 아날로그 / D1 디지털 켜짐·꺼짐 / I2C(주소) / UART / SPI / 1-Wire / 펄스

---

### 1. 현재 목록에 없는 센서 (메카솔루션에서 확인)

| # | 상품명 (검색 결과 그대로) | URL | 칩 | 통신 | 측정량·단위 | 학교 과학 활용 |
|---|---|---|---|---|---|---|
| N1 | 써모커플 앰프 MAX31855 (Thermocouple Amplifier MAX31855 breakout board (MAX6675 upgrade) - v2.0) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=6947 | MAX31855K | SPI (읽기 전용 32비트, MAX6675와 형식 다름) | K형 열전대 −200~1350 °C, 0.25 °C 분해능† + 냉접점 온도 | **높음** (화학: 연소·고온 가열). MAX6675 대체·상위 |
| N2 | Grove 고온 측정센서 / 온도센서 /써모커플 (Grove - High Temperature Sensor) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=245813 | K형 열전대 + OPA333 증폭(†, Seeed 위키) + 냉접점 서미스터 | A 2채널 (열전대·주위온도) | 고온 °C (−50~600 °C†) | 중간 (Grove 사용 학교). AD8495와 변환식 다름 |
| N3 | 고온 온도측정센서 PT100 / Platinum RTD Sensor - PT100 - 3 Wire 1 meter long | https://www.mechasolution.com/goods/goods_view.php?goodsNo=537839 | PT100 프로브 (증폭기 아님) | MAX31865 등 RTD 앰프 필요 (SPI) — **메카솔루션에서 MAX31865 모듈은 검색에 안 나옴** | °C 정밀 | 중간 (정밀 열량·어는점). 앰프 없이는 쓸 수 없음 |
| N4 | 3435 NTC 10K SMD 필름형 온도센서 | https://www.mechasolution.com/goods/goods_view.php?goodsNo=598080 | NTC 10 kΩ, B=3435 | A (분압 저항 필요) | °C (B식 변환) | 중간 (저가·얇은 필름, 표면 온도). 'raw'로는 가능하나 전용 변환 없음 |
| N5 | 아두이노 먼지센서 / 미세먼지 / 미세먼지센서 GP2Y1014AU | https://www.mechasolution.com/goods/goods_view.php?goodsNo=541009 | Sharp GP2Y1014AU (GP2Y1010 후속) | A + LED 펄스 구동 1핀 (0.32 ms 펄스 후 0.28 ms에 샘플) | 먼지 농도 약 0.5 V/(0.1 mg/m³)† → mg/m³ (상대값) | 중간 (지구과학·환경: 연기·먼지 비교). 메카솔루션에서 검색된 유일한 먼지 센서 |
| N6 | 바람센서 (wind sensor) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=1353 | (추정) Modern Device Wind Sensor Rev.C (열선식) — 페이지에 스펙 없음 | A (추정) | 풍속 (상대값~m/s, 보정 필요) | 중간 (지구과학: 바람, 물리: 기류) |
| N7 | 6V 아날로그 풍속 바람센서 | https://www.mechasolution.com/goods/goods_view.php?goodsNo=578837 | 컵형 풍속계 (칩 없음, 제목상 6 V 아날로그) | A (전압 ∝ 풍속; 출력 범위 미확인, 5 V 넘는지 확인 필요) | 풍속 m/s | 중간~높음 (지구과학 기상 관측) |
| N8 | Gravity 고품질 360도 회전/각도감지 센서 / Gravity: 360 Degree Hall Angle Sensor | https://www.mechasolution.com/goods/goods_view.php?goodsNo=539461 | 홀 각도 IC (칩명 미확인; DFRobot SEN0221) | A (각도 ∝ 전압, †) | 각도 ° (0~360) | 중간 (물리: 진자 각도, 회전 운동) |
| N9 | AS5600 마그네틱 엔코더 센서 모듈 / 디스크 자석 포함 | https://www.mechasolution.com/goods/goods_view.php?goodsNo=605131 | AS5600 | I2C(0x36) (+ 아날로그/PWM 출력 핀†) | 각도 12비트 (0~360 °) | **높음** (물리: 진자 주기·각속도, 회전 관성). I2C 1개로 간단 |
| N10 | Gravity 아날로그 50A 전류측정센서 / ACS758 / Gravity: Analog 50A Current Sensor (AC/DC) [SEN0098] | https://www.mechasolution.com/goods/goods_view.php?goodsNo=539550 | ACS758 (50 A) | A (40 mV/A†) | 전류 A (AC/DC) | 낮음 (학교 실험 전류엔 너무 큼) |
| N11 | 전류센서 DC/AC 5A (SparkFun Low Current Sensor Breakout - ACS723) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=8390 | ACS723 (+ 증폭·영점 조절) | A (감도 조절식) | 전류 A (±5 A) | 중간 (ACS712와 감도가 달라 별도 변환 필요). 작은 전류는 INA219가 나음 |
| N12 | 4~30cm 아날로그 적외선 거리센서 (GP2Y0A41SK0F) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=542352 | Sharp GP2Y0A41SK0F | A (비선형, 거리 ∝ 1/V) | 거리 cm (4~30) | 중간 (물리: 짧은 운동·용수철). 변환식 필요 |
| N13 | ToF250 레이저 거리 센서 Laser Range Sensor (ToF10120 호환) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=584095 | ToF10120 호환 (내부 칩 미확인) | UART (+I2C 0x52†) | 거리 mm (~250 cm, 제목) | 중간 (운동 분석). VL53L0X와 프로토콜 다름 |
| N14 | [인디프로그] ToF sensor 거리 센서 | https://www.mechasolution.com/goods/goods_view.php?goodsNo=599527 | 미확인 (페이지에 스펙 없음) | 미확인 | 거리 | 미확인 — 등록 판단 불가 |
| N15 | [티원]아두이노 라이다 거리측정센서 TFmini-S LiDAR module (0.3~12m) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=582986 | Benewake TFmini-S | UART 115200 (I2C 전환 가능†) | 거리 cm (0.3~12 m, 제목) | 중간 (긴 거리 운동: 달리기·낙하). 가격 높음 |
| N16 | [티원]실외용 광 거리측정 센서 / 라이더 센서 / 라이다 센서 / TFmini Plus LiDAR(Short-range distance sensor) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=585662 | Benewake TFmini Plus | UART (TFmini-S와 같은 9바이트 프레임†) | 거리 cm (0.1~12 m†) | N15와 같은 드라이버로 처리 가능 |
| N17 | 마이크로비트 초음파 센서 / Sornar:bit 3V,5V / 거리측정, 초음파 | https://www.mechasolution.com/goods/goods_view.php?goodsNo=585993 | ELECFREAKS Sonar:bit (트리거·에코 1핀 공용) | 펄스 (1핀) | 거리 cm | 낮음 (HC-SR04와 원리 같으나 1핀 방식) |
| N18 | ICM-20948 모듈 / 9축 IMU(가속도, 자이로, 지자기) / MPU9250 대체품 / 정품 | https://www.mechasolution.com/goods/goods_view.php?goodsNo=604277 | ICM-20948 | I2C(0x68/0x69), WHO_AM_I 0xEA, 레지스터 뱅크 방식 → **MPU6050/9250과 호환 안 됨** | 가속도 g, 자이로 °/s, 지자기 µT | **높음** (물리: 운동·원운동; MPU9250 단종 대체) |
| N19 | [로버] Intelli Things iAHRS 센서 | https://www.mechasolution.com/goods/goods_view.php?goodsNo=599548 | iAHRS (자체 MCU 내장 AHRS) | UART (†, 제조사 자료) | 자세각 ° (롤·피치·요), 가속도 | 낮음 (고가·전문용) |
| N20 | Grove 3축 디지털 나침반 (Grove 3-Axis Digital Compass) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=586123 | 미확인 — Grove v1은 HMC5883L(현재 목록에 있음), v2는 BMM150(목록에 없음) | I2C (0x1E 또는 0x13†) | 자기장 µT | 중간. **버전 확인 필요** — v1이면 이미 지원 |
| N21 | INMP441 MEMS 마이크 | https://www.mechasolution.com/goods/goods_view.php?goodsNo=584752 | INMP441 | I2S (UNO R4 Arduino 코어에서 I2S 지원 불확실) | 소리 파형 (dBFS) | 낮음 (아날로그 마이크로 충분) |
| N22 | [티원] TRS-4001 24GHz 산업용 레이더 센서 / 속도측정, 과속탐지, 추돌방지 / 방수방진 / KC인증 | https://mechasolution.com/shop/goods/goods_view.php?goodsno=604954 | 24 GHz 도플러 레이더 (자체 모듈) | 미확인 (산업용; UART/RS-485 추정) | 속도 km/h | 낮음 (고가, 교사 시연용 정도) |
| N23 | [크래카] KV-M100 레이더센서 (장거리 차량 속도측정용) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=601066 | 레이더 모듈 | 미확인 | 차량 속도 | 낮음 |
| N24 | [크래카] X4M06 레이더 개발보드 (UWB Radar EV Board) | https://mechasolution.com/shop/goods/goods_view.php?goodsno=599957 | Novelda X4 UWB | USB/개발보드 | 거리·호흡 등 | 낮음 (개발보드) |
| N25 | [티원] 레이더 물체 감지 센서 모듈 - TRM-121A | https://www.mechasolution.com/goods/goods_view.php?goodsNo=585667 | 레이더 모듈 | 미확인 | 물체 감지(거리?) | 낮음 — 스펙 미확인 |
| N26 | 위치감지센서 5cm (SoftPot Membrane Potentiometer - 50mm) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=586263 | 막(멤브레인) 가변저항 | A (분압) | 위치 mm (0~50) | 낮음~중간 (현재 'pot'로 대체 가능, 보정만 다름) |
| N27 | 거리측정센서 15cm Sharp GP2Y0D815Z0F Digital Distance Sensor 15cm | https://www.mechasolution.com/goods/goods_view.php?goodsNo=8542 | Sharp GP2Y0D815Z0F | D1 (15 cm 안에 물체 있음/없음) | 켜짐·꺼짐 | 낮음 (DOUT 범용으로 이미 처리 가능, 포토게이트 대용) |

### 분석용 보조 부품 (센서는 아니지만 측정 정밀도를 높임)

| 상품명 | URL | 칩 | 통신 | 비고 |
|---|---|---|---|---|
| [CJMCU] ADS-1115 ADC 모듈 (ADS1115 16-Bit ADC - 4 Channel with Programmable Gain Amplifier) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=8567 | ADS1115 | I2C(0x48~0x4B) | 16비트·PGA → 화학 전지 mV, pH 전극 직결, 열전대 등 정밀 전압. **화학 실험에 가치 높음** |
| [CJMCU] 아두이노 4채널 ADC 아날로그 디지털 컨버터 / I2C 12bit (ADS1015) | https://mechasolution.com/goods/goods_view.php?goodsNo=330657 | ADS1015 | I2C(0x48~) | ADS1115와 레지스터 같음(분해능·속도만 다름) — 한 드라이버로 처리 가능 |
| ADC DAC 컨버터 모듈 / PCF8591 YL-40 AD/DA Converter Module | https://www.mechasolution.com/goods/goods_view.php?goodsNo=538476 | PCF8591 | I2C(0x48) | 8비트, UNO R4 내장 ADC(14비트)보다 낮음 → 필요 없음 |
| MCP3008 / ADC / DIP 16pin (8-Channel 10-Bit ADC With SPI Interface) | https://www.mechasolution.com/goods/goods_view.php?goodsNo=8067 | MCP3008 | SPI | 10비트 → 필요 없음 |

---

### 2. 현재 목록으로 이미 지원되는 것 (메카솔루션에서 확인, 참고)

| 상품 (URL) | 해당 id |
|---|---|
| 한글보드: 디지털 온도센서 DS18B20 (goodsNo=542200) · Gravity DS18B20 [DFR0024] (539548) | ds18b20 |
| 한글보드: DHT11 (540701) · [정품] DHT22 AM2302 (603626) · WeMos DHT22 Pro Shield (537845) | dht |
| SparkFun IR Thermometer Evaluation Board - MLX90614 (330911) | mlx90614 (보드 자체는 MCU 내장 평가보드라 UART/USB 출력일 수 있음 — 확인 필요) |
| K타입 써모커플 [SEN0139] (2815) | 프로브만 (max6675/MAX31855/ad8495에 연결) |
| 이산화탄소 CO2 센서 (MH-Z19B) (578748) | mhz19 |
| Gravity: UART Infrared CO2 Sensor (0-50000ppm) (539608) | mhz19와 같은 명령(0xFF 0x01 0x86) 방식(†, DFRobot SEN0220 = MH-Z16) → 범위만 50000 ppm. **범위 설정 확인 필요** |
| Gravity: Analog CO2 Gas Sensor [SEN0159] (8854) | mg811 |
| MQ-135 (539802, 578784) | mq-135 |
| Gravity: Analog Dissolved Oxygen Sensor / Meter Kit (544115) | dissolved-oxygen |
| Gravity: Analog pH Sensor / Meter Kit (427195) | ph |
| Grove - UV Sensor (8217) | uv (GUVA-S12D†) |
| TCS3472 RGB 컬러센서 / LED 내장 (596674) | tcs34725 |
| 광센서 CdS (127751) · 포토 트랜지스터 광센서 (329574) · 한글보드: CDS 조도센서 (540704) | ldr |
| HC-SR04 (119, 582738) | hcsr04 |
| VL53L0X V2 ToF (584096) | vl53l0x |
| MPU-6050 GY521 (6) · SparkFun MPU-6050 (586574) | mpu6050 |
| SparkFun LIS3DH (539631) | lis3dh |
| Grove - 3-Axis Analog Accelerometer (10914) | adxl335 (Grove 제품은 ADXL335 기반†, 확인 필요) |
| GY271 QMC5883 (586260) | magnetometer |
| HX711 (127743) · Gravity: Digital Weight Sensor (1213, HX711 기반†) · 로드셀 3/5/10/20/50 kg (427296, 583205, 583206, 427309, 427295) | hx711 |
| FSR 사각형 (70) · 압력 감지형 전도성천 Velostat (1342) | fsr |
| Flex Sensor 2.2인치 (203) | flex |
| Grove - Moisture Sensor (854) | soil-resistive |
| 수위/강우량 raindrops sensor (8935) | rain |
| 사운드센서 RED LM393 (1424) | sound |
| 심장박동 센서 (418) | pulse |
| AD8232 심박·심전도 키트 (576207) | ecg |
| Grove - GSR Sensor (8219) | gsr |
| 근적외선 PIR HC-SR501 (88) · HC-SR505 (576891) · 한글보드 PIR (540706) | pir |
| 한글보드: 진동센서 (540729) | vibration |
| 피에조 진동센서 모듈 (537989) | piezo |
| 한글보드: 기울기 센서 (540728) · 틸트센서 (5387) | tilt |
| 아두이노 홀센서 모듈 (1880) | hall (칩 미확인) |
| 한글보드: 리드센서 (543502) | DOUT 범용 (hall/tilt와 같은 켜짐·꺼짐) |
| 한글보드: 불꽃센서 (540722) | flame |
| 한글보드: 적외선 근접센서 TCRT5000 (542199) | tcrt5000 |
| 한글보드: 270도 회전센서 (540723) | pot |
| RCWL-0516 마이크로 웨이브 모션 센서 (539779) | DOUT 범용 (PIR와 같은 켜짐·꺼짐) |
| 아두이노 호환 적외선 근접센서 (1879) | DOUT 범용 (칩 미확인) |

---

### 3. 제외 (데이터 센서 아님)

- 카메라: Arducam OV2640 Mini (330855), OV5642 CS 렌즈 (330868), HM01B0 SPI 카메라 (605906)
- 제스처: 제스처/모션센서 [SEN0187] (10057, APDS-9960 계열)
- 음성: Grove - Speech Recognizer (537777), ReSpeaker 4-Mic (576735), 2-Mics Pi HAT (576738)
- 입력: 한글보드 정전식 터치센서 (542197), Gravity Analog Rotary Switch (539669, 단계식 스위치), 4채널 적외선 라인센서 (8934, 로봇용)
- 기타: 수동 부저 (539749), 스피커 (540389), 전자석 (8244), 햅틱 드라이버 DRV2605L (605102), 엔코더 모터 (582792)
- 키트: 처음봐 아두이노 추가팩 (미세먼지 측정기편) (576230, 구성 센서 미확인)
- 지문·RFID·키패드·조이스틱·GPS: 카테고리(지문인식 129020, 조이스틱 129036)는 있으나 상품은 검색에 안 나옴

---

### 4. 등록 우선순위 제안 (메카솔루션 기준)

1. **AS5600** (I2C 0x36, 각도) — 물리 진자·회전. 새 카테고리 '각도'
2. **ICM-20948** (I2C 0x68/0x69) — MPU9250 단종 대체, 레지스터 비호환이라 별도 드라이버
3. **MAX31855** (SPI) — MAX6675 상위, 같은 배선(SO/CS/SCK)이라 펌웨어 추가 쉬움
4. **ADS1115/ADS1015** (I2C 0x48) — 화학 전지 mV 정밀 측정용 '정밀 전압' 카드
5. **GP2Y1014AU/GP2Y1010** (A + LED 펄스) — 먼지 (DeviceMart에도 GP2Y1010 있음)
6. 아날로그만으로 되는 것 (펌웨어 수정 없음, 변환식만): **GP2Y0A41SK0F**(거리), **6V 풍속계**, **NTC 10K**, **Grove High Temp**, **ACS723**, **360° Hall Angle**
7. UART: **TFmini-S/Plus** (같은 프레임), **ToF10120/ToF250**
8. 확인 필요: Grove 3-Axis Digital Compass 버전(HMC5883L이면 이미 지원 / BMM150이면 추가), Gravity UART CO2 SEN0220의 50000 ppm 범위 처리


---

## NTREX(엔티렉스) 센서 조사 — ChemDict Lab 미등록 칩

조사일: 2026-10-17

### 0. 먼저 알아둘 점: NTREX의 쇼핑몰은 디바이스마트다

- devicemart.co.kr 페이지 메타데이터의 작성자가 **"디바이스마트 / (주)엔티렉스"**다 (https://www.devicemart.co.kr/link/service/instore.html).
- Pololu 대리점 목록에도 한 업체로 **"NTREX,Inc.- Devicemart"**가 올라 있고, 사이트로 www.devicemart.co.kr와 www.ntrexgo.com이 함께 적혀 있다 (https://www.pololu.com/distributors/0J135).
- ntrex.co.kr은 회사 소개 사이트다. 검색에 걸린 것은 홈, 101do.html, etc.html뿐이고 상품 페이지는 없었다.
- ntrexgo.com은 NTREX/디바이스마트의 콘텐츠 사이트(디바이스마트 매거진: 신상품 소식, 작품 소개)다. 상점이 아니다.
- 결론적으로 "NTREX가 파는 센서"는 디바이스마트 상품과 같다. 그래서 이 조사는 앞선 디바이스마트 조사(research_devicemart.md)를 이어서 보완한 것이다. 이번에는 앞선 조사에 없던 칩을 디바이스마트 도메인에서 더 찾았다.
- 한계 1: ntrex.co.kr과 ntrexgo.com은 WebFetch가 https→http 리디렉트를 반복해서 열리지 않았다. 디바이스마트 카탈로그 페이지는 상품 목록이 JS로 불러와져 비어 있었다.
- 한계 2: 그래서 아래 항목은 모두 **도메인 한정 웹검색 결과의 상품 제목과 URL**로 확인했다.
- 한계 3: 웹검색 호출 한도(턴당 200회, 공유)가 중간에 소진됐다. 그래서 **전기화학식 가스(NH3·H2S·NO2·O3), MiCS 계열, Grove 멀티 가스, VL53L4CD/Modulino 세부, SI1145 칩 확인**은 검색하지 못했다. 이어서 조사하려면 후속 요청이 필요하다.
- 인터페이스, I2C 주소, 단위 가운데 †가 붙은 값은 상품 페이지가 아니라 칩 데이터시트에서 가져온 값이다.

통신 표기: A 아날로그 / D1 디지털 켜짐·꺼짐 / I2C(주소) / UART / SPI / 1-Wire / 펄스

---

### 1. 현재 목록에 없는 센서

### 1-A. 이번에 새로 찾은 것 (앞선 디바이스마트 조사에 없던 항목)

| 상품명 (검색 결과 그대로) | URL | 칩 | 통신 | 측정량·단위 | 학교 과학 활용 |
|---|---|---|---|---|---|
| SparkFun High Precision Temperature Sensor - TMP117 (Qwiic) [SEN-15805] | https://www.devicemart.co.kr/goods/view?no=12499445 | TMP117 | I2C(0x48~0x4B)† | 온도 °C, ±0.1 °C† | ◎ 정밀 열량계, 어는점 내림, 중화열 (Qwiic 바로 연결) |
| Adafruit TMP119 High-Precision ±0.03°C I2C Temperature Sensor [ada-6482] | https://www.devicemart.co.kr/goods/view?no=16057083 | TMP119 (TMP117과 레지스터 호환†) | I2C(0x48~0x4B)† | 온도 °C | ◎ 위와 같음. TMP117을 넣으면 함께 지원됨 |
| Adafruit HTU31 Temperature & Humidity Sensor Breakout - STEMMA QT / Qwiic [ada-4832] | https://www.devicemart.co.kr/goods/view?no=13959781 | HTU31D (HTU21D와 명령 체계 다름†) | I2C(0x40/0x41)† | 온도 °C, 상대습도 %RH | ○ 증산·호흡 습도 |
| 대기압 센서 모듈 (Barometric Pressure Sensor Module : LPS25) | https://www.devicemart.co.kr/goods/view?no=1160217 | LPS25H (Modulino Pressure의 LPS22HB와 비슷하지만 레지스터가 같지 않음†) | I2C(0x5C/0x5D)† | 기압 hPa, 온도 | ○ 기체 압력, 기상 |
| Gravity BMP388 Barometric Pressure Sensors [SEN0251] | https://www.devicemart.co.kr/goods/view?no=10894670 | BMP388 (BMP280과 레지스터 다름†) | I2C(0x76/0x77)†, SPI | 기압 Pa, 온도 | ○ 보일 법칙, 고도 (BMP280보다 정밀) |
| ICP-10125 Air Pressure Sensor Breakout (High Accuracy Pressure / Altitude) [PIM586] | https://www.devicemart.co.kr/goods/view?no=14590701 | ICP-10125 | I2C(0x63)† | 기압 Pa, 온도 | △ 고정밀 기압 |
| MPRLS Ported Pressure Sensor Breakout - 0 to 25 PSI [ada-3965] | https://www.devicemart.co.kr/goods/view?no=13218288 | Honeywell MPRLS0025PA | I2C(0x18)† | 기체 압력 0~25 psi(0~172 kPa) 절대압, 호스 연결 | ◎ 주사기·튜브 기체 압력 (보일 법칙, 기체 발생 반응). MPX5700을 디지털로 대체 가능 |
| 아두이노 아날로그 수압 센서 [SEN0257] | https://www.devicemart.co.kr/goods/view?no=1376717 | DFRobot SEN0257 (게이지압 트랜스듀서) | A (0.5~4.5 V†) | 수압·기체압 0~1.6 MPa† | △ 범위가 커서 교실 실험에는 분해능 부족. 수압·깊이 시연 |
| SparkFun Triple Axis Magnetometer Breakout - MLX90393 [SEN-14571] · Adafruit Wide-Range Triple-axis Magnetometer - MLX90393 - STEMMA QT [ada-4022] | https://www.devicemart.co.kr/goods/view?no=12146924 · https://www.devicemart.co.kr/goods/view?no=12382841 | MLX90393 | I2C(0x0C~0x0F)† | 자기장 µT (3축), 넓은 범위 | ◎ 전류 주위 자기장, 솔레노이드, 자석 거리-세기 (QMC5883L보다 범위 넓음) |
| SparkFun Linear 3D Hall-Effect Sensor - TMAG5273 (Qwiic) [SEN-23880] | https://www.devicemart.co.kr/goods/view?no=15378566 | TMAG5273 | I2C(0x22/0x35 등)† | 자기장 mT (3축 선형 홀) | ◎ 자석 세기, 전자석 (선형 홀 공백 메움) |
| 아두이노 호환 방사선 검출 가이거 계수기 모듈 [TYE-RD001] | https://www.devicemart.co.kr/goods/view?no=15202063 | GM관 + 고전압 회로 | 펄스 (계수)† | 방사선 계수 CPM → µSv/h 환산 | ○ 방사선 거리·차폐 실험 (지구과학·물리) |
| 가이거 계수기 모듈 이온화 방사선 검출기 [SEN0463] | https://www.devicemart.co.kr/goods/view?no=15202065 | DFRobot SEN0463 (GM관) | 펄스† | CPM, µSv/h | ○ 위와 같음 |
| 아두이노 호환 방사선 측정 감마센서 모듈 (GDK101) | https://www.devicemart.co.kr/goods/view?no=1313157 | FTLAB GDK101 (PIN 다이오드) | I2C·UART† | 감마선 µSv/h (10분/1분 평균) | ○ 방사선 측정 |
| XIPA-RDSmini 핵 방사선 감지 미니 모듈 [TYE-RD024] · XIPA-AMST 핵 방사선 감지 모듈 [TYE-RD023] | https://www.devicemart.co.kr/goods/view?no=15202087 · https://www.devicemart.co.kr/goods/view?no=15202086 | 칩 미확인 | 미확인 | 방사선 | △ 사양 미확인 |
| 풍속 측정 키트 0-5V (IP65) [SEN0170] | https://www.devicemart.co.kr/goods/view?no=1153202 | 컵형 풍속계 | A (0~5 V, 상품명) | 풍속 m/s | ○ 기상 관측 (지구과학). 12~24 V 전원 필요† |
| 아두이노 호환 풍속센서 | https://www.devicemart.co.kr/goods/view?no=11871774 | 칩 미확인 | 미확인 | 풍속 | △ |
| WDS100 설치형 풍향 센서 | https://www.devicemart.co.kr/goods/view?no=14958817 | 미확인 | 미확인 | 풍향 | △ 스마트팜 설치형 |
| ADS1115 4채널 16비트 ADC 모듈 [SZH-EKBG-024] · Adafruit ADS1115 [ada-1085] · Gravity: I2C ADS1115 16-Bit ADC Module [DFR0553] | https://www.devicemart.co.kr/goods/view?no=1327550 · https://www.devicemart.co.kr/goods/view?no=1175930 · https://www.devicemart.co.kr/goods/view?no=14592629 | ADS1115 | I2C(0x48~0x4B)† | 전압 mV (16비트, ±0.256~6.144 V PGA, 차동 입력) | ◎ 화학 전지 기전력 정밀 측정, 농도차 전지, pH 전극 직접 측정. 센서라기보다 측정 장치이지만 전압 실험에 효과가 큼 |
| Grove - Sunlight Sensor [101020089] | https://www.devicemart.co.kr/goods/view?no=1341491 | SI1145 계열로 보이나 미확인 (Grove v1=SI1145, v2=SI1151†) | I2C(0x60)† | 가시광·IR 세기, UV 지수(계산값) | ○ 자외선·햇빛 세기 |
| Adafruit MLX90640 24x32 IR Thermal Camera Breakout 110° [ada-4469] / 55° [ada-4407] · 열화상 카메라 모듈 IR MLX90640 [220565] / 110° [220573] | https://www.devicemart.co.kr/goods/view?no=12518722 · https://www.devicemart.co.kr/goods/view?no=12518723 · https://www.devicemart.co.kr/goods/view?no=15356287 · https://www.devicemart.co.kr/goods/view?no=15356286 | MLX90640 | I2C(0x33)† | 768화소 온도 °C | △ 열 분포 시각화. 데이터가 커서(프레임) 줄 단위 BLE 프로토콜에는 맞지 않음. 최고·평균 온도만 보내는 방식이면 가능 |
| 아두이노용 명도 센서 Grayscale Sensor For Arduino [DFR0022] | https://www.devicemart.co.kr/goods/view?no=38339 | 반사형 광센서 | A | 반사광 상대값 | △ 기존 tcrt5000/raw로 대체 가능 |
| 필름형 힘/압력 센서(PSC Series) - 10 | https://www.devicemart.co.kr/goods/view?no=14280441 | 칩 미확인 (박막 저항식) | A(분압)† | 힘 상대값 | △ 기존 fsr로 대체 가능 |

### 1-B. 앞선 디바이스마트(=NTREX 상점) 조사에서 이미 확인됐지만 현재 목록에 없는 칩

상품 URL과 세부는 research_devicemart.md에 있다. 아래는 현재 목록(current_parts.txt) 기준으로 아직 등록되지 않은 칩만 모은 것이다.

| 칩 | 통신 | 측정량 | research_devicemart.md 행 | 학교 활용 |
|---|---|---|---|---|
| MAX31855 | SPI | K형 열전대 −200~1350 °C | T6 | ○ 고온 (MAX6675 상위) |
| MAX31865 | SPI | PT100/PT1000 정밀 온도 | T8 | ◎ 정밀 열량계 |
| NTC 써미스터 모듈 | A | 온도 (B값 보정) | T4 | ○ raw로 대체 가능 |
| DFRobot SEN0198 고온 | A | 고온 | T9 | △ |
| AMG8833 | I2C(0x69) | 8×8 열화상 °C | T11 | △ 열 분포 |
| SHT10 | 전용 2선 | 온습도 | H8 | △ 구형 |
| BME680 / BME688 | I2C(0x76/0x77) | 기압·온습도·가스저항 Ω | P4 | ○ BME280 상위, VOC 정성 |
| MPX5010DP | A | 차압 0~10 kPa | P5 | ○ 기체 발생량 |
| MQ-6 | A | LPG·부탄 (상대값) | G4 | △ 부품(회로 필요) |
| Grove HCHO / DFRobot SEN0231 | A / 미확인 | 포름알데히드 | G10, G11 | △ |
| DFRobot SEN0376 | 미확인 | 알코올 0~5 ppm (전기화학) | G12 | ○ |
| DFRobot SEN0466 | I2C·UART | CO ppm (보정됨) | G13 | ○ 불완전 연소 정량 |
| Cubic CM1106 / CM1107N | UART | CO2 ppm (NDIR) | C5 | ○ MH-Z19C 대안 |
| RX-9M | 미확인 | CO2 | C7 | △ |
| SGP40 | I2C(0x59) | VOC 지수 | V2 | ○ |
| DFRobot SEN0496 | I2C | O2 0~100 %Vol | O2 | ◎ 과산화수소 분해 산소 (현재 o2-i2c는 SEN0322 0~25 %. 같은 라이브러리 계열인지는 미확인) |
| Cubic PM2008/PM2008M/PM2009 | I2C·UART† | PM2.5/10 | D3 | ○ |
| Sharp GP2Y1010AU0F | A(LED 펄스) | 먼지 상대값 | D4 | △ |
| Honeywell HPMA115C0 | UART | PM2.5/10 | D5 | ○ |
| AM1002 | 미확인 | 미세먼지 | D6 | △ |
| DFRobot SEN0636 | 미확인 | UV 지수 | L5 | ○ |
| AS7331 | I2C | UVA/UVB/UVC 분광 | L6 | ○ 자외선 차단제 파장대별 |
| TCS3200 / TCS230 | 펄스(주파수) | RGB 상대값 | L8 | ○ 색 변화 (TCS34725 대안) |
| AS7341 | I2C(0x39) | 11채널 분광 | L9 | ◎ 간이 분광광도계, 흡광도 |
| AS7262 / AS7263 | I2C(0x49) | 6채널 가시/NIR 분광 | L10, L11 | ○ |
| APDS-9960 | I2C(0x39) | RGB·근접 (제스처 겸용) | L12 | △ |
| HY-SRF05 / SRF-04 | 펄스 | 거리 | R2 | ○ HC-SR04와 배선 같음 (사실상 호환) |
| VL53L1X | I2C(0x29) | 거리 ~4 m | R4 | ◎ 운동 분석 (VL53L0X와 레지스터 다름) |
| VL6180 | I2C(0x29) | 거리 0~10 cm | R5 | ○ 용수철 변위 |
| VL53L5CX / VL53L8CX | I2C | 8×8 거리 | R6 | △ |
| ToF10120 | UART·I2C | 거리 | R7 | △ |
| Sharp GP2Y0A21 / GP2Y0A02 | A | 거리 10~80 / 20~150 cm (비선형) | R8, R9 | ○ |
| TFmini-S / TF-Luna | UART (Luna는 I2C도) | 거리 0.1~12 m | R10 | ○ 긴 거리 운동 |
| ICM-20948 | I2C(0x68/0x69) | 9축 | M6 | ○ (MPU9250은 현재 목록에 포함) |
| BNO055 | I2C(0x28/0x29) | 절대 자세각 | M7 | ○ 회전·각도 |
| FlexiForce A101 | A | 힘 | F3 | △ fsr로 대체 |
| INA3221 | I2C(0x40~0x43) | 3채널 전압·전류 | E3 | ◎ 여러 전지 동시 비교 |
| ACS723 / SEN0214 (20 A) | A | 전류 | E5, E6 | △ 큰 전류 |
| SCT-013 / SEN0211 | A | 교류 전류 | E7 | △ 교사 시연 |
| ZMPT101B | A | 교류 전압 | E9 | ✕ 고전압 |
| Adafruit STEMMA Soil (seesaw) | I2C(0x36) | 토양 수분·온도 | W13 | ○ Qwiic |
| YF-S201 / SEN0217 | 펄스 | 유량 L/min | W14 | ○ 유속·유량 |
| MAX30100 | I2C(0x57) | 맥박·SpO2 | X3 | △ MAX30102와 레지스터 다름 |

---

### 2. 제외 (데이터 센서가 아님, 이번 검색에 보인 것)

- 적외선 송수신: 아두이노 38KHz 적외선 수신 센서모듈 [ELB030102] (no=1290749), 적외선 송신 센서모듈 [ELB040101] (no=1310698). 리모컨 통신용이다.
- UV-C LED Module (no=11871777), UVC 자외선 살균 램프 스트립 [FIT0948] (no=15380688). 광원이고 센서가 아니다.
- 열화상 카메라 키트: M5stick T-Lite Thermal Camera Dev Kit [K126] (no=15775765), Lepton BreakOut Board (no=1290796). 카메라·영상 장치다.
- 센서 키트 묶음: 37종/30종 센서키트, 아두이노 가스 센서 키트, 미세먼지 측정 키트, 음주 측정 키트, Arduino Sensor Kit - Base (no=13931197). 낱개 센서는 위 표로 판단한다.
- 가이거관 단품(J304/J305/M4011, TYE-RD014/015/018). 고전압 회로가 필요한 부품이다. 모듈(TYE-RD001, SEN0463)만 위 표에 넣었다.
- 평가 기판: TMAG5273EVM, HDC1080EVM (디지키 평가 보드).
- ntrexgo.com 기사에 보인 NTREX 자체·협력사 제품(상세 미확인, 제목만 확인): MW-AHRS v1·V4 시리즈 AHRS, BMI160 블루투스 IMU, 레이더 MDR_mini A, 24 GHz 레이더 DNS-060, 90도 물체 감지 센서 모듈, 트루아이즈 TG-100A CO2·TF100 불꽃 센서, TBP 비접촉 적외선 온도센서, RA9P/RA12P 압력센서, 마블덱스 압력센서. 기사 본문이 열리지 않아 칩·통신을 확인하지 못했다. 대부분 2010년대 기사라 현재 판매 여부도 미확인이다.
  - 출처: http://www.ntrexgo.com/archives/30995, /34881, /36653, /37610, /38337, /34910, /31028, /36542, /41335, /32869, /34158
- 카메라·RFID·지문·키패드·조이스틱·버튼·GPS는 이번 검색 결과에 나오지 않았다. 앞선 조사에서처럼 제외 대상이다.

---

### 3. 요약 — 통신 방식별 우선 추가 후보

- **I2C (Qwiic 바로 연결)**
  - 온도: TMP117/TMP119 (정밀)
  - 기체 압력: MPRLS (주사기·튜브)
  - 자기장: MLX90393, TMAG5273
  - 거리: VL53L1X
  - 분광: AS7341
  - 전압·전류: INA3221 (3채널)
  - 전압 측정 장치: ADS1115 (16비트 전압)
  - 기압: BMP388
  - 산소: SEN0496 (O2 0~100 %)
  - 기타: BME680, SGP40, BNO055, HTU31, LPS25, ICP-10125, STEMMA Soil, GDK101
- **SPI**: MAX31865 (PT100 정밀), MAX31855 (고온)
- **UART**: CM1106 (CO2), PM2008 / HPMA115 (미세먼지), TFmini-S / TF-Luna (거리), SEN0466 (CO)
- **펄스**: 가이거 계수기 TYE-RD001 / SEN0463 (방사선 CPM), YF-S201 (유량), TCS3200 (색), HY-SRF05 (HC-SR04와 동일)
- **아날로그 (펌웨어 수정 불필요)**: SEN0170 풍속, SEN0257 수압, MPX5010DP 차압, Sharp GP2Y0A 거리, NTC 써미스터, GP2Y1010 먼지


---

## OSCO Korea (오스코) 센서 조사 — 2026-10-17

### 0. 핵심 사실: oscokorea.com에는 상품 목록이 없음
- store.arduino.cc/distributors에 한국 공인 대리점 5곳이 나온다: Eleparts, ICBanQ, Mechasolution, NTREX, **OSCO CO. Ltd (https://www.oscokorea.com/)**.
- 그런데 https://www.oscokorea.com/ 은 **반도체 부품 유통사의 회사 소개 사이트**다 (ABOUT / VALUE LINE / PARTNERS / CONTACT US). 협력사는 Qualcomm, NXP, Innolux, SiTime, Nordic 등이고, 취급 분류는 AP, Connectivity, MCU, LCD, MEMS, Memory, Battery이다. 쇼핑몰, 센서 분류, 상품 페이지가 없다.
- `/arduino`, `/shop` 경로는 가져올 수 없었다. 도메인을 oscokorea.com으로 제한한 WebSearch(Modulino, 센서, 아두이노 센서 모듈, arduino)는 홈페이지만 돌려주거나 결과가 없었다. 일반 검색에서도 OSCO가 운영하는 별도 쇼핑몰(스마트스토어 등)은 찾지 못했다.
- 따라서 **OSCO 사이트에서 직접 본 센서 상품은 0개**다. OSCO는 Arduino 공식 제품군을 B2B로 공급하는 것으로 보인다. 그래서 그 공식 제품군을 arduino.cc 공식 문서와 스토어에서 확인했다. 아래 1~3절의 출처는 모두 arduino.cc이다. OSCO 재고는 확인되지 않았다.
- 참고: 이 작업 중 WebSearch 할당량(턴당 200회, 공유)이 소진되어 Science Kit R3 캐리어의 칩 목록은 끝까지 확인하지 못했다.

### 1. Arduino 공식 Modulino — 칩·주소 확인 결과 (arduino.cc 문서와 데이터시트)
| Modulino | URL | 칩 | 인터페이스 / 주소 | 측정·단위 | 앱 반영 여부 |
|---|---|---|---|---|---|
| Light (ABX00111) | https://store-usa.arduino.cc/products/modulino-light · https://docs.arduino.cc/resources/datasheets/ABX00111-datasheet.pdf | **LTR-381RGB-01** (Lite-On) | I2C **0x53** (고정, 변경 불가) | 조도 0.01–120,000 lx, R/G/B(600–700/500–600/400–500 nm), IR. 20-bit ADC | **없음** → 추가 권장. 빛·색 실험(광합성, 흡광·색 변화, 반응속도)에 유용 |
| Distance (ABX00102) | https://store-usa.arduino.cc/products/modulino-distance · ABX00102 데이터시트 | **VL53L4CD** (ST ToF) | I2C **0x29** (소프트웨어로 변경 가능) | 거리 0–1200 mm | **없음**. VL53L0X와 레지스터 호환이 안 됨(드라이버가 다름) → 추가 권장. 운동(위치-시간), 물리 |
| Movement (ABX00101) | https://store-usa.arduino.cc/products/modulino-movement · ABX00101 데이터시트 | LSM6DSOXTR | I2C **0x6A** (점퍼로 0x6B. 스캔하면 0x6A 또는 0x7E로 보일 수 있음) | 가속도(0.061–0.488 mg/LSB), 자이로 ±125–2000 dps | 있음 (`lsm6ds`). 0x7E 표시는 Modulino 마이크로컨트롤러 쪽 주소로 보이므로 스캔 로직에서 주의 |
| Thermo (ABX00103) | https://store-usa.arduino.cc/products/modulino-thermo · https://docs.arduino.cc/hardware/modulino-thermo/ | **V0.5 이후: GXHT30C**, 이전: HS3003 | I2C **0x45** (GXHT30C) / **0x44** (HS3003) | 온도 °C, 습도 %RH | 있음 (`modulino-thermo`). **주의: 신판은 GXHT30C(SHT30 호환 명령) 0x45**이다. 펌웨어가 HS3003 0x44만 읽으면 신판에서 실패한다. `sht3x` 드라이버로 0x45까지 탐색하는지 확인 필요 |
| Pressure | — | — | — | — | **arduino.cc 스토어 Modulino 목록(22개)과 docs에서 찾을 수 없음**. 검색해도 나오지 않고 docs URL도 열리지 않음. 앱의 `modulino-pressure` 항목은 실제 제품이 아닐 수 있으니 재검토 권장 (LPS22HB는 Nano 33 BLE Sense Rev2 보드에 내장된 칩) |

센서가 아닌 Modulino(제외): Knob, Buttons, Buzzer, Pixels, LED Matrix, Joystick, Vibro, Latch Relay, Motors, Hub, Extender, 그리고 번들 상품(Environmental Station, Kitchen Timer, Programmable Keypad). Joystick과 Knob은 입력 장치라서 측정 센서에서 제외했다.

Plug and Make Kit (AKX00069, https://store-usa.arduino.cc/products/plug-and-make-kit) 구성: UNO R4 WiFi와 Modulino Knob, Pixels, Distance, Movement, Buzzer, Thermo, Buttons. 측정 센서는 Distance, Movement, Thermo 3개다.

### 2. 그 밖의 Arduino 공식 센서 제품 (arduino.cc에서 확인)
### Nicla (독립 보드. UNO의 Qwiic 센서가 아니라 ESLOV/I2C 주변장치나 BLE로 연결)
| 제품 | URL | 칩 | 측정 | 앱 반영 여부 |
|---|---|---|---|---|
| Nicla Sense Env | https://docs.arduino.cc/hardware/nicla-sense-env/ | HS4001 | 온도, 습도 | 없음 |
| | | **ZMOD4410** | 실내 공기질 TVOC, eCO₂ | 없음 |
| | | **ZMOD4510** | 실외 공기질 **NO₂, O₃** | 없음. 지구과학·환경 화학(오존·질소산화물)에 흥미로움 |
| Nicla Sense ME | https://docs.arduino.cc/hardware/nicla-sense-me/ | BHI260AP (6축 IMU 허브) | 가속도, 자이로 | 없음 |
| | | **BMP390** | 기압 300–1250 hPa | 없음 (BMP280과 레지스터 다름) |
| | | **BMM150** | 3축 자기장 | 없음 |
| | | **BME688** | 온도, 습도, 기압, 가스 저항(VOC) | 없음 (BME280과 거의 같으나 가스 히터 추가) |

### Nano 33 BLE Sense Rev2 (보드 내장. Science Kit 계열에서 쓰임)
https://docs.arduino.cc/hardware/nano-33-ble-sense-rev2/ : **LPS22HB** 기압 260–1260 hPa, HS3003 온습도, **APDS9960** 근접·제스처·색, MP34DT06JTR PDM 마이크, 9축 IMU. 앱의 기준 보드가 UNO R4이므로 참고용이다.

### Science Kit R3 (https://store.arduino.cc/pages/science-kit-r3)
Science Carrier R3와 Nano RP2040 Connect로 구성된다. 페이지에는 "air quality, temperature, humidity, pressure, light and more"라고만 적혀 있고 칩 이름은 없다. 검색 할당량이 소진되어 칩을 확인하지 못했다.

### Arduino Sensor Kit (Grove, https://store-usa.arduino.cc/products/sensor-kit-base)
조도(포토레지스터), 소리, 기압(I2C), 온습도, 가속도계, 가변저항이 들어 있다. 상품 페이지에 칩 이름이 없다. 모두 기존 분류(ldr, sound, pot 등)와 겹친다.

### Arduino 공식 스토어의 "Sensors" 컬렉션 (https://store-usa.arduino.cc/collections/sensors), 앱에 없는 것만
| 상품명(그대로) | 칩 | 인터페이스 | 측정 | 학교 과학 |
|---|---|---|---|---|
| Grove - High Precision Barometric Pressure Sensor (DPS310) | **DPS310** | I2C 0x77/0x76 (Infineon 기본값, 페이지에서 확인 안 함) | 기압 Pa, 온도 | 유용 (고정밀 높이·기압 변화) |
| Grove - Dust Sensor (PPD42NS) | PPD42NS | 펄스(LPO 시간 비율) | 먼지 농도(상대값, pcs/0.01cf) | 보통. 환경 단원. PMS7003이 이미 있음 |
| URM06 - UART Ultrasonic Sensor | URM06 | UART | 거리 | 보통. HC-SR04로 대체 가능 |
| Waterproof Ultrasonic Sensor with Separate Probe | 칩 이름 없음 | 미확인 | 거리 | 보통 (액체 수위 측정) |
| Gravity: Non-contact Digital Water / Liquid Level Sensor | 칩 이름 없음 | 디지털 on/off | 용기 밖에서 액체 유무 감지 | 보통. 기존 DOUT 항목으로 처리 가능 |
| Grove - 6-Axis Accelerometer & Gyroscope | 페이지에 칩 이름 없음 | I2C | 가속도, 자이로 | 칩 확인 필요 |
| Grove - Temperature Sensor | 페이지에 칩 이름 없음 (Grove 서미스터로 추정, 미확인) | 아날로그 | 온도 | 서미스터 항목이 없다면 고려 |
이미 반영된 것: SHT31, BME280, Gravity I2C O₂, MG-811, 정전식 토양 수분 센서, Gravity pH.

### 3. 제외 (데이터 센서가 아님)
Modulino Knob, Buttons, Buzzer, Pixels, LED Matrix, Joystick, Vibro, Latch Relay, Motors, Hub, Extender. 그 밖에 USB Camera(IMX376), HUSKYLENS(AI 비전), NFC/RFID reader, Grove Infrared Receiver, OLED.

### 4. 추가 우선순위 제안 (인터페이스별)
- **I2C (Qwiic, Wire1)**: LTR-381RGB 0x53 (Modulino Light), VL53L4CD 0x29 (Modulino Distance), GXHT30C 0x45 (신판 Modulino Thermo 대응), DPS310 0x77, BMP390 0x77, BME688 0x77/0x76, APDS9960 0x39, LPS22HB 0x5C, BMM150 0x10
- **Nicla 경유 (보드 단위)**: ZMOD4510 NO₂/O₃, ZMOD4410 TVOC
- **펄스**: PPD42NS 먼지
- **UART**: URM06 초음파
- 정리할 것: `modulino-pressure` 항목은 실제 제품이 확인되지 않는다.
(APDS9960, LPS22HB, BMM150의 주소는 일반적으로 알려진 기본값이며, 이번 조사에서 arduino.cc로 확인하지는 않았다.)
