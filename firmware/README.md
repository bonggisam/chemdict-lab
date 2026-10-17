# ChemDict Lab 펌웨어 — UNO R4 WiFi

## 처음 올리기 (교사, 보드마다 한 번)

1. Arduino IDE 2 설치
2. **보드 매니저**에서 `Arduino UNO R4 Boards` 설치
3. **라이브러리 매니저**에서 설치: `ArduinoBLE`, `OneWire`, `DallasTemperature`
4. `chemdict_lab/chemdict_lab.ino` 열기 → 보드 `Arduino UNO R4 WiFi` 선택 → 업로드
5. 시리얼 모니터(115200, 줄 끝: 새 줄)를 열면 `{"type":"hello",...}` 한 줄이 보입니다.

### 보드별 준비 (R4 WiFi는 2026-10-17 실제 보드 확인: 프로그램 45%, 메모리 38%)

| 보드 | 보드 매니저 | 라이브러리 | 연결 |
|---|---|---|---|
| UNO R4 WiFi (기준) | Arduino UNO R4 Boards 1.6.0 | ArduinoBLE 2.1.0, OneWire 2.3.8, DallasTemperature 4.0.6 (확인한 버전) | USB·블루투스 |
| UNO R4 Minima | Arduino UNO R4 Boards | OneWire, DallasTemperature | USB만 |
| UNO R3 | Arduino AVR Boards | OneWire, DallasTemperature | USB만 (메모리가 작아 시험용) |

보드 종류는 펌웨어가 자동으로 구분합니다. 센서 연결 방법은 앱의 **연결 안내** 탭을 보세요.

## 바로 시험하기 (센서 없이)

시리얼 모니터에 차례로 입력:

```
DEMO ON
START 1000
STOP
```

## 모둠 번호 정하기

```
STATION 3
```
보드를 다시 켜면 블루투스 이름이 `ChemDict-03`이 됩니다.

## 배선

| 센서 | 연결 |
|---|---|
| pH 모듈 출력 | A0 |
| 빛(광센서) | A1 |
| 전도도 | A2 |
| 전압 측정 | A3 (5 V 이하만!) |
| DS18B20 데이터 | D2 (4.7 kΩ 풀업, 모듈형은 내장) |
| Modulino Thermo | Qwiic 단자 |

전체 명령과 메시지 형식은 `protocol/PROTOCOL.md`를 보세요.
