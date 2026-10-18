// =====================================================================
// 추가 센서 2 (펌웨어 0.5.0) — 국내 아두이노 공식 판매처(엘레파츠·아이씨뱅큐·메카솔루션·디바이스마트)
// 에서 파는 모듈. 꽂으면 자동 인식(HELLO). FULL_SENSORS 보드(UNO R4·Nano R4·Mega)에서만.
//
//  I2C   TMP117/119·TMP102(0x48~0x4B) 정밀 온도 · ADS1115/1015(0x48~0x4B) 정밀 전압
//        BMP388/390·DPS310·MS5611(0x76·0x77) 기압 · MPL3115A2(0x60) 기압 · MCP9600(0x60~0x67) 열전대
//        AS5600(0x36) 회전 각도 · ICM-20948/20649(0x68·0x69)·MMA8452Q(0x1C·0x1D)·BNO055(0x28·0x29) 가속도
//        LIS3MDL(0x1C·0x1E)·MAG3110(0x0E)·BMM150(0x10~0x13)·TMAG5273(0x35·0x22·0x78) 자기장
//        AS7341(0x39) 8파장 분광 · APDS9960(0x39) 색 · LTR390(0x53) 자외선 · LTR381(0x53, Modulino Light) 색·조도
//        SI1145(0x60) 자외선 · SGP40(0x59) VOC 원시값 · VL6180X·VL53L1X·VL53L4CD(0x29) 레이저 거리
//        AM2320(0x5C)·HIH6130(0x27) 온습도 · NAU7802(0x2A) 로드셀(무게)
//  ADXL313은 ADXL345 칸, ICM-20649는 ICM-20948 칸에서 함께 읽음
// 레지스터는 각 칩 데이터시트와 제조사·Adafruit·SparkFun 라이브러리로 확인.
// =====================================================================
#if FULL_SENSORS

// ---------- 16비트 레지스터 주소 (VL6180X·VL53L1X·VL53L4CD) ----------
bool rd16a(TwoWire* w, uint8_t a, uint16_t reg, uint8_t* d, uint8_t n) {
  w->beginTransmission(a); w->write(reg >> 8); w->write(reg & 0xFF);
  if (w->endTransmission(false) != 0) return false;
  if (w->requestFrom(a, n) != n) return false;
  for (uint8_t i = 0; i < n; i++) d[i] = w->read();
  return true;
}
bool wr16a(TwoWire* w, uint8_t a, uint16_t reg, uint8_t v) {
  w->beginTransmission(a); w->write(reg >> 8); w->write(reg & 0xFF); w->write(v);
  return w->endTransmission() == 0;
}

// 반복 시작(STOP 없이) 읽기 — MPL3115A2
bool i2cReadRS(TwoWire* w, uint8_t a, uint8_t reg, uint8_t* d, uint8_t n) {
  w->beginTransmission(a); w->write(reg);
  if (w->endTransmission(false) != 0) return false;
  if (w->requestFrom(a, n) != n) return false;
  for (uint8_t i = 0; i < n; i++) d[i] = w->read();
  return true;
}

bool haveKind(uint8_t k) { for (uint8_t i = 0; i < nMore; i++) if (more[i].kind == k) return true; return false; }

bool moreAt(TwoWire* w, uint8_t a) {
  for (uint8_t i = 0; i < nMore; i++) if (more[i].w == w && more[i].addr == a) return true;
  return false;
}

// ---------- 큰 보정값은 한 개씩만 (메모리 아끼기) ----------
struct Bmp3Cal { float t1, t2, t3, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11; };
Bmp3Cal b3;
struct DpsCal { int32_t c00, c10; int16_t c0, c1, c01, c11, c20, c21, c30; };
DpsCal dps;
int8_t nauSlot = -1;   // NAU7802 → 기존 무게(M) 칸에 값 넣기

int32_t twos(uint32_t v, uint8_t bits) { if (v & (1UL << (bits - 1))) v -= (1UL << bits); return (int32_t)v; }

// AS7341 SMUX 설정 (F1~F4+Clear+NIR / F5~F8+Clear+NIR), Adafruit_AS7341 기준
const uint8_t AS_LO[20] PROGMEM = { 0x30, 0x01, 0x00, 0x00, 0x00, 0x42, 0x00, 0x00, 0x50, 0x00, 0x00, 0x00, 0x20, 0x04, 0x00, 0x30, 0x01, 0x50, 0x00, 0x06 };
const uint8_t AS_HI[20] PROGMEM = { 0x00, 0x00, 0x00, 0x40, 0x02, 0x00, 0x10, 0x03, 0x50, 0x10, 0x03, 0x00, 0x00, 0x00, 0x24, 0x00, 0x00, 0x50, 0x00, 0x06 };

// VL53L1X / VL53L4CD 기본 설정 (0x2D~0x87), ST ULD
const uint8_t L1X_CFG[91] PROGMEM = {
  0x00, 0x01, 0x01, 0x01, 0x02, 0x00, 0x02, 0x08, 0x00, 0x08, 0x10, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0xff, 0x00, 0x0F, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x20, 0x0b, 0x00, 0x00, 0x02, 0x0a, 0x21, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0xc8, 0x00, 0x00, 0x38, 0xff, 0x01, 0x00,
  0x08, 0x00, 0x00, 0x01, 0xdb, 0x0f, 0x01, 0xf1, 0x0d, 0x01, 0x68, 0x00, 0x80, 0x08, 0xb8, 0x00, 0x00, 0x00, 0x00, 0x0f, 0x89, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x0f, 0x0d, 0x0e, 0x0e, 0x00, 0x00, 0x02, 0xc7, 0xff, 0x9B, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00 };
const uint8_t L4CD_CFG[91] PROGMEM = {
  0x12, 0x00, 0x00, 0x11, 0x02, 0x00, 0x02, 0x08, 0x00, 0x08, 0x10, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0xff, 0x00, 0x0F, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x20, 0x0b, 0x00, 0x00, 0x02, 0x14, 0x21, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0xc8, 0x00, 0x00, 0x38, 0xff, 0x01, 0x00,
  0x08, 0x00, 0x00, 0x01, 0xcc, 0x07, 0x01, 0xf1, 0x05, 0x00, 0xa0, 0x00, 0x80, 0x08, 0x38, 0x00, 0x00, 0x00, 0x00, 0x0f, 0x89, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x07, 0x05, 0x06, 0x06, 0x00, 0x00, 0x02, 0xc7, 0xff, 0x9B, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00 };

// VL6180X 초기 설정 (ST AN4545, Adafruit_VL6180X 기준)
const uint16_t V6_REG[] PROGMEM = { 0x0207, 0x0208, 0x0096, 0x0097, 0x00e3, 0x00e4, 0x00e5, 0x00e6, 0x00e7, 0x00f5, 0x00d9, 0x00db, 0x00dc,
  0x00dd, 0x009f, 0x00a3, 0x00b7, 0x00bb, 0x00b2, 0x00ca, 0x0198, 0x01b0, 0x01ad, 0x00ff, 0x0100, 0x0199, 0x01a6, 0x01ac, 0x01a7, 0x0030,
  0x0011, 0x010a, 0x003f, 0x0031, 0x0041, 0x002e, 0x001b, 0x003e, 0x0014 };
const uint8_t V6_VAL[] PROGMEM = { 0x01, 0x01, 0x00, 0xfd, 0x00, 0x04, 0x02, 0x01, 0x03, 0x02, 0x05, 0xce, 0x03,
  0xf8, 0x00, 0x3c, 0x00, 0x3c, 0x09, 0x09, 0x01, 0x17, 0x00, 0x05, 0x05, 0x05, 0x1b, 0x3e, 0x1f, 0x00,
  0x10, 0x30, 0x46, 0xFF, 0x63, 0x01, 0x09, 0x31, 0x24 };

// AM2320: 깨운 뒤 온습도 4바이트 읽기 (Modbus CRC16)
bool am2320Read(TwoWire* w, float& t, float& h) {
  w->beginTransmission(0x5C); w->endTransmission();   // 깨우기 (응답 없음이 정상)
  delay(1);
  w->beginTransmission(0x5C); w->write(0x03); w->write(0x00); w->write(0x04);
  if (w->endTransmission() != 0) return false;
  delay(2);
  uint8_t d[8];
  if (!i2cReadRaw(w, 0x5C, d, 8) || d[0] != 0x03 || d[1] != 0x04) return false;
  uint16_t crc = 0xFFFF;
  for (uint8_t i = 0; i < 6; i++) {
    crc ^= d[i];
    for (uint8_t k = 0; k < 8; k++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
  }
  if (crc != (uint16_t)(d[6] | (d[7] << 8))) return false;
  h = ((d[2] << 8) | d[3]) / 10.0f;
  uint16_t tr = (d[4] << 8) | d[5];
  t = (tr & 0x7FFF) / 10.0f; if (tr & 0x8000) t = -t;
  return true;
}

// MS5611 PROM CRC4 (AN520)
bool ms56Crc(uint16_t* p) {
  uint16_t rem = 0, crcRead = p[7] & 0x000F, keep = p[7];
  p[7] &= 0xFF00;
  for (uint8_t c = 0; c < 16; c++) {
    rem ^= (c & 1) ? (p[c >> 1] & 0x00FF) : (p[c >> 1] >> 8);
    for (uint8_t b = 8; b > 0; b--) rem = (rem & 0x8000) ? (rem << 1) ^ 0x3000 : (rem << 1);
  }
  p[7] = keep;
  return ((rem >> 12) & 0x0F) == crcRead;
}

bool ms56Adc(TwoWire* w, uint8_t a, uint32_t& v) {
  if (!i2cCmd8(w, a, 0x00)) return false;
  uint8_t d[3];
  if (!i2cReadRaw(w, a, d, 3)) return false;
  v = ((uint32_t)d[0] << 16) | ((uint32_t)d[1] << 8) | d[2];
  return v != 0;
}

bool vlL1Ready(TwoWire* w) {
  uint8_t mux, st;
  if (!rd16a(w, 0x29, 0x0030, &mux, 1) || !rd16a(w, 0x29, 0x0031, &st, 1)) return false;
  return (st & 1) == !((mux & 0x10) >> 4);
}

// ---------- 인식 ----------
void detectExtra() {
  for (uint8_t b = 0; b < NBUS; b++) {
    TwoWire* w = buses[b].w;
    const char* tag = buses[b].tag;
    More* m;

    // 0x48~0x4B: TMP117/119 → ADS1115/1015 → TMP102
    for (uint8_t a = 0x48; a <= 0x4B; a++) {
      if (!i2cHas(w, a) || moreAt(w, a)) continue;
      uint16_t id, cfg, raw;
      if (i2cRead16(w, a, 0x0F, id, false) && (id == 0x0117 || id == 0x2117)) {
        if ((m = addMore(w, a, K_TMP117))) m->i0 = regDS("T", "117", SRC(b, "TMP117"), 3);
        continue;
      }
      if (!i2cRead16(w, a, 0x01, cfg, false)) continue;
      if ((cfg & 0x7FFF) == 0x0583 || (cfg & 0x7FFF) == 0x0383) {   // ADS1x15 기본값 또는 우리가 쓴 단발 설정
        if ((m = addMore(w, a, K_ADS))) m->i0 = regDS("VP", tag, SRC(b, "ADS1115"), 4);
        continue;
      }
      if ((cfg & 0x6000) == 0x6000 && i2cRead16(w, a, 0x00, raw, false)) {   // TMP102: 해상도 비트 11
        float t = ((int16_t)raw >> 4) * 0.0625f;
        if (t > -40 && t < 100 && (m = addMore(w, a, K_TMP102))) m->i0 = regDS("T", "102", SRC(b, "TMP102"), 2);
      }
    }

    // 0x76·0x77: DPS310 → BMP388/390 → MS5611 (BME280·BMP180이 아닌 것)
    static const uint8_t AP[] = { 0x77, 0x76 };
    for (uint8_t a : AP) {
      if (!i2cHas(w, a) || bmeAt(w, a) || moreAt(w, a)) continue;
      uint8_t id;
      if (!haveKind(K_DPS) && i2cRead(w, a, 0x0D, &id, 1) && id == 0x10) {   // DPS310·DPS368 (보정값 칸이 하나라 1개만)
        i2cWrite8(w, a, 0x0C, 0x89); delay(40);          // 초기화
        uint8_t c[18], src = 0;
        if (!i2cRead(w, a, 0x10, c, 18) || !i2cRead(w, a, 0x28, &src, 1)) continue;
        dps.c0 = twos(((uint16_t)c[0] << 4) | (c[1] >> 4), 12);
        dps.c1 = twos(((uint16_t)(c[1] & 0x0F) << 8) | c[2], 12);
        dps.c00 = twos(((uint32_t)c[3] << 12) | ((uint32_t)c[4] << 4) | (c[5] >> 4), 20);
        dps.c10 = twos(((uint32_t)(c[5] & 0x0F) << 16) | ((uint32_t)c[6] << 8) | c[7], 20);
        dps.c01 = (int16_t)((c[8] << 8) | c[9]); dps.c11 = (int16_t)((c[10] << 8) | c[11]);
        dps.c20 = (int16_t)((c[12] << 8) | c[13]); dps.c21 = (int16_t)((c[14] << 8) | c[15]);
        dps.c30 = (int16_t)((c[16] << 8) | c[17]);
        i2cWrite8(w, a, 0x06, 0x33);                      // 기압 8 Hz, 8회 평균
        i2cWrite8(w, a, 0x07, 0x33 | (src & 0x80));       // 온도 8 Hz, 8회, 보정값과 같은 센서
        i2cWrite8(w, a, 0x09, 0x00);
        i2cWrite8(w, a, 0x08, 0x07);                      // 연속 측정
        if ((m = addMore(w, a, K_DPS))) { m->i0 = regDS("TA", "DPS", SRC(b, "DPS310"), 2); m->i1 = regDS("BP", "DPS", SRC(b, "DPS310"), 3); }
        continue;
      }
      if (!haveKind(K_BMP3) && i2cRead(w, a, 0x00, &id, 1) && (id == 0x50 || id == 0x60)) {   // BMP388·BMP390 (1개만)
        uint8_t r[21];
        if (!i2cRead(w, a, 0x31, r, 21)) continue;
        b3.t1 = (uint16_t)(r[0] | (r[1] << 8)) * 256.0f;
        b3.t2 = (uint16_t)(r[2] | (r[3] << 8)) / 1073741824.0f;
        b3.t3 = (int8_t)r[4] / 281474976710656.0f;
        b3.p1 = ((int16_t)(r[5] | (r[6] << 8)) - 16384) / 1048576.0f;
        b3.p2 = ((int16_t)(r[7] | (r[8] << 8)) - 16384) / 536870912.0f;
        b3.p3 = (int8_t)r[9] / 4294967296.0f;
        b3.p4 = (int8_t)r[10] / 137438953472.0f;
        b3.p5 = (uint16_t)(r[11] | (r[12] << 8)) * 8.0f;
        b3.p6 = (uint16_t)(r[13] | (r[14] << 8)) / 64.0f;
        b3.p7 = (int8_t)r[15] / 256.0f;
        b3.p8 = (int8_t)r[16] / 32768.0f;
        b3.p9 = (int16_t)(r[17] | (r[18] << 8)) / 281474976710656.0f;
        b3.p10 = (int8_t)r[19] / 281474976710656.0f;
        b3.p11 = (int8_t)r[20] / 36893488147419103232.0f;
        i2cWrite8(w, a, 0x1C, 0x03);   // 기압 8배, 온도 1배
        i2cWrite8(w, a, 0x1D, 0x02);   // 50 Hz
        i2cWrite8(w, a, 0x1B, 0x33);   // 기압·온도 켜기, 연속
        if ((m = addMore(w, a, K_BMP3))) { m->i0 = regDS("TA", "BMP3", SRC(b, "BMP3xx"), 2); m->i1 = regDS("BP", "BMP3", SRC(b, "BMP3xx"), 3); }
        continue;
      }
      // MS5611: PROM 8개 + CRC4 (BME680/688·BME280·BMP180은 건너뜀)
      if (i2cRead(w, a, 0xD0, &id, 1) && (id == 0x61 || id == 0x58 || id == 0x60 || id == 0x55)) continue;
      if (!i2cCmd8(w, a, 0x1E)) continue;
      delay(5);
      uint16_t p[8];
      bool ok = true;
      for (uint8_t i = 0; i < 8 && ok; i++) {
        uint8_t d[2];
        ok = i2cCmd8(w, a, 0xA0 + 2 * i) && i2cReadRaw(w, a, d, 2);
        p[i] = (d[0] << 8) | d[1];
      }
      if (!ok || p[1] == 0 || p[1] == 0xFFFF || !ms56Crc(p)) continue;
      if ((m = addMore(w, a, K_MS56))) {
        for (uint8_t i = 0; i < 6; i++) m->cal[i] = (int16_t)p[i + 1];   // C1~C6
        m->i0 = regDS("TA", "MS56", SRC(b, "MS5611"), 2); m->i1 = regDS("BP", "MS56", SRC(b, "MS5611"), 3);
      }
    }

    // 0x60~0x67: MPL3115A2 → SI1145 → MCP9600
    for (uint8_t a = 0x60; a <= 0x67; a++) {
      if (!i2cHas(w, a) || moreAt(w, a)) continue;
      uint8_t id;
      if (a == 0x60 && i2cReadRS(w, a, 0x0C, &id, 1) && id == 0xC4) {
        i2cWrite8(w, a, 0x26, 0x38); i2cWrite8(w, a, 0x13, 0x07); i2cWrite8(w, a, 0x26, 0x39);   // 기압계, 128회, 켜기
        if ((m = addMore(w, a, K_MPL))) { m->i0 = regDS("TA", "MPL", SRC(b, "MPL3115A2"), 2); m->i1 = regDS("BP", "MPL", SRC(b, "MPL3115A2"), 3); }
        continue;
      }
      if (a == 0x60 && i2cRead(w, a, 0x00, &id, 1) && id == 0x45) {
        i2cWrite8(w, a, 0x18, 0x01); delay(10); i2cWrite8(w, a, 0x07, 0x17); delay(10);   // 초기화, HW_KEY
        i2cWrite8(w, a, 0x13, 0x29); i2cWrite8(w, a, 0x14, 0x89); i2cWrite8(w, a, 0x15, 0x02); i2cWrite8(w, a, 0x16, 0x00);   // UV 계수
        i2cWrite8(w, a, 0x17, 0xB0); i2cWrite8(w, a, 0x18, 0xA1);   // CHLIST = UV+가시+적외선
        i2cWrite8(w, a, 0x08, 0xFF); i2cWrite8(w, a, 0x18, 0x0F);   // 자동 측정
        if ((m = addMore(w, a, K_SI1145))) m->i0 = regDS("UVI", "SI", SRC(b, "SI1145"), 2);
        continue;
      }
      uint16_t did;
      if (i2cRead16(w, a, 0x20, did, false) && ((did >> 8) == 0x40 || (did >> 8) == 0x41)) {
        if ((m = addMore(w, a, K_MCP9600))) m->i0 = regDS("TK", "9600", SRC(b, "MCP9600"), 2);
      }
    }

    // AS5600 회전 각도 (0x36)
    if (i2cHas(w, 0x36) && !moreAt(w, 0x36)) {
      uint8_t st; uint16_t ang;
      if (i2cRead(w, 0x36, 0x0B, &st, 1) && (st & 0xC7) == 0 && i2cRead16(w, 0x36, 0x0E, ang, false) && ang < 4096)
        if ((m = addMore(w, 0x36, K_AS5600))) m->i0 = regDS("ANG", tag, SRC(b, "AS5600"), 1);
    }

    // ICM-20948 / ICM-20649 (0x68·0x69, MPU6050이 아닐 때)
    static const uint8_t AI[] = { 0x68, 0x69 };
    for (uint8_t a : AI) {
      uint8_t who;
      if (!i2cHas(w, a) || moreAt(w, a) || !i2cRead(w, a, 0x00, &who, 1) || (who != 0xEA && who != 0xE1)) continue;
      i2cWrite8(w, a, 0x7F, 0x00); i2cWrite8(w, a, 0x06, 0x01); i2cWrite8(w, a, 0x07, 0x00);   // 0번 뱅크, 깨우기
      if ((m = addMore(w, a, K_ICM))) {
        m->step = who == 0xE1 ? 1 : 0;   // 20649는 기본 ±4 g
        const char* s = who == 0xE1 ? SRC(b, "ICM-20649") : SRC(b, "ICM-20948");
        m->i0 = regDS("AX", "ICM", s, 2); m->i1 = regDS("AY", "ICM", s, 2); m->i2 = regDS("AZ", "ICM", s, 2);
      }
      break;
    }

    // MMA8452Q·8451·8453 (0x1C·0x1D)
    static const uint8_t AM[] = { 0x1D, 0x1C };
    for (uint8_t a : AM) {
      uint8_t who;
      if (!i2cHas(w, a) || moreAt(w, a) || !i2cRead(w, a, 0x0D, &who, 1) || (who != 0x2A && who != 0x1A && who != 0x3A && who != 0x5A)) continue;
      i2cWrite8(w, a, 0x2A, 0x00); i2cWrite8(w, a, 0x0E, 0x00); i2cWrite8(w, a, 0x2A, 0x19);   // ±2 g, 100 Hz, 켜기
      if ((m = addMore(w, a, K_MMA))) { m->i0 = regDS("AX", "MMA", SRC(b, "MMA8452Q"), 2); m->i1 = regDS("AY", "MMA", SRC(b, "MMA8452Q"), 2); m->i2 = regDS("AZ", "MMA", SRC(b, "MMA8452Q"), 2); }
      break;
    }

    // LIS3MDL 자기장 (0x1C·0x1E)
    static const uint8_t AL3[] = { 0x1C, 0x1E };
    for (uint8_t a : AL3) {
      uint8_t who;
      if (!i2cHas(w, a) || moreAt(w, a) || !i2cRead(w, a, 0x0F, &who, 1) || who != 0x3D) continue;
      i2cWrite8(w, a, 0x20, 0x70); i2cWrite8(w, a, 0x21, 0x00); i2cWrite8(w, a, 0x22, 0x00); i2cWrite8(w, a, 0x23, 0x0C);   // ±4 G, 연속
      if ((m = addMore(w, a, K_LIS3MDL))) m->i0 = regDS("MAG", "L3M", SRC(b, "LIS3MDL"), 1);
      break;
    }

    // MAG3110 (0x0E)
    if (i2cHas(w, 0x0E) && !moreAt(w, 0x0E)) {
      uint8_t who;
      if (i2cRead(w, 0x0E, 0x07, &who, 1) && who == 0xC4) {
        i2cWrite8(w, 0x0E, 0x11, 0x80); i2cWrite8(w, 0x0E, 0x10, 0x01);   // 자동 리셋, 켜기
        if ((m = addMore(w, 0x0E, K_MAG3110))) m->i0 = regDS("MAG", "3110", SRC(b, "MAG3110"), 1);
      }
    }

    // BMM150 (0x10~0x13) — 켠 뒤 칩 번호 0x32
    for (uint8_t a = 0x10; a <= 0x13; a++) {
      if (!i2cHas(w, a) || moreAt(w, a)) continue;
      uint16_t vid;
      if (a == 0x10 && i2cRead16(w, a, 0x07, vid, true) && (vid & 0xFF) == 0x81) continue;   // VEML7700
      uint8_t id;
      i2cWrite8(w, a, 0x4B, 0x01); delay(4);
      if (!i2cRead(w, a, 0x40, &id, 1) || id != 0x32) continue;
      i2cWrite8(w, a, 0x4C, 0x00);   // 보통 모드 10 Hz
      if ((m = addMore(w, a, K_BMM))) m->i0 = regDS("MAG", "BMM", SRC(b, "BMM150"), 1);
      break;
    }

    // TMAG5273 3축 홀 (0x35 A1 · 0x22 B1 · 0x78 C1), 제조사 0x5449
    static const uint8_t AT[] = { 0x35, 0x22, 0x78 };
    for (uint8_t a : AT) {
      uint16_t mid; uint8_t did;
      if (!i2cHas(w, a) || moreAt(w, a) || !i2cRead16(w, a, 0x0E, mid, true) || mid != 0x5449 || !i2cRead(w, a, 0x0D, &did, 1)) continue;
      i2cWrite8(w, a, 0x02, 0x70); i2cWrite8(w, a, 0x03, 0x00); i2cWrite8(w, a, 0x01, 0x02);   // XYZ, 좁은 범위, 연속
      if ((m = addMore(w, a, K_TMAG))) { m->step = (did & 0x03) == 2 ? 1 : 0; m->i0 = regDS("MAG", "TMAG", SRC(b, "TMAG5273"), 1); }
      break;
    }

    // 0x39: AS7341 분광 / APDS9960 색
    if (i2cHas(w, 0x39) && !moreAt(w, 0x39)) {
      uint8_t id;
      if (i2cRead(w, 0x39, 0x92, &id, 1)) {
        if ((id & 0xFC) == 0x24) {
          i2cWrite8(w, 0x39, 0x80, 0x01);                                  // 켜기
          i2cWrite8(w, 0x39, 0x81, 29); i2cWrite8(w, 0x39, 0xCA, 0x57); i2cWrite8(w, 0x39, 0xCB, 0x02);   // 약 50 ms
          i2cWrite8(w, 0x39, 0xAA, 0x05);                                  // 이득 16배
          if (nds + 8 <= MAX_DS && (m = addMore(w, 0x39, K_AS7341))) {   // 8칸이 이어져야 함
            static const char* const N[] = { "S415", "S445", "S480", "S515", "S555", "S590", "S630", "S680" };
            m->i0 = regDS(N[0], "AS", SRC(b, "AS7341"), 0);
            for (uint8_t k = 1; k < 8; k++) regDS(N[k], "AS", SRC(b, "AS7341"), 0);   // i0 다음 7칸 (nds+8 <= MAX_DS 확인함)
          }
        } else if (id == 0xAB || id == 0x9C || id == 0xA8) {
          i2cWrite8(w, 0x39, 0x81, 0xDB); i2cWrite8(w, 0x39, 0x8F, 0x01); i2cWrite8(w, 0x39, 0x80, 0x03);   // 100 ms, 4배, 켜기
          if ((m = addMore(w, 0x39, K_APDS))) {
            m->i0 = regDS("COLR", "APDS", SRC(b, "APDS9960"), 1); m->i1 = regDS("COLG", "APDS", SRC(b, "APDS9960"), 1); m->i2 = regDS("COLB", "APDS", SRC(b, "APDS9960"), 1);
          }
        }
      }
    }

    // 0x53: LTR390 자외선 / LTR381 색 (ENS160·ADXL345가 아닐 때)
    if (i2cHas(w, 0x53) && !moreAt(w, 0x53)) {
      uint8_t pid;
      if (i2cRead(w, 0x53, 0x06, &pid, 1)) {
        if ((pid >> 4) == 0x0B) {
          i2cWrite8(w, 0x53, 0x04, 0x22); i2cWrite8(w, 0x53, 0x05, 0x04); i2cWrite8(w, 0x53, 0x00, 0x0A);   // 18비트 100 ms, 18배, UVS
          if ((m = addMore(w, 0x53, K_LTR390))) m->i0 = regDS("UVI", "LTR", SRC(b, "LTR390"), 2);
        } else if ((pid & 0xF0) == 0xC0) {
          uint8_t st; i2cRead(w, 0x53, 0x07, &st, 1);
          i2cWrite8(w, 0x53, 0x05, 0x01); i2cWrite8(w, 0x53, 0x04, 0x22); i2cWrite8(w, 0x53, 0x00, 0x06);   // 3배, 18비트 100 ms, RGB
          if ((m = addMore(w, 0x53, K_LTR381))) {
            m->i0 = regDS("COLR", "LTRC", SRC(b, "LTR381"), 1); m->i1 = regDS("COLG", "LTRC", SRC(b, "LTR381"), 1); m->i2 = regDS("COLB", "LTRC", SRC(b, "LTR381"), 1);
            m->cal[0] = regDS("LUX", "LTRC", SRC(b, "LTR381"), 0);
          }
        }
      }
    }

    // SGP40 VOC 원시값 (0x59): 일련번호 읽기로 확인
    if (i2cHas(w, 0x59) && !moreAt(w, 0x59) && cmd16(w, 0x59, 0x3682)) {
      delay(2);
      uint16_t sn[3];
      if (readWords(w, 0x59, sn, 3) && (m = addMore(w, 0x59, K_SGP40))) m->i0 = regDS("VOCR", tag, SRC(b, "SGP40"), 0);
    }

    // AM2320 온습도 (0x5C, 깨워야 응답)
    {
      float t, h;
      if (!moreAt(w, 0x5C) && !lpsAt(w, 0x5C) && am2320Read(w, t, h) && (m = addMore(w, 0x5C, K_AM2320))) {
        m->i0 = regDS("TA", "2320", SRC(b, "AM2320"), 1); m->i1 = regDS("RH", "2320", SRC(b, "AM2320"), 1);
        setDS(m->i0, t); setDS(m->i1, h);
      }
    }

    // HIH6130·HIH6120 온습도 (0x27)
    if (i2cHas(w, 0x27) && !moreAt(w, 0x27)) {
      w->beginTransmission(0x27); w->endTransmission();
      delay(45);
      uint8_t d[4];
      if (i2cReadRaw(w, 0x27, d, 4) && (d[0] >> 6) < 2) {
        float h = (((d[0] & 0x3F) << 8) | d[1]) / 16382.0f * 100.0f;
        float t = ((uint16_t)((d[2] << 8) | d[3]) >> 2) / 16382.0f * 165.0f - 40.0f;
        if (h >= 0 && h <= 100 && t > -40 && t < 100 && !(d[0] == 0xFF && d[1] == 0xFF) && (m = addMore(w, 0x27, K_HIH))) {
          m->i0 = regDS("TA", "HIH", SRC(b, "HIH6130"), 2); m->i1 = regDS("RH", "HIH", SRC(b, "HIH6130"), 1);
        }
      }
    }

    // BNO055 (0x28·0x29, 칩 번호 0xA0)
    static const uint8_t AB[] = { 0x28, 0x29 };
    for (uint8_t a : AB) {
      uint8_t id;
      if (!i2cHas(w, a) || moreAt(w, a) || !i2cRead(w, a, 0x00, &id, 1) || id != 0xA0) continue;
      i2cWrite8(w, a, 0x3D, 0x00); delay(25);
      i2cWrite8(w, a, 0x07, 0x00); i2cWrite8(w, a, 0x3E, 0x00); i2cWrite8(w, a, 0x3B, 0x00);   // m/s², 도
      i2cWrite8(w, a, 0x3D, 0x0C); delay(25);                                                    // NDOF
      if ((m = addMore(w, a, K_BNO))) {
        m->i0 = regDS("AX", "BNO", SRC(b, "BNO055"), 2); m->i1 = regDS("AY", "BNO", SRC(b, "BNO055"), 2); m->i2 = regDS("AZ", "BNO", SRC(b, "BNO055"), 2);
        m->cal[0] = regDS("ANG", "BNO", SRC(b, "BNO055"), 1);
      }
      break;
    }

    // 0x29 레이저 거리: VL6180X → VL53L1X/VL53L4CD (TCS34725·TSL2591이 아닐 때)
    if (i2cHas(w, 0x29) && !moreAt(w, 0x29) && !(hasTcs && tcs.w == w)) {
      uint8_t mid[2];
      if (rd16a(w, 0x29, 0x0000, mid, 1) && mid[0] == 0xB4) {
        uint8_t fresh = 0;
        rd16a(w, 0x29, 0x0016, &fresh, 1);
        if (fresh & 1) {
          for (uint8_t i = 0; i < sizeof(V6_VAL); i++) wr16a(w, 0x29, pgm_read_word(&V6_REG[i]), pgm_read_byte(&V6_VAL[i]));
          wr16a(w, 0x29, 0x0016, 0x00);
        } else {   // 이미 연속 측정 중이면 먼저 멈춤 (1을 쓰면 멈춤)
          wr16a(w, 0x29, 0x0018, 0x01); delay(50); wr16a(w, 0x29, 0x0015, 0x07);
        }
        wr16a(w, 0x29, 0x0018, 0x03);   // 연속 측정
        if ((m = addMore(w, 0x29, K_VL6180))) m->i0 = regDS("DIST", "V618", SRC(b, "VL6180X"), 1);
      } else if (rd16a(w, 0x29, 0x010F, mid, 2) && ((mid[0] == 0xEA && mid[1] == 0xCC) || (mid[0] == 0xEB && mid[1] == 0xAA))) {
        bool l4 = mid[0] == 0xEB;
        unsigned long t0 = millis();
        uint8_t st = 0;
        while (millis() - t0 < 500) { if (rd16a(w, 0x29, 0x00E5, &st, 1) && (st & 0x01)) break; delay(2); }
        const uint8_t* cfg = l4 ? L4CD_CFG : L1X_CFG;
        for (uint8_t i = 0; i < 91; i++) wr16a(w, 0x29, 0x2D + i, pgm_read_byte(&cfg[i]));
        wr16a(w, 0x29, 0x0086, 0x01); wr16a(w, 0x29, 0x0087, 0x40);   // 첫 측정 (VHV)
        t0 = millis();
        while (millis() - t0 < 500 && !vlL1Ready(w)) delay(2);
        wr16a(w, 0x29, 0x0086, 0x01); wr16a(w, 0x29, 0x0087, 0x00);
        wr16a(w, 0x29, 0x0008, 0x09); wr16a(w, 0x29, 0x000B, 0x00);
        if (l4) { wr16a(w, 0x29, 0x0024, 0x05); wr16a(w, 0x29, 0x0025, 0x00); }
        wr16a(w, 0x29, 0x0086, 0x01); wr16a(w, 0x29, 0x0087, 0x40);   // 연속(자동) 측정
        if ((m = addMore(w, 0x29, K_VL53L1))) m->i0 = regDS("DIST", l4 ? "L4CD" : "L1X", l4 ? SRC(b, "VL53L4CD") : SRC(b, "VL53L1X"), 1);
      }
    }
  }
}

// NAU7802 로드셀 (0x2A): HX711이 없을 때 무게(M) 칸으로 — detectHx 다음에 부름
void detectNau() {
  nauSlot = -1;
#if MID_SENSORS
  if (hxIdx >= 0) return;
  for (uint8_t b = 0; b < NBUS; b++) {
    TwoWire* w = buses[b].w;
    uint8_t rev, pu = 0;
    if (!i2cHas(w, 0x2A) || moreAt(w, 0x2A) || !i2cRead(w, 0x2A, 0x1F, &rev, 1) || (rev & 0x0F) != 0x0F) continue;
    i2cWrite8(w, 0x2A, 0x00, 0x01); delay(10);   // 초기화
    i2cWrite8(w, 0x2A, 0x00, 0x02); delay(2);    // 디지털 켜기
    if (!i2cRead(w, 0x2A, 0x00, &pu, 1) || !(pu & 0x08)) continue;
    i2cWrite8(w, 0x2A, 0x00, 0x86);              // 내부 LDO, 아날로그·디지털 켜기
    i2cWrite8(w, 0x2A, 0x01, 0x2F);              // LDO 3.0 V, 이득 128
    i2cWrite8(w, 0x2A, 0x02, 0x00);              // 10 SPS
    uint8_t r;
    if (i2cRead(w, 0x2A, 0x15, &r, 1)) i2cWrite8(w, 0x2A, 0x15, r | 0x30);    // 쵸퍼 끄기
    if (i2cRead(w, 0x2A, 0x1B, &r, 1)) i2cWrite8(w, 0x2A, 0x1B, r & ~0x40);
    i2cWrite8(w, 0x2A, 0x00, 0x96);              // 변환 시작
    More* m = addMore(w, 0x2A, K_NAU);
    if (!m) return;
    nauSlot = nMore - 1;
    hxNau = true;
    hxIdx = regDS("M", "NAU", SRC(b, "NAU7802"), 2);
    hxAvg = NAN;
    if (hxIdx < 0) { hxNau = false; nMore--; return; }   // 칸이 다 찼으면 포기
    dsx[hxIdx].cal = settings.massCalValid;
    m->i0 = hxIdx;
    return;
  }
#endif
}

// ---------- 읽기 ----------
void pollExtra(uint8_t i) {
  More& m = more[i];
  unsigned long now = millis();
  switch (m.kind) {
    case K_TMP117: {
      if (now - m.last < 250) break; m.last = now;
      uint16_t v; if (i2cRead16(m.w, m.addr, 0x00, v, false) && v != 0x8000) setDS(m.i0, (int16_t)v * 0.0078125f);
      break;
    }
    case K_TMP102: {
      if (now - m.last < 250) break; m.last = now;
      uint16_t v; if (i2cRead16(m.w, m.addr, 0x00, v, false)) setDS(m.i0, ((int16_t)v >> 4) * 0.0625f);
      break;
    }
    case K_ADS: {   // A0−A1 차동, ±4.096 V, 128 SPS, 한 번씩
      if (m.step == 0) { if (now - m.last < 100) break; if (i2cWrite16(m.w, m.addr, 0x01, 0x8383, false)) { m.step = 1; m.last = now; } }
      else if (now - m.last >= 10) {
        uint16_t v; if (i2cRead16(m.w, m.addr, 0x00, v, false)) setDS(m.i0, (int16_t)v * 4.096f / 32768.0f);
        m.step = 0;
      }
      break;
    }
    case K_DPS: {
      if (now - m.last < 200) break; m.last = now;
      uint8_t d[6];
      if (!i2cRead(m.w, m.addr, 0x00, d, 6)) break;
      float sp = twos(((uint32_t)d[0] << 16) | ((uint32_t)d[1] << 8) | d[2], 24) / 7864320.0f;
      float st = twos(((uint32_t)d[3] << 16) | ((uint32_t)d[4] << 8) | d[5], 24) / 7864320.0f;
      setDS(m.i0, st * dps.c1 + dps.c0 / 2.0f);
      float p = dps.c00 + sp * (dps.c10 + sp * (dps.c20 + sp * dps.c30)) + st * (dps.c01 + sp * (dps.c11 + sp * dps.c21));
      setDS(m.i1, p / 1000.0f);   // kPa
      break;
    }
    case K_BMP3: {
      if (now - m.last < 200) break; m.last = now;
      uint8_t d[6];
      if (!i2cRead(m.w, m.addr, 0x04, d, 6)) break;
      float up = (float)(((uint32_t)d[2] << 16) | ((uint32_t)d[1] << 8) | d[0]);
      float ut = (float)(((uint32_t)d[5] << 16) | ((uint32_t)d[4] << 8) | d[3]);
      float pd1 = ut - b3.t1, t = pd1 * b3.t2 + pd1 * pd1 * b3.t3;
      float o1 = b3.p5 + b3.p6 * t + b3.p7 * t * t + b3.p8 * t * t * t;
      float o2 = up * (b3.p1 + b3.p2 * t + b3.p3 * t * t + b3.p4 * t * t * t);
      float o3 = up * up * (b3.p9 + b3.p10 * t) + up * up * up * b3.p11;
      setDS(m.i0, t); setDS(m.i1, (o1 + o2 + o3) / 1000.0f);
      break;
    }
    case K_MS56: {   // D1(기압) → D2(온도), 각각 4096배 과표본 9 ms
      uint32_t d1 = (uint32_t)m.tmp;   // 센서마다 따로
      if (m.step == 0) { if (now - m.last < 500) break; if (i2cCmd8(m.w, m.addr, 0x48)) { m.step = 1; m.last = now; } }
      else if (m.step == 1 && now - m.last >= 10) {
        if (!ms56Adc(m.w, m.addr, d1)) { m.step = 0; break; }
        m.tmp = (long)d1;
        if (i2cCmd8(m.w, m.addr, 0x58)) { m.step = 2; m.last = now; } else m.step = 0;
      } else if (m.step == 2 && now - m.last >= 10) {
        uint32_t d2; m.step = 0;
        if (!ms56Adc(m.w, m.addr, d2)) break;
        float C1 = (uint16_t)m.cal[0], C2 = (uint16_t)m.cal[1], C3 = (uint16_t)m.cal[2], C4 = (uint16_t)m.cal[3], C5 = (uint16_t)m.cal[4], C6 = (uint16_t)m.cal[5];
        float dT = (float)d2 - C5 * 256.0f;
        float temp = 2000.0f + dT * C6 / 8388608.0f;
        float off = C2 * 65536.0f + C4 * dT / 128.0f;
        float sens = C1 * 32768.0f + C3 * dT / 256.0f;
        if (temp < 2000) {   // 2차 보정
          float t2 = dT * dT / 2147483648.0f, o2 = 2.5f * (temp - 2000) * (temp - 2000), s2 = 1.25f * (temp - 2000) * (temp - 2000);
          temp -= t2; off -= o2; sens -= s2;
        }
        float p = ((float)d1 * sens / 2097152.0f - off) / 32768.0f;   // 0.01 hPa
        setDS(m.i0, temp / 100.0f); setDS(m.i1, p / 1000.0f);
      }
      break;
    }
    case K_MPL: {
      if (now - m.last < 600) break; m.last = now;
      uint8_t d[5];
      if (!i2cReadRS(m.w, m.addr, 0x01, d, 5)) break;
      setDS(m.i1, (((uint32_t)d[0] << 16) | ((uint32_t)d[1] << 8) | d[2]) / 64000.0f);
      setDS(m.i0, (int8_t)d[3] + (d[4] >> 4) / 16.0f);
      break;
    }
    case K_SI1145: {
      if (now - m.last < 200) break; m.last = now;
      uint16_t v; if (i2cRead16(m.w, m.addr, 0x2C, v, true)) setDS(m.i0, v / 100.0f);
      break;
    }
    case K_MCP9600: {
      if (now - m.last < 250) break; m.last = now;
      uint16_t v; if (i2cRead16(m.w, m.addr, 0x00, v, false)) setDS(m.i0, (int16_t)v * 0.0625f);
      break;
    }
    case K_AS5600: {
      if (now - m.last < 50) break; m.last = now;
      uint16_t v; if (i2cRead16(m.w, m.addr, 0x0E, v, false)) setDS(m.i0, (v & 0x0FFF) * 360.0f / 4096.0f);
      break;
    }
    case K_ICM: {
      if (now - m.last < 50) break; m.last = now;
      uint8_t d[6];
      if (!i2cRead(m.w, m.addr, 0x2D, d, 6)) break;
      float s = m.step ? 8192.0f : 16384.0f;
      for (uint8_t k = 0; k < 3; k++) setDS(k == 0 ? m.i0 : k == 1 ? m.i1 : m.i2, (int16_t)((d[2 * k] << 8) | d[2 * k + 1]) / s * 9.80665f);
      break;
    }
    case K_MMA: {
      if (now - m.last < 50) break; m.last = now;
      uint8_t d[6];
      if (!i2cRead(m.w, m.addr, 0x01, d, 6)) break;
      for (uint8_t k = 0; k < 3; k++) setDS(k == 0 ? m.i0 : k == 1 ? m.i1 : m.i2, (int16_t)((d[2 * k] << 8) | d[2 * k + 1]) / 16384.0f * 9.80665f);
      break;
    }
    case K_BNO: {
      if (now - m.last < 50) break; m.last = now;
      uint8_t d[6];
      if (i2cRead(m.w, m.addr, 0x08, d, 6))
        for (uint8_t k = 0; k < 3; k++) setDS(k == 0 ? m.i0 : k == 1 ? m.i1 : m.i2, (int16_t)(d[2 * k] | (d[2 * k + 1] << 8)) / 100.0f);
      if (i2cRead(m.w, m.addr, 0x1A, d, 2)) setDS(m.cal[0], (int16_t)(d[0] | (d[1] << 8)) / 16.0f);
      break;
    }
    case K_LIS3MDL: case K_MAG3110: case K_BMM: case K_TMAG: {
      if (now - m.last < 100) break; m.last = now;
      uint8_t d[6];
      float x, y, z;
      if (m.kind == K_LIS3MDL) {
        if (!i2cRead(m.w, m.addr, 0x28 | 0x80, d, 6)) break;
        x = (int16_t)(d[0] | (d[1] << 8)); y = (int16_t)(d[2] | (d[3] << 8)); z = (int16_t)(d[4] | (d[5] << 8));
        x *= 100.0f / 6842; y *= 100.0f / 6842; z *= 100.0f / 6842;          // ±4 G → µT
      } else if (m.kind == K_MAG3110) {
        if (!i2cRead(m.w, m.addr, 0x01, d, 6)) break;
        x = (int16_t)((d[0] << 8) | d[1]) * 0.1f; y = (int16_t)((d[2] << 8) | d[3]) * 0.1f; z = (int16_t)((d[4] << 8) | d[5]) * 0.1f;
      } else if (m.kind == K_BMM) {   // 공장 보정 없이 근삿값 (약 0.3 µT/LSB)
        if (!i2cRead(m.w, m.addr, 0x42, d, 6)) break;
        x = ((int16_t)((d[1] << 8) | d[0]) >> 3) * 0.3f; y = ((int16_t)((d[3] << 8) | d[2]) >> 3) * 0.3f; z = ((int16_t)((d[5] << 8) | d[4]) >> 1) * 0.3f;
      } else {   // TMAG5273: mT = 원시값 × 범위 / 32768
        if (!i2cRead(m.w, m.addr, 0x12, d, 6)) break;
        float r = (m.step ? 133.0f : 40.0f) * 1000.0f / 32768.0f;          // µT/LSB
        x = (int16_t)((d[0] << 8) | d[1]) * r; y = (int16_t)((d[2] << 8) | d[3]) * r; z = (int16_t)((d[4] << 8) | d[5]) * r;
      }
      setDS(m.i0, sqrt(x * x + y * y + z * z));
      break;
    }
    case K_AS7341: {   // 낮은 4채널 → 높은 4채널 번갈아
      if (m.step == 0 || m.step == 2) {
        if (m.step == 0 && now - m.last < 300) break;
        const uint8_t* cfg = m.step == 0 ? AS_LO : AS_HI;
        i2cWrite8(m.w, 0x39, 0x80, 0x01);                       // 측정 멈춤
        i2cWrite8(m.w, 0x39, 0xAF, 0x10);                       // SMUX 쓰기 명령
        for (uint8_t k = 0; k < 20; k++) i2cWrite8(m.w, 0x39, k, pgm_read_byte(&cfg[k]));
        i2cWrite8(m.w, 0x39, 0x80, 0x11);                       // SMUX 적용
        uint8_t e = 0x10; unsigned long t0 = millis();
        while ((e & 0x10) && millis() - t0 < 20) i2cRead(m.w, 0x39, 0x80, &e, 1);
        i2cWrite8(m.w, 0x39, 0x80, 0x03);                       // 측정 시작
        m.step++; m.last = now;
      } else {
        uint8_t s2;
        if (!i2cRead(m.w, 0x39, 0xA3, &s2, 1) || !(s2 & 0x40)) { if (now - m.last > 500) m.step = 0; break; }
        uint8_t d[8];
        if (i2cRead(m.w, 0x39, 0x95, d, 8)) {
          int8_t base = m.i0 + (m.step == 1 ? 0 : 4);
          for (uint8_t k = 0; k < 4; k++) setDS(base + k, (uint16_t)(d[2 * k] | (d[2 * k + 1] << 8)));
        }
        m.step = m.step == 1 ? 2 : 0;
        if (m.step == 0) m.last = now;
      }
      break;
    }
    case K_APDS: {
      if (now - m.last < 250) break; m.last = now;
      uint8_t d[8];
      if (!i2cRead(m.w, 0x39, 0x94, d, 8)) break;
      float c = (uint16_t)(d[0] | (d[1] << 8));
      if (c < 1) c = 1;
      setDS(m.i0, 100.0f * (uint16_t)(d[2] | (d[3] << 8)) / c); setDS(m.i1, 100.0f * (uint16_t)(d[4] | (d[5] << 8)) / c); setDS(m.i2, 100.0f * (uint16_t)(d[6] | (d[7] << 8)) / c);
      break;
    }
    case K_LTR390: {
      if (now - m.last < 250) break; m.last = now;
      uint8_t d[3];
      if (i2cRead(m.w, 0x53, 0x10, d, 3)) setDS(m.i0, (((uint32_t)(d[2] & 0x0F) << 16) | ((uint32_t)d[1] << 8) | d[0]) / 575.0f);   // 18배·18비트 기준 감도
      break;
    }
    case K_LTR381: {
      if (now - m.last < 250) break; m.last = now;
      uint8_t d[12];   // IR(0x0A) G R B
      if (!i2cRead(m.w, 0x53, 0x0A, d, 12)) break;
      float ir = ((uint32_t)(d[2] & 0x0F) << 16) | ((uint32_t)d[1] << 8) | d[0];
      float g = ((uint32_t)(d[5] & 0x0F) << 16) | ((uint32_t)d[4] << 8) | d[3];
      float r = ((uint32_t)(d[8] & 0x0F) << 16) | ((uint32_t)d[7] << 8) | d[6];
      float bl = ((uint32_t)(d[11] & 0x0F) << 16) | ((uint32_t)d[10] << 8) | d[9];
      float s = r + g + bl; if (s < 1) s = 1;
      setDS(m.i0, 100.0f * r / s); setDS(m.i1, 100.0f * g / s); setDS(m.i2, 100.0f * bl / s);
      if (g > 0) setDS(m.cal[0], max(0.0f, 0.8f * g / 3.0f * (1.0f - 0.033f * ir / g)));
      break;
    }
    case K_SGP40: {   // 원시값 측정 (습도 50 %, 25 °C 기본)
      if (m.step == 0) {
        if (now - m.last < 1000) break;
        static const uint8_t c[8] = { 0x26, 0x0F, 0x80, 0x00, 0xA2, 0x66, 0x66, 0x93 };
        m.w->beginTransmission(m.addr); m.w->write(c, 8);
        if (m.w->endTransmission() == 0) { m.step = 1; m.last = now; }
      } else if (now - m.last >= 35) {
        uint16_t v; if (readWords(m.w, m.addr, &v, 1)) setDS(m.i0, v);
        m.step = 0;
      }
      break;
    }
    case K_AM2320: {
      if (now - m.last < 2000) break; m.last = now;
      float t, h; if (am2320Read(m.w, t, h)) { setDS(m.i0, t); setDS(m.i1, h); }
      break;
    }
    case K_HIH: {
      if (m.step == 0) { if (now - m.last < 1000) break; m.w->beginTransmission(0x27); m.w->endTransmission(); m.step = 1; m.last = now; }
      else if (now - m.last >= 45) {
        uint8_t d[4]; m.step = 0;
        if (!i2cReadRaw(m.w, 0x27, d, 4) || (d[0] >> 6) > 1) break;
        setDS(m.i1, (((d[0] & 0x3F) << 8) | d[1]) / 16382.0f * 100.0f);
        setDS(m.i0, ((uint16_t)((d[2] << 8) | d[3]) >> 2) / 16382.0f * 165.0f - 40.0f);
      }
      break;
    }
    case K_VL6180: {
      uint8_t st;
      if (!rd16a(m.w, 0x29, 0x004F, &st, 1) || !(st & 0x04)) break;
      uint8_t mm, rs;
      if (rd16a(m.w, 0x29, 0x004D, &rs, 1) && rd16a(m.w, 0x29, 0x0062, &mm, 1)) setDS(m.i0, (rs >> 4) ? NAN : mm / 10.0f);   // 상태 오류면 비움
      wr16a(m.w, 0x29, 0x0015, 0x07);
      break;
    }
    case K_VL53L1: {
      if (now - m.last < 30 || !vlL1Ready(m.w)) break; m.last = now;
      uint8_t d[2], rs;
      if (rd16a(m.w, 0x29, 0x0089, &rs, 1) && rd16a(m.w, 0x29, 0x0096, d, 2)) {
        rs &= 0x1F;
        setDS(m.i0, rs == 9 ? ((d[0] << 8) | d[1]) / 10.0f : NAN);   // 9 = 정상 측정
      }
      wr16a(m.w, 0x29, 0x0086, 0x01);
      break;
    }
    case K_NAU: {
#if MID_SENSORS
      uint8_t pu, d[3];
      if (!i2cRead(m.w, 0x2A, 0x00, &pu, 1) || !(pu & 0x20)) break;   // 새 값
      if (!i2cRead(m.w, 0x2A, 0x12, d, 3)) break;
      long r = twos(((uint32_t)d[0] << 16) | ((uint32_t)d[1] << 8) | d[2], 24);
      hxRaw = r;
      hxAvg = isnan(hxAvg) ? r : hxAvg * 0.7f + r * 0.3f;
      setDS(hxIdx, massFromRaw(hxAvg));
#endif
      break;
    }
    default: break;
  }
}

#endif
