/*
  ChemDict Lab firmware v0.1.0 — Arduino UNO R4 WiFi

  - USB 시리얼(115200)과 BLE(Nordic UART 방식)로 같은 JSON 한 줄 메시지를 보냅니다.
  - 아날로그 A0~A3 고정 배정 + DS18B20(D2) + Modulino Thermo(Qwiic, 0x44) 자동 인식
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

#define FW_VERSION "0.1.0"
#define BOARD_NAME "UNO R4 WiFi"

// ---------- 핀·상수 ----------
const int ONEWIRE_PIN = 2;
const float VREF = 5.0;
const int ADC_BITS = 14;
const float ADC_MAX = 16383.0;
const uint8_t HS3003_ADDR = 0x44;
const unsigned long MIN_INTERVAL_MS = 100;
const size_t BLE_CHUNK = 20;

// ---------- 아날로그 채널 ----------
struct AnalogChannel {
  const char* id;
  const char* name;
  const char* unit;
  uint8_t pin;
  const char* src;
  float defSlope;   // 값 = slope * V + offset
  float defOffset;
  uint8_t decimals;
};

AnalogChannel analogCh[4] = {
  { "pH", "pH",     "",  A0, "A0", -5.70f, 21.34f, 2 },
  { "L",  "빛",     "%", A1, "A1", 20.0f,  0.0f,   1 },
  { "EC", "전도도", "V", A2, "A2", 1.0f,   0.0f,   3 },
  { "V",  "전압",   "V", A3, "A3", 1.0f,   0.0f,   3 },
};

// ---------- EEPROM 설정 ----------
const uint32_t SETTINGS_MAGIC = 0xC4E3D1C7;
struct Settings {
  uint32_t magic;
  uint8_t station;
  uint8_t calValid[4];
  float slope[4];
  float offset[4];
  float tempOffset;      // DS18B20 1점 보정
  uint8_t tempCalValid;
};
Settings settings;

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
    for (int i = 0; i < 4; i++) {
      settings.calValid[i] = 0;
      settings.slope[i] = analogCh[i].defSlope;
      settings.offset[i] = analogCh[i].defOffset;
    }
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

String sensorJson(const char* id, const char* name, const char* unit, const char* src, bool cal) {
  return String("{\"id\":") + jsonStr(id) + ",\"name\":" + jsonStr(name) + ",\"unit\":" + jsonStr(unit) +
         ",\"src\":" + jsonStr(src) + ",\"cal\":" + (cal ? "true" : "false") + "}";
}

void sendHello() {
  String s = String("{\"type\":\"hello\",\"fw\":\"") + FW_VERSION + "\",\"board\":\"" + BOARD_NAME +
             "\",\"station\":" + settings.station + ",\"demo\":" + (demo ? "true" : "false") +
             ",\"interval\":" + intervalMs + ",\"running\":" + (running ? "true" : "false") + ",\"sensors\":[";
  bool first = true;
  for (int i = 0; i < 4; i++) {
    if (!first) s += ",";
    s += sensorJson(analogCh[i].id, analogCh[i].name, analogCh[i].unit, analogCh[i].src, settings.calValid[i]);
    first = false;
  }
  if (hasDS || demo) {
    s += ",";
    s += sensorJson("T", "온도", "°C", demo && !hasDS ? "demo" : "onewire", settings.tempCalValid);
  }
  if (hasHS3003) {
    s += ",";
    s += sensorJson("TA", "기온", "°C", "i2c:0x44", false);
    s += ",";
    s += sensorJson("RH", "습도", "%", "i2c:0x44", false);
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
  return settings.slope[i] * volt + settings.offset[i];
}

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

  if (demo) {
    add("pH", demoPH(t), 2);
    add("L", 50.0f + 10.0f * sin(t / 10.0f) + demoNoise(0.5f), 1);
    add("EC", 1.2f + 0.002f * t + demoNoise(0.01f), 3);
    add("V", 1.10f + demoNoise(0.005f), 3);
    add("T", hasDS ? lastDS : demoTemp(t), 2);
  } else {
    for (int i = 0; i < 4; i++) {
      float volt = readVoltage(analogCh[i].pin);
      add(analogCh[i].id, analogValue(i, volt), analogCh[i].decimals);
    }
    if (hasDS) add("T", lastDS, 2);
  }

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
    if (id.equals(analogCh[i].id)) return i;
  return -1;
}

void sendCal(int i) {
  sendLine(String("{\"type\":\"cal\",\"id\":") + jsonStr(analogCh[i].id) + ",\"slope\":" + String(settings.slope[i], 4) +
           ",\"offset\":" + String(settings.offset[i], 4) + ",\"points\":2}");
}

void handleCal(String args[], int argc) {
  if (argc < 3) { sendErr("CAL", "usage: CAL <id> <1|2|CLEAR> [value]"); return; }
  String id = args[1];
  String step = args[2];

  if (id.equals("T")) {
    if (step.equalsIgnoreCase("CLEAR")) {
      settings.tempOffset = 0; settings.tempCalValid = 0; saveSettings(); sendAck("CAL");
      return;
    }
    if (argc < 4 || !hasDS || isnan(lastDS)) { sendErr("CAL", "no temperature reading"); return; }
    float raw = lastDS - (settings.tempCalValid ? settings.tempOffset : 0);
    settings.tempOffset = args[3].toFloat() - raw;
    settings.tempCalValid = 1;
    saveSettings();
    sendLine(String("{\"type\":\"cal\",\"id\":\"T\",\"slope\":1,\"offset\":") + String(settings.tempOffset, 3) + ",\"points\":1}");
    return;
  }

  int i = analogIndex(id);
  if (i < 0) { sendErr("CAL", "unknown sensor"); return; }

  if (step.equalsIgnoreCase("CLEAR")) {
    settings.calValid[i] = 0;
    settings.slope[i] = analogCh[i].defSlope;
    settings.offset[i] = analogCh[i].defOffset;
    calHasP1[i] = false;
    saveSettings();
    sendAck("CAL");
    return;
  }
  if (argc < 4) { sendErr("CAL", "missing reference value"); return; }

  float ref = args[3].toFloat();
  float volt = readVoltage(analogCh[i].pin);

  if (step.equals("1")) {
    calV1[i] = volt; calRef1[i] = ref; calHasP1[i] = true;
    sendAck("CAL");
  } else if (step.equals("2")) {
    if (!calHasP1[i]) { sendErr("CAL", "record point 1 first"); return; }
    float dv = volt - calV1[i];
    if (fabs(dv) < 0.005f) { sendErr("CAL", "points too close"); return; }
    settings.slope[i] = (ref - calRef1[i]) / dv;
    settings.offset[i] = calRef1[i] - settings.slope[i] * calV1[i];
    settings.calValid[i] = 1;
    calHasP1[i] = false;
    saveSettings();
    sendCal(i);
  } else {
    sendErr("CAL", "step must be 1, 2 or CLEAR");
  }
}

void handleCommand(String line) {
  line.trim();
  if (line.length() == 0) return;

  String args[6];
  int argc = 0;
  int pos = 0;
  while (argc < 6 && pos < (int)line.length()) {
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
