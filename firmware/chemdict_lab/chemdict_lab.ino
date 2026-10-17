/*
  ChemDict Lab firmware v0.3.1
  기준 보드: Arduino UNO R4 WiFi (USB + 블루투스, 실제 보드 확인)
  그 밖의 보드: UNO R4 Minima, Nano R4, UNO R3, Nano, Leonardo, Mega 2560 (USB만)

  - USB 시리얼(115200)과 BLE(Nordic UART 방식)로 같은 JSON 한 줄 메시지를 보냅니다.
  - 아날로그 A0~A3: 앱에서 센서 종류를 지정(PORT 명령), 설정은 EEPROM에 저장
  - 디지털 센서는 꽂아 두면 자동 인식 (HELLO = 센서 다시 찾기)
      D2  DS18B20 방수 온도 (여러 개 나란히: T, T_OW2, T_OW3…)
      D4  DHT11 / DHT22 온습도
      D5·D6  HX711 무게(로드셀)        DT=D5, SCK=D6
      D7·D8  HC-SR04 초음파 거리        TRIG=D7, ECHO=D8
      D10·D12·D13  MAX6675 K형 열전대   CS=D10, SO=D12, SCK=D13
      I2C(Qwiic 단자와 SDA·SCL 핀 모두 검색)
        0x44·0x45  Modulino Thermo, SHT30/31 온습도
        0x76·0x77  BMP280 기압·온도, BME280 기압·온도·습도
        0x5C·0x5D  Modulino Pressure(LPS22) 기압·온도
        0x62       SCD40/41 이산화탄소·온도·습도
        0x29       TCS34725 색(R·G·B)
  - 센서가 없어도 DEMO ON 명령으로 가짜 데이터를 보낼 수 있습니다.

  필요 라이브러리: OneWire, DallasTemperature (+ 블루투스 보드는 ArduinoBLE)
  통신 규칙: protocol/PROTOCOL.md
*/

// ---------- 보드별 차이 ----------
// Nano R4는 ARDUINO_UNOR4_MINIMA도 함께 정의하므로 먼저 검사
#if defined(ARDUINO_UNOR4_WIFI)
  #define HAS_BLE 1
  #define HAS_QWIIC 1          // Qwiic 단자 = Wire1 (3.3 V)
  #define BOARD_NAME "UNO R4 WiFi"
  #define ADC_BITS 14
#elif defined(ARDUINO_NANO_R4)
  #define HAS_BLE 0
  #define HAS_QWIIC 1
  #define BOARD_NAME "Nano R4"
  #define ADC_BITS 14
#elif defined(ARDUINO_UNOR4_MINIMA)
  #define HAS_BLE 0
  #define HAS_QWIIC 0
  #define BOARD_NAME "UNO R4 Minima"
  #define ADC_BITS 14
#elif defined(ARDUINO_AVR_UNO)
  #define HAS_BLE 0
  #define HAS_QWIIC 0
  #define BOARD_NAME "UNO R3"
  #define ADC_BITS 10
#elif defined(ARDUINO_AVR_NANO)
  #define HAS_BLE 0
  #define HAS_QWIIC 0
  #define BOARD_NAME "Nano"
  #define ADC_BITS 10
#elif defined(ARDUINO_AVR_MEGA2560)
  #define HAS_BLE 0
  #define HAS_QWIIC 0
  #define BOARD_NAME "Mega 2560"
  #define ADC_BITS 10
#elif defined(ARDUINO_AVR_LEONARDO)
  #define HAS_BLE 0
  #define HAS_QWIIC 0
  #define BOARD_NAME "Leonardo"
  #define ADC_BITS 10
#else
  #error "지원 보드: UNO R4 WiFi, UNO R4 Minima, Nano R4, UNO R3, Nano, Leonardo, Mega 2560"
#endif

// 메모리가 작은 보드(UNO R3·Nano·Leonardo, 32 KB)는 자주 쓰는 센서만 넣은 가벼운 버전
// 가벼운 버전: 아날로그 A0~A3, DS18B20, DHT, 온습도(SHT3x·HS3003), BMP/BME280, HX711 (Leonardo는 BME·HX711 제외)
// 전체 버전에만: LPS22, SCD4x, TCS34725, MAX6675, HC-SR04
#if defined(ARDUINO_ARCH_AVR) && !defined(ARDUINO_AVR_MEGA2560)
  #define FULL_SENSORS 0
#else
  #define FULL_SENSORS 1
#endif
// Leonardo(28 KB)는 BMP/BME280·HX711도 뺌
#if defined(ARDUINO_AVR_LEONARDO)
  #define MID_SENSORS 0
#else
  #define MID_SENSORS 1
#endif

#if HAS_BLE
#include <ArduinoBLE.h>
#endif
#include <Wire.h>
#include <EEPROM.h>
#include <OneWire.h>
#include <DallasTemperature.h>

#define FW_VERSION "0.3.1"

// ---------- 핀 ----------
#if defined(ARDUINO_AVR_LEONARDO)
const uint8_t ONEWIRE_PIN = 9;   // Leonardo는 D2·D3이 I2C라서 D9 사용
#else
const uint8_t ONEWIRE_PIN = 2;
#endif
const uint8_t DHT_PIN = 4;
const uint8_t HX_DT = 5, HX_SCK = 6;
const uint8_t US_TRIG = 7, US_ECHO = 8;
const uint8_t TC_CS = 10, TC_SO = 12, TC_SCK = 13;

const float VREF = 5.0;
const float ADC_MAX = (1L << ADC_BITS) - 1;
const unsigned long MIN_INTERVAL_MS = 100;
const uint8_t BLE_CHUNK = 20;

// ---------- 아날로그 포트 ----------
// 종류(type)와 변환식(값 = slope × 전압 + offset)은 앱이 PORT 명령으로 정합니다 (protocol/sensors.json).
const uint8_t analogPins[4] = { A0, A1, A2, A3 };
const char* const analogSrc[4] = { "A0", "A1", "A2", "A3" };
const uint8_t TYPE_LEN = 8;

// ---------- EEPROM 설정 ----------
const uint32_t SETTINGS_MAGIC = 0xC4E3D1C9;  // v0.3 (구조가 바뀌면 값을 바꿔 초기화)
struct PortSetting {
  char type[TYPE_LEN];
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
  long massTare;         // HX711 영점(원시값)
  float massScale;       // g / 원시값
  uint8_t massCalValid;
};
Settings settings;

void setPort(int i, const char* type, float slope, float offset) {
  strncpy(settings.port[i].type, type, TYPE_LEN - 1);
  settings.port[i].type[TYPE_LEN - 1] = 0;
  settings.port[i].slope = slope;
  settings.port[i].offset = offset;
  settings.port[i].calValid = 0;
}

bool portOn(int i) { return strcmp(settings.port[i].type, "OFF") != 0; }

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

float calV1[4], calRef1[4];
bool calHasP1[4] = { false, false, false, false };

// ---------- 디지털 센서 목록 ----------
// 인식된 센서마다 한 칸. 값은 각 센서가 자기 주기로 읽어 v에 넣고, 측정 때는 v만 보냄.
#if !FULL_SENSORS
const uint8_t MAX_DS = 8;
#elif defined(ARDUINO_ARCH_AVR)
const uint8_t MAX_DS = 12;
#else
const uint8_t MAX_DS = 20;
#endif
struct DSens {
  char type[5];
  char id[10];
  const char* src;
  float v;
  uint8_t dec;
  uint8_t cal;
};
DSens dsx[MAX_DS];
uint8_t nds = 0;

// 같은 종류가 이미 있으면 "TA_D4"처럼 꼬리표를 붙여 id를 겹치지 않게 함
int8_t regDS(const char* type, const char* tag, const char* src, uint8_t dec) {
  if (nds >= MAX_DS) return -1;
  DSens& d = dsx[nds];
  strncpy(d.type, type, 4); d.type[4] = 0;
  bool dup = false;
  for (uint8_t i = 0; i < nds; i++) if (!strcmp(dsx[i].type, type)) dup = true;
  for (int i = 0; i < 4 && !dup; i++) if (portOn(i) && !strcmp(settings.port[i].type, type)) dup = true;
  if (dup) snprintf(d.id, sizeof(d.id), "%s_%s", type, tag);
  else { strncpy(d.id, type, sizeof(d.id) - 1); d.id[sizeof(d.id) - 1] = 0; }
  d.src = src; d.v = NAN; d.dec = dec; d.cal = 0;
  return nds++;
}

int8_t findDS(const String& id) {
  for (uint8_t i = 0; i < nds; i++) if (id.equals(dsx[i].id)) return i;
  return -1;
}

void setDS(int8_t i, float v) { if (i >= 0) dsx[i].v = v; }

// ---------- 측정 상태 ----------
bool running = false;
bool demo = false;
unsigned long intervalMs = 1000;
unsigned long startMs = 0;
unsigned long lastTickMs = 0;

// ---------- BLE ----------
#if HAS_BLE
BLEService uartService("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
BLECharacteristic rxChar("6E400002-B5A3-F393-E0A9-E50E24DCCA9E", BLEWrite | BLEWriteWithoutResponse, BLE_CHUNK);
BLECharacteristic txChar("6E400003-B5A3-F393-E0A9-E50E24DCCA9E", BLENotify, BLE_CHUNK);
bool bleOk = false;
String bleName;
String bleBuf;
#endif
String serialBuf;

// =====================================================================
// 설정
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
    settings.massTare = 0;
    settings.massScale = 0.001f;
    settings.massCalValid = 0;
    EEPROM.put(0, settings);
  }
  if (settings.station < 1 || settings.station > 8) settings.station = 1;
}

void saveSettings() { EEPROM.put(0, settings); }

// =====================================================================
// 출력: 한 줄을 조각으로 USB와 BLE에 동시에 보냄 (긴 줄도 메모리를 적게 씀)
// =====================================================================
struct LineOut {
  uint8_t buf[BLE_CHUNK];
  uint8_t n = 0;
  bool ble = false;
  void begin() {
    n = 0;
#if HAS_BLE
    ble = bleOk && BLE.connected() && txChar.subscribed();
#endif
  }
  void flush() {
#if HAS_BLE
    if (ble && n) { txChar.writeValue(buf, n); BLE.poll(); }
#endif
    n = 0;
  }
  void push(char c) {
    if (!ble) return;
    buf[n++] = (uint8_t)c;
    if (n == BLE_CHUNK) flush();
  }
  void print(const char* s) { Serial.print(s); while (*s) push(*s++); }
  void print(const __FlashStringHelper* f) {  // F("...") 문자열은 플래시에서 바로 읽음
    PGM_P p = reinterpret_cast<PGM_P>(f);
    char c;
    while ((c = pgm_read_byte(p++))) { Serial.print(c); push(c); }
  }
  void print(const String& s) { print(s.c_str()); }
  void num(float v, uint8_t dec) { print(String(v, (unsigned char)dec)); }
  void num(long v) { print(String(v)); }
  void str(const char* s) { Serial.print('"'); push('"'); print(s); Serial.print('"'); push('"'); }
  void end() { Serial.print('\n'); push('\n'); flush(); }
};
LineOut out;

void sendLine(const String& line) { out.begin(); out.print(line); out.end(); }

void sendAck(const char* cmd) {
  out.begin(); out.print(F("{\"type\":\"ack\",\"cmd\":")); out.str(cmd); out.print(F("}")); out.end();
}

void sendErr(const char* cmd, const __FlashStringHelper* msg) {
  out.begin(); out.print(F("{\"type\":\"err\",\"cmd\":")); out.str(cmd);
  out.print(F(",\"msg\":\"")); out.print(msg); out.print(F("\"}")); out.end();
}

// =====================================================================
// I2C 도우미
// =====================================================================
bool i2cHas(TwoWire* w, uint8_t a) {
  w->beginTransmission(a);
  return w->endTransmission() == 0;
}

bool i2cWrite8(TwoWire* w, uint8_t a, uint8_t reg, uint8_t val) {
  w->beginTransmission(a); w->write(reg); w->write(val);
  return w->endTransmission() == 0;
}

bool i2cRead(TwoWire* w, uint8_t a, uint8_t reg, uint8_t* buf, uint8_t n) {
  w->beginTransmission(a); w->write(reg);
  if (w->endTransmission() != 0) return false;
  if (w->requestFrom(a, n) != n) return false;
  for (uint8_t i = 0; i < n; i++) buf[i] = w->read();
  return true;
}

uint8_t crc8(const uint8_t* d, int n) {  // SHT3x·SCD4x 방식 (다항식 0x31, 초기값 0xFF)
  uint8_t c = 0xFF;
  for (int i = 0; i < n; i++) {
    c ^= d[i];
    for (int b = 0; b < 8; b++) c = (c & 0x80) ? (uint8_t)((c << 1) ^ 0x31) : (uint8_t)(c << 1);
  }
  return c;
}

bool cmd16(TwoWire* w, uint8_t a, uint16_t cmd) {
  w->beginTransmission(a); w->write(cmd >> 8); w->write(cmd & 0xFF);
  return w->endTransmission() == 0;
}

// 2바이트 + CRC 묶음 k개 읽기
bool readWords(TwoWire* w, uint8_t a, uint16_t* words, uint8_t k) {
  uint8_t n = k * 3;
  if (w->requestFrom(a, n) != n) return false;
  for (uint8_t i = 0; i < k; i++) {
    uint8_t d[3] = { (uint8_t)w->read(), (uint8_t)w->read(), (uint8_t)w->read() };
    if (crc8(d, 2) != d[2]) return false;
    words[i] = ((uint16_t)d[0] << 8) | d[1];
  }
  return true;
}

// 버스: Qwiic 단자(있으면)와 SDA·SCL 핀
struct Bus { TwoWire* w; const char* tag; const char* name; };
#if HAS_QWIIC
const Bus buses[2] = { { &Wire1, "QW", "qwiic" }, { &Wire, "I2C", "i2c" } };
const uint8_t NBUS = 2;
#else
const Bus buses[1] = { { &Wire, "I2C", "i2c" } };
const uint8_t NBUS = 1;
#endif

// =====================================================================
// 센서 드라이버
// 각 드라이버: detect(등록) → poll(자기 주기로 값 갱신)
// =====================================================================

// ---------- DS18B20 (D2) ----------
OneWire oneWire(ONEWIRE_PIN);
DallasTemperature ds(&oneWire);
// 같은 D2 선에 여러 개를 나란히 꽂을 수 있음 (열평형·비열 비교 등). 첫 번째 id는 "T", 다음은 "T_OW2", "T_OW3"…
#if FULL_SENSORS
const uint8_t MAX_PROBES = 4;
#else
const uint8_t MAX_PROBES = 2;
#endif
int8_t dsIdx[MAX_PROBES];
uint8_t nProbes = 0;

void detectDS18() {
  nProbes = 0;
  ds.begin();
  uint8_t n = ds.getDeviceCount();
  if (n > MAX_PROBES) n = MAX_PROBES;
  if (!n) return;
  ds.setResolution(11);
  ds.setWaitForConversion(false);
  ds.requestTemperatures();
  for (uint8_t i = 0; i < n; i++) {
    char tag[5];
    if (i == 0) strcpy(tag, "OW"); else snprintf(tag, sizeof(tag), "OW%u", i + 1);
    int8_t k = regDS("T", tag, "onewire", 2);
    if (k < 0) break;
    if (i > 0) snprintf(dsx[k].id, sizeof(dsx[k].id), "T_%s", tag);
    if (i == 0) dsx[k].cal = settings.tempCalValid;   // 1점 보정은 첫 번째 센서에만
    dsIdx[nProbes++] = k;
  }
}

void pollDS18() {
  if (!nProbes || !ds.isConversionComplete()) return;
  for (uint8_t i = 0; i < nProbes; i++) {
    float c = ds.getTempCByIndex(i);
    if (c > -100 && c < 150) setDS(dsIdx[i], c + (i == 0 && settings.tempCalValid ? settings.tempOffset : 0));
  }
  ds.requestTemperatures();
}

// ---------- 온습도: SHT3x(Modulino Thermo 신형, SHT30/31) · HS3003(Modulino Thermo 구형) ----------
struct Thermo { TwoWire* w; uint8_t addr; bool sht; int8_t iT, iH; unsigned long last; };
#if FULL_SENSORS
const uint8_t MAX_THERMO = 4, MAX_BME = 2;
#else
const uint8_t MAX_THERMO = 2, MAX_BME = 1;
#endif
Thermo thermo[MAX_THERMO];
uint8_t nThermo = 0;

bool readSHT3x(TwoWire* w, uint8_t a, float& t, float& h) {
  if (!cmd16(w, a, 0x2400)) return false;
  delay(16);
  uint16_t v[2];
  if (!readWords(w, a, v, 2)) return false;
  t = -45.0f + 175.0f * v[0] / 65535.0f;
  h = 100.0f * v[1] / 65535.0f;
  return true;
}

bool readHS3003(TwoWire* w, uint8_t a, float& t, float& h) {
  w->beginTransmission(a);
  if (w->endTransmission() != 0) return false;
  delay(40);
  if (w->requestFrom(a, (uint8_t)4) != 4) return false;
  uint8_t b0 = w->read(), b1 = w->read(), b2 = w->read(), b3 = w->read();
  h = (((uint16_t)(b0 & 0x3F) << 8) | b1) / 16383.0f * 100.0f;
  t = ((((uint16_t)b2 << 8) | b3) >> 2) / 16383.0f * 165.0f - 40.0f;
  return true;
}

void detectThermo() {
  nThermo = 0;
  for (uint8_t b = 0; b < NBUS; b++) {
    for (uint8_t a = 0x44; a <= 0x45; a++) {
      if (nThermo >= MAX_THERMO || !i2cHas(buses[b].w, a)) continue;
      float t, h;
      bool sht = readSHT3x(buses[b].w, a, t, h);
      if (!sht && !(a == 0x44 && readHS3003(buses[b].w, a, t, h))) continue;
      Thermo& th = thermo[nThermo++];
      th.w = buses[b].w; th.addr = a; th.sht = sht; th.last = millis();
      const char* src = sht ? (b == 0 && HAS_QWIIC ? "qwiic:SHT3x" : "i2c:SHT3x") : (b == 0 && HAS_QWIIC ? "qwiic:HS3003" : "i2c:HS3003");
      th.iT = regDS("TA", buses[b].tag, src, 2);
      th.iH = regDS("RH", buses[b].tag, src, 1);
      setDS(th.iT, t); setDS(th.iH, h);
    }
  }
}

void pollThermo() {
  for (uint8_t i = 0; i < nThermo; i++) {
    Thermo& th = thermo[i];
    if (millis() - th.last < 1000) continue;
    th.last = millis();
    float t, h;
    bool ok = th.sht ? readSHT3x(th.w, th.addr, t, h) : readHS3003(th.w, th.addr, t, h);
    if (ok) { setDS(th.iT, t); setDS(th.iH, h); }
  }
}

#if MID_SENSORS
// ---------- BMP280 / BME280 (0x76·0x77) ----------
struct Bme {
  TwoWire* w; uint8_t addr; bool hum;
  uint16_t T1, P1; int16_t T2, T3, P2, P3, P4, P5, P6, P7, P8, P9;
  uint8_t H1, H3; int16_t H2, H4, H5; int8_t H6;
  int8_t iT, iP, iH; unsigned long last;
};
Bme bme[MAX_BME];
uint8_t nBme = 0;

bool detectOneBme(TwoWire* w, uint8_t a, const char* tag, bool qwiic) {
  uint8_t id;
  if (!i2cRead(w, a, 0xD0, &id, 1) || (id != 0x58 && id != 0x60)) return false;
  Bme& s = bme[nBme];
  s.w = w; s.addr = a; s.hum = (id == 0x60);
  uint8_t c[26];
  if (!i2cRead(w, a, 0x88, c, 24)) return false;
  s.T1 = c[0] | (c[1] << 8); s.T2 = c[2] | (c[3] << 8); s.T3 = c[4] | (c[5] << 8);
  s.P1 = c[6] | (c[7] << 8); s.P2 = c[8] | (c[9] << 8); s.P3 = c[10] | (c[11] << 8);
  s.P4 = c[12] | (c[13] << 8); s.P5 = c[14] | (c[15] << 8); s.P6 = c[16] | (c[17] << 8);
  s.P7 = c[18] | (c[19] << 8); s.P8 = c[20] | (c[21] << 8); s.P9 = c[22] | (c[23] << 8);
  if (s.hum) {
    uint8_t h1, e[7];
    if (!i2cRead(w, a, 0xA1, &h1, 1) || !i2cRead(w, a, 0xE1, e, 7)) return false;
    s.H1 = h1; s.H2 = e[0] | (e[1] << 8); s.H3 = e[2];
    s.H4 = ((int16_t)(int8_t)e[3] << 4) | (e[4] & 0x0F);
    s.H5 = ((int16_t)(int8_t)e[5] << 4) | (e[4] >> 4);
    s.H6 = (int8_t)e[6];
    i2cWrite8(w, a, 0xF2, 0x01);           // 습도 x1
  }
  i2cWrite8(w, a, 0xF5, 0xA0);             // 대기 1 s
  i2cWrite8(w, a, 0xF4, 0x27);             // 온도 x1, 기압 x1, 연속 측정
  const char* src = s.hum ? (qwiic ? "qwiic:BME280" : "i2c:BME280") : (qwiic ? "qwiic:BMP280" : "i2c:BMP280");
  s.iT = regDS("TA", tag, src, 2);
  s.iP = regDS("BP", tag, src, 2);
  s.iH = s.hum ? regDS("RH", tag, src, 1) : -1;
  s.last = 0;
  nBme++;
  return true;
}

void detectBme() {
  nBme = 0;
  for (uint8_t b = 0; b < NBUS; b++)
    for (uint8_t a = 0x76; a <= 0x77; a++)
      if (nBme < MAX_BME && i2cHas(buses[b].w, a)) detectOneBme(buses[b].w, a, buses[b].tag, HAS_QWIIC && b == 0);
}

void pollBme() {
  for (uint8_t i = 0; i < nBme; i++) {
    Bme& s = bme[i];
    if (millis() - s.last < 1000) continue;
    s.last = millis();
    uint8_t d[8];
    if (!i2cRead(s.w, s.addr, 0xF7, d, s.hum ? 8 : 6)) continue;
    long adcP = ((long)d[0] << 12) | ((long)d[1] << 4) | (d[2] >> 4);
    long adcT = ((long)d[3] << 12) | ((long)d[4] << 4) | (d[5] >> 4);
    float v1 = (adcT / 16384.0f - s.T1 / 1024.0f) * s.T2;
    float v2 = (adcT / 131072.0f - s.T1 / 8192.0f);
    v2 = v2 * v2 * s.T3;
    float tFine = v1 + v2;
    setDS(s.iT, tFine / 5120.0f);
    // 기압 (Bosch 데이터시트 부동소수 식)
    v1 = tFine / 2.0f - 64000.0f;
    v2 = v1 * v1 * s.P6 / 32768.0f;
    v2 = v2 + v1 * s.P5 * 2.0f;
    v2 = v2 / 4.0f + s.P4 * 65536.0f;
    v1 = (s.P3 * v1 * v1 / 524288.0f + s.P2 * v1) / 524288.0f;
    v1 = (1.0f + v1 / 32768.0f) * s.P1;
    if (v1 != 0) {
      float p = 1048576.0f - adcP;
      p = (p - v2 / 4096.0f) * 6250.0f / v1;
      v1 = s.P9 * p * p / 2147483648.0f;
      v2 = p * s.P8 / 32768.0f;
      p = p + (v1 + v2 + s.P7) / 16.0f;
      setDS(s.iP, p / 1000.0f);  // kPa
    }
    if (s.hum) {
      long adcH = ((long)d[6] << 8) | d[7];
      float h = tFine - 76800.0f;
      h = (adcH - (s.H4 * 64.0f + s.H5 / 16384.0f * h)) *
          (s.H2 / 65536.0f * (1.0f + s.H6 / 67108864.0f * h * (1.0f + s.H3 / 67108864.0f * h)));
      h = h * (1.0f - s.H1 * h / 524288.0f);
      if (h > 100) h = 100;
      if (h < 0) h = 0;
      setDS(s.iH, h);
    }
  }
}

#endif

#if FULL_SENSORS
// ---------- LPS22 (Modulino Pressure, 0x5C·0x5D) ----------
struct Lps { TwoWire* w; uint8_t addr; int8_t iP, iT; unsigned long last; };
Lps lps[2];
uint8_t nLps = 0;

void detectLps() {
  nLps = 0;
  for (uint8_t b = 0; b < NBUS; b++)
    for (uint8_t a = 0x5C; a <= 0x5D; a++) {
      uint8_t who;
      if (nLps >= 2 || !i2cHas(buses[b].w, a) || !i2cRead(buses[b].w, a, 0x0F, &who, 1)) continue;
      if (who != 0xB1 && who != 0xB3) continue;
      i2cWrite8(buses[b].w, a, 0x10, 0x20);   // 10 Hz 연속 측정
      Lps& s = lps[nLps++];
      s.w = buses[b].w; s.addr = a; s.last = 0;
      const char* src = HAS_QWIIC && b == 0 ? "qwiic:LPS22" : "i2c:LPS22";
      s.iP = regDS("BP", buses[b].tag, src, 2);
      s.iT = regDS("TA", buses[b].tag, src, 2);
    }
}

void pollLps() {
  for (uint8_t i = 0; i < nLps; i++) {
    Lps& s = lps[i];
    if (millis() - s.last < 500) continue;
    s.last = millis();
    uint8_t d[5];
    if (!i2cRead(s.w, s.addr, 0x28, d, 5)) continue;
    long rp = ((long)d[2] << 16) | ((long)d[1] << 8) | d[0];
    if (rp & 0x800000) rp -= 0x1000000;
    int16_t rt = (int16_t)(((uint16_t)d[4] << 8) | d[3]);
    setDS(s.iP, rp / 4096.0f / 10.0f);  // hPa → kPa
    setDS(s.iT, rt / 100.0f);
  }
}

// ---------- SCD40/41 이산화탄소 (0x62) ----------
struct Scd { TwoWire* w; int8_t iC, iT, iH; unsigned long last; };
Scd scd;
bool hasScd = false;

void detectScd() {
  hasScd = false;
  for (uint8_t b = 0; b < NBUS && !hasScd; b++) {
    TwoWire* w = buses[b].w;
    if (!i2cHas(w, 0x62)) continue;
    cmd16(w, 0x62, 0x3F86);   // 측정 멈춤 (이미 측정 중일 수 있음)
    delay(500);
    if (!cmd16(w, 0x62, 0x21B1)) continue;  // 5초마다 측정 시작
    const char* src = HAS_QWIIC && b == 0 ? "qwiic:SCD4x" : "i2c:SCD4x";
    scd.w = w; scd.last = millis();
    scd.iC = regDS("CO2", buses[b].tag, src, 0);
    scd.iT = regDS("TA", "SCD", src, 2);
    scd.iH = regDS("RH", "SCD", src, 1);
    hasScd = true;
  }
}

void pollScd() {
  if (!hasScd || millis() - scd.last < 1000) return;
  scd.last = millis();
  uint16_t st;
  if (!cmd16(scd.w, 0x62, 0xE4B8)) return;
  delay(1);
  if (!readWords(scd.w, 0x62, &st, 1) || (st & 0x07FF) == 0) return;  // 새 값 없음
  if (!cmd16(scd.w, 0x62, 0xEC05)) return;
  delay(1);
  uint16_t v[3];
  if (!readWords(scd.w, 0x62, v, 3)) return;
  setDS(scd.iC, v[0]);
  setDS(scd.iT, -45.0f + 175.0f * v[1] / 65535.0f);
  setDS(scd.iH, 100.0f * v[2] / 65535.0f);
}

// ---------- TCS34725 색 (0x29) ----------
struct Tcs { TwoWire* w; int8_t iR, iG, iB; unsigned long last; };
Tcs tcs;
bool hasTcs = false;

void detectTcs() {
  hasTcs = false;
  for (uint8_t b = 0; b < NBUS && !hasTcs; b++) {
    TwoWire* w = buses[b].w;
    uint8_t id;
    if (!i2cHas(w, 0x29) || !i2cRead(w, 0x29, 0x80 | 0x12, &id, 1)) continue;
    if (id != 0x44 && id != 0x4D && id != 0x10) continue;
    i2cWrite8(w, 0x29, 0x80 | 0x01, 0xD5);  // 적분 시간 약 103 ms
    i2cWrite8(w, 0x29, 0x80 | 0x0F, 0x01);  // 이득 4배
    i2cWrite8(w, 0x29, 0x80 | 0x00, 0x01);  // 전원
    delay(3);
    i2cWrite8(w, 0x29, 0x80 | 0x00, 0x03);  // 전원 + 측정
    const char* src = HAS_QWIIC && b == 0 ? "qwiic:TCS34725" : "i2c:TCS34725";
    tcs.w = w; tcs.last = millis();
    tcs.iR = regDS("COLR", buses[b].tag, src, 1);
    tcs.iG = regDS("COLG", buses[b].tag, src, 1);
    tcs.iB = regDS("COLB", buses[b].tag, src, 1);
    hasTcs = true;
  }
}

void pollTcs() {
  if (!hasTcs || millis() - tcs.last < 250) return;
  tcs.last = millis();
  uint8_t d[8];
  if (!i2cRead(tcs.w, 0x29, 0xA0 | 0x14, d, 8)) return;  // 자동 증가 읽기
  float c = d[0] | (d[1] << 8);
  if (c < 1) c = 1;
  // 전체 빛(clear) 대비 각 색의 비율(%) — 용액 색 비교용
  setDS(tcs.iR, 100.0f * (d[2] | (d[3] << 8)) / c);
  setDS(tcs.iG, 100.0f * (d[4] | (d[5] << 8)) / c);
  setDS(tcs.iB, 100.0f * (d[6] | (d[7] << 8)) / c);
}

#endif

#if MID_SENSORS
// ---------- HX711 로드셀 (DT=D5, SCK=D6) ----------
int8_t hxIdx = -1;
long hxRaw = 0;
float hxAvg = NAN;

bool hxRead(long& raw) {
  if (digitalRead(HX_DT) == HIGH) return false;  // 아직 준비 안 됨
  long v = 0;
  for (uint8_t i = 0; i < 24; i++) {
    digitalWrite(HX_SCK, HIGH); delayMicroseconds(1);
    v = (v << 1) | digitalRead(HX_DT);
    digitalWrite(HX_SCK, LOW); delayMicroseconds(1);
  }
  digitalWrite(HX_SCK, HIGH); delayMicroseconds(1);  // 25번째 펄스: 채널 A, 이득 128
  digitalWrite(HX_SCK, LOW);
  if (v & 0x800000) v |= 0xFF000000;
  raw = v;
  return true;
}

void detectHx() {
  hxIdx = -1;
  pinMode(HX_DT, INPUT_PULLUP);
  pinMode(HX_SCK, OUTPUT);
  digitalWrite(HX_SCK, LOW);
  unsigned long t0 = millis();
  while (millis() - t0 < 400) {       // 10 Hz 모듈이면 0.1초 안에 준비 신호가 옴
    long r;
    if (hxRead(r)) { hxRaw = r; hxAvg = r; hxIdx = regDS("M", "HX", "D5:HX711", 2); break; }
  }
  if (hxIdx >= 0) dsx[hxIdx].cal = settings.massCalValid;
}

float massFromRaw(float raw) { return (raw - settings.massTare) * settings.massScale; }

void pollHx() {
  if (hxIdx < 0) return;
  long r;
  if (!hxRead(r)) return;
  hxRaw = r;
  hxAvg = isnan(hxAvg) ? r : hxAvg * 0.7f + r * 0.3f;  // 흔들림 줄이기
  setDS(hxIdx, massFromRaw(hxAvg));
}

#endif

#if FULL_SENSORS
// ---------- MAX6675 K형 열전대 (CS=D10, SO=D12, SCK=D13) ----------
int8_t tcIdx = -1;
unsigned long tcLast = 0;

int tcReadRaw() {
  digitalWrite(TC_CS, LOW); delayMicroseconds(2);
  uint16_t v = 0;
  for (int8_t i = 15; i >= 0; i--) {
    digitalWrite(TC_SCK, HIGH); delayMicroseconds(1);
    v = (v << 1) | digitalRead(TC_SO);
    digitalWrite(TC_SCK, LOW); delayMicroseconds(1);
  }
  digitalWrite(TC_CS, HIGH);
  return (int)v;
}

void detectTc() {
  tcIdx = -1;
  pinMode(TC_CS, OUTPUT); digitalWrite(TC_CS, HIGH);
  pinMode(TC_SCK, OUTPUT); digitalWrite(TC_SCK, LOW);
  pinMode(TC_SO, INPUT_PULLUP);
  delay(250);
  uint16_t v = (uint16_t)tcReadRaw();
  // 모듈이 없으면 SO가 계속 1(0xFFFF) — 0번 비트(더미)와 1번 비트(장치 ID)는 항상 0
  if (v != 0xFFFF && v != 0x0000 && (v & 0x0002) == 0) {
    tcIdx = regDS("TK", "TC", "D10:MAX6675", 1);
    if (!(v & 0x0004)) setDS(tcIdx, (v >> 3) * 0.25f);
  }
  tcLast = millis();
}

void pollTc() {
  if (tcIdx < 0 || millis() - tcLast < 300) return;   // 변환 220 ms
  tcLast = millis();
  uint16_t v = (uint16_t)tcReadRaw();
  setDS(tcIdx, (v & 0x0004) ? NAN : (v >> 3) * 0.25f);  // 2번 비트: 열전대 끊김
}

// ---------- HC-SR04 초음파 (TRIG=D7, ECHO=D8) ----------
int8_t usIdx = -1;
unsigned long usLast = 0;

float usRead() {
  digitalWrite(US_TRIG, LOW); delayMicroseconds(2);
  digitalWrite(US_TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(US_TRIG, LOW);
  unsigned long us = pulseIn(US_ECHO, HIGH, 25000UL);  // 약 4 m
  return us ? us / 58.0f : NAN;
}

void detectUs() {
  usIdx = -1;
  pinMode(US_TRIG, OUTPUT);
  pinMode(US_ECHO, INPUT_PULLUP);   // 센서가 없으면 HIGH로 머물러 응답이 없음
  for (uint8_t i = 0; i < 3 && usIdx < 0; i++) {
    if (digitalRead(US_ECHO) == HIGH) { delay(30); continue; }
    float d = usRead();
    if (!isnan(d)) { usIdx = regDS("DIST", "US", "D7:HC-SR04", 1); setDS(usIdx, d); }
    delay(30);
  }
  usLast = millis();
}

void pollUs() {
  if (usIdx < 0 || millis() - usLast < 200) return;
  usLast = millis();
  setDS(usIdx, usRead());
}

#endif

// ---------- DHT11 / DHT22 (D4) ----------
uint8_t dhtKind = 0;
int8_t dhtT = -1, dhtH = -1;
unsigned long lastDhtMs = 0;
int dhtLastResult = -1;

uint32_t dhtWait(int level, uint32_t timeoutUs) {
  uint32_t t0 = micros();
  while (digitalRead(DHT_PIN) == level) {
    if (micros() - t0 > timeoutUs) return 0;
  }
  return micros() - t0 + 1;  // 0은 시간 초과 뜻으로만 씀
}

// 1 = 성공, 0 = 잡음·체크섬 오류, -1 = 센서 응답 없음
int dhtReadRaw(uint8_t data[5]) {
  pinMode(DHT_PIN, OUTPUT);
  digitalWrite(DHT_PIN, LOW);
  delay(20);
  pinMode(DHT_PIN, INPUT_PULLUP);
  delayMicroseconds(30);
  if (!dhtWait(HIGH, 200)) return -1;
  if (!dhtWait(LOW, 200)) return -1;
  if (!dhtWait(HIGH, 200)) return 0;
  for (int i = 0; i < 5; i++) data[i] = 0;
  for (int i = 0; i < 40; i++) {
    if (!dhtWait(LOW, 200)) return 0;
    uint32_t high = dhtWait(HIGH, 200);
    if (!high) return 0;
    data[i / 8] <<= 1;
    if (high > 45) data[i / 8] |= 1;
  }
  return (uint8_t)(data[0] + data[1] + data[2] + data[3]) == data[4] ? 1 : 0;
}

// DHT22는 습도 상위 바이트가 3 이하(100.0 % = 1000), DHT11은 정수 습도(20 이상)
bool dhtRead(float& t, float& h, uint8_t& kind) {
  uint8_t d[5];
  dhtLastResult = dhtReadRaw(d);
  if (dhtLastResult != 1) return false;
  if (d[0] > 3) {
    kind = 11;
    h = d[0] + d[1] / 10.0f;
    t = (d[2] & 0x7F) + d[3] / 10.0f;
  } else {
    kind = 22;
    h = (((uint16_t)d[0] << 8) | d[1]) / 10.0f;
    t = ((((uint16_t)d[2] & 0x7F) << 8) | d[3]) / 10.0f;
  }
  if (d[2] & 0x80) t = -t;
  return h >= 0 && h <= 100 && t > -40 && t < 85;
}

void detectDHT() {
  dhtKind = 0; dhtT = dhtH = -1;
  while (millis() < 1200) {}
  float t, h; uint8_t k;
  for (int tries = 0; tries < 3 && !dhtKind; tries++) {
    if (tries) delay(1100);
    if (dhtRead(t, h, k)) {
      dhtKind = k;
      const char* src = k == 22 ? "D4:DHT22" : "D4:DHT11";
      dhtT = regDS("TA", "D4", src, 1);
      dhtH = regDS("RH", "D4", src, 1);
      setDS(dhtT, t); setDS(dhtH, h);
      lastDhtMs = millis();
    } else if (dhtLastResult == -1) break;
  }
}

void pollDHT() {
  if (!dhtKind) return;
  if (millis() - lastDhtMs < (dhtKind == 22 ? 2000UL : 1100UL)) return;
  lastDhtMs = millis();
  float t, h; uint8_t k;
  if (dhtRead(t, h, k)) { setDS(dhtT, t); setDS(dhtH, h); }
}

// ---------- 데모 ----------
int8_t demoT = -1, demoTA = -1, demoRH = -1;

float demoNoise(float amp) { return ((random(0, 2001) - 1000) / 1000.0f) * amp; }
float demoPH(float t) { return 2.8f + 8.4f / (1.0f + exp(-(t - 60.0f) / 4.0f)) + demoNoise(0.03f); }
float demoTemp(float t) {
  float T;
  if (t < 140) T = 22.0f - 22.0f * (t / 140.0f);
  else if (t < 220) T = 0.0f;
  else T = -0.06f * (t - 220.0f);
  if (T < -10) T = -10;
  return T + demoNoise(0.05f);
}
float demoHumidity(float t) {  // 40초마다 입김
  float ph = fmod(t, 40.0f);
  return 45.0f + (ph > 10.0f ? 35.0f * exp(-(ph - 10.0f) / 6.0f) : 0.0f) + demoNoise(0.3f);
}
float demoAirTemp(float t) {
  float ph = fmod(t, 40.0f);
  return 23.5f + (ph > 10.0f ? 1.2f * exp(-(ph - 10.0f) / 8.0f) : 0.0f) + demoNoise(0.05f);
}
float demoAnalog(const char* type, float t) {
  if (!strcmp(type, "pH")) return demoPH(t);
  if (!strcmp(type, "L")) return 50.0f + 10.0f * sin(t / 10.0f) + demoNoise(0.5f);
  if (!strcmp(type, "EC")) return 1200.0f + 2.0f * t + demoNoise(5.0f);
  if (!strcmp(type, "V")) return 1.10f + demoNoise(0.005f);
  if (!strcmp(type, "TL") || !strcmp(type, "TM36")) return demoTemp(t);
  if (!strcmp(type, "P")) return 101.3f + 0.5f * t + demoNoise(0.3f);
  return 2.5f + demoNoise(0.01f);
}

bool hasType(const char* type) {
  for (uint8_t i = 0; i < nds; i++) if (!strcmp(dsx[i].type, type)) return true;
  return false;
}

void registerDemo() {
  demoT = demoTA = demoRH = -1;
  if (!demo) return;
  if (!hasType("T")) demoT = regDS("T", "DM", "demo", 2);
  if (!hasType("TA")) demoTA = regDS("TA", "DM", "demo", 2);
  if (!hasType("RH")) demoRH = regDS("RH", "DM", "demo", 1);
}

// =====================================================================
// 센서 인식 / 갱신
// =====================================================================
void detectSensors() {
  nds = 0;
  for (uint8_t b = 0; b < NBUS; b++) buses[b].w->begin();
  detectDS18();
  detectThermo();
#if MID_SENSORS
  detectBme();
#endif
#if FULL_SENSORS
  detectLps();
  detectScd();
  detectTcs();
#endif
#if MID_SENSORS
  detectHx();
#endif
#if FULL_SENSORS
  detectTc();
  detectUs();
#endif
  detectDHT();
  registerDemo();
}

// 측정 직전에는 시간이 걸리는 읽기(DHT 등)를 미룸
void pollSensors() {
  bool soon = running && (millis() - lastTickMs + 60 >= intervalMs);
  pollDS18();
#if MID_SENSORS
  pollHx();
#endif
  if (soon) return;
  pollThermo();
#if MID_SENSORS
  pollBme();
#endif
#if FULL_SENSORS
  pollLps();
  pollScd();
  pollTcs();
  pollTc();
  pollUs();
#endif
  pollDHT();
}

// =====================================================================
// 메시지
// =====================================================================
void sensorJson(bool& first, const char* id, const char* type, const char* src, bool cal) {
  // name·unit은 앱이 protocol/sensors.json 에서 type으로 찾습니다
  if (!first) out.print(F(","));
  first = false;
  out.print(F("{\"id\":")); out.str(id);
  out.print(F(",\"type\":")); out.str(type);
  out.print(F(",\"name\":")); out.str(type);
  out.print(F(",\"unit\":\"\",\"src\":")); out.str(src);
  out.print(cal ? F(",\"cal\":true}") : F(",\"cal\":false}"));
}

void sendHello() {
  out.begin();
  out.print(F("{\"type\":\"hello\",\"fw\":\"" FW_VERSION "\",\"board\":\"" BOARD_NAME "\",\"station\":"));
  out.num((long)settings.station);
  out.print(demo ? F(",\"demo\":true") : F(",\"demo\":false"));
  out.print(F(",\"interval\":")); out.num((long)intervalMs);
  out.print(running ? F(",\"running\":true") : F(",\"running\":false"));
  out.print(F(",\"sensors\":["));
  bool first = true;
  for (int i = 0; i < 4; i++) {
    if (!portOn(i)) continue;
    sensorJson(first, portId(i).c_str(), settings.port[i].type, analogSrc[i], settings.port[i].calValid);
  }
  for (uint8_t i = 0; i < nds; i++) sensorJson(first, dsx[i].id, dsx[i].type, dsx[i].src, dsx[i].cal);
  out.print(F("]}"));
  out.end();
}

float readVoltage(uint8_t pin) {
  long sum = 0;
  const int N = 16;
  for (int i = 0; i < N; i++) sum += analogRead(pin);
  return (sum / (float)N) * VREF / ADC_MAX;
}

float analogValue(int i, float volt) { return settings.port[i].slope * volt + settings.port[i].offset; }

void tick() {
  float t = (millis() - startMs) / 1000.0f;
  if (demoT >= 0) setDS(demoT, demoTemp(t));
  if (demoTA >= 0) setDS(demoTA, demoAirTemp(t));
  if (demoRH >= 0) setDS(demoRH, demoHumidity(t));

  out.begin();
  out.print(F("{\"type\":\"d\",\"t\":")); out.num(t, 2);
  out.print(F(",\"v\":{"));
  bool first = true;
  for (int i = 0; i < 4; i++) {
    if (!portOn(i)) continue;
    float v = demo ? demoAnalog(settings.port[i].type, t) : analogValue(i, readVoltage(analogPins[i]));
    if (!first) out.print(F(","));
    first = false;
    out.str(portId(i).c_str()); out.print(F(":")); out.num(v, 3);
  }
  for (uint8_t i = 0; i < nds; i++) {
    if (isnan(dsx[i].v)) continue;
    if (!first) out.print(F(","));
    first = false;
    out.str(dsx[i].id); out.print(F(":")); out.num(dsx[i].v, dsx[i].dec);
  }
  out.print(F("}}"));
  out.end();
}

// =====================================================================
// 명령
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

void sendCal(const char* id, float slope, float offset, int points) {
  out.begin();
  out.print(F("{\"type\":\"cal\",\"id\":")); out.str(id);
  out.print(F(",\"slope\":")); out.num(slope, 4);
  out.print(F(",\"offset\":")); out.num(offset, 4);
  out.print(F(",\"points\":")); out.num((long)points);
  out.print(F("}"));
  out.end();
}

// CAL <id> 1 <ref> → CAL <id> 2 <ref> : 2점 보정
// CAL <id> OFS <ref>                  : 1점(영점) — 지금 값이 ref가 되도록 절편 이동 (무게는 영점 맞추기)
// CAL <id> SCL <ref>                  : 1점(비례) — 지금 값이 ref가 되도록 기울기 조정 (산소, 무게 기준 추)
// CAL <id> CLEAR                      : 보정 지우기
void handleCal(String args[], int argc) {
  if (argc < 3) { sendErr("CAL", F("usage: CAL <id> <1|2|OFS|SCL|CLEAR> [value]")); return; }
  String id = args[1];
  String step = args[2];
  step.toUpperCase();
  float ref = argc > 3 ? args[3].toFloat() : 0;

  // 디지털: DS18B20 온도(영점), HX711 무게(영점·비례)
  int8_t di = findDS(id);
  if (di >= 0 && nProbes && di == dsIdx[0]) {
    if (step == "CLEAR") { settings.tempOffset = 0; settings.tempCalValid = 0; }
    else {
      if (isnan(dsx[di].v)) { sendErr("CAL", F("no reading")); return; }
      float raw = dsx[di].v - (settings.tempCalValid ? settings.tempOffset : 0);
      settings.tempOffset = ref - raw;
      settings.tempCalValid = 1;
    }
    dsx[di].cal = settings.tempCalValid;
    saveSettings();
    if (step == "CLEAR") sendAck("CAL"); else sendCal(dsx[di].id, 1, settings.tempOffset, 1);
    return;
  }
#if MID_SENSORS
  if (di >= 0 && di == hxIdx) {
    if (step == "CLEAR") { settings.massTare = 0; settings.massScale = 0.001f; settings.massCalValid = 0; }
    else if (step == "OFS") {  // 영점: 지금 무게 = ref (보통 0 g)
      settings.massTare = (long)(hxAvg - ref / settings.massScale);
    } else if (step == "SCL") {  // 기준 추를 올리고: 지금 무게 = ref g
      float d = hxAvg - settings.massTare;
      if (fabs(d) < 10) { sendErr("CAL", F("put a known mass first")); return; }
      settings.massScale = ref / d;
      settings.massCalValid = 1;
    } else { sendErr("CAL", F("use OFS (zero) then SCL (known mass)")); return; }
    dsx[di].cal = settings.massCalValid;
    saveSettings();
    if (step == "CLEAR") sendAck("CAL"); else sendCal(dsx[di].id, settings.massScale, (float)settings.massTare, step == "SCL" ? 2 : 1);
    return;
  }
#endif

  int i = analogIndex(id);
  if (i < 0) { sendErr("CAL", F("unknown sensor")); return; }
  PortSetting& p = settings.port[i];

  if (step == "CLEAR") {
    p.calValid = 0;
    calHasP1[i] = false;
    saveSettings();
    sendAck("CAL");
    return;
  }
  if (argc < 4) { sendErr("CAL", F("missing reference value")); return; }
  float volt = readVoltage(analogPins[i]);

  if (step == "OFS") {
    p.offset += ref - analogValue(i, volt);
    p.calValid = 1;
    saveSettings();
    sendCal(id.c_str(), p.slope, p.offset, 1);
  } else if (step == "SCL") {
    if (volt < 0.005f) { sendErr("CAL", F("signal too small")); return; }
    p.slope = (ref - p.offset) / volt;
    p.calValid = 1;
    saveSettings();
    sendCal(id.c_str(), p.slope, p.offset, 1);
  } else if (step == "1") {
    calV1[i] = volt; calRef1[i] = ref; calHasP1[i] = true;
    sendAck("CAL");
  } else if (step == "2") {
    if (!calHasP1[i]) { sendErr("CAL", F("record point 1 first")); return; }
    float dv = volt - calV1[i];
    if (fabs(dv) < 0.005f) { sendErr("CAL", F("points too close")); return; }
    p.slope = (ref - calRef1[i]) / dv;
    p.offset = calRef1[i] - p.slope * calV1[i];
    p.calValid = 1;
    calHasP1[i] = false;
    saveSettings();
    sendCal(id.c_str(), p.slope, p.offset, 2);
  } else {
    sendErr("CAL", F("step must be 1, 2, OFS, SCL or CLEAR"));
  }
}

// PORT <A0~A3> <type> [slope offset]  /  PORT <A0~A3> OFF
void handlePort(String args[], int argc) {
  if (argc < 3) { sendErr("PORT", F("usage: PORT <A0-A3> <type> [slope offset]")); return; }
  int i = portIndexByName(args[1]);
  if (i < 0) { sendErr("PORT", F("port must be A0-A3")); return; }
  if (args[2].length() >= TYPE_LEN) { sendErr("PORT", F("type too long")); return; }
  setPort(i, args[2].c_str(), argc > 3 ? args[3].toFloat() : 1.0f, argc > 4 ? args[4].toFloat() : 0.0f);
  calHasP1[i] = false;
  saveSettings();
  sendAck("PORT");
  if (!running) detectSensors();  // 디지털 센서 id가 아날로그 종류와 겹치지 않게 다시 정리
  sendHello();
}

void handleCommand(String line) {
  line.trim();
  if (line.length() == 0) return;
  String args[6];
  int argc = 0, pos = 0;
  while (argc < 6 && pos < (int)line.length()) {
    int sp = line.indexOf(' ', pos);
    if (sp < 0) sp = line.length();
    if (sp > pos) args[argc++] = line.substring(pos, sp);
    pos = sp + 1;
  }
  String cmd = args[0];
  cmd.toUpperCase();

  if (cmd == "HELLO") {
    if (!running) detectSensors();
    sendHello();
  } else if (cmd == "START") {
    unsigned long ms = argc > 1 ? (unsigned long)args[1].toInt() : 1000;
    if (ms < MIN_INTERVAL_MS) ms = MIN_INTERVAL_MS;
    intervalMs = ms;
    running = true;
    startMs = millis();
    lastTickMs = startMs - intervalMs;
    sendAck("START");
  } else if (cmd == "STOP") {
    running = false;
    sendAck("STOP");
  } else if (cmd == "DEMO") {
    String v = argc > 1 ? args[1] : String("ON");
    v.toUpperCase();
    demo = (v == "ON");
    sendAck("DEMO");
    if (!running) detectSensors();
    sendHello();
  } else if (cmd == "CAL") {
    handleCal(args, argc);
  } else if (cmd == "PORT") {
    handlePort(args, argc);
  } else if (cmd == "STATION") {
    int n = argc > 1 ? args[1].toInt() : 0;
    if (n < 1 || n > 8) { sendErr("STATION", F("1-8")); return; }
    settings.station = n;
    saveSettings();
    sendAck("STATION");
  } else {
    sendErr(cmd.c_str(), F("unknown command"));
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

#if HAS_BLE
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
void onBleConnect(BLEDevice) { bleBuf = ""; }
void onBleDisconnect(BLEDevice) { bleBuf = ""; BLE.advertise(); }
#endif

// =====================================================================
void setup() {
  Serial.begin(115200);
  unsigned long t0 = millis();
  while (!Serial && millis() - t0 < 1500) {}

#if ADC_BITS > 10
  analogReadResolution(ADC_BITS);
#endif
  randomSeed(analogRead(A5));
  loadSettings();
  detectSensors();

#if HAS_BLE
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
#endif

  sendHello();
}

void loop() {
#if HAS_BLE
  if (bleOk) BLE.poll();
#endif
  readSerial();
  pollSensors();

  if (running && millis() - lastTickMs >= intervalMs) {
    lastTickMs += intervalMs;
    if (millis() - lastTickMs > intervalMs) lastTickMs = millis();
    tick();
  }
}
