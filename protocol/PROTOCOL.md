# ChemDict Lab 통신 규칙 v1.3

보드(UNO R4 WiFi)와 앱(웹앱, 애플 앱)이 주고받는 약속입니다. USB 시리얼과 블루투스(BLE) 모두 **같은 내용**을 씁니다.

## 1. 기본 형식

- 한 메시지는 **UTF-8 텍스트 한 줄**이고 `\n`으로 끝납니다.
- 보드 → 앱: **JSON 한 줄**
- 앱 → 보드: **명령어 한 줄** (공백으로 구분)
- USB 시리얼 속도: `115200` baud

## 2. 연결 통로

| 통로 | 설정 |
|---|---|
| USB 시리얼 | 115200 baud, 8N1 |
| BLE 서비스 | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` (Nordic UART 방식) |
| BLE 앱 → 보드 (write) | `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` |
| BLE 보드 → 앱 (notify) | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` |
| BLE 장치 이름 | `ChemDict-01` ~ `ChemDict-08` (모둠 번호) |

BLE는 한 번에 보낼 수 있는 길이가 짧습니다. 보드는 한 줄을 **최대 20바이트 조각**으로 나눠 보내고, 앱은 받은 조각을 이어 붙이다가 `\n`이 나오면 한 메시지로 처리합니다. 앱이 보드로 보내는 명령도 20바이트 이하로 유지합니다.

## 3. 보드 → 앱 메시지

모든 메시지에 `type` 필드가 있습니다.

### hello — 연결 직후, 그리고 `HELLO` 명령을 받았을 때

```json
{"type":"hello","fw":"0.5.0","board":"UNO R4 WiFi","station":3,"demo":false,
 "sensors":[
  {"id":"pH","type":"pH","name":"pH","unit":"","src":"A0","cal":true},
  {"id":"L","type":"L","name":"L","unit":"","src":"A1","cal":false},
  {"id":"pH_A2","type":"pH","name":"pH","unit":"","src":"A2","cal":false},
  {"id":"T","type":"T","name":"T","unit":"","src":"onewire","cal":false}
 ]}
```

- `sensors`: 보드가 지금 읽을 수 있는 센서 목록. 앱은 이 목록으로 화면을 만듭니다.
- `type`: 센서 종류. **이름·단위·소수 자리·보정 방법은 앱이 `protocol/sensors.json`에서 찾습니다.** (보드는 `name`에 type을 그대로 넣음)
- `id`: 데이터 메시지의 키. 보통 type과 같고, 같은 종류가 둘 이상이면 두 번째부터 꼬리표가 붙습니다 (`pH_A2`, `TA_D4`, `TA_QW`, `TA_I2C`, `TA_SCD`).
- `board`: 보드 이름 (`UNO R4 WiFi`, `UNO R4 Minima`, `UNO R3`). 앱의 연결 안내가 이 이름으로 보드를 자동 선택합니다.
- `src`: 센서가 연결된 곳 (`A0`~`A3`, `onewire`, `i2c:0x44`, `i2c:0x45`, `D4:DHT22` 등, 데모면 `demo`)
- `cal`: 저장된 보정값이 있는지 여부

### d — 측정 데이터 (측정 중 반복)

```json
{"type":"d","t":12.5,"v":{"pH":6.98,"L":41.2,"T":23.41}}
```

- `t`: 측정 시작 후 경과 시간(초)
- `v`: 센서 `id` → 값. 읽기 실패한 센서는 빠집니다.

### ack / err — 명령 결과

```json
{"type":"ack","cmd":"START"}
{"type":"err","cmd":"CAL","msg":"unknown sensor"}
```

### cal — 보정 결과

```json
{"type":"cal","id":"pH","slope":-5.70,"offset":21.34,"points":2}
```

## 4. 앱 → 보드 명령

| 명령 | 뜻 |
|---|---|
| `HELLO` | 측정 중이 아니면 센서를 다시 찾은 뒤 hello를 보냄 (앱의 "센서 다시 찾기") |
| `START <ms>` | `<ms>` 밀리초 간격으로 측정 시작 (최소 100, 기본 1000) |
| `STOP` | 측정 정지 |
| `DEMO ON` / `DEMO OFF` | 데모 모드 켜기/끄기 (센서 없이 가짜 데이터) |
| `PORT <A0~A3|D3> <type> [slope offset]` | 아날로그 포트에 꽂은 센서 종류와 기본 변환식(값 = slope × 전압 + offset) 지정. EEPROM에 저장, 보정은 초기화, 이어서 hello 전송 |
| `PORT <A0~A3|D3> OFF` | 포트 사용 안 함 |
| `CAL <id> <n> <값>` | 2점 보정: 지금 측정값을 기준값 `<값>`으로 기록 (`<n>`은 1 또는 2) |
| `CAL <id> OFS <값>` | 1점(영점) 보정: 지금 값이 `<값>`이 되도록 절편만 이동. 무게(`M`)는 영점 맞추기 |
| `CAL <id> SCL <값>` | 1점(비례) 보정: 지금 값이 `<값>`이 되도록 기울기 조정 (산소·탁도, 무게는 기준 추) |
| `CAL <id> CLEAR` | 보정 표시 지우기 (아날로그는 앱이 PORT로 기본 변환식을 다시 보냄) |
| `STATION <n>` | 모둠 번호 설정 (1~8, BLE 이름이 바뀜, 재부팅 후 적용) |

보정 예 (pH 2점):
```
CAL pH 1 7.00     ← pH 7 완충 용액에 담근 상태에서
CAL pH 2 4.00     ← pH 4 완충 용액에 담근 상태에서
```
두 번째 점이 기록되면 보드가 기울기·절편을 계산해 저장하고 `cal` 메시지를 보냅니다.

## 5. 센서 카탈로그와 포트 배정

센서 종류별 이름·단위·기본 변환식·보정 방법은 **`protocol/sensors.json`** 하나에만 적습니다. 웹앱과 애플 앱이 같은 파일을 읽습니다.

| type | 이름 | 단위 | 기본 변환 | 보정 |
|---|---|---|---|---|
| `pH` | pH | | −5.70 × V + 21.34 | 2점 (pH 7, 4) |
| `L` | 빛 | % | 20 × V | 없음 |
| `EC` | 전도도 | µS/cm | 1000 × V (참고용) | 2점, 필수 |
| `V` | 전압 | V | V | 없음 |
| `TL` | 온도(LM35) | °C | 100 × V | 1점 (얼음물) |
| `P` | 기체 압력 | kPa | 155.56 × V − 31.11 | 1점 (대기압) |
| `RAW` | 사용자 정의 | V | V | 2점 |

처음 켠 보드의 기본 배정: A0 `pH`, A1 `L`, A2 `EC`, A3 `V`. 앱의 "센서 연결"에서 포트마다 바꿀 수 있습니다.

디지털 센서는 꽂아 두면 자동 인식합니다 (`HELLO` = 다시 찾기). 핀은 모든 보드에서 같습니다 (Leonardo의 DS18B20만 D9).

| 연결 | type | 센서 | `src` 예 |
|---|---|---|---|
| D2 (OneWire) | `T` | DS18B20 방수 온도 | `onewire` |
| D4 | `TA`, `RH` | DHT11 / DHT22 | `D4:DHT22` |
| D5 DT · D6 SCK | `M` (g) | 로드셀 + HX711 | `D5:HX711` |
| D7 TRIG · D8 ECHO | `DIST` (cm) | HC-SR04 초음파 | `D7:HC-SR04` |
| D10 CS · D12 SO · D13 SCK | `TK` (°C) | MAX6675 K형 열전대 | `D10:MAX6675` |
| I2C 0x44·0x45 | `TA`, `RH` | Modulino Thermo, SHT30/31 | `qwiic:SHT3x`, `i2c:HS3003` |
| I2C 0x76·0x77 | `TA`, `BP`, (`RH`) | BMP280, BME280 | `i2c:BME280` |
| I2C 0x5C·0x5D | `BP`, `TA` | Modulino Pressure (LPS22) | `qwiic:LPS22` |
| I2C 0x62 | `CO2`, `TA`, `RH` | SCD40 / SCD41 | `i2c:SCD4x` |
| I2C 0x29 | `COLR`, `COLG`, `COLB` (%) | TCS34725 컬러 | `i2c:TCS34725` |

I2C는 Qwiic 단자(UNO R4 WiFi·Nano R4의 `Wire1`, `qwiic:`)와 SDA·SCL 핀(`Wire`, `i2c:`)을 모두 검색합니다. 데모 모드에서는 `T`, `TA`, `RH`가 없으면 가짜 값을 보냅니다.

보드별 펌웨어 범위: 전체(UNO R4 WiFi·R4 Minima·Nano R4·Mega 2560), 가벼운 버전(UNO R3·Nano: LPS22·SCD4x·TCS34725·MAX6675·HC-SR04 제외), 가장 가벼운 버전(Leonardo: BMP/BME280·HX711도 제외).

## 6. 실험 템플릿

`protocol/experiments/*.json` 파일 하나가 실험 하나입니다. 웹앱과 애플 앱이 같은 파일을 읽습니다.

```json
{
  "id": "titration",
  "title": "식초 속 아세트산은 몇 %",
  "subject": "화학",
  "standards": ["12화학04-03","12화학04-04","12반응01-03"],
  "sensors": ["pH"],
  "mode": "event",
  "event": {"label":"NaOH 부피","unit":"mL","start":0,"step":1,"scale":"linear"},
  "intervalMs": 500,
  "x": {"label":"NaOH 부피","unit":"mL"},
  "y": [{"sensor":"pH","label":"pH","min":0,"max":14}],
  "markers": {"enabled": false, "label": "", "prompt": ""},
  "analysis": ["stats","equivalence","fit"],
  "steps": ["...학생 안내 문장..."]
}
```

- `sensors`, `y[].sensor`: 센서 **종류(type)**. 같은 종류의 첫 센서를 씁니다. `"*"`는 연결된 모든 센서.
- `mode`
  - `time`: 정해진 간격으로 자동 기록. 가로축은 시간.
  - `event`: 보드는 계속 측정하고, 학생이 `값 기록`을 누를 때 최근 1초 평균을 입력값(`event`)과 함께 한 점으로 기록. 가로축은 입력값 (적정 부피, 희석 배수 등).
- `event.scale`: `log`이면 가로축을 로그 눈금으로 그리고, 다음 값 제안은 `× step`.
- `markers`: 시간 모드에서 그 순간에 메모를 붙이는 기능.
- `setup`: 연결 안내 — `parts`(`protocol/guide.json`의 부품 id), `materials`(준비물), `attach`(실험 장치에 붙이는 방법), `cautions`(실험할 때 주의). 없으면 앱이 필요한 센서로 부품을 추정하고 부착 안내는 "준비 중"으로 표시.
- `analysis`: 해석 도구 — `stats`(구간 통계), `fit`(직선 맞춤), `equivalence`(당량점·반당량점), `plateau`(평탄 구간, 예: 어는점).

## 7. 연결 안내 (`protocol/guide.json`, `tools/make_guide.py`로 생성)

보드 종류별 연결 방법과 주의할 점을 적은 파일입니다. 웹앱과 애플 앱이 같은 파일을 읽습니다.

- `common`: 모든 실험 공통 규칙
- `boards[]`: `id`, `name`, `match`(hello의 board 이름과 맞춰 볼 문자열), `firmware`(`supported`·`partial`·`none`), USB·블루투스·핀 전압·아날로그·Qwiic 정보, `connectors.{qwiic,onewire,analog}`의 연결 순서와 주의
- `connectors{}`: 연결 방식별 배선 — `wires[]`(센서 단자 → 보드 핀 역할), `cable`(Qwiic), `resistor`
- `boards[].pins`: 핀 역할 → 이 보드의 핀 이름 (`SDA` → `D20 (SDA)` 등), `sensorSet`: 펌웨어 범위
- `parts[]`: 센서 — `category`, `connector`, `provides`(센서 종류), `minSet`(필요한 펌웨어 범위), `analogType`(아날로그 포트에 지정할 종류), `items`, `cautions`, `addr`(I2C 주소)
- 전원·전압 표시 (v2.1, 공식 데이터시트 점검 반영): `parts[].needs5V`(전원 5 V 전용 → 연결 방식 `analog-5v`·`uart`·`pulse`·`ultrasonic`은 VCC를 핀 역할 `PWR5`에 둠), `outOver33`(출력이 3.3 V를 넘어 3.3 V 보드에서는 2:1 분압 필요), `currentMa`(대략 소비 전류). `boards[].pins.PWR5`는 '항상 5 V인 핀'(5 V 보드 = 5V, UNO Q = 전원 헤더 5V, Nano ESP32 = VBUS). 앱은 3.3 V 보드 + `needs5V` 부품에 경고를, `outOver33`이면 분압 안내를 띄운다. 같은 I2C 주소를 쓰는 부품끼리는 생성기가 '한 버스에 함께 꽂지 않음' caution을 자동으로 붙인다. 가벼운 펌웨어 보드(lite·mini)는 지원하지 않는 연결의 핀 역할이 `—`로 나온다.
- 앱의 "바로 측정": 센서를 고르면 아날로그는 `PORT`, 디지털은 `HELLO`를 보내고, 해당 종류가 hello에 나타나면 측정을 시작합니다.

## 8. 시뮬레이터 전용 명령

웹앱의 "보드 없이 체험"만 이해하는 명령입니다. 실제 보드는 `unknown command`로 답합니다.

| 명령 | 뜻 |
|---|---|
| `SIMX <값>` | 값 입력 모드 체험용: 다음에 기록할 입력값(예: NaOH 부피)을 알려 주면 pH를 그에 맞게 만듦 |

## 9. 기기 센서 — 보드 없이 이 기기로 (2.0, sensors.json v5)

아이패드·아이폰·맥(애플 앱)과 브라우저(웹앱: 안드로이드 태블릿·크롬북 등)의 내장 센서를 **가상 보드 "이 기기"**로 다룹니다. 앱 안의 가상 보드(애플 `DeviceBoard.swift`, 웹 `lib/device.ts`의 `DeviceTransport`)가 실제 보드와 같은 줄을 만들므로 그래프·분석·저장·반 비교는 그대로 씁니다.

- hello: `fw: "device"`, `board: "이 기기"`, 센서마다 `src: "device"`. 이 기기에서 쓸 수 있는 종류만 보냄.
- 명령: `HELLO`·`START <ms>`(최소 20)·`STOP` 그대로. `START` 때 지금 실험이 쓰는 장치만 켬(마이크·카메라 권한을 그때만 물음). 실험이 센서를 정하지 않으면 권한이 필요 없는 움직임 센서만.
- `CAL <DAR|DAG|DAB|DCR…> OFS 0`: 지금 카메라 색을 흡광도 기준(I₀, 빈 용액)으로 → `{"type":"cal",…,"points":1}`. `CAL <id> CLEAR`로 지움. 앱의 [0 맞추기] 버튼이 같은 일을 함.
- 카드 목록: `protocol/device_sensors.json` (`kits[]`: id·name·category·provides·platforms(ios·mac·web)·how·cautions·ideas). 센서가 없는 기기에서는 카드를 숨김. i18n 키 `device.<id>.*`.
- 실험: `cur-d-*` (`make_experiments.py`의 "2.0 기기 내장 센서 실험", 과목 "기기 센서 실험"). 보드에 그 센서가 없고 이 기기로 되면 실험 카드를 누를 때 '이 기기'로 바꿔 연결.

| type | 뜻 | 단위 | 애플(iOS·맥) | 웹 |
|---|---|---|---|---|
| `DACC` `DAX` `DAY` `DAZ` | 가속도 크기·x·y·z (중력 포함, 화면 위로 평평하면 z ≈ +9.8) | m/s² | iOS: CoreMotion | DeviceMotionEvent (iOS 사파리는 부호를 뒤집어 맞춤, 허락은 연결 버튼에서) |
| `DGYR` | 회전 속도 크기 | rad/s | iOS | DeviceMotionEvent.rotationRate (°/s → rad/s) |
| `DMAG` | 자기장 크기 | µT | iOS | — |
| `DBAR` | 기압 | kPa | iOS: CMAltimeter | — |
| `DSND` | 소리 크기 (dBFS + 100, 기기마다 다른 상대값) | dB | 마이크 4096점 RMS | getUserMedia + AnalyserNode |
| `DFRQ` | 가장 센 진동수 (Hann·FFT·포물선 보간, 50 Hz 미만 제외, 40 dB 미만이면 0) | Hz | 〃 | 〃 |
| `DCR` `DCG` `DCB` | 카메라 가운데 1/5 사각형의 평균 색 (10 Hz) | 0–255 | 뒤 카메라(맥: 기본 카메라) | getUserMedia(environment) + canvas |
| `DAR` `DAG` `DAB` | 흡광도 −log₁₀(I/I₀), I₀ = [0 맞추기] 때의 색(없으면 255) | — | 〃 (0 맞춘 뒤 노출·화이트밸런스 고정) | 〃 (지원 브라우저만 고정) |

권한 문구: 애플 `NSMicrophoneUsageDescription`·`NSMotionUsageDescription`·`NSCameraUsageDescription`(tools/make_l10n.py DISPLAY → 언어별 InfoPlist.strings), 맥 샌드박스 `com.apple.security.device.audio-input`·`device.camera`. 소리·영상은 저장하지 않고 숫자만 기록 (개인정보 처리방침 3).

## 웹앱에서 측정 프로그램 설치 (v1.4)

- USB로 연결한 뒤 약 4.5초 안에 `hello`가 오지 않으면 "측정 프로그램이 없는 보드"로 봅니다 (2.5초에 `HELLO`를 한 번 더 보냄).
- `hello.fw`가 웹앱에 들어 있는 버전(`web/src/lib/flash/index.ts`의 `BUNDLED_FW`)보다 낮으면 업데이트를 권합니다.
- 보드 알아보기: USB VID/PID (0x2341·0x2A03 정품). CH340(0x1A86)·CP210x(0x10C4)·FTDI(0x0403)는 호환 보드 → 1단계에서 고른 보드를 씁니다.
- 굽는 방식 (Web Serial, 크롬·엣지):

| 보드 | 방식 | 속도 | 파일 |
|---|---|---|---|
| Mega 2560 | STK500v2 (DTR 리셋, 256바이트 페이지, 읽어서 확인) | 115200 | `web/public/firmware/mega2560.hex` |
| UNO R3 | STK500v1 (optiboot, 128바이트 페이지) | 115200 | `uno.hex` |
| Nano | STK500v1 | 115200 → 안 되면 57600 (옛 부트로더) | `nano.hex` |
| UNO R4·Nano R4·Leonardo | 아직 Arduino IDE로 한 번 올림 | | |

- 펌웨어를 바꾸면: Arduino IDE에서 보드별로 *Sketch → Export Compiled Binary* → `build/arduino.avr.*/chemdict_fw.ino.hex`를 위 이름으로 복사하고 `BUNDLED_FW`를 맞춥니다.
- `guide.json`의 `troubles[]`(id, title, steps)는 3단계 "문제 해결" 목록입니다.

## 측정 간격 (v1.5)

- `START <ms>`의 `<ms>`는 100 ~ 3,600,000 (0.1초 ~ 60분). 웹앱은 자주 쓰는 값 + 직접 입력(초·분)을 제공합니다. 펌웨어는 100 ms 미만만 올려 맞춥니다.
- DHT는 약 2초, SCD4x는 5초마다 새 값을 만들므로 그보다 짧은 간격에서는 같은 값이 반복됩니다.

## 데이터 해석·저장 (웹앱)

- 해석: 함수 찾기(직선·비례·2차·3차·지수·지수 접근·거듭제곱·로그·반비례 + 자동), 접선, 넓이(사다리꼴 적분), 변화율 그래프, 부드럽게(이동 평균), 가로축 바꾸기(다른 센서), 선택 구간 확대, 표 계산 열, 점 제외. 코드: `web/src/lib/fit.ts`, `calc.ts`.
- 저장: PNG(그래프+해석 한 장), PDF(A4, 페이지를 그림으로 넣어 한글 글꼴 불필요), .xlsx(측정별 시트 + 엑셀 분산형 그래프 + 추세선, Numbers에서 그대로 열림), CSV. 코드: `web/src/lib/report.ts`, `xlsx.ts`, `pdf.ts`.

## 온도 센서 여러 개 (펌웨어 0.3.1)

- DS18B20을 D2 한 줄에 여러 개 꽂으면 id `T`, `T_OW2`, `T_OW3`, `T_OW4`로 보냅니다 (R4·Mega 4개, UNO R3·Nano 2개). 1점 보정은 첫 번째(`T`)에만 적용됩니다.
- 앱은 실험 템플릿의 y가 센서 종류(`T`)이면 그 종류의 센서마다 그래프를 하나씩 그립니다 ('온도 1', '온도 2').

## 교육과정 실험 (protocol/experiments/cur-*.json)

- `tools/make_experiments.py`로 생성합니다 (json 직접 수정 금지). 손으로 만든 실험 5개에는 같은 스크립트가 찾기 정보만 덧붙입니다.
- 추가 필드: `level`(중학교 / 고1 공통 / 고2·3 선택 / 공통), `course`, `area`, `summary`, `standardTexts`, `textbooks[]`(publisher, course, note, sure = confirmed·mentioned·similar).
- 성취기준 문장은 교육과정 정리본·교육청 자료에서 옮긴 것입니다. 수업 자료에 쓰기 전 NCIC 원문과 대조합니다.

## 실험 정보 (웹앱, 선택)

- 측정 화면의 '실험 정보'에서 모둠·실험조, 이름, 학년·반, 장소, 날짜, 시간, 메모를 적습니다 (`web/src/lib/info.ts`).
- 날짜·시간을 비우면 첫 측정의 시작 시각(`Run.startedAt`)이 들어갑니다. 측정마다 시작 시각과 '저장한 때'도 함께 남깁니다.
- 저장 파일: PNG·PDF는 제목 아래 정보 상자, 엑셀은 '그래프'·'해석' 시트 위쪽, CSV는 표 위 이름–값 줄로 들어갑니다.
- 모둠·이름·반·장소는 브라우저 저장소에 기억해 다음 실험에 미리 채웁니다 (그 기기에만).

## 참고 자료 파일 (웹앱·애플 앱 공통, v2.1)

- `protocol/analysis_methods.json` — 센서 가족별 추천 그래프·해석 도구·읽는 요령. `bySensor[type]` + `aliases{변형 type → 가족 type}`. `methods[].tool`은 앱 도구 이름(평탄 구간·당량점 찾기·접선·넓이·변화율 그래프·값 읽기·구간 선택·계산 열 → …·함수 찾기 → …)으로 시작해야 [적용] 단추가 그 도구를 켠다.
- `protocol/sensor_checks.json` (`tools/make_sensor_checks.py`로 생성) — 센서 점검: `range`·`accuracy`·`resolution`·`response`(사양), `refs[]`(기준 상황: `expect`±`tol` 또는 `min`~`max`, 단위는 sensors.json과 같음), `test[]`(정상 작동 테스트 절차), `fail[]`(고장 신호 → 원인), `errorNote`. 앱의 '센서 점검' 화면은 최근 값 평균·흔들림(표준편차)을 기준 상황과 비교해 오차(절대·상대)와 통과 여부를 보여 주고, 해석 패널의 '기준값과 비교'는 선택 구간 평균(없으면 평탄 구간 평균, 없으면 마지막 값)과 이론값의 오차를 계산한다.
- `protocol/reagents.json` — 실험 준비물에 나오는 시약의 위험·보호구·조제·보관·폐기·응급 처치. `matches`(+`name`·`aliases`)가 준비물 문구의 부분 문자열이면 연결되며, 긴 이름부터 맞추고 맞은 글자는 지워 '아세트산 나트륨'이 '아세트산'으로 다시 잡히지 않게 한다.

## 다국어 (웹앱)

- 언어 10개: ko, en, ja, zh(간체), es, fr, de, pt(브라질), vi, id. 화면 오른쪽 위 🌐에서 고르고, 처음에는 브라우저 언어를 따릅니다 (`chemdict.lang`에 기억).
- 원문: `protocol/i18n/source/ui.json`(화면 문구, 키 = 한국어) · `content.json`(guide·실험·센서, 키 = 경로). 번역: `protocol/i18n/<lang>/ui.json`, `content.json`, `glossary.json`(용어 통일).
- 번역이 없는 문구는 한국어로 보입니다. 성취기준 코드([9과03-01] 등)는 공식 코드라 번역하지 않습니다.
- 찾기에 쓰는 값(학교급·과목·영역·센서 분류)은 한국어로 두고 화면에서만 번역합니다.

## 오프라인 모드 (PWA, 웹앱)

- `vite-plugin-pwa`가 서비스 워커(`sw.js`)를 만들어 앱·번역 10개·펌웨어 hex·로고를 기기에 저장합니다 (약 3.3 MB).
- 한 번 접속한 뒤에는 인터넷 없이 열리고, USB·블루투스 측정과 파일 저장도 그대로 됩니다.
- 새 버전은 자동으로 바꾸지 않고 '새 버전이 있습니다 · 지금 업데이트'를 보여 줍니다 (측정 중에는 미룸). 1시간마다 새 버전을 확인합니다.
- 크롬·엣지에서는 '앱으로 설치'가 나오면 바탕화면 아이콘으로 설치할 수 있습니다.

## 추가 센서 (펌웨어 0.4.0, sensors.json v3)

디바이스마트 등 국내에서 파는 아두이노 센서 모듈을 넣었습니다. 연결 안내 86종(`tools/make_guide.py`의 `MORE_PARTS`).

**아날로그 type** (모든 보드, 값 = slope × V + offset):

| type | 센서 | 변환 | 보정 |
|---|---|---|---|
| `TKA` | AD8495 K형 열전대 | 200 V − 250 °C | 1점 |
| `CO2N` | SEN0219 적외선 CO₂ | 3125 V − 1250 ppm | 없음 |
| `REFL` `FLEX` `VIB` `PULS` `ECG` `EMG` `GSR` | 반사·휨·압전·생체 (상대값) | 20 V % | 없음 |
| `FLAM` `RAIN` | 불꽃·빗물 (상대값) | 100 − 20 V % | 없음 |
| `DOUT` | DO 출력 모듈 (PIR, SW-420, 기울기, 홀, 포토 인터럽터, 광전 수위) | 0.2 V (0/1) | 없음 |
| `AXA` `AYA` `AZA` | ADXL335 (3.3 V) | 29.72 V − 49.03 m/s² | 2점 (±9.81) |
| `I5A` `I20A` `I30A` | ACS712 5·20·30 A | 185·100·66 mV/A, 2.5 V 영점 | 1점 (0 A) |
| `V25` | 전압 감지 모듈 | 5 V | 없음 |
| `DBA` | SEN0232 소리 크기 | 50 V dBA | 없음 |
| `DOX` | 용존 산소 | 5.2 V mg/L | 배율, 필수 |
| `ORP` | ORP SEN0165 | 2000 − 1000 V mV | 1점 |

MQ-2·3·4·7·8·9·135, MG811은 기존 `GAS`, 마이크 앰프는 `SND`, 저항식 토양은 `SOIL`을 씁니다.

**디지털 type** (`sensors_more.ino`, `FULL_SENSORS` 보드 = UNO R4·Nano R4·Mega만):

| 연결 | type | 센서 |
|---|---|---|
| I2C 0x23·0x5C / 0x10 / 0x29 | `LUX` (lx) | BH1750 / VEML7700 / TSL2591 |
| I2C 0x38 · 0x40 · 0x44·0x45 | `TA`, `RH` | AHT20·DHT20 · HTU21D·Si7021 · SHT4x |
| I2C 0x77 (id 0x55) | `TA`, `BP` | BMP180 |
| I2C 0x5A | `TIR`, `TA` | MLX90614 |
| I2C 0x18–0x1F | `T` | MCP9808 |
| I2C 0x40–0x45 | `VDC` (V), `IDC` (mA) | INA219, INA260 |
| I2C 0x68·0x69 / 0x53·0x1D / 0x18·0x19 / 0x6A·0x6B | `AX` `AY` `AZ` (m/s²) | MPU6050 / ADXL345 / LIS3DH / LSM6DS |
| I2C 0x0D / 0x1E | `MAG` (µT) | QMC5883L / HMC5883L |
| I2C 0x58 / 0x5A·0x5B / 0x52·0x53 | `ECO2` (ppm), `TVOC` (ppb) | SGP30 / CCS811 / ENS160 |
| I2C 0x61 | `CO2`, `TA`, `RH` | SCD30 |
| I2C 0x70–0x73 | `O2I` (%) | DFRobot SEN0322 |
| I2C 0x57 | `PPG` | MAX30102 (적외선 원값) |
| I2C 0x29 | `DIST` (cm) | VL53L0X (Pololu 라이브러리가 있을 때만) |
| UART (R4 D0·D1 = `Serial1`, Mega D19·D18) | `PM1` `PM25` `PM10` (µg/m³) 또는 `CO2` | PMS7003 / MH-Z19 (켤 때 하나만 판별) |

- 같은 주소를 쓰는 칩은 칩 ID로 구분하고, 이미 다른 센서로 잡힌 주소는 건너뜁니다 (예: 0x40 INA219 ↔ HTU21D, 0x5A MLX90614 ↔ CCS811).
- 연결 안내에 핀 역할 `U_RX`·`U_TX`(UART)와 연결 방식 `uart`, `digital-out`, 분류 '움직임·자기', '생체'가 더해졌습니다. UNO R3·Nano·Leonardo의 UART 핀은 `—`(지원 안 함).
- 웹앱 센서 카드에 이름·부품 번호 찾기 칸을 두고, 연결된 센서를 앞에 보입니다.

## 추가 센서 2 (펌웨어 0.5.0, sensors.json v4)

국내 아두이노 공식 판매처(엘레파츠·아이씨뱅큐·메카솔루션·디바이스마트) 조사로 빠진 센서를 넣었습니다 (`docs/research/official_distributors_sensors.md`). 연결 안내 146종 (`make_guide.py`의 `MORE_PARTS2`).

**D3 펄스 포트** (전체 버전만): `PORT D3 <type> [slope offset]`. 보드는 D3의 하강 에지를 세어 초당 펄스 수(Hz)를 x로 쓰고, 값 = slope × x + offset. 평균 시간: `CPM`·`USVH` 60초, `BPM` 10초, 나머지 2초. hello의 `src`는 `"D3"`. 설정은 EEPROM의 기존 설정 뒤에 따로 저장(예전 설정 유지).

| type | 센서 | 변환 |
|---|---|---|
| `FLOW` | 유량 YF-S201 | Hz ÷ 7.5 L/min (배율 보정) |
| `CPM` / `USVH` | 가이거 계수기 | Hz × 60 회/분 / ÷ 151 µSv/h |
| `BPM` | 귀 클립 심박 | Hz × 60 |
| `WNDP` | 펄스형 풍속계 | 0.062 × Hz m/s |
| `RPM` / `FREQ` | 회전수 / 주파수 | Hz × 60 / Hz |

**곡선 변환 아날로그 type** (펌웨어가 x를 먼저 계산, 전체 버전만, sensors.json `full: true`): `IRD` GP2Y0A21 (x = V^−1.15, ×27.86 cm), `IRDS` GP2Y0A41 (x = V^−1.058, ×12.08 cm), `TNTC` 10 kΩ NTC B3950 (x = °C, NTC가 5V 쪽·10 kΩ 저항이 GND 쪽 = 분압 연결 안내와 같음).

**그 밖의 아날로그 type**: `UVML` ML8511, `WPRS` 수압 SEN0257, `DP` MPX5010DP, `WIND` SEN0170, `ANGA` SEN0221, `I5B` ACS723, `I50A` ACS758, `DUS` MaxBotix.

**디지털 (sensors_more2.ino, 전체 버전)**:

| 연결 | type | 센서 |
|---|---|---|
| I2C 0x48~0x4B | `T` / `VP` (V, A0−A1 차동 ±4.096 V) | TMP117·TMP119·TMP102 / ADS1115·ADS1015 |
| I2C 0x76·0x77 | `TA`, `BP` | BMP388·BMP390 · DPS310 · MS5611 |
| I2C 0x60 / 0x60~0x67 | `TA`,`BP` · `UVI` / `TK` | MPL3115A2 · SI1145 / MCP9600 |
| I2C 0x36 | `ANG` (°) | AS5600 |
| I2C 0x68·0x69 / 0x1C·0x1D / 0x28·0x29 | `AX` `AY` `AZ` (+ BNO055 `ANG` 방위각) | ICM-20948·20649 / MMA8452Q / BNO055 (ADXL313은 ADXL345 칸) |
| I2C 0x1C·0x1E / 0x0E / 0x10~0x13 / 0x35·0x22·0x78 | `MAG` (µT) | LIS3MDL / MAG3110 / BMM150(근삿값) / TMAG5273 |
| I2C 0x39 | `S415`…`S680` (원시값) / `COLR` `COLG` `COLB` | AS7341 / APDS9960 |
| I2C 0x53 | `UVI` / `COLR` `COLG` `COLB` `LUX` | LTR390 / LTR381 (Modulino Light) |
| I2C 0x59 | `VOCR` | SGP40 원시값 |
| I2C 0x5C / 0x27 | `TA`, `RH` | AM2320 / HIH6130 |
| I2C 0x29 | `DIST` | VL6180X · VL53L1X · VL53L4CD (Modulino Distance) — 라이브러리 없이 |
| I2C 0x2A | `M` (HX711이 없을 때 같은 무게 칸·보정) | NAU7802 |
| SPI D10·D12·D13 | `TK` | MAX31855 (MAX6675와 자동 구분) |
| SPI D9(CS)·D11(SDI)·D12·D13 | `TPT` (°C) | MAX31865 + PT100 (기준 저항 430 Ω) |
| UART 9600 | `CO2` / `DIST` / `HCHO` (ppm) / PMS5003ST는 `HCHO` `TA` `RH` 추가 | CM1106·CM1108 · COZIR·SprintIR · MH-Z14A·MH-Z16 / A02YYUW / SEN0231 |
| UART 115200 | `DIST` | TFmini-S·TFmini Plus·TF-Luna |

- 아직 안 되는 것: 열화상(AMG8833·MLX90640), GP2Y1014AU·PPD42NS, TCS3200, RS485 토양 센서, SEN0321·MiCS-4514, HTU31D·SHT1x·ICP-10111·MS5540C·HPMA115, MAX32664.
- 메모리(2026-10-18 컴파일): UNO R4 WiFi 약 157 KB (60%) / RAM 44%, Mega 약 74 KB (29%) / RAM 46%, UNO R3 30568 B (95%), Nano 30566 B (99%).
