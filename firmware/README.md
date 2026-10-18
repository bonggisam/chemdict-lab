# ChemDict Lab 펌웨어 — UNO R4 WiFi

## 처음 올리기 (교사, 보드마다 한 번)

1. Arduino IDE 2 설치
2. **보드 매니저**에서 `Arduino UNO R4 Boards` 설치
3. **라이브러리 매니저**에서 설치: `ArduinoBLE`, `OneWire`, `DallasTemperature`
4. `chemdict_lab/chemdict_lab.ino` 열기 → 보드 `Arduino UNO R4 WiFi` 선택 → 업로드
5. 시리얼 모니터(115200, 줄 끝: 새 줄)를 열면 `{"type":"hello",...}` 한 줄이 보입니다.

### 보드별 준비 (2026-10-18 컴파일 확인, 펌웨어 0.5.0)

| 보드 | 보드 매니저 | 센서 범위 | 프로그램 / 메모리 | 연결 |
|---|---|---|---|---|
| UNO R4 WiFi (기준, 실제 확인) | Arduino UNO R4 Boards | 전체 | 60% / 44% | USB·블루투스 |
| UNO R4 Minima | Arduino UNO R4 Boards | 전체 | 0.3.0 기준 34% / 20% (0.5.0 미확인) | USB |
| Nano R4 | Arduino UNO R4 Boards | 전체 | 0.3.0 기준 34% / 24% (0.5.0 미확인) | USB |
| Mega 2560 | Arduino AVR Boards | 전체 | 29% / 46% | USB |
| UNO R3 | Arduino AVR Boards | 가벼운 버전 | 95% / 56% | USB |
| Nano | Arduino AVR Boards | 가벼운 버전 | 98% / 56% | USB |
| Leonardo | Arduino AVR Boards | 가장 가벼운 버전 | 0.3.0 기준 98% / 38% (0.5.0 미확인) | USB |

라이브러리: `OneWire`, `DallasTemperature` (+ UNO R4 WiFi는 `ArduinoBLE`). 그 밖의 센서는 라이브러리 없이 직접 읽습니다.
선택: `VL53L0X` (Pololu) — 설치되어 있으면 레이저 거리 센서도 읽습니다 (`__has_include`로 자동).

### 펌웨어 0.4.0 — 추가 센서 (`sensors_more.ino`)

전체 버전 보드(UNO R4·Nano R4·Mega)만 컴파일합니다. 2026-10-17 컴파일: UNO R4 WiFi 137264 B (52%) / RAM 42%, Mega hex 135684 B. UNO R3·Nano는 크기 변화 없음.
I2C: BH1750, VEML7700, TSL2591, AHT20/DHT20, HTU21D/Si7021, SHT4x, BMP180, MLX90614, MCP9808, INA219, INA260, MPU6050, ADXL345, LIS3DH, LSM6DS, QMC5883L, HMC5883L, SGP30, CCS811, ENS160, SCD30, SEN0322 산소, MAX30102, VL53L0X. UART(`Serial1`): PMS7003 미세먼지 또는 MH-Z19 CO₂.
### 펌웨어 0.5.0 — 추가 센서 2 (`sensors_more2.ino`)

공식 판매처 조사로 I2C 26종·SPI 2종·UART 6종·D3 펄스 입력을 더했습니다 (표는 PROTOCOL.md "추가 센서 2"). 2026-10-18 컴파일: UNO R4 WiFi 약 157 KB (60%) / RAM 44%, Mega 약 74 KB (29%) / RAM 46%, UNO R3 30568 B (95%), Nano 30566 B (99%).
VL53L1X·VL53L4CD·VL6180X는 라이브러리 없이 ST 기본 설정으로 직접 읽습니다.

`.ino`는 IDE가 이름 순서로 이어 붙이므로 (`sensors_more2.ino`가 `sensors_more.ino` 뒤에 와야 함) 사용자 정의 타입을 함수 매개변수에 쓰지 않습니다(자동 원형 선언 오류). `B1`·`B2` 같은 이름은 AVR 2진수 매크로와 겹치니 쓰지 않습니다.
보드 종류와 센서 범위는 펌웨어가 자동으로 정합니다. 센서 연결 방법은 앱의 **연결 안내** 탭을 보세요.

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
