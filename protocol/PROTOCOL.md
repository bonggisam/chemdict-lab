# ChemDict Lab 통신 규칙 v1.2

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
{"type":"hello","fw":"0.2.2","board":"UNO R4 WiFi","station":3,"demo":false,
 "sensors":[
  {"id":"pH","type":"pH","name":"pH","unit":"","src":"A0","cal":true},
  {"id":"L","type":"L","name":"L","unit":"","src":"A1","cal":false},
  {"id":"pH_A2","type":"pH","name":"pH","unit":"","src":"A2","cal":false},
  {"id":"T","type":"T","name":"T","unit":"","src":"onewire","cal":false}
 ]}
```

- `sensors`: 보드가 지금 읽을 수 있는 센서 목록. 앱은 이 목록으로 화면을 만듭니다.
- `type`: 센서 종류. **이름·단위·소수 자리·보정 방법은 앱이 `protocol/sensors.json`에서 찾습니다.** (보드는 `name`에 type을 그대로 넣음)
- `id`: 데이터 메시지의 키. 보통 type과 같고, 같은 종류가 두 포트에 있으면 두 번째부터 `pH_A2`처럼 포트가 붙습니다.
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
| `PORT <A0~A3> <type> [slope offset]` | 아날로그 포트에 꽂은 센서 종류와 기본 변환식(값 = slope × 전압 + offset) 지정. EEPROM에 저장, 보정은 초기화, 이어서 hello 전송 |
| `PORT <A0~A3> OFF` | 포트 사용 안 함 |
| `CAL <id> <n> <값>` | 2점 보정: 지금 측정값을 기준값 `<값>`으로 기록 (`<n>`은 1 또는 2) |
| `CAL <id> OFS <값>` | 1점(영점) 보정: 지금 값이 `<값>`이 되도록 절편만 이동 |
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

디지털 센서는 자동 인식합니다.

| 연결 | 센서 id | 이름 | 인식 방법 |
|---|---|---|---|
| D2 (OneWire) | `T` | 온도 | DS18B20 장치 검색 |
| Qwiic 0x44 | `TA`, `RH` | 기온, 습도 | Modulino Thermo 구형 (HS3003) |
| Qwiic 0x45 | `TA`, `RH` | 기온, 습도 | Modulino Thermo 신형 V0.5~ (GXHT30, SHT3x 방식) |
| D4 | `TA`, `RH` | 기온, 습도 | DHT11 / DHT22 응답 (`src`: `D4:DHT11` 또는 `D4:DHT22`). Modulino와 함께 있으면 id가 `TA_D4`, `RH_D4` |

Qwiic 버스: UNO R4 WiFi는 Qwiic 단자(`Wire1`, 3.3 V), UNO R4 Minima·R3는 SDA·SCL 핀(`Wire`). 데모 모드에서는 `T`, `TA`, `RH`도 가짜 값을 보냅니다.

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

## 7. 연결 안내 (`protocol/guide.json`)

보드 종류별 연결 방법과 주의할 점을 적은 파일입니다. 웹앱과 애플 앱이 같은 파일을 읽습니다.

- `common`: 모든 실험 공통 규칙
- `boards[]`: `id`, `name`, `match`(hello의 board 이름과 맞춰 볼 문자열), `firmware`(`supported`·`partial`·`none`), USB·블루투스·핀 전압·아날로그·Qwiic 정보, `connectors.{qwiic,onewire,analog}`의 연결 순서와 주의
- `parts[]`: 부품 — `provides`(센서 종류), `connector`, `items`(준비물), `cautions`

## 8. 시뮬레이터 전용 명령

웹앱의 "보드 없이 체험"만 이해하는 명령입니다. 실제 보드는 `unknown command`로 답합니다.

| 명령 | 뜻 |
|---|---|
| `SIMX <값>` | 값 입력 모드 체험용: 다음에 기록할 입력값(예: NaOH 부피)을 알려 주면 pH를 그에 맞게 만듦 |
