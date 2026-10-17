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
]

# ---------------------------------------------------------------- 보드
# sensorSet: full(모든 센서) · lite(UNO R3·Nano: LPS22·SCD4x·TCS34725·MAX6675·HC-SR04 제외)
#            · mini(Leonardo: lite에서 BME280·HX711도 제외) · none(펌웨어 없음)
def pins5(sda='SDA (A4)', scl='SCL (A5)', onewire='D2', pwr='5V'):
    return {"PWR": pwr, "PWR3": "3.3V", "GND": "GND", "SDA": sda, "SCL": scl, "A": "A0",
            "ONEWIRE": onewire, "DHT": "D4", "HX_DT": "D5", "HX_SCK": "D6",
            "TRIG": "D7", "ECHO": "D8", "TC_CS": "D10", "TC_SO": "D12", "TC_SCK": "D13"}

V33_NOTE = "3.3 V 보드입니다. 5 V 신호를 내는 모듈(MQ 가스, HC-SR04, 5 V 전용 pH 모듈 등)의 신호선을 바로 연결하지 않습니다."
CH340 = "호환 보드(CH340 칩)는 맥에 CH340 드라이버가 필요할 수 있습니다. 포트가 안 보이면 판매처의 드라이버를 설치합니다."

BOARDS = [
    dict(id="uno-r4-wifi", name="UNO R4 WiFi", match=["UNO R4 WiFi"], firmware="verified", sensorSet="full",
         firmwareNote="기준 보드. 실제 보드에서 확인했습니다. USB와 블루투스 모두 됩니다.",
         usb="USB-C", ble=True, logic="5 V", adc="14비트 (0~5 V)", qwiic="있음 (3.3 V)", pins=pins5(),
         notes=["I2C 센서는 Qwiic 단자와 SDA·SCL 핀 어디에 꽂아도 인식합니다."]),
    dict(id="uno-r4-minima", name="UNO R4 Minima", match=["UNO R4 Minima"], firmware="compiled", sensorSet="full",
         firmwareNote="모든 센서 지원 (컴파일 확인, 실제 보드 확인 전). USB로만 연결됩니다.",
         usb="USB-C", ble=False, logic="5 V", adc="14비트 (0~5 V)", qwiic="없음", pins=pins5(), notes=[]),
    dict(id="nano-r4", name="Nano R4", match=["Nano R4"], firmware="compiled", sensorSet="full",
         firmwareNote="모든 센서 지원 (컴파일 확인, 실제 보드 확인 전). USB로만 연결됩니다.",
         usb="USB-C", ble=False, logic="5 V", adc="14비트 (0~5 V)", qwiic="있음 (3.3 V)",
         pins=pins5(sda="A4 (SDA)", scl="A5 (SCL)"),
         notes=["브레드보드에 꽂아 쓰면 선을 연결하기 쉽습니다. 핀 이름은 보드 옆면에 인쇄되어 있습니다."]),
    dict(id="mega-2560", name="Mega 2560 (호환 포함)", match=["Mega 2560"], firmware="compiled", sensorSet="full",
         firmwareNote="모든 센서 지원 (컴파일 확인, 실제 보드 확인 전). USB로만 연결됩니다.",
         usb="USB-B (맥북은 변환 필요)", ble=False, logic="5 V", adc="10비트 (0~5 V)", qwiic="없음",
         pins=pins5(sda="D20 (SDA)", scl="D21 (SCL)"), notes=["I2C 핀이 A4·A5가 아니라 D20·D21입니다.", CH340]),
    dict(id="uno-r3", name="UNO R3 (호환 포함)", match=["UNO R3"], firmware="compiled", sensorSet="lite",
         firmwareNote="메모리가 작아 가벼운 버전입니다 (기압 LPS22, CO₂, 색, 열전대, 초음파 제외). 컴파일 확인, 실제 보드 확인 전.",
         usb="USB-B (맥북은 변환 필요)", ble=False, logic="5 V", adc="10비트 (0~5 V)", qwiic="없음",
         pins=pins5(), notes=[CH340]),
    dict(id="nano", name="Nano (호환 포함)", match=["Nano"], firmware="compiled", sensorSet="lite",
         firmwareNote="가벼운 버전입니다 (UNO R3와 같음). 컴파일 확인, 실제 보드 확인 전.",
         usb="Mini-USB (호환품은 USB-C도 있음)", ble=False, logic="5 V", adc="10비트 (0~5 V)", qwiic="없음",
         pins=pins5(sda="A4 (SDA)", scl="A5 (SCL)"),
         notes=[CH340, "호환 Nano에 업로드가 안 되면 IDE의 Tools > Processor에서 'ATmega328P (Old Bootloader)'를 고릅니다."]),
    dict(id="leonardo", name="Leonardo", match=["Leonardo"], firmware="compiled", sensorSet="mini",
         firmwareNote="가장 가벼운 버전입니다 (BME280·HX711도 제외). 컴파일 확인, 실제 보드 확인 전.",
         usb="Micro-USB", ble=False, logic="5 V", adc="10비트 (0~5 V)", qwiic="없음",
         pins=pins5(sda="D2 (SDA)", scl="D3 (SCL)", onewire="D9"),
         notes=["D2·D3이 I2C 핀이라 DS18B20은 D9에 연결합니다."]),
    dict(id="nano-every", name="Nano Every", match=["Nano Every"], firmware="none", sensorSet="none",
         firmwareNote="ChemDict 펌웨어 준비 중입니다. 연결 방법만 참고하세요.",
         usb="Micro-USB", ble=False, logic="5 V", adc="10비트 (0~5 V)", qwiic="없음",
         pins=pins5(sda="A4 (SDA)", scl="A5 (SCL)"), notes=[]),
    dict(id="nano-esp32", name="Nano ESP32", match=["Nano ESP32"], firmware="none", sensorSet="none",
         firmwareNote="ChemDict 펌웨어 준비 중입니다. 연결 방법만 참고하세요.",
         usb="USB-C", ble=True, logic="3.3 V", adc="12비트 (0~3.3 V)", qwiic="없음",
         pins=pins5(sda="A4 (SDA)", scl="A5 (SCL)", pwr="3.3V"), notes=[V33_NOTE]),
    dict(id="nano-33-iot", name="Nano 33 IoT", match=["Nano 33 IoT"], firmware="none", sensorSet="none",
         firmwareNote="ChemDict 펌웨어 준비 중입니다. 연결 방법만 참고하세요.",
         usb="Micro-USB", ble=True, logic="3.3 V", adc="12비트 (0~3.3 V)", qwiic="없음",
         pins=pins5(sda="A4 (SDA)", scl="A5 (SCL)", pwr="3.3V"), notes=[V33_NOTE]),
    dict(id="nano-33-ble-sense", name="Nano 33 BLE Sense Rev2", match=["Nano 33 BLE"], firmware="none", sensorSet="none",
         firmwareNote="ChemDict 펌웨어 준비 중입니다. 연결 방법만 참고하세요.",
         usb="Micro-USB", ble=True, logic="3.3 V", adc="12비트 (0~3.3 V)", qwiic="없음",
         pins=pins5(sda="A4 (SDA)", scl="A5 (SCL)", pwr="3.3V"),
         notes=[V33_NOTE, "보드 안에 온습도·기압·색·소리·움직임 센서가 들어 있습니다 (Arduino Science Journal 앱에서 사용 가능)."]),
    dict(id="giga-r1", name="GIGA R1 WiFi", match=["GIGA"], firmware="none", sensorSet="none",
         firmwareNote="ChemDict 펌웨어 준비 중입니다. 연결 방법만 참고하세요.",
         usb="USB-C", ble=True, logic="3.3 V", adc="보드 문서 확인", qwiic="없음",
         pins=pins5(sda="D20 (SDA)", scl="D21 (SCL)", pwr="3.3V"), notes=[V33_NOTE]),
    dict(id="uno-q", name="UNO Q", match=["UNO Q"], firmware="none", sensorSet="none",
         firmwareNote="App Lab 방식 보드라 ChemDict 펌웨어를 아직 지원하지 않습니다. 연결 방법만 참고하세요.",
         usb="USB-C", ble=True, logic="3.3 V (보드 문서 확인)", adc="보드 문서 확인", qwiic="있음 (Modulino 호환)",
         pins=pins5(pwr="3.3V"), notes=[V33_NOTE]),
]

# ---------------------------------------------------------------- 연결 방식
# wires: 센서 단자(term) → 보드 핀 역할(pin) / color: red·black·yellow·blue·green·white·orange
CONNECTORS = {
    "analog": dict(name="아날로그 3선", wires=[
        dict(term="VCC (+)", pin="PWR", color="red"), dict(term="GND (−)", pin="GND", color="black"),
        dict(term="신호 (AO·OUT·S)", pin="A", color="green")],
        steps=["A0 대신 A1~A3에 꽂아도 됩니다. '꽂을 포트'에서 같은 포트를 누르면 앱이 자동으로 설정합니다."],
        cautions=["아날로그 입력은 보드 전압(5 V 또는 3.3 V)을 넘으면 안 됩니다."]),
    "analog-divider": dict(name="아날로그 + 10 kΩ 저항", wires=[
        dict(term="센서 한쪽 다리", pin="PWR", color="red"), dict(term="센서 다른 쪽 다리", pin="A", color="green"),
        dict(term="저항 다른 쪽", pin="GND", color="black")],
        resistor=dict(between=["A", "GND"], value="10 kΩ"),
        steps=["센서 다른 쪽 다리와 A0을 잇는 선에서 10 kΩ 저항을 GND로 연결합니다 (브레드보드 사용)."],
        cautions=[]),
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
        cautions=["저항이 없으면 센서가 인식되지 않습니다."]),
    "dht": dict(name="디지털 3선", wires=[
        dict(term="GND (−)", pin="GND", color="black"), dict(term="VCC (+)", pin="PWR", color="red"),
        dict(term="DATA (S·OUT)", pin="DHT", color="yellow")],
        steps=["핀이 4개인 센서(모듈 아님)는 DATA와 VCC 사이에 10 kΩ 저항을 연결합니다. 3번 핀은 비워 둡니다."],
        cautions=[]),
    "qwiic": dict(name="Qwiic 케이블", cable=True, wires=[
        dict(term="GND (검정)", pin="GND", color="black"), dict(term="3.3V (빨강)", pin="PWR3", color="red"),
        dict(term="SDA (파랑)", pin="SDA", color="blue"), dict(term="SCL (노랑)", pin="SCL", color="yellow")],
        steps=["Qwiic 단자가 있으면 케이블을 '딸깍' 소리가 날 때까지 꽂습니다. 모듈 쪽은 어느 단자든 됩니다.",
               "Qwiic 단자가 없는 보드는 Qwiic–점퍼 케이블로 위 표대로 핀에 연결합니다.",
               "모듈을 여러 개 쓰면 모듈끼리 Qwiic 케이블로 이어서 연결할 수 있습니다."],
        cautions=["Qwiic은 3.3 V입니다. 5 V 보드의 SDA·SCL 핀에 직접 연결할 때는 레벨 변환기를 권장합니다."]),
    "i2c": dict(name="I2C 4선 (SDA·SCL)", wires=[
        dict(term="VCC (VIN)", pin="PWR3", color="red"), dict(term="GND", pin="GND", color="black"),
        dict(term="SDA", pin="SDA", color="blue"), dict(term="SCL", pin="SCL", color="yellow")],
        steps=["모듈에 Qwiic·STEMMA QT 단자가 있으면 Qwiic 케이블로 연결해도 됩니다.",
               "같은 I2C 선에 여러 모듈을 함께 연결할 수 있습니다 (주소가 다르면)."],
        cautions=["VCC는 3.3V에 연결하는 것이 안전합니다. 모듈에 'VIN 3–5 V' 표시가 있으면 5V도 됩니다."]),
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
    "ultrasonic": dict(name="초음파 4선", wires=[
        dict(term="VCC", pin="PWR", color="red"), dict(term="TRIG", pin="TRIG", color="yellow"),
        dict(term="ECHO", pin="ECHO", color="green"), dict(term="GND", pin="GND", color="black")],
        steps=[], cautions=["3.3 V 보드에서는 ECHO 신호(5 V)를 저항 분압으로 낮춰 연결합니다."]),
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

def analog(id, name, category, t, items, cautions, connector="analog"):
    return part(id, name, category, connector, [t], items, cautions, analogType=t)

PARTS = [
    # 온도
    part("ds18b20", "방수 온도 센서 DS18B20", "온도", "onewire", ["T"],
         ["방수 DS18B20 1개", "4.7 kΩ 저항 1개 (어댑터 보드가 있으면 불필요)", "점퍼선 3개"],
         ["선 색은 제품마다 다를 수 있습니다. 설명서에서 VCC·GND·DATA를 확인합니다.",
          "금속 끝부분만 액체에 넣습니다. 케이블 연결부는 물에 넣지 않습니다.",
          "측정 범위 −55 ~ 125 °C. 끓는 물은 되지만 불꽃에 직접 대지 않습니다."]),
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
            "보관할 때는 보호 캡에 보관액(KCl)을 넣어 끼웁니다. 증류수에 오래 담가 두지 않습니다."]),
    analog("ec", "전도도(EC) 센서", "물·용액", "EC",
           ["전도도 전극 + 변환 모듈 1세트", "1413 µS/cm 표준 용액"],
           ["반드시 '보정'에서 증류수(0) → 표준 용액 순서로 2점 보정합니다.", "측정 사이에 증류수로 헹굽니다."]),
    analog("tds", "TDS 센서 (총용존고형물)", "물·용액", "TDS",
           ["TDS 탐침 + 변환 모듈 1세트"], ["ppm 근삿값입니다. 정확히 하려면 증류수와 표준 용액으로 2점 보정합니다."]),
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

ORDER = ["온도", "온습도", "기압·압력", "기체", "빛·색", "물·용액", "무게·거리·힘", "전기·소리"]

out = dict(version=2, common=COMMON, categories=ORDER, boards=BOARDS, connectors=CONNECTORS, parts=PARTS,
           planned=["MH-Z19B 이산화탄소 (UART)", "PMS7003 미세먼지", "Modulino Distance·Light·Movement",
                    "Nano ESP32·Nano 33·GIGA·UNO Q 펌웨어"])
path = pathlib.Path(__file__).resolve().parent.parent / "protocol" / "guide.json"
path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("boards", len(BOARDS), "parts", len(PARTS), "->", path)
