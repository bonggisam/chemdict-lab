# ChemDict Lab 통신 규칙 v1

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
{"type":"hello","fw":"0.1.0","board":"UNO R4 WiFi","station":3,"demo":false,
 "sensors":[
  {"id":"pH","name":"pH","unit":"","src":"A0","cal":true},
  {"id":"L","name":"빛","unit":"%","src":"A1","cal":false},
  {"id":"T","name":"온도","unit":"°C","src":"onewire","cal":false}
 ]}
```

- `sensors`: 보드가 지금 읽을 수 있는 센서 목록. 앱은 이 목록으로 화면을 만듭니다.
- `src`: 센서가 연결된 곳 (`A0`~`A3`, `onewire`, `i2c:0x44` 등)
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
| `HELLO` | hello 메시지를 다시 보내 달라 |
| `START <ms>` | `<ms>` 밀리초 간격으로 측정 시작 (최소 100, 기본 1000) |
| `STOP` | 측정 정지 |
| `DEMO ON` / `DEMO OFF` | 데모 모드 켜기/끄기 (센서 없이 가짜 데이터) |
| `CAL <id> <n> <값>` | 지금 측정값을 기준값 `<값>`으로 기록 (`<n>`은 1 또는 2) |
| `CAL <id> CLEAR` | 해당 센서 보정값 지우기 |
| `STATION <n>` | 모둠 번호 설정 (1~8, BLE 이름이 바뀜, 재부팅 후 적용) |

보정 예 (pH 2점):
```
CAL pH 1 7.00     ← pH 7 완충 용액에 담근 상태에서
CAL pH 2 4.00     ← pH 4 완충 용액에 담근 상태에서
```
두 번째 점이 기록되면 보드가 기울기·절편을 계산해 저장하고 `cal` 메시지를 보냅니다.

## 5. 아날로그 포트 기본 배정

| 포트 | 센서 id | 이름 | 단위 | 기본 변환 |
|---|---|---|---|---|
| A0 | `pH` | pH | | pH = −5.70 × V + 21.34 (보정 전 기본값) |
| A1 | `L` | 빛 | % | V / 5 × 100 |
| A2 | `EC` | 전도도 | V | 전압 그대로 (보정 후 단위 지정) |
| A3 | `V` | 전압 | V | 전압 그대로 |

디지털 센서는 자동 인식합니다.

| 연결 | 센서 id | 이름 | 인식 방법 |
|---|---|---|---|
| D2 (OneWire) | `T` | 온도 | DS18B20 장치 검색 |
| Qwiic (Wire1) 0x44 | `TA` | 기온 | Modulino Thermo (HS3003) 응답 |
| Qwiic (Wire1) 0x44 | `RH` | 습도 | 위와 같음 |

## 6. 실험 템플릿

`protocol/experiments/*.json` 파일 하나가 실험 하나입니다. 웹앱과 애플 앱이 같은 파일을 읽습니다.

```json
{
  "id": "ph-dilution",
  "title": "묽힐수록 pH는 얼마나 변할까",
  "subject": "화학",
  "standards": ["12화학04-01","12화학04-02"],
  "sensors": ["pH"],
  "intervalMs": 1000,
  "x": {"label":"시간","unit":"s"},
  "y": [{"sensor":"pH","label":"pH","min":0,"max":14}],
  "markers": {"enabled": true, "label": "희석 단계", "prompt": "희석 배수를 입력하세요"},
  "steps": ["...학생 안내 문장..."]
}
```

- `markers`: 측정 중 학생이 버튼을 눌러 그 순간에 값을 붙이는 기능 (예: 적정 부피, 희석 배수)
