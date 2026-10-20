"""protocol/guide.json 생성기 — 보드·연결 방식·센서 목록을 한곳에서 관리합니다.
실행: python3 tools/make_guide.py  (결과 파일을 직접 고치지 말고 이 파일을 고칩니다)"""
import json, pathlib

COMMON = [
    "선을 꽂거나 뺄 때는 USB 케이블을 먼저 뽑습니다.",
    "센서를 꽂은 뒤 앱에서 '센서 다시 찾기'를 누릅니다.",
    "5V(또는 3.3V) 핀과 GND 핀을 직접 잇지 않습니다 (합선으로 보드가 꺼지거나 망가짐).",
    "모듈의 VCC·GND를 바꿔 꽂지 않습니다. 모듈이 뜨거워지면 바로 USB를 뽑습니다.",
    "물·용액은 보드에서 멀리 두고, 보드는 쟁반이나 받침 위에 놓습니다.",
    "실험이 끝나면 USB를 뽑고 센서를 정리합니다. 젖은 센서는 헹군 뒤 말려서 보관합니다.",
    "가스(MQ)·미세먼지·CO₂(MH-Z19)처럼 전류가 큰 센서(100~180 mA)는 USB 전원(500 mA)으로는 2개까지만 함께 씁니다. 더 쓰거나 값이 흔들리고 보드가 다시 켜지면 DC 잭·VIN에 7~12 V 어댑터를 꽂습니다.",
]

# ---------------------------------------------------------------- 보드
# sensorSet: full(모든 센서) · lite(UNO R3·Nano: LPS22·SCD4x·TCS34725·MAX6675·HC-SR04 제외)
#            · mini(Leonardo: lite에서 BME280·HX711도 제외) · none(펌웨어 없음)
def pins5(sda='SDA (A4)', scl='SCL (A5)', onewire='D2', pwr='5V', urx='D0 (RX)', utx='D1 (TX)', pulse='D3', pwr5='5V'):
    return {"PWR": pwr, "PWR5": pwr5, "PWR3": "3.3V", "GND": "GND", "SDA": sda, "SCL": scl, "A": "A0",
            "ONEWIRE": onewire, "DHT": "D4", "HX_DT": "D5", "HX_SCK": "D6",
            "TRIG": "D7", "ECHO": "D8", "TC_CS": "D10", "TC_SO": "D12", "TC_SCK": "D13",
            "U_RX": urx, "U_TX": utx, "PULSE": pulse, "RTD_CS": "D9", "SPI_SDI": "D11"}

NO_UART = dict(urx="—", utx="—", pulse="—")   # 가벼운 버전 보드: UART·D3 펄스 없음

V33_NOTE = "3.3 V 보드입니다. 5 V 신호를 내는 모듈(MQ 가스, HC-SR04, 5 V 전용 pH 모듈 등)의 신호선을 바로 연결하지 않습니다."
CH340 = "호환 보드(CH340 칩)는 맥에 CH340 드라이버가 필요할 수 있습니다. 포트가 안 보이면 판매처의 드라이버를 설치합니다."

BOARDS = [
    dict(id="uno-r4-wifi", name="UNO R4 WiFi", match=["UNO R4 WiFi"], firmware="verified", sensorSet="full",
         firmwareNote="기준 보드. 실제 보드에서 확인했습니다. USB와 블루투스 모두 됩니다.",
         usb="USB-C", ble=True, logic="5 V", adc="14비트 (0~5 V)", qwiic="있음 (3.3 V)", pins=pins5(),
         notes=["I2C 센서는 Qwiic 단자와 SDA·SCL 핀 어디에 꽂아도 인식합니다.",
                "USB 전원일 때 5V 핀은 약 4.7 V입니다. LM35·TMP36·pH 모듈처럼 절대 전압을 내는 센서는 값이 5 %쯤 낮게 나올 수 있으니 [센서 점검]으로 확인하고 1점 보정을 하거나 DC 잭 전원(7~12 V)을 씁니다."]),
    dict(id="uno-r4-minima", name="UNO R4 Minima", match=["UNO R4 Minima"], firmware="compiled", sensorSet="full",
         firmwareNote="모든 센서 지원 (컴파일 확인, 실제 보드 확인 전). USB로만 연결됩니다.",
         usb="USB-C", ble=False, logic="5 V", adc="14비트 (0~5 V)", qwiic="없음", pins=pins5(), notes=[]),
    dict(id="nano-r4", name="Nano R4", match=["Nano R4"], firmware="compiled", sensorSet="full",
         firmwareNote="모든 센서 지원 (컴파일 확인, 실제 보드 확인 전). USB로만 연결됩니다.",
         usb="USB-C", ble=False, logic="5 V", adc="14비트 (0~5 V)", qwiic="있음 (3.3 V)",
         pins=pins5(sda="A4 (SDA)", scl="A5 (SCL)"),
         notes=["브레드보드에 꽂아 쓰면 선을 연결하기 쉽습니다. 핀 이름은 보드 옆면에 인쇄되어 있습니다.",
                "3V3 핀은 모듈 합계 약 150 mA까지입니다. CO₂·미세먼지처럼 전류가 큰 모듈은 'VIN 3–5 V' 표시가 있으면 5V 핀에 꽂습니다."]),
    dict(id="mega-2560", name="Mega 2560 (호환 포함)", match=["Mega 2560"], firmware="compiled", sensorSet="full",
         firmwareNote="모든 센서 지원 (컴파일 확인, 실제 보드 확인 전). USB로만 연결됩니다.",
         usb="USB-B (맥북은 변환 필요)", ble=False, logic="5 V", adc="10비트 (0~5 V)", qwiic="없음",
         pins=pins5(sda="D20 (SDA)", scl="D21 (SCL)", urx="D19 (RX1)", utx="D18 (TX1)"), notes=["I2C 핀이 A4·A5가 아니라 D20·D21입니다.", CH340, "UART 센서(미세먼지·MH-Z19)는 D19(RX1)·D18(TX1)에 연결합니다.",
                "열전대(MAX6675)와 PT100(MAX31865)은 D10·D11·D12·D13에 꽂습니다 (보드 실크의 SPI D50~D53·ICSP가 아님)."]),
    dict(id="uno-r3", name="UNO R3 (호환 포함)", match=["UNO R3"], firmware="compiled", sensorSet="lite",
         firmwareNote="메모리가 작아 가벼운 버전입니다 (기압 LPS22, CO₂, 색, 열전대, 초음파와 추가 I2C·UART 센서 제외). 아날로그 센서는 모두 됩니다. 컴파일 확인, 실제 보드 확인 전.",
         usb="USB-B (맥북은 변환 필요)", ble=False, logic="5 V", adc="10비트 (0~5 V)", qwiic="없음",
         pins=pins5(**NO_UART), notes=[CH340]),
    dict(id="nano", name="Nano (호환 포함)", match=["Nano"], firmware="compiled", sensorSet="lite",
         firmwareNote="가벼운 버전입니다 (UNO R3와 같음). 컴파일 확인, 실제 보드 확인 전.",
         usb="Mini-USB (호환품은 USB-C도 있음)", ble=False, logic="5 V", adc="10비트 (0~5 V)", qwiic="없음",
         pins=pins5(sda="A4 (SDA)", scl="A5 (SCL)", **NO_UART),
         notes=[CH340, "호환 Nano에 업로드가 안 되면 IDE의 Tools > Processor에서 'ATmega328P (Old Bootloader)'를 고릅니다."]),
    dict(id="leonardo", name="Leonardo", match=["Leonardo"], firmware="compiled", sensorSet="mini",
         firmwareNote="가장 가벼운 버전입니다 (BME280·HX711도 제외). 컴파일 확인, 실제 보드 확인 전.",
         usb="Micro-USB", ble=False, logic="5 V", adc="10비트 (0~5 V)", qwiic="없음",
         pins=pins5(sda="D2 (SDA)", scl="D3 (SCL)", onewire="D9", **NO_UART),
         notes=["D2·D3이 I2C 핀이라 DS18B20은 D9에 연결합니다."]),
    dict(id="nano-every", name="Nano Every", match=["Nano Every"], firmware="none", sensorSet="none",
         firmwareNote="ChemDict 펌웨어 준비 중입니다. 연결 방법만 참고하세요.",
         usb="Micro-USB", ble=False, logic="5 V", adc="10비트 (0~5 V)", qwiic="없음",
         pins=pins5(sda="A4 (SDA)", scl="A5 (SCL)"), notes=[]),
    dict(id="nano-esp32", name="Nano ESP32", match=["Nano ESP32"], firmware="none", sensorSet="none",
         firmwareNote="ChemDict 펌웨어 준비 중입니다. 연결 방법만 참고하세요.",
         usb="USB-C", ble=True, logic="3.3 V", adc="12비트 (0~3.3 V)", qwiic="없음",
         pins=pins5(sda="A4 (SDA)", scl="A5 (SCL)", pwr="3.3V", pwr5="VBUS (USB 전원일 때 5 V)"),
         notes=[V33_NOTE, "5 V 전용 센서의 전원은 VBUS 핀(USB 전원일 때만 5 V)에서 받고, 신호는 분압으로 3.3 V 이하로 낮춥니다.",
                "I2C는 A4·A5, UART 센서는 D0·D1(Serial0)입니다. 펌웨어 지원 전이라 UART·펄스·열전대 핀은 확인 전입니다."]),
    dict(id="nano-33-iot", name="Nano 33 IoT", match=["Nano 33 IoT"], firmware="none", sensorSet="none",
         firmwareNote="ChemDict 펌웨어 준비 중입니다. 연결 방법만 참고하세요.",
         usb="Micro-USB", ble=True, logic="3.3 V", adc="12비트 (0~3.3 V)", qwiic="없음",
         pins=pins5(sda="A4 (SDA)", scl="A5 (SCL)", pwr="3.3V", pwr5="VUSB (뒷면 VUSB 점퍼 납땜 필요)"), notes=[V33_NOTE]),
    dict(id="nano-33-ble-sense", name="Nano 33 BLE Sense Rev2", match=["Nano 33 BLE"], firmware="none", sensorSet="none",
         firmwareNote="ChemDict 펌웨어 준비 중입니다. 연결 방법만 참고하세요.",
         usb="Micro-USB", ble=True, logic="3.3 V", adc="12비트 (0~3.3 V)", qwiic="없음",
         pins=pins5(sda="A4 (SDA)", scl="A5 (SCL)", pwr="3.3V", pwr5="VUSB (뒷면 VUSB 점퍼 납땜 필요)"),
         notes=[V33_NOTE, "보드 안에 온습도·기압·색·소리·움직임 센서가 들어 있습니다 (Arduino Science Journal 앱에서 사용 가능)."]),
    dict(id="giga-r1", name="GIGA R1 WiFi", match=["GIGA"], firmware="none", sensorSet="none",
         firmwareNote="ChemDict 펌웨어 준비 중입니다. 연결 방법만 참고하세요.",
         usb="USB-C", ble=True, logic="3.3 V", adc="보드 문서 확인", qwiic="없음",
         pins=pins5(sda="D20 (SDA)", scl="D21 (SCL)", pwr="3.3V"), notes=[V33_NOTE, "5V 핀이 있어 5 V 전용 센서의 전원으로 쓸 수 있지만, 신호는 3.3 V 이하로 낮춰야 합니다."]),
    dict(id="uno-q", name="UNO Q", match=["UNO Q"], firmware="verified", sensorSet="full", bleOnly=True,
         firmwareNote="모든 센서 지원. 실제 보드에서 확인했습니다. 블루투스로만 측정합니다 (USB-C는 전원과 프로그램 올리기용). 처음 한 번 Arduino IDE로 측정 프로그램을 올립니다.",
         usb="USB-C (전원·프로그램 올리기)", ble=True, logic="3.3 V", adc="12비트 (0~3.3 V)", qwiic="있음 (3.3 V)",
         pins=pins5(sda="SDA (AREF 옆)", scl="SCL (AREF 옆)", pwr="3.3V", pwr5="5V (전원 헤더)", urx="D0 (RX, 확인 전)", utx="D1 (TX, 확인 전)"),
         notes=["I2C 센서는 Qwiic 단자나 AREF 옆 SDA·SCL 핀에 꽂습니다. UNO Q는 A4·A5가 I2C가 아닙니다.",
                "아날로그 입력은 0~3.3 V입니다. 3.3 V로 동작하는 센서는 전원을 [3.3V] 핀에, '5 V 전용' 표시가 있는 센서는 전원 헤더의 [5V] 핀에 꽂되 신호가 3.3 V를 넘지 않게 합니다 (A0~A5·D3에 5 V를 넣으면 보드가 망가짐).",
                "UART 센서(미세먼지·MH-Z19)는 UNO Q에서 아직 실제 확인 전입니다 (D0·D1은 3.3 V).",
                V33_NOTE,
                "보드를 켜고 1분쯤 기다리면 블루투스 이름 ChemDict-01이 보입니다 (보드 안의 리눅스가 먼저 켜져야 함).",
                "처음 한 번: Arduino IDE → 보드 관리자에서 'Arduino UNO Q Boards', 라이브러리 관리자에서 ArduinoBLE 2.1.0 이상·Arduino_RouterBridge·OneWire·DallasTemperature 설치 → chemdict_lab.ino를 열고 보드 'Arduino UNO Q'로 업로드.",
                "보정값과 모둠 번호는 보드 플래시에 저장되어 껐다 켜도 남습니다."]),
]

# ---------------------------------------------------------------- 연결 방식
# wires: 센서 단자(term) → 보드 핀 역할(pin) / color: red·black·yellow·blue·green·white·orange
CONNECTORS = {
    "analog": dict(name="아날로그 3선", wires=[
        dict(term="VCC (+)", pin="PWR", color="red"), dict(term="GND (−)", pin="GND", color="black"),
        dict(term="신호 (AO·OUT·S)", pin="A", color="green")],
        steps=["A0 대신 A1~A3에 꽂아도 됩니다. '꽂을 포트'에서 같은 포트를 누르면 앱이 자동으로 설정합니다."],
        cautions=["아날로그 입력은 보드 전압(5 V 또는 3.3 V)을 넘으면 안 됩니다."]),
    "analog-5v": dict(name="아날로그 3선 (5 V 전용)", wires=[
        dict(term="VCC (+5 V)", pin="PWR5", color="red"), dict(term="GND (−)", pin="GND", color="black"),
        dict(term="신호 (AO·OUT·S)", pin="A", color="green")],
        steps=["A0 대신 A1~A3에 꽂아도 됩니다. '꽂을 포트'에서 같은 포트를 누르면 앱이 자동으로 설정합니다."],
        cautions=["전원 5 V 전용 모듈입니다. 3.3 V 보드(UNO Q·Nano ESP32 등)에서는 VCC를 보드의 5V(VBUS) 핀에 꽂고, 신호가 3.3 V를 넘는 모듈은 신호선에 2:1 분압(10 kΩ+10 kΩ)을 넣은 뒤 [센서 보정]에서 배율을 2배로 맞춥니다."]),
    "analog-3v3": dict(name="아날로그 3선 (3.3 V 전원)", wires=[
        dict(term="VCC (3.3 V)", pin="PWR3", color="red"), dict(term="GND", pin="GND", color="black"),
        dict(term="OUT (신호)", pin="A", color="yellow")],
        steps=["VCC는 반드시 3.3V 핀에 꽂습니다 (5V를 넣으면 망가짐).", "신호선은 A0~A3 중 하나에 꽂고 '꽂을 포트'에서 같은 포트를 누릅니다."],
        cautions=["3.3 V 전용 모듈입니다. 5V 핀에 연결하지 않습니다."]),
    "uart-3v3": dict(name="UART 4선 (3.3 V 전원, TX·RX 엇갈려)", wires=[
        dict(term="VCC (3.3 V)", pin="PWR3", color="red"), dict(term="GND", pin="GND", color="black"),
        dict(term="TX (센서가 보냄)", pin="U_RX", color="green"), dict(term="RX (센서가 받음)", pin="U_TX", color="yellow")],
        steps=["센서의 TX는 보드의 RX에, 센서의 RX는 보드의 TX에 엇갈려 연결합니다.", "VCC는 반드시 3.3V 핀에 꽂습니다."],
        cautions=["UNO R3·Nano·Leonardo는 UART 센서를 지원하지 않습니다.",
                  "5 V 보드의 TX(5 V)가 센서 RX로 들어갑니다. 설명서에 5 V 입력 불가라고 되어 있으면 분압 저항(1 kΩ+2 kΩ)을 넣습니다."]),
    "analog-divider": dict(name="아날로그 + 10 kΩ 저항", wires=[
        dict(term="센서 한쪽 다리", pin="PWR", color="red"), dict(term="센서 다른 쪽 다리", pin="A", color="green"),
        dict(term="저항 다른 쪽", pin="GND", color="black")],
        resistor=dict(between=["A", "GND"], value="10 kΩ"),
        steps=["센서 다른 쪽 다리와 A0을 잇는 선에서 10 kΩ 저항을 GND로 연결합니다 (브레드보드 사용)."],
        cautions=[], breadboard=dict(need="required", why="센서와 10 kΩ 저항을 한 줄에서 이어야 합니다.", circuit="divider")),
    "probe": dict(name="전압 측정 2선", wires=[
        dict(term="(+) 극", pin="A", color="red"), dict(term="(−) 극", pin="GND", color="black")],
        steps=["악어 클립 선으로 전지의 (+)극을 A0, (−)극을 GND에 연결합니다."],
        cautions=["0~5 V(3.3 V 보드는 0~3.3 V)만 잴 수 있습니다. 극을 반대로 연결하거나 더 큰 전압을 대지 않습니다.",
                  "건전지 여러 개를 직렬로 연결한 전압은 재지 않습니다."]),
    "onewire": dict(name="1-Wire 3선 + 4.7 kΩ", wires=[
        dict(term="GND (검정)", pin="GND", color="black"), dict(term="VCC (빨강)", pin="PWR", color="red"),
        dict(term="DATA (노랑)", pin="ONEWIRE", color="yellow")],
        resistor=dict(between=["PWR", "ONEWIRE"], value="4.7 kΩ"),
        steps=["4.7 kΩ 저항을 DATA와 VCC 사이에 연결합니다. 터미널 어댑터 보드를 쓰면 저항이 들어 있어 생략합니다."],
        cautions=["저항이 없으면 센서가 인식되지 않습니다."],
        breadboard=dict(need="recommended", why="4.7 kΩ 저항을 끼우거나 센서 여러 개를 나란히 꽂을 때 씁니다. 저항이 든 어댑터 보드에 센서 1개만 쓰면 필요 없습니다.", circuit="pullup")),
    "dht": dict(name="디지털 3선", wires=[
        dict(term="GND (−)", pin="GND", color="black"), dict(term="VCC (+)", pin="PWR", color="red"),
        dict(term="DATA (S·OUT)", pin="DHT", color="yellow")],
        steps=["핀이 4개인 센서(모듈 아님)는 DATA와 VCC 사이에 10 kΩ 저항을 연결합니다. 3번 핀은 비워 둡니다."],
        cautions=[], breadboard=dict(need="recommended", why="핀 4개짜리 센서(모듈 아님)는 10 kΩ 저항을 끼우려면 브레드보드가 필요합니다. 3핀 모듈은 필요 없습니다.", circuit="pullup")),
    "qwiic": dict(name="Qwiic 케이블", cable=True, wires=[
        dict(term="GND (검정)", pin="GND", color="black"), dict(term="3.3V (빨강)", pin="PWR3", color="red"),
        dict(term="SDA (파랑)", pin="SDA", color="blue"), dict(term="SCL (노랑)", pin="SCL", color="yellow")],
        steps=["Qwiic 단자가 있으면 케이블을 '딸깍' 소리가 날 때까지 꽂습니다. 모듈 쪽은 어느 단자든 됩니다.",
               "Qwiic 단자가 없는 보드는 Qwiic–점퍼 케이블로 위 표대로 핀에 연결합니다.",
               "모듈을 여러 개 쓰면 모듈끼리 Qwiic 케이블로 이어서 연결할 수 있습니다."],
        cautions=["Qwiic은 3.3 V입니다. UNO R3·Nano·Mega·Leonardo의 SDA·SCL 핀은 내부 풀업이 5 V라 Modulino 등 3.3 V 전용 모듈을 직결하면 5 V가 걸립니다. 반드시 I2C 레벨 변환기(또는 Qwiic 실드)를 씁니다. 'VIN 3–5 V' 표시가 있는 모듈만 직결해도 됩니다.",
                  "3.3V 핀은 모듈 합계 약 150 mA까지입니다. CO₂(SCD4x)·미세먼지처럼 전류가 큰 모듈은 'VIN 3–5 V' 표시가 있으면 5V 핀에, 없으면 하나만 씁니다."]),
    "i2c": dict(name="I2C 4선 (SDA·SCL)", wires=[
        dict(term="VCC (VIN)", pin="PWR3", color="red"), dict(term="GND", pin="GND", color="black"),
        dict(term="SDA", pin="SDA", color="blue"), dict(term="SCL", pin="SCL", color="yellow")],
        steps=["모듈에 Qwiic·STEMMA QT 단자가 있으면 Qwiic 케이블로 연결해도 됩니다.",
               "같은 I2C 선에 여러 모듈을 함께 연결할 수 있습니다 (주소가 다르면)."],
        cautions=["VCC는 3.3V에 연결하는 것이 안전합니다. 모듈에 'VIN 3–5 V' 표시가 있으면 5V도 됩니다.",
                  "3.3V 핀은 모듈 합계 약 150 mA까지입니다. 전류가 큰 모듈(CO₂·미세먼지)은 'VIN 3–5 V' 표시가 있으면 5V 핀에 꽂습니다.",
                  "주소가 같은 센서 둘을 한 버스에 꽂으면 하나만 인식됩니다. UNO R4 WiFi·Nano R4·UNO Q는 Qwiic 단자와 SDA·SCL 핀이 다른 버스라 하나씩 나누면 둘 다 됩니다."]),
    "hx711": dict(name="HX711 4선 + 로드셀", wires=[
        dict(term="GND", pin="GND", color="black"), dict(term="VCC", pin="PWR", color="red"),
        dict(term="DT (DOUT)", pin="HX_DT", color="yellow"), dict(term="SCK (CLK)", pin="HX_SCK", color="green")],
        steps=["로드셀 선을 HX711에 연결합니다: 빨강 → E+, 검정 → E−, 흰색 → A−, 초록 → A+ (제품마다 다를 수 있음).",
               "로드셀은 화살표 방향으로 힘이 가도록 받침판과 접시를 나사로 고정합니다."],
        cautions=["처음 쓸 때 '보정'에서 영점(빈 접시) → 기준 추(예: 100 g) 순서로 맞춰야 g 단위가 맞습니다."]),
    "spi-tc": dict(name="MAX6675 5선", wires=[
        dict(term="GND", pin="GND", color="black"), dict(term="VCC", pin="PWR", color="red"),
        dict(term="SCK", pin="TC_SCK", color="green"), dict(term="CS", pin="TC_CS", color="orange"),
        dict(term="SO", pin="TC_SO", color="yellow")],
        steps=["K형 열전대의 (+)·(−) 선을 모듈의 + / − 나사 단자에 연결합니다 (보통 빨강 = −, 노랑·파랑 = +, 반대면 온도가 내려감)."],
        cautions=[]),
    "pulse": dict(name="펄스 3선 (D3)", wires=[
        dict(term="VCC (+5 V)", pin="PWR5", color="red"), dict(term="GND (−)", pin="GND", color="black"),
        dict(term="신호 (OUT·SIG)", pin="PULSE", color="yellow")],
        steps=["신호선은 항상 D3에 꽂습니다. 펌웨어가 초당 펄스 수를 세어 단위로 바꿉니다.",
               "같은 D3에는 펄스 센서를 하나만 연결합니다."],
        cautions=["UNO R4·Nano R4·Mega·UNO Q에서만 됩니다 (UNO R3·Nano는 메모리가 부족).",
                  "12 V 전원을 쓰는 센서는 신호가 5 V를 넘지 않는지 설명서를 확인합니다.",
                  "3.3 V 보드(UNO Q 등)의 D3에는 5 V를 넣으면 안 됩니다. 펄스 센서는 대개 전원 전압 크기의 펄스를 내므로 신호선에 1 kΩ+2 kΩ 분압을 넣거나 3.3 V로 동작하는 센서만 씁니다."]),
    "spi-rtd": dict(name="MAX31865 6선 (SPI)", wires=[
        dict(term="VIN", pin="PWR", color="red"), dict(term="GND", pin="GND", color="black"),
        dict(term="CLK", pin="TC_SCK", color="green"), dict(term="SDO", pin="TC_SO", color="yellow"),
        dict(term="SDI", pin="SPI_SDI", color="blue"), dict(term="CS", pin="RTD_CS", color="orange")],
        steps=["PT100 탐침의 선을 모듈의 RTD 단자에 연결합니다 (2선이면 양 끝 단자에).",
               "MAX6675·MAX31855 열전대와 CLK·SDO를 함께 써도 됩니다 (CS만 다름)."],
        cautions=["모듈의 기준 저항이 430 Ω(PT100용)인지 확인합니다. 4300 Ω은 PT1000용이라 값이 10배 틀립니다.",
                  "모듈에 'VIN 3–5 V' 표시가 없으면(레귤레이터 없음) VIN을 5V가 아니라 3.3V 핀에 꽂습니다 (MAX31865 칩은 3.0~3.6 V)."]),
    "uart": dict(name="UART 4선 (TX·RX 엇갈려)", wires=[
        dict(term="VCC (5 V)", pin="PWR5", color="red"), dict(term="GND", pin="GND", color="black"),
        dict(term="TX (센서가 보냄)", pin="U_RX", color="green"), dict(term="RX (센서가 받음)", pin="U_TX", color="yellow")],
        steps=["센서의 TX는 보드의 RX에, 센서의 RX는 보드의 TX에 엇갈려 연결합니다.",
               "UART 센서는 한 번에 하나만 연결합니다 (미세먼지 또는 MH-Z19 중 하나)."],
        cautions=["UNO R3·Nano·Leonardo는 이 핀을 USB 통신에 쓰므로 UART 센서를 지원하지 않습니다.",
                  "센서를 꽂은 뒤 보드를 다시 연결하거나 '센서 다시 찾기'를 누릅니다 (켜질 때 종류를 알아냄).",
                  "UART 센서는 한 번에 하나만 됩니다 (Serial1이 하나). 전원은 5 V, 전류 100~150 mA라 USB 전원으로는 다른 큰 센서와 함께 쓰지 않습니다."]),
    "digital-out": dict(name="디지털 출력(DO) 3선", wires=[
        dict(term="VCC (+)", pin="PWR", color="red"), dict(term="GND (−)", pin="GND", color="black"),
        dict(term="DO (디지털 출력)", pin="A", color="green")],
        steps=["DO 핀을 A0~A3 중 하나에 꽂고, '꽂을 포트'에서 같은 포트를 누릅니다.",
               "값 1은 감지됨, 0은 감지 안 됨입니다 (모듈에 따라 반대일 수 있음). 감도는 모듈의 가변저항으로 맞춥니다."],
        cautions=["켜짐·꺼짐만 기록합니다. 아주 짧은 순간(0.1초 이하)은 놓칠 수 있습니다."]),
    "ultrasonic": dict(name="초음파 4선 (5 V 전용)", wires=[
        dict(term="VCC (5 V)", pin="PWR5", color="red"), dict(term="TRIG", pin="TRIG", color="yellow"),
        dict(term="ECHO", pin="ECHO", color="green"), dict(term="GND", pin="GND", color="black")],
        steps=[], cautions=["전원은 5 V 전용입니다 (3.3 V로는 동작하지 않음). 3.3 V 보드에서는 VCC를 5V(VBUS) 핀에 꽂고 ECHO 신호(5 V)는 1 kΩ+2 kΩ 분압으로 낮춰 연결합니다."],
        breadboard=dict(need="recommended", why="센서 핀이 보드에 바로 닿지 않으면 브레드보드에 꽂고 점퍼선으로 연결합니다.", circuit=None)),
}

# ---------------------------------------------------------------- 센서
# minSet: 이 센서를 읽는 가장 작은 펌웨어 버전 (mini < lite < full)
# support: verified(실제 보드 확인) · firmware(펌웨어 지원, 실제 센서 확인 전)
def part(id, name, category, connector, provides, items, cautions, minSet="mini", support="firmware", analogType=None, addr=None):
    p = dict(id=id, name=name, category=category, connector=connector, provides=provides, minSet=minSet,
             support=support, items=items, cautions=cautions)
    if analogType: p["analogType"] = analogType
    if addr: p["addr"] = addr
    return p

def analog(id, name, category, t, items, cautions, connector="analog", minSet="mini"):
    return part(id, name, category, connector, [t], items, cautions, analogType=t, minSet=minSet)

PARTS = [
    # 온도
    part("ds18b20", "방수 온도 센서 DS18B20", "온도", "onewire", ["T"],
         ["방수 DS18B20 1개", "4.7 kΩ 저항 1개 (어댑터 보드가 있으면 불필요)", "점퍼선 3개"],
         ["선 색은 제품마다 다를 수 있습니다. 설명서에서 VCC·GND·DATA를 확인합니다.",
          "금속 끝부분만 액체에 넣습니다. 케이블 연결부는 물에 넣지 않습니다.",
          "측정 범위 −55 ~ 125 °C. 끓는 물은 되지만 불꽃에 직접 대지 않습니다.",
          "2개 이상 쓸 때(열평형·비열 비교): 같은 VCC·GND·DATA 줄에 나란히 꽂습니다. 4.7 kΩ 저항은 하나면 됩니다. UNO R4·Mega는 4개, UNO R3·Nano는 2개까지."]),
    analog("lm35", "LM35 온도 센서", "온도", "TL", ["LM35 1개", "점퍼선 3개"],
           ["평평한 면을 앞으로 보고 왼쪽부터 VCC · 신호 · GND입니다.", "물에 넣으려면 열수축 튜브로 다리를 막습니다."]),
    analog("tmp36", "TMP36 온도 센서", "온도", "TM36", ["TMP36 1개", "점퍼선 3개"],
           ["평평한 면을 앞으로 보고 왼쪽부터 VCC · 신호 · GND입니다."]),
    part("max6675", "K형 열전대 MAX6675 (고온)", "온도", "spi-tc", ["TK"],
         ["MAX6675 모듈 1개", "K형 열전대 1개", "점퍼선 5개"],
         ["0 ~ 1024 °C까지 잴 수 있어 알코올램프·버너 실험에 씁니다. 모듈 기판은 불에서 멀리 둡니다.",
          "열전대 끝의 금속 부분만 가열합니다."], minSet="full"),
    # 온습도
    part("dht", "DHT11 / DHT22 온습도", "온습도", "dht", ["TA", "RH"],
         ["DHT11(파랑) 또는 DHT22(흰색) 1개", "점퍼선 3개 (핀 4개짜리는 10 kΩ 저항 추가)"],
         ["DHT11은 1 °C·1 % 단위, DHT22는 0.1 단위입니다. 펌웨어가 자동으로 구분합니다.",
          "센서는 2초에 한 번 새 값을 줍니다. 습도 반응이 느려 5~10초 기다립니다.",
          "핀 순서는 제품마다 다릅니다. 모듈에 인쇄된 +, −, S(OUT) 글자를 보고 연결합니다."], support="verified"),
    part("modulino-thermo", "Modulino Thermo (온도·습도)", "온습도", "qwiic", ["TA", "RH"],
         ["Modulino Thermo 1개", "Qwiic 케이블 1개"],
         ["방수가 아닙니다. 물방울이 센서에 직접 닿지 않게 합니다.",
          "손가락으로 칩을 잡으면 체온 때문에 기온이 올라갑니다. 가장자리를 잡습니다.",
          "구형(0x44)과 신형(V0.5 이상, 0x45) 모두 인식합니다."], addr="0x44 / 0x45"),
    part("sht3x", "SHT30 / SHT31 온습도 모듈", "온습도", "i2c", ["TA", "RH"],
         ["SHT30 또는 SHT31 모듈 1개", "점퍼선 4개"],
         ["DHT보다 정확하고 반응이 빠릅니다. 방수형(금속 캡)도 같은 방법으로 연결합니다."], addr="0x44 / 0x45"),
    part("bme280", "BME280 (온도·습도·기압)", "온습도", "i2c", ["TA", "RH", "BP"],
         ["BME280 모듈 1개 (GY-BME280 등)", "점퍼선 4개"],
         ["BMP280과 모양이 같습니다. BME280만 습도가 나옵니다 (칩이 정사각형에 가까움).",
          "SDO 핀을 GND에 연결하면 주소 0x76, 3.3V에 연결하면 0x77입니다 (둘 다 인식)."], minSet="lite", addr="0x76 / 0x77"),
    # 기압·압력
    part("bmp280", "BMP280 기압 센서", "기압·압력", "i2c", ["TA", "BP"],
         ["BMP280 모듈 1개", "점퍼선 4개"],
         ["대기압 측정용입니다. 주사기 실험(보일 법칙)은 밀폐 용기에 모듈째 넣거나 기체 압력 센서를 씁니다."],
         minSet="lite", addr="0x76 / 0x77"),
    part("modulino-pressure", "Modulino Pressure (기압)", "기압·압력", "qwiic", ["BP", "TA"],
         ["Modulino Pressure 1개", "Qwiic 케이블 1개"], ["대기압과 높이 변화에 따른 기압 차를 잴 수 있습니다."],
         minSet="full", addr="0x5C"),
    analog("mpx5700", "기체 압력 센서 MPX5700AP (주사기)", "기압·압력", "P",
           ["MPX5700AP 모듈 1개", "실리콘 튜브", "주사기 (60 mL)", "점퍼선 3개"],
           ["튜브를 센서 포트에 꽉 끼우고 새는 곳이 없는지 확인합니다.",
            "700 kPa까지 잴 수 있지만 주사기를 세게 눌러 튜브가 빠지지 않게 합니다.",
            "'보정'에서 대기압(약 101.3 kPa) 1점 보정을 합니다."]),
    # 기체
    part("scd4x", "이산화탄소 센서 SCD40 / SCD41", "기체", "i2c", ["CO2", "TA", "RH"],
         ["SCD40 또는 SCD41 모듈 1개", "점퍼선 4개 (Qwiic 단자 모듈은 케이블)"],
         ["5초마다 새 값이 나옵니다. 처음 켠 뒤 1~2분은 값이 흔들립니다.",
          "호흡·발효·탄산음료 실험에 좋습니다. 센서에 물방울이 들어가지 않게 합니다."],
         minSet="full", addr="0x62"),
    analog("mq-gas", "가스 센서 MQ-2 / MQ-3 / MQ-135 (상대값)", "기체", "GAS",
           ["MQ 시리즈 모듈 1개", "점퍼선 3개 (AO 핀 사용)"],
           ["농도(ppm)가 아니라 상대적인 변화(%)만 봅니다.",
            "사용 전 3분 이상 켜 두어 예열합니다. 센서가 뜨거워지므로 만지지 않습니다.",
            "MQ-2: 가연성 기체·연기, MQ-3: 알코올, MQ-135: 공기 질(CO₂·NH₃ 등)."]),
    analog("o2", "산소 센서 (아날로그, Gravity O₂)", "기체", "O2",
           ["아날로그 산소 센서 1개", "점퍼선 3개"],
           ["처음 쓸 때 맑은 공기에서 '보정' → 20.9 % 1점 비례 보정을 합니다.",
            "연소·호흡 실험에 씁니다. 센서 수명이 있으니 쓰지 않을 때는 밀봉해 둡니다."]),
    # 빛·색
    analog("ldr", "조도 센서 (CdS·포토트랜지스터 모듈)", "빛·색", "L",
           ["조도 센서 모듈 1개", "점퍼선 3개"],
           ["비색계(용액 투과광) 실험에서는 LED와 센서를 큐벳 양쪽에 마주 보게 고정하고 주변 빛을 가립니다."]),
    part("tcs34725", "컬러 센서 TCS34725", "빛·색", "i2c", ["COLR", "COLG", "COLB"],
         ["TCS34725 모듈 1개", "점퍼선 4개"],
         ["R·G·B를 전체 빛에 대한 비율(%)로 보여 줍니다. 지시약 색 변화·용액 농도 비교에 씁니다.",
          "모듈의 흰색 LED가 켜집니다. 시료와 거리를 일정하게(약 1 cm) 유지합니다."], minSet="full", addr="0x29"),
    analog("uv", "자외선 센서 GUVA-S12SD", "빛·색", "UV",
           ["자외선 센서 모듈 1개", "점퍼선 3개"], ["자외선 지수(UV index) 근삿값입니다. 자외선 차단제 실험에 씁니다."]),
    # 물·용액
    analog("ph", "pH 센서 (PH-4502C · Gravity pH)", "물·용액", "pH",
           ["pH 전극 + 변환 모듈 1세트", "pH 4·7 완충 용액", "증류수 세척병"],
           ["전극 끝 유리막은 깨지기 쉽습니다. 바닥에 부딪히지 않게 합니다.",
            "실험 전 '보정'에서 pH 7 → pH 4 순서로 2점 보정을 합니다.",
            "보관할 때는 보호 캡에 보관액(KCl)을 넣어 끼웁니다. 증류수에 오래 담가 두지 않습니다.",
            "PH-4502C는 5 V 전용입니다 (3.3 V 보드에서는 Gravity pH V2(3.3~5.5 V, 출력 0~3 V)를 권장)."]),
    analog("ec", "전도도(EC) 센서", "물·용액", "EC",
           ["전도도 전극 + 변환 모듈 1세트", "1413 µS/cm 표준 용액 (가능하면 12.88 mS/cm도)"],
           ["'보정'에서 1413 µS/cm 표준 용액으로 1점(가능하면 12.88 mS/cm까지 2점) 보정합니다. 증류수는 영점이 아니라 헹굼용입니다.", "측정 사이에 증류수로 헹굽니다."]),
    analog("tds", "TDS 센서 (총용존고형물)", "물·용액", "TDS",
           ["TDS 탐침 + 변환 모듈 1세트"], ["ppm 근삿값입니다. 정확히 하려면 표준 용액(342·1000 ppm)으로 보정합니다.",
            "온도 보정이 없어 25 °C 기준 근삿값입니다 (DS18B20을 같이 꽂으면 비교에 좋음)."]),
    analog("turbidity", "탁도 센서", "물·용액", "TURB",
           ["탁도 센서 모듈 1개", "점퍼선 3개"],
           ["값이 클수록 맑습니다 (투명도 %). 깨끗한 물을 100 %로 보정해 비교합니다.", "센서 윗부분(회로)은 물에 넣지 않습니다."]),
    analog("water-level", "수위 센서", "물·용액", "LEVEL",
           ["수위 센서 모듈 1개", "점퍼선 3개"], ["상대값(%)입니다. 오래 담가 두면 전극이 부식되니 측정할 때만 넣습니다."]),
    analog("soil", "토양 수분 센서 (정전식)", "물·용액", "SOIL",
           ["정전식 토양 수분 센서 1개", "점퍼선 3개"],
           ["마른 흙(0 %)과 물(100 %)로 2점 보정하면 비교하기 좋습니다.", "회로 부분은 흙·물에 넣지 않습니다."]),
    # 무게·거리·힘
    part("hx711", "로드셀 + HX711 (전자저울)", "무게·거리·힘", "hx711", ["M"],
         ["로드셀(1 kg 또는 5 kg) 1개", "HX711 모듈 1개", "받침판·접시", "기준 추 (예: 100 g)", "점퍼선 4개"],
         ["반응 전후 질량 변화(질량 보존, 기체 발생) 실험에 씁니다.",
          "로드셀이 감당하는 무게를 넘기지 않습니다."], minSet="lite"),
    part("hcsr04", "초음파 거리 센서 HC-SR04", "무게·거리·힘", "ultrasonic", ["DIST"],
         ["HC-SR04 1개", "점퍼선 4개"], ["2 cm ~ 4 m까지 잽니다. 물체 면이 센서를 똑바로 향해야 정확합니다."], minSet="full"),
    analog("fsr", "압력(힘) 센서 FSR", "무게·거리·힘", "FSR",
           ["FSR 센서 1개", "10 kΩ 저항 1개", "브레드보드·점퍼선"], ["누르는 힘의 상대값(%)입니다."], connector="analog-divider"),
    analog("pot", "가변저항 (손잡이)", "무게·거리·힘", "POT",
           ["가변저항 모듈 1개", "점퍼선 3개"], ["돌린 정도를 0~100 %로 보여 줍니다. 센서 연습용으로 좋습니다."]),
    # 전기·소리
    analog("voltage", "전압 측정 (화학 전지)", "전기·소리", "V",
           ["악어 클립 선 2개", "전극 (Zn·Cu 등)과 전해질"], ["다니엘 전지·과일 전지 실험에 씁니다."], connector="probe"),
    analog("sound", "사운드 센서", "전기·소리", "SND",
           ["사운드 센서 모듈 1개 (AO 핀 있는 것)", "점퍼선 3개"], ["소리 크기의 상대값(%)입니다."]),
    analog("raw", "기타 아날로그 센서 (직접 보정)", "전기·소리", "RAW",
           ["아날로그 출력이 있는 센서"], ["전압을 그대로 기록합니다. '보정'에서 기준값 두 개로 단위를 맞출 수 있습니다."]),
]

# ---------------------------------------------------------------- 추가 센서 (디바이스마트 판매 모듈, 펌웨어 0.4.0)
# I2C·UART 센서는 UNO R4·Nano R4·Mega(full)에서만 인식. 아날로그 센서는 모든 보드.
F = "full"
MORE_PARTS = [
    # 온도
    analog("ad8495", "K형 열전대 AD8495 (아날로그 고온)", "온도", "TKA",
           ["AD8495 열전대 앰프 모듈", "K형 열전대", "점퍼선 3개"], ["5 mV/°C 출력입니다. 열전대 끝만 가열 부위에 댑니다."]),
    part("mlx90614", "비접촉 적외선 온도 MLX90614 (GY-906)", "온도", "i2c", ["TIR", "TA"],
         ["MLX90614 모듈", "점퍼선 4개"], ["물체 표면 온도를 닿지 않고 잽니다. 센서 시야(약 35°) 안에 대상만 들어오게 합니다.",
          "반짝이는 금속 표면은 실제보다 낮게 나옵니다."], minSet=F, addr="0x5A"),
    part("mcp9808", "정밀 온도 센서 MCP9808", "온도", "i2c", ["T"],
         ["MCP9808 모듈", "점퍼선 4개"], ["±0.25 °C 정밀 온도 (0.0625 °C 단위)."], minSet=F, addr="0x18"),
    # 온습도·기압
    part("aht20", "AHT20 / DHT20 온습도", "온습도", "i2c", ["TA", "RH"],
         ["AHT20 또는 DHT20(I2C) 모듈", "점퍼선 4개"], ["DHT20은 이름은 비슷하지만 I2C입니다 (D4가 아니라 SDA·SCL)."], minSet=F, addr="0x38"),
    part("htu21d", "HTU21D / Si7021 / SHT21 온습도", "온습도", "i2c", ["TA", "RH"],
         ["HTU21D·Si7021 모듈", "점퍼선 4개"], ["INA219와 주소(0x40)가 같습니다. 둘을 함께 쓰지 않습니다."], minSet=F, addr="0x40"),
    part("sht40", "SHT40 / SHT41 온습도", "온습도", "i2c", ["TA", "RH"],
         ["SHT40 모듈 (Qwiic 가능)", "점퍼선 4개"], ["정밀 온습도 (±0.2 °C)."], minSet=F, addr="0x44"),
    part("bmp180", "BMP180 기압 센서 (GY-68)", "기압·압력", "i2c", ["TA", "BP"],
         ["BMP180 모듈", "점퍼선 4개"], ["구형 센서입니다. 새로 산다면 BMP280을 권장합니다."], minSet=F, addr="0x77"),
    # 기체
    analog("mq-2", "MQ-2 가연성 가스·연기 (상대값)", "기체", "GAS", ["MQ-2 모듈 (AO 핀)", "점퍼선 3개"],
           ["LPG·프로판·수소·연기에 반응합니다. 3분 이상 예열합니다.", "센서가 뜨거워집니다. 손대지 않습니다."]),
    analog("mq-3", "MQ-3 알코올 가스 (상대값)", "기체", "GAS", ["MQ-3 모듈 (AO 핀)", "점퍼선 3개"],
           ["에탄올 증기에 반응합니다. 발효·증발 실험에 씁니다. 3분 이상 예열합니다."]),
    analog("mq-4", "MQ-4 메탄 가스 (상대값)", "기체", "GAS", ["MQ-4 모듈 (AO 핀)", "점퍼선 3개"], ["메탄(도시가스)에 반응합니다."]),
    analog("mq-7", "MQ-7 일산화탄소 (상대값)", "기체", "GAS", ["MQ-7 모듈 (AO 핀)", "점퍼선 3개"],
           ["불완전 연소 비교용입니다. 일산화탄소는 위험하므로 밀폐된 곳에서 만들지 않습니다."]),
    analog("mq-8", "MQ-8 수소 가스 (상대값)", "기체", "GAS", ["MQ-8 모듈 (AO 핀)", "점퍼선 3개"], ["금속+산 반응, 물의 전기 분해에서 나오는 수소 비교."]),
    analog("mq-9", "MQ-9 일산화탄소·가연성 가스 (상대값)", "기체", "GAS", ["MQ-9 모듈 (AO 핀)", "점퍼선 3개"], ["예열 후 상대 변화만 봅니다."]),
    analog("mq-135", "MQ-135 공기질 (상대값)", "기체", "GAS", ["MQ-135 모듈 (AO 핀)", "점퍼선 3개"], ["암모니아·벤젠·CO₂ 등 여러 기체에 함께 반응합니다 (구분 못 함)."]),
    analog("mg811", "MG811 이산화탄소 (아날로그, 상대값)", "기체", "GAS", ["MG811 모듈 (Gravity SEN0159)", "점퍼선 3개"],
           ["예열이 길고(10분 이상) 값이 반대로 움직입니다 (CO₂가 많으면 전압이 내려감). 정확한 값은 SCD40·MH-Z19를 씁니다."]),
    analog("co2-ndir-analog", "적외선 CO₂ 센서 (아날로그, SEN0219)", "기체", "CO2N", ["SEN0219 모듈", "점퍼선 3개"],
           ["0.4~2.0 V가 0~5000 ppm입니다. 3분 예열합니다."]),
    part("scd30", "이산화탄소 센서 SCD30", "기체", "i2c", ["CO2", "TA", "RH"],
         ["SCD30 모듈 (Qwiic·Grove)", "점퍼선 4개"], ["400~10000 ppm. 2초마다 새 값이 나옵니다."], minSet=F, addr="0x61"),
    part("mhz19", "이산화탄소 센서 MH-Z19C (NDIR, UART)", "기체", "uart", ["CO2"],
         ["MH-Z19C(또는 B)", "점퍼선 4개"], ["400~5000 ppm. 켠 뒤 1분 예열, 값이 안정되는 데 3분.", "보드를 켤 때 연결되어 있어야 인식합니다.",
          "전원 5 V(150 mA 이상). UART는 3.3 V지만 5 V 보드에 그대로 연결해도 됩니다 (분압 불필요)."], minSet=F),
    part("sgp30", "공기질 센서 SGP30 (TVOC·eCO₂)", "기체", "i2c", ["ECO2", "TVOC"],
         ["SGP30 모듈", "점퍼선 4개"], ["eCO₂는 휘발성 물질로 추정한 값이라 실제 CO₂가 아닙니다. 처음 15초는 400 ppm으로 나옵니다."], minSet=F, addr="0x58"),
    part("ens160", "공기질 센서 ENS160 (TVOC·eCO₂)", "기체", "i2c", ["ECO2", "TVOC"],
         ["ENS160 모듈 (Gravity SEN0514 등)", "점퍼선 4개"], ["처음 켜면 몇 분 동안 값이 안정되지 않습니다.", "eCO₂는 추정값입니다."], minSet=F, addr="0x53"),
    part("o2-i2c", "산소 센서 Gravity I2C (SEN0322)", "기체", "i2c", ["O2I"],
         ["SEN0322 산소 센서", "점퍼선 4개 (Gravity 케이블)"], ["0~25 %. 연소·호흡의 산소 소모, 과산화수소 분해의 산소 발생을 잽니다.",
          "처음 쓰면 맑은 공기에서 20.9 %가 나오는지 확인합니다."], minSet=F, addr="0x73"),
    part("pms7003", "미세먼지 센서 PMS7003 / PMS A003", "기체", "uart", ["PM1", "PM25", "PM10"],
         ["PMS7003 + 변환 보드(1.27 mm → 2.54 mm)", "점퍼선 3~4개"], ["PM1.0·PM2.5·PM10(µg/m³)을 1초마다 보냅니다.",
          "보드를 켤 때 연결되어 있어야 인식합니다.",
          "센서의 RX는 비워 둬도 됩니다 (보드가 명령을 보내지 않음). RX·TX가 3.3 V라 5 V 보드에서 꼭 연결하려면 보드 TX→센서 RX에 1 kΩ+2 kΩ 분압. 전원 5 V, 100 mA."], minSet=F),
    # 빛
    part("bh1750", "조도 센서 BH1750 (GY-302, lx)", "빛·색", "i2c", ["LUX"],
         ["BH1750 모듈", "점퍼선 4개"], ["1~65535 lx. 광합성 빛 세기, 거리-빛 세기 실험에 좋습니다."], minSet=F, addr="0x23"),
    part("tsl2591", "고감도 조도 센서 TSL2591", "빛·색", "i2c", ["LUX"],
         ["TSL2591 모듈", "점퍼선 4개"], ["아주 어두운 빛(루미놀 발광 등)도 잽니다."], minSet=F, addr="0x29"),
    analog("tcrt5000", "적외선 반사 센서 TCRT5000", "빛·색", "REFL", ["TCRT5000 모듈 (AO 핀)", "점퍼선 3개"],
           ["가까운 면의 반사 정도(상대값)입니다. 회전 원판에 붙인 흰 테이프로 회전수를 셀 수 있습니다."]),
    analog("flame", "불꽃 센서 (적외선)", "빛·색", "FLAM", ["불꽃 센서 모듈 (AO 핀)", "점퍼선 3개"],
           ["불꽃 세기의 상대값입니다. 센서를 불에서 20 cm 이상 떨어뜨립니다."]),
    analog("photo-gate", "포토 인터럽터 (빛 차단 감지)", "빛·색", "DOUT", ["포토 인터럽터 모듈 (DO 핀)", "점퍼선 3개"],
           ["홈 사이를 물체가 지나가면 0↔1로 바뀝니다. 0.1초보다 빠른 통과는 놓칠 수 있습니다."], connector="digital-out"),
    # 거리
    part("vl53l0x", "레이저 거리 센서 VL53L0X (ToF)", "무게·거리·힘", "i2c", ["DIST"],
         ["VL53L0X 모듈", "점퍼선 4개"], ["약 3~200 cm. 초음파보다 작은 물체·짧은 거리에 좋습니다.",
          "펌웨어를 직접 올릴 때는 Pololu VL53L0X 라이브러리가 필요합니다."], minSet=F, addr="0x29"),
    analog("flex", "휨 센서 (Flex)", "무게·거리·힘", "FLEX", ["Flex 센서", "10 kΩ 저항", "브레드보드"],
           ["휜 정도의 상대값입니다."], connector="analog-divider"),
    # 움직임·자기
    part("mpu6050", "가속도·자이로 MPU6050 (GY-521) / MPU9250", "움직임·자기", "i2c", ["AX", "AY", "AZ"],
         ["MPU6050 모듈", "점퍼선 4개"], ["x·y·z 가속도(m/s²)를 잽니다. 가만히 두면 위쪽 축이 약 9.8입니다."], minSet=F, addr="0x68"),
    part("adxl345", "가속도 센서 ADXL345 (GY-291)", "움직임·자기", "i2c", ["AX", "AY", "AZ"],
         ["ADXL345 모듈", "점퍼선 4개"], ["자유 낙하·충돌·진동 실험에 씁니다."], minSet=F, addr="0x53"),
    part("lis3dh", "가속도 센서 LIS3DH", "움직임·자기", "i2c", ["AX", "AY", "AZ"],
         ["LIS3DH 모듈", "점퍼선 4개"], ["±2 g 범위로 잽니다."], minSet=F, addr="0x18"),
    part("lsm6ds", "가속도·자이로 LSM6DSOX", "움직임·자기", "i2c", ["AX", "AY", "AZ"],
         ["LSM6DSOX 모듈 (Qwiic)", "Qwiic 케이블"], ["±2 g 범위로 잽니다."], minSet=F, addr="0x6A"),
    analog("adxl335", "가속도 센서 ADXL335 (아날로그 3축)", "움직임·자기", "AXA", ["ADXL335 모듈", "점퍼선 5개"],
           ["X·Y·Z 출력을 A0·A1·A2에 꽂고 각 포트를 AXA·AYA·AZA로 고릅니다 ('포트 직접 설정')."], connector="analog-3v3"),
    part("magnetometer", "지자기 센서 QMC5883L / HMC5883L (GY-271)", "움직임·자기", "i2c", ["MAG"],
         ["GY-271 모듈", "점퍼선 4개"], ["자기장 세기(µT)입니다. 지구 자기장은 약 50 µT, 자석을 가까이 하면 커집니다."], minSet=F, addr="0x0D"),
    analog("pir", "인체 감지 센서 HC-SR501 (PIR)", "움직임·자기", "DOUT", ["HC-SR501 모듈 (OUT 핀)", "점퍼선 3개"],
           ["움직임이 있으면 1입니다. 켠 뒤 약 1분은 값이 흔들립니다."], connector="digital-out"),
    analog("vibration", "진동 감지 센서 SW-420", "움직임·자기", "DOUT", ["SW-420 모듈 (DO 핀)", "점퍼선 3개"],
           ["진동이 있으면 0↔1로 바뀝니다."], connector="digital-out"),
    analog("tilt", "기울기 센서 SW-520D", "움직임·자기", "DOUT", ["SW-520D 모듈 (DO 핀)", "점퍼선 3개"], ["기울면 0↔1로 바뀝니다."], connector="digital-out"),
    analog("hall", "홀 센서 A3144 (자석 감지)", "움직임·자기", "DOUT", ["A3144 홀 센서 모듈 (DO 핀)", "점퍼선 3개"],
           ["자석의 한쪽 극이 가까이 오면 바뀝니다. 바퀴에 자석을 붙여 회전을 셉니다."], connector="digital-out"),
    analog("piezo", "세라믹 압전 진동 센서", "움직임·자기", "VIB", ["압전 진동 센서 (DFR0052 등)", "점퍼선 3개"],
           ["두드린 세기의 상대값입니다. 짧은 충격은 측정 간격을 0.1초로 둡니다."]),
    # 전기·소리
    part("ina219", "전압·전류 센서 INA219", "전기·소리", "i2c", ["VDC", "IDC"],
         ["INA219 모듈", "점퍼선 4개 + 측정 회로선"], ["0~26 V, ±3.2 A. 회로 중간(+쪽)에 VIN+ → VIN−로 끼웁니다.",
          "화학 전지·전기 분해·태양전지의 전류를 정확히 잽니다."], minSet=F, addr="0x40"),
    part("ina260", "전압·전류 센서 INA260", "전기·소리", "i2c", ["VDC", "IDC"],
         ["INA260 모듈", "점퍼선 4개 + 측정 회로선"], ["0~36 V, ±15 A."], minSet=F, addr="0x40"),
    analog("acs712", "전류 센서 ACS712 (5 A)", "전기·소리", "I5A", ["ACS712 5A 모듈", "점퍼선 3개"],
           ["0.1 A보다 작은 전류는 정확하지 않습니다 (작은 전류는 INA219).", "20 A·30 A 모듈은 '포트 직접 설정'에서 I20A·I30A를 고릅니다."]),
    analog("voltage-25", "전압 센서 모듈 (0~25 V 분압)", "전기·소리", "V25", ["전압 감지 모듈", "점퍼선 3개"],
           ["5 V보다 높은 전압(최대 25 V, 3.3 V 보드에서는 16.5 V까지)을 잽니다. 모듈의 VCC·GND 단자에 측정할 전압을 연결합니다."]),
    analog("sound-level", "소리 크기 측정기 (dBA, SEN0232)", "전기·소리", "DBA", ["SEN0232 모듈", "점퍼선 3개"],
           ["30~130 dBA의 실제 소리 크기입니다."]),
    analog("mic-amp", "마이크 앰프 MAX4466 / MAX9814", "전기·소리", "SND", ["MAX4466·MAX9814 모듈", "점퍼선 3개"],
           ["소리 세기의 상대값입니다. 파형(진동수)은 측정 간격이 길어 볼 수 없습니다."]),
    # 물
    analog("dissolved-oxygen", "용존 산소 센서 (Gravity DO)", "물·용액", "DOX", ["SEN0237 DO 센서 키트", "점퍼선 3개"],
           ["전극에 전해액을 채워 쓰고, 보정 후 사용합니다.", "수초 광합성, 수온과 용존 산소 실험에 씁니다."]),
    analog("orp", "ORP(산화환원전위) 센서", "물·용액", "ORP", ["SEN0165 ORP 키트", "점퍼선 3개"],
           ["−2000~2000 mV. 표준액(예: 256 mV)으로 확인 후 씁니다."]),
    analog("rain", "빗물 감지 센서", "물·용액", "RAIN", ["빗물 감지판 + LM393 모듈 (AO 핀)", "점퍼선 3개"],
           ["젖을수록 값이 커집니다 (상대값). 회로 부분은 물에 넣지 않습니다."]),
    analog("soil-resistive", "토양 수분 센서 (저항식)", "물·용액", "SOIL", ["저항식 토양 센서 + LM393 모듈", "점퍼선 3개"],
           ["전극이 쉽게 부식됩니다. 오래 꽂아 둘 때는 정전식을 씁니다.", "모듈에 따라 값 방향이 반대일 수 있으니 마른 흙(0 %)·물(100 %)로 2점 보정 후 씁니다."]),
    analog("water-level-optical", "광전 수위 센서 (SEN0205)", "물·용액", "DOUT", ["SEN0205 모듈", "점퍼선 3개"],
           ["물이 닿으면 0↔1로 바뀝니다."], connector="digital-out"),
    # 생체
    analog("pulse", "맥박 센서 (Pulse Sensor)", "생체", "PULS", ["Pulse Sensor", "점퍼선 3개"],
           ["손가락 끝이나 귓불에 대고 움직이지 않습니다. 측정 간격 0.1초로 파형을 봅니다.", "의료용이 아닙니다."]),
    part("max30102", "맥박·산소포화도 센서 MAX30102", "생체", "i2c", ["PPG"],
         ["MAX30102 모듈", "점퍼선 4개"], ["적외선 맥박 파형(상대값)을 기록합니다. 봉우리 간격으로 맥박 수를 구합니다.", "의료용이 아닙니다."], minSet=F, addr="0x57"),
    analog("ecg", "심전도 센서 AD8232", "생체", "ECG", ["AD8232 모듈", "전극 패드 3개"],
           ["전극을 붙이고 움직이지 않습니다. 노트북은 충전기를 빼고 씁니다 (잡음).", "의료용이 아닙니다."]),
    analog("emg", "근전도 센서 (Grove EMG · SEN0240)", "생체", "EMG", ["근전도 모듈", "전극 패드"],
           ["근육에 힘을 줄 때 커지는 상대값입니다."]),
    analog("gsr", "피부 전기 반응 센서 (Grove GSR)", "생체", "GSR", ["GSR 모듈", "손가락 전극"],
           ["긴장·자극에 따라 바뀌는 상대값입니다."]),
]
PARTS += MORE_PARTS

# ---------------------------------------------------------------- 추가 센서 2 (공식 판매처 조사, 펌웨어 0.5.0)
# 엘레파츠·아이씨뱅큐·메카솔루션·디바이스마트(엔티렉스) 판매 모듈 (docs/research/official_distributors_sensors.md)
MORE_PARTS2 = [
    # 온도
    part("tmp117", "정밀 온도 센서 TMP117 / TMP119 (±0.1 °C)", "온도", "i2c", ["T"],
         ["TMP117 모듈 (Qwiic)", "점퍼선 4개"], ["±0.1 °C로 가장 정밀합니다. 열량계·중화열 실험에 좋습니다."], minSet=F, addr="0x48"),
    part("tmp102", "온도 센서 TMP102", "온도", "i2c", ["T"],
         ["TMP102 모듈", "점퍼선 4개"], ["±0.5 °C. 작은 기판 온도 센서입니다."], minSet=F, addr="0x48"),
    part("mcp9600", "열전대 앰프 MCP9600 (I2C, 고온)", "온도", "i2c", ["TK"],
         ["Grove I2C Thermocouple Amplifier (MCP9600)", "K형 열전대"], ["−200~1300 °C. 냉접점 보상이 들어 있습니다.", "모듈 기판은 불에서 멀리 둡니다."], minSet=F, addr="0x60"),
    part("max31855", "K형 열전대 MAX31855 (고온, 정밀)", "온도", "spi-tc", ["TK"],
         ["MAX31855 모듈", "K형 열전대", "점퍼선 5개"], ["MAX6675와 같은 자리(D10·D12·D13)에 꽂으면 자동으로 구분합니다. −200~1350 °C."], minSet=F),
    part("max31865", "백금 저항 온도 PT100 + MAX31865", "온도", "spi-rtd", ["TPT"],
         ["MAX31865 모듈 (기준 저항 430 Ω)", "PT100 탐침 (2선·3선·4선)", "점퍼선 6개"],
         ["−200~600 °C를 ±0.5 °C로 잽니다. 기준 저항이 430 Ω인 PT100 모듈 기준입니다.",
          "3선 탐침은 모듈 뒷면의 납땜 점퍼를 3선으로 바꿔야 합니다."], minSet=F),
    analog("ntc", "NTC 서미스터 10 kΩ (B 3950)", "온도", "TNTC", ["NTC 10 kΩ 서미스터", "10 kΩ 저항", "브레드보드"],
           ["값싼 온도 센서입니다. 얼음물(0 °C)로 1점 보정하면 정확해집니다.", "B 값이 3950이 아니면 보정 후 씁니다.",
            "연결 그림대로 NTC를 5V 쪽, 10 kΩ 저항을 GND 쪽에 둡니다 (반대로 꽂으면 온도가 거꾸로 나옴)."],
           connector="analog-divider", minSet=F),
    part("am2320", "온습도 센서 AM2320", "온습도", "i2c", ["TA", "RH"],
         ["AM2320 센서", "점퍼선 4개 (SDA·SCL 10 kΩ 풀업이 없으면 추가)"], ["2초마다 새 값이 나옵니다."], minSet=F, addr="0x5C"),
    part("hih6130", "온습도 센서 HIH6130 / HIH6120", "온습도", "i2c", ["TA", "RH"],
         ["HIH6130 모듈", "점퍼선 4개"], ["±4 % RH. LCD 어댑터(0x27)와 주소가 같아 함께 쓰지 않습니다."], minSet=F, addr="0x27"),
    # 기압
    part("bmp388", "기압 센서 BMP388 / BMP390", "기압·압력", "i2c", ["TA", "BP"],
         ["BMP388·BMP390 모듈", "점퍼선 4개"], ["±0.03 kPa. 높이에 따른 기압 변화도 볼 수 있습니다."], minSet=F, addr="0x77"),
    part("dps310", "기압 센서 DPS310 (Grove)", "기압·압력", "i2c", ["TA", "BP"],
         ["DPS310 모듈", "점퍼선 4개"], ["±0.002 kPa로 아주 정밀합니다."], minSet=F, addr="0x77"),
    part("ms5611", "기압 센서 MS5611 (GY-63)", "기압·압력", "i2c", ["TA", "BP"],
         ["GY-63 MS5611 모듈", "점퍼선 4개"], ["10 cm 높이 차이도 구분할 만큼 정밀합니다."], minSet=F, addr="0x77"),
    part("mpl3115a2", "기압 센서 MPL3115A2", "기압·압력", "i2c", ["TA", "BP"],
         ["MPL3115A2 모듈", "점퍼선 4개"], ["0.6초마다 새 값이 나옵니다."], minSet=F, addr="0x60"),
    analog("mpx5010dp", "차압 센서 MPX5010DP (0~10 kPa)", "기압·압력", "DP", ["MPX5010DP 모듈", "실리콘 관 2개", "점퍼선 3개"],
           ["두 관의 압력 차이를 잽니다. 입김·폐활량·유속 실험에 씁니다.", "시작 전에 두 관을 열어 두고 영점을 맞춥니다."]),
    analog("water-pressure", "수압 센서 (SEN0257, 0~1.6 MPa)", "기압·압력", "WPRS", ["SEN0257 수압 센서", "점퍼선 3개"],
           ["물 깊이에 따른 압력(물기둥 1 m ≈ 9.8 kPa)을 잽니다. 범위가 커서 깊은 수조에 알맞습니다."]),
    # 기체
    analog("mq-5", "MQ-5 LPG·도시가스 (상대값)", "기체", "GAS", ["MQ-5 모듈 (AO 핀)", "점퍼선 3개"], ["3분 이상 예열합니다."]),
    analog("mq-6", "MQ-6 LPG·부탄 (상대값)", "기체", "GAS", ["MQ-6 모듈 (AO 핀)", "점퍼선 3개"], ["부탄가스 확산 실험에 씁니다. 3분 이상 예열합니다."]),
    analog("mq-131", "MQ-131 오존 (상대값)", "기체", "GAS", ["MQ-131 모듈 (AO 핀)", "점퍼선 3개"], ["오존에 반응합니다. 예열이 깁니다(24시간 권장)."]),
    analog("mq-137", "MQ-137 암모니아 (상대값)", "기체", "GAS", ["MQ-137 모듈 (AO 핀)", "점퍼선 3개"], ["암모니아 확산·발생 실험에 씁니다. 3분 이상 예열합니다."]),
    analog("mq-138", "MQ-138 휘발성 유기물 (상대값)", "기체", "GAS", ["MQ-138 모듈 (AO 핀)", "점퍼선 3개"], ["알코올·아세톤·톨루엔 등에 반응합니다."]),
    analog("mics-5524", "MiCS-5524 가스 (CO·알코올·VOC, 상대값)", "기체", "GAS", ["MiCS-5524 모듈", "점퍼선 3개"], ["여러 기체에 함께 반응합니다 (구분 못 함)."]),
    part("mhz16", "이산화탄소 센서 MH-Z14A / MH-Z16 (UART, 0~50000 ppm)", "기체", "uart", ["CO2"],
         ["MH-Z14A 또는 Gravity SEN0220 (MH-Z16)", "점퍼선 4개"], ["MH-Z19와 같은 방식이라 자동으로 인식합니다. 진한 CO₂(발효·연소)도 잽니다."], minSet=F),
    part("cm1106", "이산화탄소 센서 CM1106 / CM1108 (UART)", "기체", "uart", ["CO2"],
         ["Cubic CM1106·CM1108", "점퍼선 4개"], ["0~5000 ppm. 켠 뒤 3분 예열합니다."], minSet=F),
    part("cozir", "이산화탄소 센서 COZIR / SprintIR (UART)", "기체", "uart-3v3", ["CO2"],
         ["GSS COZIR·SprintIR·ExplorIR", "점퍼선 4개"], ["SprintIR은 빨라서 반응 속도 실험에 좋습니다. 배율은 자동으로 읽습니다."], minSet=F),
    part("hcho", "폼알데하이드 센서 (SEN0231, UART)", "기체", "uart", ["HCHO"],
         ["DFRobot SEN0231 (WZ-S)", "점퍼선 4개"], ["0~5 ppm. 실내 공기질 비교에 씁니다."], minSet=F),
    part("pms5003st", "미세먼지 + 폼알데하이드 센서 PMS5003ST", "기체", "uart", ["PM1", "PM25", "PM10", "HCHO", "TA", "RH"],
         ["PMS5003ST (SEN0233)", "점퍼선 4개"], ["미세먼지·폼알데하이드·온도·습도를 함께 잽니다."], minSet=F),
    part("sgp40", "VOC 센서 SGP40 (원시값)", "기체", "i2c", ["VOCR"],
         ["SGP40 모듈", "점퍼선 4개"], ["휘발성 물질이 많아지면 값이 내려갑니다 (상대 비교용)."], minSet=F, addr="0x59"),
    # 빛
    part("as7341", "분광 센서 AS7341 (8파장, 간이 분광광도계)", "빛·색", "i2c",
         ["S415", "S445", "S480", "S515", "S555", "S590", "S630", "S680"],
         ["AS7341 모듈 (DFRobot SEN0364 등)", "점퍼선 4개", "LED 광원·큐벳 받침"],
         ["415~680 nm 8가지 빛 세기를 잽니다. 용액의 흡광도(비어-람베르트 법칙) 실험에 좋습니다.",
          "흡광도 = log(증류수 값 ÷ 시료 값). 표에서 계산 열로 구합니다."], minSet=F, addr="0x39"),
    part("apds9960", "색·근접 센서 APDS9960", "빛·색", "i2c", ["COLR", "COLG", "COLB"],
         ["APDS9960 모듈", "점퍼선 4개"], ["빨강·초록·파랑 비율(%)을 잽니다. 용액 색 변화 비교에 씁니다."], minSet=F, addr="0x39"),
    part("ltr390", "자외선 센서 LTR390 (UV 지수)", "빛·색", "i2c", ["UVI"],
         ["LTR390 모듈", "점퍼선 4개"], ["자외선 지수(UVI)입니다. 선크림·유리·그늘에 따른 자외선 차단을 비교합니다."], minSet=F, addr="0x53"),
    part("si1145", "자외선 센서 SI1145 (Grove Sunlight)", "빛·색", "i2c", ["UVI"],
         ["SI1145 모듈", "점퍼선 4개"], ["자외선 지수 근삿값입니다."], minSet=F, addr="0x60"),
    analog("ml8511", "자외선 센서 ML8511 (아날로그)", "빛·색", "UVML", ["ML8511 모듈", "점퍼선 3개 (3.3 V 전원)"],
           ["자외선 세기(mW/cm²)입니다. 모듈의 EN 핀은 3.3V에 함께 연결합니다."], connector="analog-3v3"),
    part("modulino-light", "Modulino Light (LTR381, 색·조도)", "빛·색", "qwiic", ["COLR", "COLG", "COLB", "LUX"],
         ["Modulino Light", "Qwiic 케이블"], ["빨강·초록·파랑 비율과 조도(lx)를 함께 잽니다."], minSet=F, addr="0x53"),
    # 거리
    part("vl53l1x", "레이저 거리 센서 VL53L1X (최대 4 m)", "무게·거리·힘", "i2c", ["DIST"],
         ["VL53L1X 모듈", "점퍼선 4개"], ["4 cm~4 m. 라이브러리 없이 바로 됩니다. 물체 낙하·수레 운동에 좋습니다."], minSet=F, addr="0x29"),
    part("modulino-distance", "Modulino Distance (VL53L4CD)", "무게·거리·힘", "qwiic", ["DIST"],
         ["Modulino Distance", "Qwiic 케이블"], ["1~130 cm. Qwiic 케이블로 꽂으면 바로 됩니다."], minSet=F, addr="0x29"),
    part("vl6180x", "근거리 레이저 센서 VL6180X (0~20 cm)", "무게·거리·힘", "i2c", ["DIST"],
         ["VL6180X 모듈", "점퍼선 4개"], ["0~20 cm를 mm 단위로 잽니다. 용수철 진동처럼 짧은 움직임에 씁니다."], minSet=F, addr="0x29"),
    analog("gp2y0a21", "적외선 거리 센서 GP2Y0A21 (10~80 cm)", "무게·거리·힘", "IRD", ["Sharp GP2Y0A21", "JST 3핀 케이블"],
           ["10 cm보다 가까우면 값이 틀립니다.", "전압→거리 곡선 변환은 UNO R4·Mega에서만 됩니다."], minSet=F),
    analog("gp2y0a41", "적외선 거리 센서 GP2Y0A41 (4~30 cm)", "무게·거리·힘", "IRDS", ["Sharp GP2Y0A41", "JST 3핀 케이블"],
           ["4 cm보다 가까우면 값이 틀립니다.", "전압→거리 곡선 변환은 UNO R4·Mega에서만 됩니다."], minSet=F),
    part("tfmini", "라이다 거리 센서 TFmini-S / TFmini Plus / TF-Luna", "무게·거리·힘", "uart", ["DIST"],
         ["Benewake TFmini-S·Plus·TF-Luna", "점퍼선 4개"], ["0.1~12 m. 먼 거리 운동에 씁니다. 기본 설정(115200, UART)으로 씁니다."], minSet=F),
    part("a02yyuw", "방수 초음파 거리 센서 A02YYUW (UART)", "무게·거리·힘", "uart", ["DIST"],
         ["DFRobot A02YYUW", "점퍼선 4개"], ["3~450 cm. 물 위 수위 측정에 씁니다 (센서 머리만 방수)."], minSet=F),
    analog("maxbotix", "방수 초음파 MaxBotix (아날로그)", "무게·거리·힘", "DUS", ["MaxBotix MB7388 등", "점퍼선 3개"],
           ["AN 핀을 연결합니다. 5 V 전원 기준입니다."]),
    part("nau7802", "로드셀 ADC NAU7802 (Qwiic 저울)", "무게·거리·힘", "i2c", ["M"],
         ["SparkFun Qwiic Scale (NAU7802)", "로드셀", "기준 추"], ["HX711 대신 Qwiic 케이블로 연결하는 저울입니다. '보정'에서 영점 → 기준 추 순서로 맞춥니다."], minSet=F, addr="0x2A"),
    # 움직임·자기
    part("icm20948", "9축 센서 ICM-20948 / ICM-20649", "움직임·자기", "i2c", ["AX", "AY", "AZ"],
         ["ICM-20948 모듈 (MPU9250 후속)", "점퍼선 4개"], ["x·y·z 가속도(m/s²)를 잽니다."], minSet=F, addr="0x68"),
    part("mma8452q", "가속도 센서 MMA8452Q", "움직임·자기", "i2c", ["AX", "AY", "AZ"],
         ["MMA8452Q 모듈", "점퍼선 4개"], ["±2 g 범위로 잽니다."], minSet=F, addr="0x1D"),
    part("adxl313", "가속도 센서 ADXL313 (Qwiic)", "움직임·자기", "i2c", ["AX", "AY", "AZ"],
         ["SparkFun ADXL313", "Qwiic 케이블"], ["±4 g 범위로 잽니다."], minSet=F, addr="0x1D"),
    part("bno055", "방향 센서 BNO055 (9축, 각도 계산)", "움직임·자기", "i2c", ["AX", "AY", "AZ", "ANG"],
         ["BNO055 모듈", "점퍼선 4개"], ["가속도와 방위각(°)을 함께 냅니다. 처음 몇 초는 천천히 돌려 보정합니다."], minSet=F, addr="0x28"),
    part("as5600", "자석 회전 각도 센서 AS5600", "움직임·자기", "i2c", ["ANG"],
         ["AS5600 모듈 + 원형 자석", "점퍼선 4개"], ["0~360°를 잽니다. 진자의 흔들림·회전 운동에 씁니다.", "자석을 칩 바로 위 1~3 mm에 둡니다."], minSet=F, addr="0x36"),
    analog("hall-angle", "360° 홀 각도 센서 (SEN0221, 아날로그)", "움직임·자기", "ANGA", ["SEN0221 모듈", "점퍼선 3개"],
           ["손잡이를 돌린 각도(°)입니다. 0°·180° 두 점으로 보정하면 정확해집니다."]),
    part("lis3mdl", "자기장 센서 LIS3MDL", "움직임·자기", "i2c", ["MAG"],
         ["LIS3MDL 모듈", "점퍼선 4개"], ["±400 µT. 코일·자석 주변 자기장 세기를 잽니다."], minSet=F, addr="0x1C"),
    part("mag3110", "자기장 센서 MAG3110", "움직임·자기", "i2c", ["MAG"],
         ["MAG3110 모듈", "점퍼선 4개"], ["±1000 µT."], minSet=F, addr="0x0E"),
    part("bmm150", "자기장 센서 BMM150 (Grove Compass v2)", "움직임·자기", "i2c", ["MAG"],
         ["BMM150 모듈", "점퍼선 4개"], ["공장 보정을 쓰지 않은 근삿값입니다. 변화 비교에 씁니다."], minSet=F, addr="0x13"),
    part("tmag5273", "3축 홀 센서 TMAG5273 (강한 자기장)", "움직임·자기", "i2c", ["MAG"],
         ["SparkFun TMAG5273", "Qwiic 케이블"], ["±40 mT(약 40000 µT)까지 잽니다. 자석 가까이·전자석 실험에 좋습니다."], minSet=F, addr="0x22"),
    # 펄스 (D3)
    analog("water-flow", "물 흐름 센서 YF-S201 (유량)", "물·용액", "FLOW", ["YF-S201 유량 센서", "점퍼선 3개", "호스"],
           ["노랑(신호)선을 D3에 꽂습니다. 1분 동안 받은 물로 보정하면 정확해집니다.", "Seeed G1/4 등 다른 크기는 보정 후 씁니다."],
           connector="pulse", minSet=F),
    analog("geiger", "가이거 계수기 (방사선, 1분 계수)", "전기·소리", "CPM", ["가이거 계수기 모듈 (SEN0463·RadiationD 등)", "점퍼선 3개"],
           ["신호(VIN·OUT)선을 D3에 꽂습니다. 1분 평균이라 처음 1분은 값이 쌓이는 중입니다.",
            "µSv/h로 보려면 '포트 직접 설정'에서 D3를 '방사선량'으로 바꿉니다.", "방사선원은 교사가 관리합니다."],
           connector="pulse", minSet=F),
    analog("anemometer-pulse", "풍속계 (펄스형)", "물·용액", "WNDP", ["펄스 출력 풍속계 (P2531 등)", "점퍼선 3개"],
           ["신호선을 D3에 꽂습니다. 제품마다 펄스-풍속 비율이 달라 설명서 값으로 보정합니다."], connector="pulse", minSet=F),
    analog("anemometer-analog", "풍속계 (아날로그, SEN0170)", "물·용액", "WIND", ["SEN0170 풍속계", "12 V 어댑터", "점퍼선 3개"],
           ["풍속계 전원은 12~24 V 따로, 신호(0~5 V)만 A0에 꽂고 GND는 함께 연결합니다."]),
    analog("ear-clip-hr", "귀 클립 심박 센서 (Grove)", "생체", "BPM", ["Grove Ear-clip Heart Rate", "점퍼선 3개"],
           ["신호선을 D3에 꽂습니다. 10초 평균 심박수입니다. 운동 전후 비교에 씁니다.", "의료용이 아닙니다."],
           connector="pulse", minSet=F),
    analog("pulse-counter", "회전수·펄스 세기 (홀 센서·포토 인터럽터)", "움직임·자기", "RPM", ["홀 센서 또는 포토 인터럽터 모듈 (DO 핀)", "점퍼선 3개"],
           ["DO선을 D3에 꽂습니다. 한 바퀴에 펄스가 1번이면 회전수(rpm) 그대로입니다."], connector="pulse", minSet=F),
    # 전기
    part("ads1115", "정밀 전압 ADS1115 (16비트, 화학 전지)", "전기·소리", "i2c", ["VP"],
         ["ADS1115 모듈", "점퍼선 4개 + 악어 클립 2개"], ["A0(+)·A1(−) 사이 전압을 0.1 mV 단위로 잽니다 (±4 V). 화학 전지·농도차 전지에 좋습니다.",
          "모듈의 A0·A1 단자입니다 (보드의 A0·A1이 아님)."], minSet=F, addr="0x48"),
    analog("acs723", "전류 센서 ACS723 (5 A)", "전기·소리", "I5B", ["ACS723 모듈", "점퍼선 3개"], ["0 A에서 영점을 맞추고 씁니다."]),
    analog("acs758", "전류 센서 ACS758 (50 A)", "전기·소리", "I50A", ["ACS758 50A 모듈", "점퍼선 3개"], ["큰 전류용입니다. 교사 시범 실험에만 씁니다."]),
]
PARTS += MORE_PARTS2

# 문제 해결: 증상 → 차례로 해 볼 것 (웹앱 3단계, 애플 앱 같은 파일)
TROUBLES = [
    dict(id="no-port", title="USB로 연결할 때 보드가 목록에 안 보여요",
         steps=["USB 케이블을 다른 것으로 바꿉니다. 충전 전용 케이블은 데이터가 안 갑니다.",
                "컴퓨터의 다른 USB 포트에 꽂습니다. 허브보다 본체에 바로 꽂는 것이 좋습니다.",
                "호환 보드(CH340 칩)를 윈도우에서 쓰면 CH340 드라이버를 한 번 설치해야 합니다.",
                "크롬이나 엣지로 열었는지 확인합니다. 사파리·파이어폭스는 USB 연결이 안 됩니다."]),
    dict(id="busy", title="'다른 프로그램이 보드를 쓰고 있습니다'가 떠요",
         steps=["Arduino IDE의 시리얼 모니터·시리얼 플로터를 닫습니다.",
                "ChemDict Lab이 열린 다른 탭이나 창을 닫습니다.",
                "USB를 뽑았다가 다시 꽂고 [USB로 연결]을 누릅니다."]),
    dict(id="no-fw", title="'측정 프로그램이 없습니다'가 떠요",
         steps=["처음 쓰는 보드입니다. 1단계 화면의 [측정 프로그램 설치]를 누릅니다 (약 30초).",
                "UNO R4·Leonardo는 아직 웹 설치가 안 됩니다. Arduino IDE로 한 번만 올리면 됩니다 (3단계 → 보드 정보 → 펌웨어 받기).",
                "설치 뒤에는 다시 할 필요가 없습니다. 보드를 뽑아도 프로그램은 남아 있습니다."]),
    dict(id="flash-fail", title="측정 프로그램 설치가 실패해요",
         steps=["센서 선을 모두 뽑고 보드만 USB로 연결한 뒤 다시 누릅니다.",
                "호환 보드라면 1단계에서 보드 종류(UNO·Nano·Mega)를 맞게 골랐는지 봅니다.",
                "그래도 안 되면 [설치] 버튼을 누른 직후 보드의 RESET 버튼을 한 번 누릅니다.",
                "실패해도 보드는 고장 나지 않습니다. 다시 시도하면 됩니다."]),
    dict(id="no-sensor", title="센서를 찾지 못했다고 나와요",
         steps=["USB를 뽑고 연결 그림대로 선을 다시 봅니다. VCC(+)와 GND(-)가 바뀌지 않았는지 확인합니다.",
                "점퍼선을 꾹 눌러 꽂습니다. 브레드보드는 같은 줄에 꽂혀야 이어집니다.",
                "USB를 다시 꽂고 [다시 찾기]를 누릅니다.",
                "이 보드가 지원하지 않는 센서일 수 있습니다. 센서 카드에 '이 보드 미지원'이 있는지 봅니다."]),
    dict(id="odd-value", title="값이 0이나 최댓값에서 안 움직여요",
         steps=["아날로그 센서는 꽂은 포트(A0~A3)와 앱에서 고른 포트가 같아야 합니다.",
                "센서의 AO(아날로그 출력) 핀을 썼는지 봅니다. DO 핀은 켜짐/꺼짐만 나옵니다.",
                "pH·전도도처럼 보정이 필요한 센서는 [센서 보정]을 먼저 합니다."]),
    dict(id="ble", title="블루투스에서 보드가 안 보여요",
         steps=["블루투스는 UNO R4 WiFi만 됩니다. 다른 보드는 USB로 연결합니다.",
                "보드에 USB 전원(보조배터리도 가능)이 들어와 있는지 봅니다.",
                "다른 기기가 이미 연결했으면 안 보입니다. 그 기기에서 연결을 끊습니다.",
                "모둠 번호(ChemDict-01~08)가 같은 보드가 두 개면 하나를 바꿉니다."]),
    dict(id="stopped", title="측정 중에 그래프가 멈췄어요",
         steps=["케이블이 빠졌거나 흔들렸을 수 있습니다. 화면 위에 '연결이 끊어졌습니다'가 떴는지 봅니다.",
                "다시 연결하면 지금까지 기록한 데이터는 그대로 남아 있습니다.",
                "노트북이 절전 모드에 들어가지 않게 합니다."]),
]

# ---------------------------------------------------------------- 브레드보드
# 구멍 이름: 열 번호 + 행 글자 (예: "c5"), 전원 줄: "T+:5"(위 + 줄, 5열 옆), "T-:5"
# 보드 핀: "pin:5V", "pin:GND", "pin:A0", "pin:A1", "pin:D2"
def wire(a, b, color): return dict(a=a, b=b, color=color)
def comp(kind, label, legs): return dict(kind=kind, label=label, legs=legs)

BREADBOARD = dict(
    intro="브레드보드는 납땜 없이 부품과 선을 꽂아 회로를 만드는 판입니다. 저항을 끼우거나, 센서 여러 개를 같은 선에 나란히 꽂거나, 전압·전류를 재는 회로를 만들 때 씁니다.",
    structure=[
        "가운데 홈을 기준으로 위쪽 a~e, 아래쪽 f~j 다섯 구멍이 세로 한 줄로 이어져 있습니다 (그림의 초록 칸).",
        "가로로 옆 칸끼리는 이어져 있지 않습니다. 가운데 홈 건너편(e와 f)도 이어지지 않습니다.",
        "위·아래 끝의 긴 줄(빨강 +, 파랑 −)은 가로로 길게 이어집니다. 보드의 5V를 + 줄, GND를 − 줄에 꽂아 전원 줄로 씁니다.",
        "긴 브레드보드는 전원 줄이 가운데에서 끊긴 것도 있습니다. 양쪽을 쓰려면 짧은 선으로 이어 줍니다.",
    ],
    rules=[
        "선을 꽂거나 뺄 때는 USB를 먼저 뽑습니다.",
        "보드 5V → + 줄, GND → − 줄을 먼저 꽂습니다. 3.3 V 센서만 쓸 때는 5V 대신 3.3V를 꽂습니다.",
        "부품의 두 다리를 같은 세로 줄에 꽂으면 그 부품은 회로에서 빠집니다. 다리는 서로 다른 줄에 꽂습니다.",
        "저항은 방향이 없습니다. LED는 긴 다리(+), 전해 축전기는 띠 없는 쪽 다리(+)가 + 방향입니다.",
        "+ 줄과 − 줄을 선 하나로 바로 잇지 않습니다 (합선).",
        "선 색을 정해 두면 실수가 줄어듭니다: 빨강 = 5V, 검정 = GND, 그 밖의 색 = 신호.",
        "구멍 끝까지 꾹 눌러 꽂습니다. 헐거우면 값이 튀거나 센서가 인식되지 않습니다.",
    ],
    resistors=[
        dict(value="100 Ω", bands="갈색 · 검정 · 갈색 · 금색", use="전류 재기(기준저항), LED"),
        dict(value="220 Ω", bands="빨강 · 빨강 · 갈색 · 금색", use="LED 보호"),
        dict(value="4.7 kΩ", bands="노랑 · 보라 · 빨강 · 금색", use="DS18B20 온도 센서"),
        dict(value="10 kΩ", bands="갈색 · 검정 · 주황 · 금색", use="빛·힘 센서, 서미스터, DHT 4핀"),
    ],
    circuits=[
        dict(id="divider", name="분압 회로 (빛 센서 LDR · 힘 센서 FSR · 서미스터)",
             what="센서와 10 kΩ 저항을 한 줄에서 만나게 하고, 그 줄의 전압을 A0으로 읽습니다.",
             steps=["보드 5V → + 줄, GND → − 줄.", "+ 줄 → 6열로 빨간 선.", "센서 다리를 6열과 9열에 꽂습니다.", "10 kΩ 저항을 9열과 13열에 꽂습니다.", "13열 → − 줄로 검은 선.", "9열(센서와 저항이 만나는 줄) → 보드 A0."],
             wires=[wire("pin:5V", "T+:2", "red"), wire("pin:GND", "T-:3", "black"), wire("T+:6", "a6", "red"), wire("a13", "T-:13", "black"), wire("pin:A0", "a9", "green")],
             parts=[comp("sensor", "센서", ["c6", "c9"]), comp("resistor", "10 kΩ", ["d9", "d13"])]),
        dict(id="pullup", name="온도 센서 여러 개 + 4.7 kΩ (DS18B20)",
             what="센서의 GND·VCC·DATA 선을 같은 세 줄에 나란히 꽂고, VCC와 DATA 줄 사이에 4.7 kΩ을 하나만 끼웁니다.",
             steps=["보드 5V → + 줄, GND → − 줄.", "8열 → − 줄, 10열 → + 줄로 선을 잇습니다.", "센서 1의 검정·빨강·노랑 선을 8·10·12열에 꽂습니다.", "센서 2도 같은 8·10·12열의 다른 구멍에 꽂습니다.", "4.7 kΩ 저항을 10열과 12열에 꽂습니다 (하나면 충분).", "12열 → 보드 D2."],
             wires=[wire("pin:5V", "T+:2", "red"), wire("pin:GND", "T-:3", "black"), wire("T-:8", "a8", "black"), wire("T+:10", "a10", "red"), wire("pin:D2", "a12", "yellow")],
             parts=[comp("resistor", "4.7 kΩ", ["b10", "b12"]), comp("probe", "온도 센서 1", ["d8", "d10", "d12"]), comp("probe", "온도 센서 2", ["e8", "e10", "e12"])]),
        dict(id="series-ref", name="전압·전류 재기 (측정 저항 + 기준저항 100 Ω)",
             what="소자와 기준저항을 직렬로 잇습니다. 기준저항 전압(A1) ÷ 100 Ω = 전류, A0 − A1 = 소자 전압입니다.",
             steps=["보드 GND → − 줄. 전지(−)도 − 줄에 꽂아 보드와 GND를 같게 합니다.", "전지(+) → 4열.", "측정 저항 R을 4열과 9열에 꽂습니다.", "100 Ω 저항을 9열과 14열에 꽂습니다.", "14열 → − 줄.", "4열 → A0, 9열 → A1."],
             wires=[wire("pin:GND", "T-:3", "black"), wire("bat:+", "c4", "red"), wire("bat:-", "T-:18", "black"), wire("a14", "T-:14", "black"), wire("pin:A0", "a4", "green"), wire("pin:A1", "a9", "orange")],
             parts=[comp("resistor", "측정 R", ["b4", "b9"]), comp("resistor", "100 Ω", ["c9", "c14"])],
             caution="전지는 5 V 보드 3개(4.5 V), 3.3 V 보드(UNO Q 등) 2개(3 V)까지만 씁니다. A0·A1에는 보드 전압을 넘는 전압이 들어가면 안 됩니다."),
        dict(id="led", name="LED 켜는 전압 재기 (가변저항 + LED + 100 Ω)",
             what="가변저항으로 전압을 조금씩 올리며 LED 전압(A0 − A1)과 전류(A1 ÷ 100 Ω)를 잽니다.",
             steps=["보드 5V → + 줄, GND → − 줄.", "가변저항 세 다리를 4·6·8열에 꽂고, 4열 → + 줄, 8열 → − 줄.", "LED 긴 다리를 6열(가운데 다리 줄), 짧은 다리를 10열에 꽂습니다.", "100 Ω 저항을 10열과 15열에, 15열 → − 줄.", "6열 → A0, 10열 → A1."],
             wires=[wire("pin:5V", "T+:2", "red"), wire("pin:GND", "T-:3", "black"), wire("T+:4", "a4", "red"), wire("a8", "T-:8", "black"), wire("a15", "T-:15", "black"), wire("pin:A0", "a6", "green"), wire("pin:A1", "a10", "orange")],
             parts=[comp("pot", "가변저항", ["c4", "c6", "c8"]), comp("led", "LED", ["e6", "e10"]), comp("resistor", "100 Ω", ["c10", "c15"])]),
        dict(id="rc", name="축전기 충전·방전 (10 kΩ + 1000 µF)",
             what="5 V로 저항을 거쳐 축전기를 충전하고, 축전기 전압을 A0으로 잽니다. 5 V 선을 GND로 옮기면 방전됩니다.",
             steps=["보드 5V → + 줄, GND → − 줄.", "+ 줄 → 5열 (충전 선). 방전할 때는 이 선을 − 줄로 옮깁니다.", "10 kΩ 저항을 5열과 10열에 꽂습니다.", "축전기 + 다리를 10열, − 다리(띠 쪽)를 13열에 꽂고, 13열 → − 줄.", "10열 → A0."],
             wires=[wire("pin:5V", "T+:2", "red"), wire("pin:GND", "T-:3", "black"), wire("T+:5", "a5", "red"), wire("a13", "T-:13", "black"), wire("pin:A0", "a10", "green")],
             parts=[comp("resistor", "10 kΩ", ["c5", "c10"]), comp("cap", "1000 µF", ["d10", "d13"])],
             caution="전해 축전기는 방향이 바뀌면 부풀거나 터질 수 있습니다. 띠가 있는 다리를 − 줄 쪽에 꽂습니다."),
    ],
)

# ---------------------------------------------------------------- 공식 자료 점검 반영 (2026-10, Arduino 데이터시트·제조사 문서)
# 5 V 전용 전원 모듈: analog → analog-5v 로 바꾸고 needs5V 표시. outOver33: 출력이 3.3 V를 넘어 3.3 V 보드에서는 분압 필요.
NEEDS_5V = {"lm35", "mpx5700", "mpx5010dp", "acs712", "acs723", "ph", "turbidity", "pir", "gp2y0a21", "gp2y0a41",
            "water-flow", "water-pressure", "anemometer-analog", "geiger", "mg811", "mics-5524", "co2-analog"}
NEEDS_5V |= {p["id"] for p in PARTS if p["id"].startswith("mq-")}
OUT_OVER_33 = {"mpx5700", "mpx5010dp", "acs712", "acs723", "ph", "turbidity", "water-pressure", "anemometer-analog", "mg811"} | {p["id"] for p in PARTS if p["id"].startswith("mq-")}
CURRENT_MA = {"mhz19": 150, "mhz16": 150, "pms7003": 100, "pms5003st": 100, "mg811": 200, "scd30": 75, "scd4x": 60}
CURRENT_MA.update({p["id"]: 160 for p in PARTS if p["id"].startswith("mq-")})
MQ_CAUTION = "히터 전원 5.0 V 전용(약 150 mA, 3.3 V로는 예열이 안 됨). 3.3 V 보드에서는 5V 핀에서 전원을 주고 AO 신호는 2:1 분압. USB 전원으로는 MQ·미세먼지·CO₂ 큰 센서를 2개까지만."
WATER_IF = "같은 비커에 전도도(EC·TDS) 전극과 pH·ORP·용존 산소 전극을 함께 넣으면 EC 전극의 교류 신호 때문에 값이 흔들립니다. 번갈아 재거나 EC 쪽에 아날로그 신호 아이솔레이터(DFRobot DFR0504, 5 V)를 끼웁니다."
EXTRA_CAUTIONS = {
    "lm35": ["전원 4 V 이상 필요 — 3.3 V 보드에서는 5V 핀에 꽂거나 TMP36(2.7~5.5 V)을 씁니다."],
    "mpx5700": ["5 V 보드 전용 (출력 0.2~4.7 V). 3.3 V 보드에서는 5V 핀 전원 + 출력에 2:1 분압(변환 배율 2배)."],
    "mpx5010dp": ["5 V 보드 전용 (출력 0.2~4.7 V). 3.3 V 보드에서는 5V 핀 전원 + 출력에 2:1 분압(변환 배율 2배)."],
    "acs712": ["전원 4.5~5.5 V, 0 A에서 2.5 V 출력 — 5 V 보드 전용 (3.3 V 보드 미지원)."],
    "acs723": ["5 V 보드 전용 (3.3 V 보드 미지원)."],
    "ads1115": ["VDD를 5V 핀에 연결(2~5.5 V 가능)해야 ±4 V까지 잴 수 있습니다. 3.3V 전원이면 각 단자 전압이 3.3 V를 넘지 않게 합니다 (입력은 VDD+0.3 V까지)."],
    "gp2y0a21": ["전원 5 V 전용 (출력은 3.1 V 이하라 3.3 V 보드 ADC는 괜찮음). 값이 튀면 VCC–GND 사이에 10 µF 커패시터를 답니다."],
    "gp2y0a41": ["전원 5 V 전용 (출력은 3.1 V 이하라 3.3 V 보드 ADC는 괜찮음). 값이 튀면 VCC–GND 사이에 10 µF 커패시터를 답니다."],
    "anemometer-analog": ["신호가 0~5 V라 3.3 V 보드에서는 2:1 분압(10 kΩ+10 kΩ)을 넣고 변환 배율을 2배로 합니다."],
    "water-flow": ["전원 5 V 전용 (3.3 V 불가). 출력 펄스가 전원 전압 크기이므로 3.3 V 보드에서는 노랑 신호선에 1 kΩ+2 kΩ 분압."],
    "ec": [WATER_IF], "tds": [WATER_IF], "ph": [WATER_IF], "orp": [WATER_IF], "dissolved-oxygen": [WATER_IF],
    "ds18b20": ["센서가 여러 개이거나 선이 길면(3 m 이상) VCC를 반드시 연결합니다 (2선 기생 전원 불가). 85 °C나 −127 °C에 고정되면 풀업·VCC·DATA를 확인합니다."],
}
def _apply_audit():
    byid = {p["id"]: p for p in PARTS}
    for pid in NEEDS_5V:
        p = byid.get(pid)
        if not p: continue
        p["needs5V"] = True
        if p["connector"] == "analog": p["connector"] = "analog-5v"
        if pid in OUT_OVER_33: p["outOver33"] = True
    for pid, ma in CURRENT_MA.items():
        if pid in byid: byid[pid]["currentMa"] = ma
    for p in PARTS:
        if p["id"].startswith("mq-") and MQ_CAUTION not in p["cautions"]: p["cautions"].append(MQ_CAUTION)
        for c in EXTRA_CAUTIONS.get(p["id"], []):
            if c not in p["cautions"]: p["cautions"].append(c)
    # ads1115: VDD는 5V 핀 (i2c 연결의 VCC→PWR3 대신)
    if "ads1115" in byid:
        CONNECTORS["i2c-5v"] = dict(CONNECTORS["i2c"], name="I2C 4선 (VCC는 5V)",
            wires=[dict(w, pin="PWR", term="VDD (5 V)") if w["pin"] == "PWR3" else w for w in CONNECTORS["i2c"]["wires"]],
            cautions=["VDD를 5V 핀에 연결해야 ±4 V까지 잴 수 있습니다. SDA·SCL은 보드 전압과 같습니다."])
        byid["ads1115"]["connector"] = "i2c-5v"
    # I2C 주소 충돌: 같은 주소를 쓰는 부품끼리 자동 caution
    import re as _re
    addrs = {}
    for p in PARTS:
        for a in _re.findall(r"0x[0-9A-Fa-f]{2}", p.get("addr", "") or ""):
            addrs.setdefault(a.lower(), []).append(p)
    for a, ps in addrs.items():
        if len(ps) < 2: continue
        for p in ps:
            others = "·".join(q["name"].split(" (")[0] for q in ps if q is not p)[:80]
            c = f"주소 {a}가 같은 {others}와 한 버스에 함께 꽂지 않습니다 (하나만 인식됨). UNO R4 WiFi·Nano R4·UNO Q는 Qwiic 단자와 SDA·SCL 핀에 하나씩 나누면 됩니다."
            if not any(f"주소 {a}가 같은" in x for x in p["cautions"]): p["cautions"].append(c)
    # 보드가 지원하지 않는 연결 방식의 핀 역할은 '—' (lite: 열전대·PT100·초음파 없음, mini: HX711도 없음)
    LITE_OFF = ["TC_CS", "TC_SO", "TC_SCK", "RTD_CS", "SPI_SDI", "TRIG", "ECHO"]
    MINI_OFF = LITE_OFF + ["HX_DT", "HX_SCK"]
    for b in BOARDS:
        off = MINI_OFF if b["sensorSet"] == "mini" else LITE_OFF if b["sensorSet"] == "lite" else []
        for k in off: b["pins"][k] = "—"
        if b["sensorSet"] == "none" and b["logic"].startswith("3.3"):
            for k in ["U_RX", "U_TX", "PULSE", "TC_CS", "TC_SO", "TC_SCK", "RTD_CS", "SPI_SDI"]: b["pins"][k] = "— (펌웨어 준비 중)"
_apply_audit()

TROUBLES += [
    dict(id="i2c-missing", title="I2C(Qwiic) 센서를 못 찾아요",
         steps=["Qwiic 케이블이 '딸깍' 소리가 날 때까지 들어갔는지 봅니다 (방향은 없음).",
                "주소가 같은 센서 둘(예: 색 TCS34725와 거리 VL53L0X 둘 다 0x29)을 한 버스에 꽂으면 하나만 보입니다. UNO R4 WiFi·Nano R4·UNO Q는 Qwiic 단자와 SDA·SCL 핀에 하나씩 나눕니다.",
                "UNO R3·Nano·Mega·Leonardo의 SDA·SCL에 3.3 V 전용 모듈(Modulino 등)을 레벨 변환 없이 꽂으면 인식이 안 되거나 망가집니다.",
                "모듈 VCC가 3.3V(또는 'VIN 3–5 V' 모듈만 5V)에 꽂혔는지, SDA·SCL이 서로 바뀌지 않았는지 봅니다.",
                "A4·A5가 I2C인 보드(UNO R3·Nano·Nano R4)에서는 그 핀에 아날로그 센서를 같이 꽂을 수 없습니다."]),
    dict(id="temp-stuck", title="온도가 85 °C나 −127 °C에서 안 움직여요 (DS18B20)",
         steps=["−127 °C는 '센서 없음'입니다. DATA·VCC·GND 선과 4.7 kΩ 풀업 저항(DATA–VCC)을 확인합니다.",
                "85 °C는 전원이 들어온 직후의 초깃값입니다. 그대로면 전원·풀업이 약한 것 — 선이 길거나 센서가 여러 개면 VCC를 반드시 연결합니다 (2선 기생 전원 불가).",
                "USB를 뽑았다 다시 꽂고 [센서 다시 찾기]를 누릅니다."]),
    dict(id="dht-empty", title="온습도(DHT) 값이 비어 있어요",
         steps=["처음 2~3초는 값이 없습니다. DHT22는 2초, DHT11은 1초보다 자주 읽을 수 없습니다 (앱은 맞춰져 있음).",
                "핀 4개짜리 센서(모듈 아님)는 DATA–VCC 사이 10 kΩ 풀업이 필수입니다. 3핀 모듈은 S·+·− 인쇄를 확인합니다.",
                "선은 짧게(1 m 이내). 길면 값이 비거나 튑니다."]),
    dict(id="power-budget", title="센서를 여러 개 꽂으니 보드가 다시 켜지거나 값이 흔들려요",
         steps=["USB 전원은 500 mA가 한계입니다. MQ 가스(약 150 mA)·미세먼지(100 mA)·MH-Z19(150 mA)는 2개까지만 함께 씁니다.",
                "DC 잭이나 VIN에 7~12 V 어댑터를 꽂으면 해결됩니다.",
                "Nano R4의 3V3 핀은 150 mA까지입니다. I2C 모듈을 많이 이으면 'VIN 3–5 V' 모듈은 5V 핀으로 옮깁니다."]),
]

ORDER = ["온도", "온습도", "기압·압력", "기체", "빛·색", "물·용액", "무게·거리·힘", "움직임·자기", "전기·소리", "생체"]

out = dict(version=2, common=COMMON, categories=ORDER, boards=BOARDS, connectors=CONNECTORS, parts=PARTS, troubles=TROUBLES, breadboard=BREADBOARD,
           planned=["열화상 카메라 AMG8833·MLX90640", "먼지 센서 GP2Y1014AU·PPD42NS (펄스 폭 방식)",
                    "색 센서 TCS3200 (주파수 출력)", "RS485 토양 센서 (수분·EC·pH·질소·인·칼륨)",
                    "오존 SEN0321·멀티가스 MiCS-4514·심박 허브 MAX32664", "HTU31D·SHT1x·ICP-10111·MS5540C·HPMA115",
                    "Nano ESP32·Nano 33·GIGA 펌웨어"])
path = pathlib.Path(__file__).resolve().parent.parent / "protocol" / "guide.json"
path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("boards", len(BOARDS), "parts", len(PARTS), "->", path)
