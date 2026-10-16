/*
  ChemDict Lab firmware v0.1.0 — Arduino UNO R4 WiFi

  - USB 시리얼(115200)과 BLE(Nordic UART 방식)로 같은 JSON 한 줄 메시지를 보냅니다.
  - 아날로그 A0~A3: 앱에서 센서 종류를 지정(PORT 명령), 설정은 EEPROM에 저장
  - DS18B20(D2) + Modulino Thermo(Qwiic, 0x44) 자동 인식
  - 2점 보정값은 EEPROM에 저장됩니다.
  - 센서가 없어도 DEMO ON 명령으로 가짜 데이터를 보낼 수 있습니다.

  필요 라이브러리 (Arduino IDE > 라이브러리 매니저):
    ArduinoBLE, OneWire, DallasTemperature

  통신 규칙: protocol/PROTOCOL.md
*/

#include <ArduinoBLE.h>
#include <Wire.h>
#include <EEPROM.h>
#include <OneWire.h>
#include <DallasTemperature.h>

#define FW_VERSION "0.2.0"
#define BOARD_NAME "UNO R4 WiFi"

// ---------- 핀·상수 ----------
const int ONEWIRE_PIN = 2;
const float VREF = 5.0;
const int ADC_BITS = 14;
const float ADC_MAX = 16383.0;
const uint8_t HS3003_ADDR = 0x44;
const unsigned long MIN_INTERVAL_MS = 100;
const size_t BLE_CHUNK = 20;

// ---------- 아날로그 포트 ----------
// 센서 종류(type)와 변환식(값 = slope × 전압 + offset)은 앱이 PORT 명령으로 정합니다.
// 종류별 이름·단위·기본 변환식은 protocol/sensors.json 이 기준입니다.
const uint8_t analogPins[4] = { A0, A1, A2, A3 };
const char* analogSrc[4] = { "A0", "A1", "A2", "A3" };
const uint8_t TYPE_LEN = 8;

// ---------- EEPROM 설정 ----------
const uint32_t SETTINGS_MAGIC = 0xC4E3D1C8;  // v0.2 (구조가 바뀌면 값을 바꿔 초기화)
struct PortSetting {
  char type[TYPE_LEN];  // "pH", "L", "EC", "V", "TL", "P", "RAW", "OFF"
  float slope;
  float offset;
  uint8_t calValid;
};
struct Settings {
  uint32_t magic;
  uint8_t station;
  PortSetting port[4];
  float tempOffset;      // DS18B20 1점 보정
  uint8_t tempCalValid;
};
Settings settings;

void setPort(int i, const char* type, float slope, float offset) {
  strncpy(settings.port[i].type, type, TYPE_LEN - 1);
  settings.port[i].type[TYPE_LEN - 1] = 0;
  settings.port[i].slope = slope;
  settings.port[i].offset = offset;
  settings.port[i].calValid = 0;
}

bool portOn(int i) {
  return strcmp(settings.port[i].type, "OFF") != 0;
}

// 같은 종류가 두 포트에 있으면 두 번째부터 "pH_A1"처럼 포트 이름을 붙임
String portId(int i) {
  String id = settings.port[i].type;
  for (int j = 0; j < i; j++) {
    if (portOn(j) && strcmp(settings.port[j].type, settings.port[i].type) == 0) {
      id += "_";
      id += analogSrc[i];
      break;
    }
  }
  return id;
}

// 2점 보정 중간값 (RAM)
float calV1[4];
float calRef1[4];
bool calHasP1[4] = { false, false, false, false };

// ---------- 센서 상태 ----------
OneWire oneWire(ONEWIRE_PIN);
DallasTemperature ds(&oneWire);
bool hasDS = false;
bool hasHS3003 = false;
float lastDS = NAN;

// ---------- 측정 상태 ----------
bool running = false;
bool demo = false;
unsigned long intervalMs = 1000;
unsigned long startMs = 0;
unsigned long lastTickMs = 0;

// ---------- BLE ----------
BLEService uartService("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
BLECharacteristic rxChar("6E400002-B5A3-F393-E0A9-E50E24DCCA9E", BLEWrite | BLEWriteWithoutResponse, BLE_CHUNK);
BLECharacteristic txChar("6E400003-B5A3-F393-E0A9-E50E24DCCA9E", BLENotify, BLE_CHUNK);
bool bleOk = false;
String bleName;

// ---------- 입력 버퍼 ----------
String serialBuf;
String bleBuf;

// =====================================================================
// 설정 저장/불러오기
// =====================================================================
void loadSettings() {
  EEPROM.get(0, settings);
  if (settings.magic != SETTINGS_MAGIC) {
    settings.magic = SETTINGS_MAGIC;
    settings.station = 1;
    setPort(0, "pH", -5.70f, 21.34f);
    setPort(1, "L", 20.0f, 0.0f);
    setPort(2, "EC", 1000.0f, 0.0f);
    setPort(3, "V", 1.0f, 0.0f);
    settings.tempOffset = 0;
    settings.tempCalValid = 0;
    EEPROM.put(0, settings);
  }
  if (settings.station < 1 || settings.station > 8) settings.station = 1;
}

void saveSettings() {
  EEPROM.put(0, settings);
}

// =====================================================================
// 출력: USB와 BLE에 같은 한 줄을 보냄
// =====================================================================
void sendLine(const String& line) {
  Serial.println(line);
  if (bleOk && BLE.connected() && txChar.subscribed()) {
    String full = line + "\n";
    size_t n = full.length();
    for (size_t i = 0; i < n; i += BLE_CHUNK) {
      size_t len = min(BLE_CHUNK, n - i);
      txChar.writeValue((const uint8_t*)full.c_str() + i, len);
      BLE.poll();
    }
  }
}

String jsonStr(const char* s) {
  String out = "\"";
  out += s;
  out += "\"";
  return out;
}

void sendAck(const char* cmd) {
  sendLine(String("{\"type\":\"ack\",\"cmd\":") + jsonStr(cmd) + "}");
}

void sendErr(const char* cmd, const char* msg) {
  sendLine(String("{\"type\":\"err\",\"cmd\":") + jsonStr(cmd) + ",\"msg\":" + jsonStr(msg) + "}");
}

// =====================================================================
// 센서 인식
// =====================================================================
void detectSensors() {
  ds.begin();
  hasDS = ds.getDeviceCount() > 0;
  if (hasDS) {
    ds.setResolution(11);            // 약 375 ms 변환
    ds.setWaitForConversion(false);  // 측정 루프를 막지 않음
    ds.requestTemperatures();
  }

  Wire1.begin();
  Wire1.beginTransmission(HS3003_ADDR);
  hasHS3003 = (Wire1.endTransmission() == 0);
}

String sensorJson(const String& id, const char* type, const char* src, bool cal) {
  // name·unit은 앱이 protocol/sensors.json 에서 type으로 찾습니다 (여기서는 type을 그대로 넣음)
  return String("{\"id\":\"") + id + "\",\"type\":" + jsonStr(type) + ",\"name\":" + jsonStr(type) +
         ",\"unit\":\"\",\"src\":" + jsonStr(src) + ",\"cal\":" + (cal ? "true" : "false") + "}";
}

void sendHello() {
  String s = String("{\"type\":\"hello\",\"fw\":\"") + FW_VERSION + "\",\"board\":\"" + BOARD_NAME +
             "\",\"station\":" + settings.station + ",\"demo\":" + (demo ? "true" : "false") +
             ",\"interval\":" + intervalMs + ",\"running\":" + (running ? "true" : "false") + ",\"sensors\":[";
  bool first = true;
  for (int i = 0; i < 4; i++) {
    if (!portOn(i)) continue;
    if (!first) s += ",";
    s += sensorJson(portId(i), settings.port[i].type, analogSrc[i], settings.port[i].calValid);
    first = false;
  }
  if (hasDS || demo) {
    if (!first) s += ",";
    s += sensorJson("T", "T", demo && !hasDS ? "demo" : "onewire", settings.tempCalValid);
    first = false;
  }
  if (hasHS3003) {
    if (!first) s += ",";
    s += sensorJson("TA", "TA", "i2c:0x44", false);
    s += ",";
    s += sensorJson("RH", "RH", "i2c:0x44", false);
  }
  s += "]}";
  sendLine(s);
}

// =====================================================================
// 측정
// =====================================================================
float readVoltage(uint8_t pin) {
  long sum = 0;
  const int N = 16;
  for (int i = 0; i < N; i++) sum += analogRead(pin);
  return (sum / (float)N) * VREF / ADC_MAX;
}

float analogValue(int i, float volt) {
  return settings.port[i].slope * volt + settings.port[i].offset;
}

// 데모 모드: 종류별 그럴듯한 값
float demoAnalog(const char* type, float t);

bool readHS3003(float& tempC, float& rh) {
  Wire1.beginTransmission(HS3003_ADDR);
  if (Wire1.endTransmission() != 0) return false;
  delay(40);  // 측정 대기
  if (Wire1.requestFrom(HS3003_ADDR, (uint8_t)4) != 4) return false;
  uint8_t b0 = Wire1.read(), b1 = Wire1.read(), b2 = Wire1.read(), b3 = Wire1.read();
  uint16_t rawH = ((uint16_t)(b0 & 0x3F) << 8) | b1;
  uint16_t rawT = (((uint16_t)b2 << 8) | b3) >> 2;
  rh = rawH / 16383.0f * 100.0f;
  tempC = rawT / 16383.0f * 165.0f - 40.0f;
  return true;
}

// 데모 데이터: 적정 곡선(pH), 냉각 곡선(T)
float demoNoise(float amp) {
  return ((random(0, 2001) - 1000) / 1000.0f) * amp;
}

float demoPH(float t) {
  return 2.8f + 8.4f / (1.0f + exp(-(t - 60.0f) / 4.0f)) + demoNoise(0.03f);
}

float demoTemp(float t) {
  float T;
  if (t < 140) T = 22.0f - 22.0f * (t / 140.0f);           // 22 → 0 ℃
  else if (t < 220) T = 0.0f;                               // 어는 동안 일정
  else T = -0.06f * (t - 220.0f);                           // 다시 하강
  if (T < -10) T = -10;
  return T + demoNoise(0.05f);
}

float demoAnalog(const char* type, float t) {
  if (!strcmp(type, "pH")) return demoPH(t);
  if (!strcmp(type, "L")) return 50.0f + 10.0f * sin(t / 10.0f) + demoNoise(0.5f);
  if (!strcmp(type, "EC")) return 1200.0f + 2.0f * t + demoNoise(5.0f);
  if (!strcmp(type, "V")) return 1.10f + demoNoise(0.005f);
  if (!strcmp(type, "TL")) return demoTemp(t);
  if (!strcmp(type, "P")) return 101.3f + 0.5f * t + demoNoise(0.3f);
  return 2.5f + demoNoise(0.01f);
}

void tick() {
  float t = (millis() - startMs) / 1000.0f;
  String s = String("{\"type\":\"d\",\"t\":") + String(t, 2) + ",\"v\":{";
  bool first = true;
  auto add = [&](const char* id, float v, int dec) {
    if (isnan(v)) return;
    if (!first) s += ",";
    s += "\"";
    s += id;
    s += "\":";
    s += String(v, dec);
    first = false;
  };

  for (int i = 0; i < 4; i++) {
    if (!portOn(i)) continue;
    String id = portId(i);
    float v = demo ? demoAnalog(settings.port[i].type, t) : analogValue(i, readVoltage(analogPins[i]));
    add(id.c_str(), v, 3);
  }
  if (hasDS) add("T", lastDS, 2);
  else if (demo) add("T", demoTemp(t), 2);

  if (hasHS3003) {
    float ta, rh;
    if (readHS3003(ta, rh)) {
      add("TA", ta, 2);
      add("RH", rh, 1);
    }
  }

  s += "}}";
  sendLine(s);
}

void pollDS() {
  if (!hasDS) return;
  if (ds.isConversionComplete()) {
    float c = ds.getTempCByIndex(0);
    if (c > -100 && c < 150) lastDS = c + (settings.tempCalValid ? settings.tempOffset : 0);
    ds.requestTemperatures();
  }
}

// =====================================================================
// 명령 처리
// =====================================================================
int analogIndex(const String& id) {
  for (int i = 0; i < 4; i++)
    if (portOn(i) && id.equals(portId(i))) return i;
  return -1;
}

int portIndexByName(const String& name) {
  for (int i = 0; i < 4; i++)
    if (name.equalsIgnoreCase(analogSrc[i])) return i;
  return -1;
}

void sendCal(const String& id, float slope, float offset, int points) {
  sendLine(String("{\"type\":\"cal\",\"id\":\"") + id + "\",\"slope\":" + String(slope, 4) +
           ",\"offset\":" + String(offset, 4) + ",\"points\":" + points + "}");
}

// CAL <id> 1 <ref> → CAL <id> 2 <ref> : 2점 보정
// CAL <id> OFS <ref>                  : 1점(영점) 보정 — 지금 값이 ref가 되도록 절편만 이동
// CAL <id> CLEAR                      : 보정 지우기 (PORT로 받은 기본 변환식은 앱이 다시 보냄)
void handleCal(String args[], int argc) {
  if (argc < 3) { sendErr("CAL", "usage: CAL <id> <1|2|OFS|CLEAR> [value]"); return; }
  String id = args[1];
  String step = args[2];
  step.toUpperCase();

  if (id.equals("T")) {
    if (step == "CLEAR") {
      settings.tempOffset = 0; settings.tempCalValid = 0; saveSettings(); sendAck("CAL");
      return;
    }
    if (argc < 4 || !hasDS || isnan(lastDS)) { sendErr("CAL", "no temperature reading"); return; }
    float raw = lastDS - (settings.tempCalValid ? settings.tempOffset : 0);
    settings.tempOffset = args[3].toFloat() - raw;
    settings.tempCalValid = 1;
    saveSettings();
    sendCal("T", 1, settings.tempOffset, 1);
    return;
  }

  int i = analogIndex(id);
  if (i < 0) { sendErr("CAL", "unknown sensor"); return; }
  PortSetting& p = settings.port[i];

  if (step == "CLEAR") {
    p.calValid = 0;
    calHasP1[i] = false;
    saveSettings();
    sendAck("CAL");
    return;
  }
  if (argc < 4) { sendErr("CAL", "missing reference value"); return; }

  float ref = args[3].toFloat();
  float volt = readVoltage(analogPins[i]);

  if (step == "OFS") {
    float now = analogValue(i, volt);
    p.offset += ref - now;
    p.calValid = 1;
    saveSettings();
    sendCal(id, p.slope, p.offset, 1);
  } else if (step == "1") {
    calV1[i] = volt; calRef1[i] = ref; calHasP1[i] = true;
    sendAck("CAL");
  } else if (step == "2") {
    if (!calHasP1[i]) { sendErr("CAL", "record point 1 first"); return; }
    float dv = volt - calV1[i];
    if (fabs(dv) < 0.005f) { sendErr("CAL", "points too close"); return; }
    p.slope = (ref - calRef1[i]) / dv;
    p.offset = calRef1[i] - p.slope * calV1[i];
    p.calValid = 1;
    calHasP1[i] = false;
    saveSettings();
    sendCal(id, p.slope, p.offset, 2);
  } else {
    sendErr("CAL", "step must be 1, 2, OFS or CLEAR");
  }
}

// PORT <A0~A3> <type> [slope offset]  /  PORT <A0~A3> OFF
void handlePort(String args[], int argc) {
  if (argc < 3) { sendErr("PORT", "usage: PORT <A0-A3> <type> [slope offset]"); return; }
  int i = portIndexByName(args[1]);
  if (i < 0) { sendErr("PORT", "port must be A0-A3"); return; }
  String type = args[2];
  if (type.length() >= TYPE_LEN) { sendErr("PORT", "type too long"); return; }
  float slope = argc > 3 ? args[3].toFloat() : 1.0f;
  float offset = argc > 4 ? args[4].toFloat() : 0.0f;
  setPort(i, type.c_str(), slope, offset);
  calHasP1[i] = false;
  saveSettings();
  sendAck("PORT");
  sendHello();
}

void handleCommand(String line) {
  line.trim();
  if (line.length() == 0) return;

  String args[8];
  int argc = 0;
  int pos = 0;
  while (argc < 8 && pos < (int)line.length()) {
    int sp = line.indexOf(' ', pos);
    if (sp < 0) sp = line.length();
    if (sp > pos) args[argc++] = line.substring(pos, sp);
    pos = sp + 1;
  }
  String cmd = args[0];
  cmd.toUpperCase();

  if (cmd == "HELLO") {
    sendHello();
  } else if (cmd == "START") {
    unsigned long ms = argc > 1 ? (unsigned long)args[1].toInt() : 1000;
    if (ms < MIN_INTERVAL_MS) ms = MIN_INTERVAL_MS;
    intervalMs = ms;
    running = true;
    startMs = millis();
    lastTickMs = startMs - intervalMs;  // 즉시 첫 측정
    sendAck("START");
  } else if (cmd == "STOP") {
    running = false;
    sendAck("STOP");
  } else if (cmd == "DEMO") {
    String v = argc > 1 ? args[1] : "ON";
    v.toUpperCase();
    demo = (v == "ON");
    sendAck("DEMO");
    sendHello();
  } else if (cmd == "CAL") {
    handleCal(args, argc);
  } else if (cmd == "PORT") {
    handlePort(args, argc);
  } else if (cmd == "STATION") {
    int n = argc > 1 ? args[1].toInt() : 0;
    if (n < 1 || n > 8) { sendErr("STATION", "1-8"); return; }
    settings.station = n;
    saveSettings();
    sendAck("STATION");
  } else {
    sendErr(cmd.c_str(), "unknown command");
  }
}

void readSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialBuf.length()) handleCommand(serialBuf);
      serialBuf = "";
    } else if (serialBuf.length() < 64) {
      serialBuf += c;
    }
  }
}

void onRxWritten(BLEDevice, BLECharacteristic ch) {
  int n = ch.valueLength();
  const uint8_t* data = ch.value();
  for (int i = 0; i < n; i++) {
    char c = (char)data[i];
    if (c == '\n' || c == '\r') {
      if (bleBuf.length()) handleCommand(bleBuf);
      bleBuf = "";
    } else if (bleBuf.length() < 64) {
      bleBuf += c;
    }
  }
}

void onBleConnect(BLEDevice) {
  bleBuf = "";
}

void onBleDisconnect(BLEDevice) {
  bleBuf = "";
  BLE.advertise();
}

// =====================================================================
void setup() {
  Serial.begin(115200);
  unsigned long t0 = millis();
  while (!Serial && millis() - t0 < 1500) {}

  analogReadResolution(ADC_BITS);
  randomSeed(analogRead(A5));
  loadSettings();
  detectSensors();

  bleName = String("ChemDict-0") + settings.station;
  if (BLE.begin()) {
    BLE.setLocalName(bleName.c_str());
    BLE.setDeviceName(bleName.c_str());
    BLE.setAdvertisedService(uartService);
    uartService.addCharacteristic(rxChar);
    uartService.addCharacteristic(txChar);
    BLE.addService(uartService);
    rxChar.setEventHandler(BLEWritten, onRxWritten);
    BLE.setEventHandler(BLEConnected, onBleConnect);
    BLE.setEventHandler(BLEDisconnected, onBleDisconnect);
    BLE.advertise();
    bleOk = true;
  }

  sendHello();
}

void loop() {
  if (bleOk) BLE.poll();
  readSerial();
  pollDS();

  if (running && millis() - lastTickMs >= intervalMs) {
    lastTickMs += intervalMs;
    if (millis() - lastTickMs > intervalMs) lastTickMs = millis();  // 밀린 경우 따라잡기
    tick();
  }
}
