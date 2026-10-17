// =====================================================================
// 추가 센서 (펌웨어 0.4.0) — 국내에서 흔히 파는 I2C·UART 모듈
// 모두 꽂으면 자동 인식(HELLO). FULL_SENSORS 보드(UNO R4·Nano R4·Mega)에서만.
//
//  I2C   BH1750(0x23·0x5C) 조도 · VEML7700(0x10) 조도 · AHT10/20(0x38) 온습도
//        HTU21D·SHT21·Si7021(0x40) 온습도 · SHT40/41(0x44·0x45) 온습도 · BMP180(0x77) 기압
//        MLX90614(0x5A) 비접촉 온도 · MCP9808(0x18~0x1F) 정밀 온도 · INA219(0x40·0x41·0x44·0x45) 전압·전류
//        MPU6050(0x68·0x69)·ADXL345(0x53·0x1D) 가속도 · QMC5883L(0x0D)·HMC5883L(0x1E) 지자기
//        SGP30(0x58)·CCS811(0x5A·0x5B) 공기질(eCO2·TVOC) · MAX30102(0x57) 맥박 파형
//        SCD30(0x61) CO2 · ENS160(0x52·0x53) 공기질 · DFRobot SEN0322(0x70~) 산소 · TSL2591(0x29) 조도
//        LIS3DH(0x18·0x19)·LSM6DS(0x6A·0x6B) 가속도 · INA260 전압·전류
//        VL53L0X(0x29) 레이저 거리 (Pololu VL53L0X 라이브러리가 있을 때)
//  UART  Serial1(R4: D0·D1, Mega: 19·18)  PMS5003/7003 미세먼지 · MH-Z19B 이산화탄소
// =====================================================================
#if FULL_SENSORS

#if __has_include(<VL53L0X.h>)
#include <VL53L0X.h>
#define HAS_VL53 1
#else
#define HAS_VL53 0
#endif

// ---------- 공통 ----------
bool i2cRead16(TwoWire* w, uint8_t a, uint8_t reg, uint16_t& v, bool le) {
  uint8_t d[2];
  if (!i2cRead(w, a, reg, d, 2)) return false;
  v = le ? (d[0] | (d[1] << 8)) : ((d[0] << 8) | d[1]);
  return true;
}
bool i2cWrite16(TwoWire* w, uint8_t a, uint8_t reg, uint16_t v, bool le) {
  w->beginTransmission(a); w->write(reg);
  if (le) { w->write(v & 0xFF); w->write(v >> 8); } else { w->write(v >> 8); w->write(v & 0xFF); }
  return w->endTransmission() == 0;
}
bool i2cCmd8(TwoWire* w, uint8_t a, uint8_t c) {
  w->beginTransmission(a); w->write(c);
  return w->endTransmission() == 0;
}
bool i2cReadRaw(TwoWire* w, uint8_t a, uint8_t* d, uint8_t n) {
  if (w->requestFrom(a, n) != n) return false;
  for (uint8_t i = 0; i < n; i++) d[i] = w->read();
  return true;
}
#define SRC(b, chip) ((HAS_QWIIC && (b) == 0) ? "qwiic:" chip : "i2c:" chip)

// 이미 다른 드라이버가 쓰는 주소인지 (SHT3x/HS3003, BME/BMP280, LPS22, TCS34725)
bool thermoAt(TwoWire* w, uint8_t a) { for (uint8_t i = 0; i < nThermo; i++) if (thermo[i].w == w && thermo[i].addr == a) return true; return false; }
bool bmeAt(TwoWire* w, uint8_t a) { for (uint8_t i = 0; i < nBme; i++) if (bme[i].w == w && bme[i].addr == a) return true; return false; }
bool lpsAt(TwoWire* w, uint8_t a) { for (uint8_t i = 0; i < nLps; i++) if (lps[i].w == w && lps[i].addr == a) return true; return false; }

// ---------- 일반 I2C 센서 칸 ----------
enum Kind : uint8_t { K_BH1750, K_VEML, K_AHT, K_HTU, K_SHT4, K_BMP180, K_MLX, K_MCP, K_INA, K_MPU, K_ADXL, K_QMC, K_HMC, K_SGP, K_CCS, K_MAX,
                     K_SCD30, K_ENS, K_O2, K_TSL, K_LIS, K_LSM, K_INA260,
                     // sensors_more2.ino (0.5.0)
                     K_TMP117, K_TMP102, K_ADS, K_BMP3, K_DPS, K_MS56, K_MPL, K_SI1145, K_MCP9600, K_AS5600, K_ICM, K_MMA, K_BNO,
                     K_LIS3MDL, K_MAG3110, K_BMM, K_TMAG, K_AS7341, K_APDS, K_LTR390, K_LTR381, K_SGP40, K_AM2320, K_HIH,
                     K_VL6180, K_VL53L1, K_NAU };
struct More {
  TwoWire* w; uint8_t addr; Kind kind; uint8_t step;
  int8_t i0, i1, i2; unsigned long last;
  int16_t cal[11];   // BMP180 보정값 (AC1..MD)
  uint16_t ucal[3];  // BMP180 AC4..AC6
};
const uint8_t MAX_MORE = 16;
More more[MAX_MORE];
uint8_t nMore = 0;

int8_t addMoreIdx(TwoWire* w, uint8_t a, uint8_t k) {
  if (nMore >= MAX_MORE) return -1;
  More& m = more[nMore];
  m.w = w; m.addr = a; m.kind = (Kind)k; m.step = 0; m.i0 = m.i1 = m.i2 = -1; m.last = 0;
  return nMore++;
}
#define addMore(w, a, k) (addMoreIdx(w, a, k) >= 0 ? &more[nMore - 1] : (More*)0)

void detectMore() {
  nMore = 0;
  for (uint8_t b = 0; b < NBUS; b++) {
    TwoWire* w = buses[b].w;
    const char* tag = buses[b].tag;
    More* m;

    // 조도: BH1750
    static const uint8_t A1[] = { 0x23, 0x5C };
    for (uint8_t a : A1) {
      if (!i2cHas(w, a) || lpsAt(w, a)) continue;
      if (a == 0x5C) { uint8_t who; if (i2cRead(w, a, 0x0F, &who, 1) && (who == 0xB1 || who == 0xB3)) continue; }
      if (a == 0x5C) { float t, h; if (am2320Read(w, t, h)) continue; }   // AM2320 (sensors_more2.ino)
      if (!i2cCmd8(w, a, 0x01) || !i2cCmd8(w, a, 0x10)) continue;   // 켜기, 연속 고해상도
      if ((m = addMore(w, a, K_BH1750))) m->i0 = regDS("LUX", tag, SRC(b, "BH1750"), 0);
    }
    // 조도: VEML7700
    if (i2cHas(w, 0x10)) {
      uint16_t id;
      if (i2cRead16(w, 0x10, 0x07, id, true) && (id & 0xFF) == 0x81) {
        i2cWrite16(w, 0x10, 0x00, 0x0000, true);   // 이득 1, 100 ms, 켜기
        if ((m = addMore(w, 0x10, K_VEML))) m->i0 = regDS("LUX", "VEML", SRC(b, "VEML7700"), 1);
      }
    }
    // 온습도: AHT10/AHT20
    if (i2cHas(w, 0x38)) {
      uint8_t st;
      if (i2cReadRaw(w, 0x38, &st, 1)) {
        if (!(st & 0x08)) { w->beginTransmission(0x38); w->write(0xBE); w->write(0x08); w->write(0x00); w->endTransmission(); delay(10); }
        if ((m = addMore(w, 0x38, K_AHT))) { m->i0 = regDS("TA", "AHT", SRC(b, "AHT20"), 2); m->i1 = regDS("RH", "AHT", SRC(b, "AHT20"), 1); }
      }
    }
    // 전압·전류: INA219 (0x40·0x41·0x44·0x45) — 켰을 때 설정 레지스터 기본값 0x399F로 확인
    static const uint8_t A2[] = { 0x40, 0x41, 0x44, 0x45 };
    for (uint8_t a : A2) {
      if (!i2cHas(w, a) || thermoAt(w, a)) continue;
      uint16_t cfg, mid;
      if (i2cRead16(w, a, 0xFE, mid, false) && mid == 0x5449) {   // INA260 (TI)
        if ((m = addMore(w, a, K_INA260))) { m->i0 = regDS("VDC", "260", SRC(b, "INA260"), 3); m->i1 = regDS("IDC", "260", SRC(b, "INA260"), 1); }
        continue;
      }
      if (!i2cRead16(w, a, 0x00, cfg, false) || cfg != 0x399F) continue;
      if ((m = addMore(w, a, K_INA))) { m->i0 = regDS("VDC", tag, SRC(b, "INA219"), 3); m->i1 = regDS("IDC", tag, SRC(b, "INA219"), 1); }
    }
    // 온습도: HTU21D · SHT21 · Si7021 (0x40, INA219가 아니면)
    if (i2cHas(w, 0x40) && !(nMore && more[nMore - 1].kind == K_INA && more[nMore - 1].addr == 0x40 && more[nMore - 1].w == w)) {
      uint8_t ur;
      w->beginTransmission(0x40); w->write(0xE7);
      if (w->endTransmission() == 0 && i2cReadRaw(w, 0x40, &ur, 1) && (ur == 0x02 || ur == 0x3A || ur == 0x3B)) {
        if ((m = addMore(w, 0x40, K_HTU))) { m->i0 = regDS("TA", "HTU", SRC(b, "HTU21D"), 2); m->i1 = regDS("RH", "HTU", SRC(b, "HTU21D"), 1); }
      }
    }
    // 온습도: SHT40/41 (SHT3x로 인식되지 않은 0x44·0x45)
    static const uint8_t A3[] = { 0x44, 0x45 };
    for (uint8_t a : A3) {
      if (!i2cHas(w, a) || thermoAt(w, a)) continue;
      bool ina = false;
      for (uint8_t i = 0; i < nMore; i++) if (more[i].w == w && more[i].addr == a) ina = true;
      if (ina || !i2cCmd8(w, a, 0xFD)) continue;
      delay(10);
      uint16_t v[2];
      if (!readWords(w, a, v, 2)) continue;
      if ((m = addMore(w, a, K_SHT4))) { m->i0 = regDS("TA", "SHT4", SRC(b, "SHT4x"), 2); m->i1 = regDS("RH", "SHT4", SRC(b, "SHT4x"), 1); }
    }
    // 기압: BMP180 (0x77, 칩 번호 0x55)
    if (i2cHas(w, 0x77) && !bmeAt(w, 0x77)) {
      uint8_t id, c[22];
      if (i2cRead(w, 0x77, 0xD0, &id, 1) && id == 0x55 && i2cRead(w, 0x77, 0xAA, c, 22) && (m = addMore(w, 0x77, K_BMP180))) {
        for (uint8_t i = 0; i < 11; i++) {
          uint16_t v = (c[2 * i] << 8) | c[2 * i + 1];
          if (i >= 3 && i <= 5) m->ucal[i - 3] = v; else m->cal[i] = (int16_t)v;
        }
        m->i0 = regDS("TA", "B180", SRC(b, "BMP180"), 2); m->i1 = regDS("BP", "B180", SRC(b, "BMP180"), 2);
      }
    }
    // 공기질: CCS811 (0x5A·0x5B, HW_ID 0x81) — MLX90614보다 먼저 확인
    static const uint8_t A4[] = { 0x5A, 0x5B };
    for (uint8_t a : A4) {
      uint8_t id;
      if (!i2cHas(w, a) || !i2cRead(w, a, 0x20, &id, 1) || id != 0x81) continue;
      i2cCmd8(w, a, 0xF4); delay(20);                 // 앱 시작
      i2cWrite8(w, a, 0x01, 0x10);                   // 1초마다 측정
      if ((m = addMore(w, a, K_CCS))) { m->i0 = regDS("ECO2", tag, SRC(b, "CCS811"), 0); m->i1 = regDS("TVOC", tag, SRC(b, "CCS811"), 0); }
    }
    // 비접촉 온도: MLX90614 (0x5A)
    if (i2cHas(w, 0x5A)) {
      bool ccs = false;
      for (uint8_t i = 0; i < nMore; i++) if (more[i].w == w && more[i].addr == 0x5A) ccs = true;
      uint8_t d[3];
      if (!ccs && i2cRead(w, 0x5A, 0x06, d, 3)) {
        float ta = (d[0] | (d[1] << 8)) * 0.02f - 273.15f;
        if (ta > -40 && ta < 125 && (m = addMore(w, 0x5A, K_MLX))) {
          m->i0 = regDS("TIR", tag, SRC(b, "MLX90614"), 2); m->i1 = regDS("TA", "MLX", SRC(b, "MLX90614"), 2);
        }
      }
    }
    // 정밀 온도: MCP9808 (0x18~0x1F, 제조사 0x0054)
    for (uint8_t a = 0x18; a <= 0x1F; a++) {
      uint16_t mid;
      if (!i2cHas(w, a) || !i2cRead16(w, a, 0x06, mid, false) || mid != 0x0054) continue;
      if ((m = addMore(w, a, K_MCP))) m->i0 = regDS("T", "MCP", SRC(b, "MCP9808"), 3);
      break;
    }
    // 가속도: MPU6050 (0x68·0x69)
    static const uint8_t A5[] = { 0x68, 0x69 };
    for (uint8_t a : A5) {
      uint8_t who;
      if (!i2cHas(w, a) || !i2cRead(w, a, 0x75, &who, 1) || (who != 0x68 && who != 0x70 && who != 0x71 && who != 0x73 && who != 0x98)) continue;
      i2cWrite8(w, a, 0x6B, 0x00);   // 깨우기
      i2cWrite8(w, a, 0x1C, 0x00);   // ±2 g
      if ((m = addMore(w, a, K_MPU))) {
        m->i0 = regDS("AX", tag, SRC(b, "MPU6050"), 2); m->i1 = regDS("AY", tag, SRC(b, "MPU6050"), 2); m->i2 = regDS("AZ", tag, SRC(b, "MPU6050"), 2);
      }
      break;
    }
    // 가속도: ADXL345 (0x53·0x1D, DEVID 0xE5)
    static const uint8_t A6[] = { 0x53, 0x1D };
    for (uint8_t a : A6) {
      uint8_t id;
      if (!i2cHas(w, a) || !i2cRead(w, a, 0x00, &id, 1) || (id != 0xE5 && id != 0xAD)) continue;   // ADXL345·343 / ADXL313
      i2cWrite8(w, a, 0x31, id == 0xAD ? 0x0B : 0x08);   // 전체 해상도 (313: ±4 g, 1024/g)
      i2cWrite8(w, a, 0x2C, 0x0A);   // 100 Hz
      i2cWrite8(w, a, 0x2D, 0x08);   // 측정
      if ((m = addMore(w, a, K_ADXL))) {
        m->step = id == 0xAD;
        m->i0 = regDS("AX", "ADXL", SRC(b, "ADXL345"), 2); m->i1 = regDS("AY", "ADXL", SRC(b, "ADXL345"), 2); m->i2 = regDS("AZ", "ADXL", SRC(b, "ADXL345"), 2);
      }
      break;
    }
    // 지자기: QMC5883L (0x0D, 칩 번호 0xFF)
    if (i2cHas(w, 0x0D)) {
      uint8_t id;
      if (i2cRead(w, 0x0D, 0x0D, &id, 1) && id == 0xFF) {
        i2cWrite8(w, 0x0D, 0x0B, 0x01);
        i2cWrite8(w, 0x0D, 0x09, 0x1D);   // 연속, 200 Hz, ±8 G, OSR 512
        if ((m = addMore(w, 0x0D, K_QMC))) m->i0 = regDS("MAG", tag, SRC(b, "QMC5883L"), 1);
      }
    }
    // 지자기: HMC5883L (0x1E, 'H43')
    if (i2cHas(w, 0x1E)) {
      uint8_t id[3];
      if (i2cRead(w, 0x1E, 0x0A, id, 3) && id[0] == 'H' && id[1] == '4' && id[2] == '3') {
        i2cWrite8(w, 0x1E, 0x00, 0x70); i2cWrite8(w, 0x1E, 0x01, 0x20); i2cWrite8(w, 0x1E, 0x02, 0x00);
        if ((m = addMore(w, 0x1E, K_HMC))) m->i0 = regDS("MAG", "HMC", SRC(b, "HMC5883L"), 1);
      }
    }
    // 공기질: SGP30 (0x58)
    if (i2cHas(w, 0x58) && cmd16(w, 0x58, 0x2003)) {   // 공기질 측정 시작
      if ((m = addMore(w, 0x58, K_SGP))) { m->i0 = regDS("ECO2", "SGP", SRC(b, "SGP30"), 0); m->i1 = regDS("TVOC", "SGP", SRC(b, "SGP30"), 0); }
    }
    // CO2: SCD30 (0x61)
    if (i2cHas(w, 0x61)) {
      uint8_t c[5] = { 0x00, 0x10, 0x00, 0x00, 0 };   // 연속 측정 시작 (기압 보정 없음)
      c[4] = crc8(c + 2, 2);
      w->beginTransmission(0x61); w->write(c, 5);
      if (w->endTransmission() == 0 && (m = addMore(w, 0x61, K_SCD30))) {
        m->i0 = regDS("CO2", "S30", SRC(b, "SCD30"), 0); m->i1 = regDS("TA", "S30", SRC(b, "SCD30"), 2); m->i2 = regDS("RH", "S30", SRC(b, "SCD30"), 1);
      }
    }
    // 공기질: ENS160 (0x52·0x53, PART_ID 0x0160)
    static const uint8_t AE[] = { 0x52, 0x53 };
    for (uint8_t a : AE) {
      uint16_t id;
      if (!i2cHas(w, a) || !i2cRead16(w, a, 0x00, id, true) || id != 0x0160) continue;
      i2cWrite8(w, a, 0x10, 0x02);   // 표준 측정
      if ((m = addMore(w, a, K_ENS))) { m->i0 = regDS("ECO2", "ENS", SRC(b, "ENS160"), 0); m->i1 = regDS("TVOC", "ENS", SRC(b, "ENS160"), 0); }
      break;
    }
    // 산소: DFRobot Gravity I2C O2 (SEN0322, 0x70~0x73)
    for (uint8_t a = 0x70; a <= 0x73; a++) {
      uint8_t d[3];
      if (!i2cHas(w, a) || !i2cRead(w, a, 0x03, d, 3) || d[0] > 30) continue;
      if ((m = addMore(w, a, K_O2))) m->i0 = regDS("O2I", tag, SRC(b, "SEN0322"), 2);
      break;
    }
    // 조도: TSL2591 (0x29, ID 0x50)
    if (i2cHas(w, 0x29)) {
      uint8_t id;
      if (i2cRead(w, 0x29, 0xA0 | 0x12, &id, 1) && id == 0x50) {
        i2cWrite8(w, 0x29, 0xA0 | 0x01, 0x10);   // 이득 25배, 100 ms
        i2cWrite8(w, 0x29, 0xA0 | 0x00, 0x03);   // 켜기 + ALS
        if ((m = addMore(w, 0x29, K_TSL))) m->i0 = regDS("LUX", "TSL", SRC(b, "TSL2591"), 1);
      }
    }
    // 가속도: LIS3DH (0x18·0x19, WHO_AM_I 0x33)
    static const uint8_t AL[] = { 0x18, 0x19 };
    for (uint8_t a : AL) {
      uint8_t who;
      if (!i2cHas(w, a) || !i2cRead(w, a, 0x0F, &who, 1) || who != 0x33) continue;
      i2cWrite8(w, a, 0x20, 0x57); i2cWrite8(w, a, 0x23, 0x08);   // 100 Hz, ±2 g 고해상도
      if ((m = addMore(w, a, K_LIS))) {
        m->i0 = regDS("AX", "LIS", SRC(b, "LIS3DH"), 2); m->i1 = regDS("AY", "LIS", SRC(b, "LIS3DH"), 2); m->i2 = regDS("AZ", "LIS", SRC(b, "LIS3DH"), 2);
      }
      break;
    }
    // 가속도: LSM6DSOX/DS3 (0x6A·0x6B, WHO_AM_I 0x6C·0x69·0x6A)
    static const uint8_t AS[] = { 0x6A, 0x6B };
    for (uint8_t a : AS) {
      uint8_t who;
      if (!i2cHas(w, a) || !i2cRead(w, a, 0x0F, &who, 1) || (who != 0x6C && who != 0x69 && who != 0x6A)) continue;
      i2cWrite8(w, a, 0x10, 0x40);   // 104 Hz, ±2 g
      if ((m = addMore(w, a, K_LSM))) {
        m->i0 = regDS("AX", "LSM", SRC(b, "LSM6DS"), 2); m->i1 = regDS("AY", "LSM", SRC(b, "LSM6DS"), 2); m->i2 = regDS("AZ", "LSM", SRC(b, "LSM6DS"), 2);
      }
      break;
    }
    // 맥박: MAX30102 (0x57, PART_ID 0x15)
    if (i2cHas(w, 0x57)) {
      uint8_t id;
      if (i2cRead(w, 0x57, 0xFF, &id, 1) && id == 0x15) {
        i2cWrite8(w, 0x57, 0x09, 0x40); delay(10);    // 초기화
        i2cWrite8(w, 0x57, 0x08, 0x5F);               // 평균 4, FIFO 덮어쓰기
        i2cWrite8(w, 0x57, 0x09, 0x03);               // 빨강+적외선
        i2cWrite8(w, 0x57, 0x0A, 0x27);               // 4096 nA, 100 sps, 411 µs
        i2cWrite8(w, 0x57, 0x0C, 0x24); i2cWrite8(w, 0x57, 0x0D, 0x24);   // LED 세기
        if ((m = addMore(w, 0x57, K_MAX))) m->i0 = regDS("PPG", tag, SRC(b, "MAX30102"), 0);
      }
    }
  }
}

float bmp180(uint8_t idx, long ut, long up, float& tc) {
  More& m = more[idx];
  // Bosch BMP180 데이터시트 (oss = 0)
  long kac1 = m.cal[0], kac2 = m.cal[1], kac3 = m.cal[2], kb1 = m.cal[6], kb2 = m.cal[7], kmc = m.cal[9], kmd = m.cal[10];
  unsigned long kac4 = m.ucal[0]; long kac5 = m.ucal[1], kac6 = m.ucal[2];
  long kx1 = ((ut - kac6) * kac5) >> 15;
  long kx2 = (kmc << 11) / (kx1 + kmd);
  long kb5 = kx1 + kx2;
  tc = ((kb5 + 8) >> 4) / 10.0f;
  long kb6 = kb5 - 4000;
  kx1 = (kb2 * ((kb6 * kb6) >> 12)) >> 11;
  kx2 = (kac2 * kb6) >> 11;
  long kx3 = kx1 + kx2;
  long kb3 = ((kac1 * 4 + kx3) + 2) / 4;
  kx1 = (kac3 * kb6) >> 13;
  kx2 = (kb1 * ((kb6 * kb6) >> 12)) >> 16;
  kx3 = ((kx1 + kx2) + 2) >> 2;
  unsigned long kb4 = (kac4 * (unsigned long)(kx3 + 32768)) >> 15;
  unsigned long kb7 = ((unsigned long)up - kb3) * 50000UL;
  long p = kb7 < 0x80000000UL ? (kb7 * 2) / kb4 : (kb7 / kb4) * 2;
  kx1 = (p >> 8) * (p >> 8);
  kx1 = (kx1 * 3038) >> 16;
  kx2 = (-7357 * p) >> 16;
  p = p + ((kx1 + kx2 + 3791) >> 4);
  return p / 1000.0f;   // kPa
}

void pollMore() {
  for (uint8_t i = 0; i < nMore; i++) {
    More& m = more[i];
    unsigned long now = millis();
    switch (m.kind) {
      case K_BH1750: {
        if (now - m.last < 200) break; m.last = now;
        uint8_t d[2];
        if (i2cReadRaw(m.w, m.addr, d, 2)) setDS(m.i0, ((d[0] << 8) | d[1]) / 1.2f);
        break;
      }
      case K_VEML: {
        if (now - m.last < 150) break; m.last = now;
        uint16_t v;
        if (i2cRead16(m.w, m.addr, 0x04, v, true)) setDS(m.i0, v * 0.0576f);
        break;
      }
      case K_AHT: {   // 측정 시작 → 80 ms 뒤 읽기
        if (m.step == 0) {
          if (now - m.last < 1000) break;
          m.w->beginTransmission(m.addr); m.w->write(0xAC); m.w->write(0x33); m.w->write(0x00);
          if (m.w->endTransmission() == 0) { m.step = 1; m.last = now; }
        } else if (now - m.last >= 80) {
          uint8_t d[6];
          m.step = 0;
          if (!i2cReadRaw(m.w, m.addr, d, 6) || (d[0] & 0x80)) break;
          unsigned long h = ((unsigned long)d[1] << 12) | ((unsigned long)d[2] << 4) | (d[3] >> 4);
          unsigned long t = (((unsigned long)d[3] & 0x0F) << 16) | ((unsigned long)d[4] << 8) | d[5];
          setDS(m.i1, h * 100.0f / 1048576.0f);
          setDS(m.i0, t * 200.0f / 1048576.0f - 50.0f);
        }
        break;
      }
      case K_HTU: {   // 온도(0xF3) → 습도(0xF5), 기다리지 않는 방식
        if (m.step == 0) { if (now - m.last < 1000) break; if (i2cCmd8(m.w, m.addr, 0xF3)) { m.step = 1; m.last = now; } }
        else if (m.step == 1 && now - m.last >= 90) {
          uint8_t d[3];
          if (i2cReadRaw(m.w, m.addr, d, 3)) setDS(m.i0, -46.85f + 175.72f * (((d[0] << 8) | d[1]) & 0xFFFC) / 65536.0f);
          if (i2cCmd8(m.w, m.addr, 0xF5)) { m.step = 2; m.last = now; } else m.step = 0;
        } else if (m.step == 2 && now - m.last >= 35) {
          uint8_t d[3];
          if (i2cReadRaw(m.w, m.addr, d, 3)) setDS(m.i1, -6.0f + 125.0f * (((d[0] << 8) | d[1]) & 0xFFFC) / 65536.0f);
          m.step = 0;
        }
        break;
      }
      case K_SHT4: {
        if (m.step == 0) { if (now - m.last < 1000) break; if (i2cCmd8(m.w, m.addr, 0xFD)) { m.step = 1; m.last = now; } }
        else if (now - m.last >= 10) {
          uint16_t v[2];
          if (readWords(m.w, m.addr, v, 2)) { setDS(m.i0, -45.0f + 175.0f * v[0] / 65535.0f); setDS(m.i1, constrain(-6.0f + 125.0f * v[1] / 65535.0f, 0.0f, 100.0f)); }
          m.step = 0;
        }
        break;
      }
      case K_BMP180: {   // 온도 → 기압 차례로
        static long ut = 0;
        if (m.step == 0) { if (now - m.last < 1000) break; if (i2cWrite8(m.w, m.addr, 0xF4, 0x2E)) { m.step = 1; m.last = now; } }
        else if (m.step == 1 && now - m.last >= 5) {
          uint16_t v; if (i2cRead16(m.w, m.addr, 0xF6, v, false)) ut = v;
          if (i2cWrite8(m.w, m.addr, 0xF4, 0x34)) { m.step = 2; m.last = now; } else m.step = 0;
        } else if (m.step == 2 && now - m.last >= 8) {
          uint8_t d[3];
          if (i2cRead(m.w, m.addr, 0xF6, d, 3)) {
            long up = (((long)d[0] << 16) | ((long)d[1] << 8) | d[2]) >> 8;
            float tc, p = bmp180(i, ut, up, tc);
            setDS(m.i0, tc); setDS(m.i1, p);
          }
          m.step = 0;
        }
        break;
      }
      case K_MLX: {
        if (now - m.last < 250) break; m.last = now;
        uint8_t d[3];
        if (i2cRead(m.w, m.addr, 0x07, d, 3)) setDS(m.i0, (d[0] | (d[1] << 8)) * 0.02f - 273.15f);
        if (i2cRead(m.w, m.addr, 0x06, d, 3)) setDS(m.i1, (d[0] | (d[1] << 8)) * 0.02f - 273.15f);
        break;
      }
      case K_MCP: {
        if (now - m.last < 250) break; m.last = now;
        uint16_t v;
        if (!i2cRead16(m.w, m.addr, 0x05, v, false)) break;
        float t = (v & 0x0FFF) / 16.0f;
        if (v & 0x1000) t -= 256.0f;
        setDS(m.i0, t);
        break;
      }
      case K_INA: {
        if (now - m.last < 200) break; m.last = now;
        uint16_t bus, sh;
        if (i2cRead16(m.w, m.addr, 0x02, bus, false)) setDS(m.i0, (bus >> 3) * 0.004f);              // V
        if (i2cRead16(m.w, m.addr, 0x01, sh, false)) setDS(m.i1, (int16_t)sh * 0.01f / 0.1f);       // mA (분로 0.1 Ω)
        break;
      }
      case K_MPU: case K_ADXL: {
        if (now - m.last < 50) break; m.last = now;
        uint8_t d[6];
        bool mpu = m.kind == K_MPU;
        if (!i2cRead(m.w, m.addr, mpu ? 0x3B : 0x32, d, 6)) break;
        for (uint8_t k = 0; k < 3; k++) {
          int16_t raw = mpu ? (int16_t)((d[2 * k] << 8) | d[2 * k + 1]) : (int16_t)(d[2 * k] | (d[2 * k + 1] << 8));
          float g = mpu ? raw / 16384.0f : m.step ? raw / 1024.0f : raw * 0.0039f;
          setDS(k == 0 ? m.i0 : k == 1 ? m.i1 : m.i2, g * 9.80665f);   // m/s²
        }
        break;
      }
      case K_QMC: case K_HMC: {
        if (now - m.last < 100) break; m.last = now;
        uint8_t d[6];
        bool q = m.kind == K_QMC;
        if (!i2cRead(m.w, m.addr, q ? 0x00 : 0x03, d, 6)) break;
        float x, y, z;
        if (q) { x = (int16_t)(d[0] | (d[1] << 8)); y = (int16_t)(d[2] | (d[3] << 8)); z = (int16_t)(d[4] | (d[5] << 8)); x /= 30; y /= 30; z /= 30; }
        else { x = (int16_t)((d[0] << 8) | d[1]); z = (int16_t)((d[2] << 8) | d[3]); y = (int16_t)((d[4] << 8) | d[5]); x /= 10.9f; y /= 10.9f; z /= 10.9f; }
        setDS(m.i0, sqrt(x * x + y * y + z * z));   // µT
        break;
      }
      case K_SGP: {
        if (m.step == 0) { if (now - m.last < 1000) break; if (cmd16(m.w, m.addr, 0x2008)) { m.step = 1; m.last = now; } }
        else if (now - m.last >= 15) {
          uint16_t v[2];
          if (readWords(m.w, m.addr, v, 2)) { setDS(m.i0, v[0]); setDS(m.i1, v[1]); }
          m.step = 0;
        }
        break;
      }
      case K_CCS: {
        if (now - m.last < 1000) break; m.last = now;
        uint8_t st, d[4];
        if (!i2cRead(m.w, m.addr, 0x00, &st, 1) || !(st & 0x08)) break;   // 새 값
        if (i2cRead(m.w, m.addr, 0x02, d, 4)) { setDS(m.i0, (d[0] << 8) | d[1]); setDS(m.i1, (d[2] << 8) | d[3]); }
        break;
      }
      case K_SCD30: {
        if (now - m.last < 1000) break; m.last = now;
        uint16_t rdy, v[6];
        if (!cmd16(m.w, m.addr, 0x0202)) break;
        delay(3);
        if (!readWords(m.w, m.addr, &rdy, 1) || !rdy) break;
        if (!cmd16(m.w, m.addr, 0x0300)) break;
        delay(3);
        if (!readWords(m.w, m.addr, v, 6)) break;
        float f[3];
        for (uint8_t k = 0; k < 3; k++) { uint32_t u = ((uint32_t)v[2 * k] << 16) | v[2 * k + 1]; memcpy(&f[k], &u, 4); }
        setDS(m.i0, f[0]); setDS(m.i1, f[1]); setDS(m.i2, f[2]);
        break;
      }
      case K_ENS: {
        if (now - m.last < 1000) break; m.last = now;
        uint16_t tv, co;
        if (i2cRead16(m.w, m.addr, 0x22, tv, true)) setDS(m.i1, tv);
        if (i2cRead16(m.w, m.addr, 0x24, co, true)) setDS(m.i0, co);
        break;
      }
      case K_O2: {   // DFRobot 방식: (정수 + 소수1 + 소수2) × 보정 키
        if (now - m.last < 500) break; m.last = now;
        uint8_t d[3], key;
        if (!i2cRead(m.w, m.addr, 0x03, d, 3)) break;
        float k = (i2cRead(m.w, m.addr, 0x0A, &key, 1) && key) ? key / 1000.0f : 20.9f / 120.0f;
        setDS(m.i0, k * (d[0] + d[1] / 10.0f + d[2] / 100.0f));
        break;
      }
      case K_TSL: {
        if (now - m.last < 150) break; m.last = now;
        uint8_t d[4];
        if (!i2cRead(m.w, m.addr, 0xA0 | 0x14, d, 4)) break;
        float c0 = d[0] | (d[1] << 8), c1 = d[2] | (d[3] << 8);
        if (c0 < 1) { setDS(m.i0, 0); break; }
        float cpl = (100.0f * 25.0f) / 408.0f;   // 적분 100 ms × 이득 25
        setDS(m.i0, max(0.0f, (c0 - c1) * (1.0f - c1 / c0) / cpl));
        break;
      }
      case K_LIS: case K_LSM: {
        if (now - m.last < 50) break; m.last = now;
        uint8_t d[6];
        bool lis = m.kind == K_LIS;
        if (!i2cRead(m.w, m.addr, lis ? (0x28 | 0x80) : 0x28, d, 6)) break;
        for (uint8_t k = 0; k < 3; k++) {
          int16_t raw = (int16_t)(d[2 * k] | (d[2 * k + 1] << 8));
          float g = lis ? (raw >> 4) * 0.001f : raw * 0.000061f;
          setDS(k == 0 ? m.i0 : k == 1 ? m.i1 : m.i2, g * 9.80665f);
        }
        break;
      }
      case K_INA260: {
        if (now - m.last < 200) break; m.last = now;
        uint16_t cur, bus;
        if (i2cRead16(m.w, m.addr, 0x02, bus, false)) setDS(m.i0, bus * 0.00125f);
        if (i2cRead16(m.w, m.addr, 0x01, cur, false)) setDS(m.i1, (int16_t)cur * 1.25f);
        break;
      }
      case K_MAX: {   // FIFO에 쌓인 것 중 마지막 적외선 값
        if (now - m.last < 20) break; m.last = now;
        uint8_t wr, rd;
        if (!i2cRead(m.w, m.addr, 0x04, &wr, 1) || !i2cRead(m.w, m.addr, 0x06, &rd, 1)) break;
        uint8_t n = (wr - rd) & 0x1F;
        long ir = -1;
        for (uint8_t k = 0; k < n; k++) {
          uint8_t d[6];
          if (!i2cRead(m.w, m.addr, 0x07, d, 6)) break;
          ir = (((long)d[3] << 16) | ((long)d[4] << 8) | d[5]) & 0x3FFFF;
        }
        if (ir >= 0) setDS(m.i0, ir);
        break;
      }
      default: pollExtra(i); break;   // sensors_more2.ino
    }
  }
}

// ---------- VL53L0X 레이저 거리 (0x29) ----------
#if HAS_VL53
VL53L0X tof;
int8_t tofIdx = -1;
void detectTof() {
  tofIdx = -1;
  for (uint8_t b = 0; b < NBUS && tofIdx < 0; b++) {
    TwoWire* w = buses[b].w;
    uint8_t id;
    if (!i2cHas(w, 0x29) || !i2cRead(w, 0x29, 0xC0, &id, 1) || id != 0xEE) continue;
    tof.setBus(w);
    tof.setTimeout(100);
    if (!tof.init()) continue;
    tof.startContinuous(50);
    tofIdx = regDS("DIST", "TOF", SRC(b, "VL53L0X"), 1);
  }
}
void pollTof() {
  if (tofIdx < 0 || !(tof.readReg(0x13) & 0x07)) return;   // 새 값이 있을 때만
  uint16_t mm = tof.readRangeContinuousMillimeters();
  if (!tof.timeoutOccurred() && mm < 8000) setDS(tofIdx, mm / 10.0f);
}
#endif

// ---------- UART (Serial1): 켤 때 한 종류만 알아냄 ----------
//  9600:   PMS5003/7003/5003ST 미세먼지(+폼알데하이드·온습도) · A02YYUW 방수 초음파 · 폼알데하이드 SEN0231(WZ-S)
//          MH-Z19B/C·MH-Z14A·MH-Z16 CO2 · CM1106/CM1108 CO2 · COZIR·SprintIR CO2
//  115200: TFmini-S·TFmini Plus·TF-Luna 라이다 거리
#if defined(HAVE_HWSERIAL1) || defined(ARDUINO_ARCH_RENESAS)
#define HAS_UART_SENSOR 1
enum UKind : uint8_t { U_NONE, U_PMS, U_MHZ, U_CM11, U_GSS, U_A02, U_HCHO, U_TF };
uint8_t uartKind = U_NONE;
int8_t ui0 = -1, ui1 = -1, ui2 = -1, ui3 = -1, ui4 = -1, ui5 = -1;
uint8_t ubuf[40]; uint8_t ulen = 0, uneed = 0;
unsigned long ulast = 0;
uint16_t gssMul = 1;
bool pmsST = false;   // PMS5003ST (프레임 40바이트)
unsigned long uartLastOk = 0;   // 마지막으로 바른 값을 받은 때
char gssLine[16]; uint8_t gssN = 0;

const uint8_t MHZ_Q[9] = { 0xFF, 0x01, 0x86, 0, 0, 0, 0, 0, 0x79 };
const uint8_t CM_Q[4] = { 0x11, 0x01, 0x01, 0xED };

void uartFlush() { while (Serial1.available()) Serial1.read(); }

// 9600으로 1.5초 듣기: 스스로 보내는 센서 (PMS 0x42 0x4D · A02 0xFF+합 · WZ-S 0xFF 0x17)
uint8_t uartListen() {
  unsigned long t0 = millis();
  uint8_t b[9]; uint8_t n = 0;
  while (millis() - t0 < 1500) {
    if (!Serial1.available()) continue;
    uint8_t c = Serial1.read();
    if (n == 0 && c != 0x42 && c != 0xFF) continue;
    b[n++] = c;
    if (b[0] == 0x42) {
      if (n == 2 && c != 0x4D) { n = 0; continue; }
      if (n == 4) { pmsST = (b[2] == 0 && b[3] == 36); return U_PMS; }
      continue;
    }
    if (n == 4 && b[0] == 0xFF && b[1] != 0x17) { if (((0xFF + b[1] + b[2]) & 0xFF) == b[3]) return U_A02; n = 0; continue; }
    if (n == 9 && b[0] == 0xFF) {
      uint8_t ck = 0; for (uint8_t i = 1; i < 8; i++) ck += b[i];
      if (b[1] == 0x17 && (uint8_t)(~ck + 1) == b[8]) return U_HCHO;
      n = 0;
    }
  }
  return U_NONE;
}

bool uartAsk(const uint8_t* q, uint8_t qn, uint8_t h0, uint8_t h1, unsigned long ms) {
  uartFlush(); Serial1.write(q, qn);
  unsigned long t0 = millis(); uint8_t prev = 0;
  while (millis() - t0 < ms) {
    if (!Serial1.available()) continue;
    uint8_t c = Serial1.read();
    if (prev == h0 && c == h1) { uartFlush(); return true; }
    prev = c;
  }
  return false;
}

// COZIR·SprintIR: "K 2" (질의 모드) → " K 00002"
bool gssAsk() {
  uartFlush(); Serial1.print("K 2\r\n");
  unsigned long t0 = millis(); char prev = 0;
  while (millis() - t0 < 300) {
    if (!Serial1.available()) continue;
    char c = Serial1.read();
    if (prev == ' ' && c == 'K') { delay(20); uartFlush(); return true; }
    prev = c;
  }
  return false;
}

long gssQuery(const char* cmd, char key) {   // " Z 00450" 같은 줄에서 숫자
  uartFlush(); Serial1.print(cmd);
  unsigned long t0 = millis(); bool on = false; long v = 0; uint8_t nd = 0;
  while (millis() - t0 < 200) {
    if (!Serial1.available()) continue;
    char c = Serial1.read();
    if (!on) { if (c == key) on = true; continue; }
    if (c >= '0' && c <= '9') { v = v * 10 + (c - '0'); nd++; }
    else if (nd && (c == '\r' || c == '\n')) return v;
  }
  return nd ? v : -1;
}

void detectUart() {
  ulen = 0; uneed = 0;
  ui0 = ui1 = ui2 = ui3 = ui4 = ui5 = -1;
  // 이미 알아낸 센서는 다시 묻지 않음 (센서 다시 찾기를 빠르게). 없을 때만 새로 찾음
  if (uartKind != U_NONE && millis() - uartLastOk > 10000) uartKind = U_NONE;   // 10초 넘게 값이 없으면 빠진 것으로 보고 다시 찾음
  if (uartKind == U_NONE) {
  uartLastOk = millis();
  pmsST = false;
  Serial1.begin(9600);
  uartKind = uartListen();
  if (uartKind == U_NONE && uartAsk(MHZ_Q, 9, 0xFF, 0x86, 300)) uartKind = U_MHZ;
  if (uartKind == U_NONE && uartAsk(CM_Q, 4, 0x16, 0x05, 300)) uartKind = U_CM11;
  if (uartKind == U_NONE && gssAsk()) {
    uartKind = U_GSS;
    long mul = gssQuery(".\r\n", '.');
    gssMul = mul > 0 ? mul : 1;
  }
  if (uartKind == U_NONE) {   // 라이다는 115200
    Serial1.end(); Serial1.begin(115200);
    unsigned long t0 = millis(); uint8_t prev = 0;
    while (millis() - t0 < 300) {
      if (!Serial1.available()) continue;
      uint8_t c = Serial1.read();
      if (prev == 0x59 && c == 0x59) { uartKind = U_TF; break; }
      prev = c;
    }
  }
  }
  uartFlush();
  switch (uartKind) {
    case U_PMS:
      ui0 = regDS("PM1", "PMS", "uart:PMS", 0); ui1 = regDS("PM25", "PMS", "uart:PMS", 0); ui2 = regDS("PM10", "PMS", "uart:PMS", 0);
      if (pmsST) { ui3 = regDS("HCHO", "PMS", "uart:PMS5003ST", 3); ui4 = regDS("TA", "PMS", "uart:PMS5003ST", 1); ui5 = regDS("RH", "PMS", "uart:PMS5003ST", 1); }
      break;
    case U_MHZ: ui0 = regDS("CO2", "MHZ", "uart:MH-Z19", 0); break;
    case U_CM11: ui0 = regDS("CO2", "CM11", "uart:CM1106", 0); break;
    case U_GSS: ui0 = regDS("CO2", "GSS", "uart:COZIR", 0); break;
    case U_A02: ui0 = regDS("DIST", "A02", "uart:A02YYUW", 1); break;
    case U_HCHO: ui0 = regDS("HCHO", "WZ", "uart:WZ-S", 3); break;
    case U_TF: ui0 = regDS("DIST", "TF", "uart:TFmini", 1); break;
    default: Serial1.end();
  }
}

void pollUart() {
  switch (uartKind) {
    case U_PMS: {   // 0x42 0x4D 길이(2) 자료… 합(2). 7003 = 32바이트, 5003ST = 40바이트
      while (Serial1.available()) {
        uint8_t c = Serial1.read();
        if (ulen == 0 && c != 0x42) continue;
        if (ulen == 1 && c != 0x4D) { ulen = 0; continue; }
        ubuf[ulen++] = c;
        if (ulen == 4) { uneed = 4 + ((ubuf[2] << 8) | ubuf[3]); if (uneed > sizeof(ubuf) || uneed < 32) { ulen = 0; continue; } }
        if (ulen >= 4 && ulen == uneed) {
          uint16_t sum = 0;
          for (uint8_t i = 0; i < uneed - 2; i++) sum += ubuf[i];
          if (sum == ((ubuf[uneed - 2] << 8) | ubuf[uneed - 1])) {
            { setDS(ui0, (uint16_t)((ubuf[10] << 8) | ubuf[11])); uartLastOk = millis(); }    // 대기 환경 기준 (µg/m³)
            setDS(ui1, (ubuf[12] << 8) | ubuf[13]);
            setDS(ui2, (ubuf[14] << 8) | ubuf[15]);
            if (uneed == 40 && ui3 >= 0) {   // PMS5003ST: 폼알데하이드(mg/m³ ×1000)·온도·습도(×10)
              setDS(ui3, ((ubuf[28] << 8) | ubuf[29]) / 1000.0f * 0.814f);   // mg/m³ → ppm (25 °C)
              setDS(ui4, (int16_t)((ubuf[30] << 8) | ubuf[31]) / 10.0f);
              setDS(ui5, ((ubuf[32] << 8) | ubuf[33]) / 10.0f);
            }
          }
          ulen = 0;
        }
      }
      break;
    }
    case U_A02: {   // 0xFF H L 합, 거리 mm
      while (Serial1.available()) {
        uint8_t c = Serial1.read();
        if (ulen == 0 && c != 0xFF) continue;
        ubuf[ulen++] = c;
        if (ulen == 4) {
          if (((ubuf[0] + ubuf[1] + ubuf[2]) & 0xFF) == ubuf[3]) { setDS(ui0, ((ubuf[1] << 8) | ubuf[2]) / 10.0f); uartLastOk = millis(); }
          ulen = 0;
        }
      }
      break;
    }
    case U_HCHO: {   // FF 17 04 00 농도(ppb, 2) 최대(2) 합
      while (Serial1.available()) {
        uint8_t c = Serial1.read();
        if (ulen == 0 && c != 0xFF) continue;
        if (ulen == 1 && c != 0x17) { ulen = 0; continue; }
        ubuf[ulen++] = c;
        if (ulen == 9) {
          uint8_t ck = 0; for (uint8_t i = 1; i < 8; i++) ck += ubuf[i];
          if ((uint8_t)(~ck + 1) == ubuf[8]) { setDS(ui0, ((ubuf[4] << 8) | ubuf[5]) / 1000.0f); uartLastOk = millis(); }   // ppm
          ulen = 0;
        }
      }
      break;
    }
    case U_TF: {   // 59 59 거리(L,H, cm) 세기(2) 온도(2) 합
      while (Serial1.available()) {
        uint8_t c = Serial1.read();
        if (ulen < 2 && c != 0x59) { ulen = 0; continue; }
        ubuf[ulen++] = c;
        if (ulen == 9) {
          uint8_t sum = 0; for (uint8_t i = 0; i < 8; i++) sum += ubuf[i];
          uint16_t str = ubuf[4] | (ubuf[5] << 8);
          if (sum == ubuf[8]) { setDS(ui0, (str >= 100 && str != 0xFFFF) ? (ubuf[2] | (ubuf[3] << 8)) : NAN); uartLastOk = millis(); }
          ulen = 0;
        }
      }
      break;
    }
    case U_MHZ: case U_CM11: {   // 2초마다 묻고 답 읽기
      uint8_t n = uartKind == U_MHZ ? 9 : 8;
      if (ulen == 0 && millis() - ulast >= 2000) {
        uartFlush();
        if (uartKind == U_MHZ) Serial1.write(MHZ_Q, 9); else Serial1.write(CM_Q, 4);
        ulast = millis(); ulen = 1;
      }
      if (ulen && Serial1.available() >= n) {
        uint8_t d[9];
        for (uint8_t i = 0; i < n; i++) d[i] = Serial1.read();
        uint8_t ck = 0;
        if (uartKind == U_MHZ) {
          for (uint8_t i = 1; i < 8; i++) ck += d[i];
          if (d[0] == 0xFF && d[1] == 0x86 && (uint8_t)(0xFF - ck + 1) == d[8]) { setDS(ui0, (uint16_t)((d[2] << 8) | d[3])); uartLastOk = millis(); }
        } else {
          for (uint8_t i = 0; i < 7; i++) ck += d[i];
          if (d[0] == 0x16 && d[1] == 0x05 && (uint8_t)(0x100 - ck) == d[7]) { setDS(ui0, (uint16_t)((d[3] << 8) | d[4])); uartLastOk = millis(); }
        }
        ulen = 0;
      } else if (ulen && millis() - ulast > 500) { uartFlush(); ulen = 0; }
      break;
    }
    case U_GSS: {   // " Z 00450" (×배율)
      if (ulen == 0 && millis() - ulast >= 1000) { uartFlush(); Serial1.print("Z\r\n"); ulast = millis(); ulen = 1; gssN = 0; }
      while (ulen && Serial1.available()) {
        char c = Serial1.read();
        if (c == '\n') {
          gssLine[gssN] = 0;
          char* z = strchr(gssLine, 'Z');
          if (z) { setDS(ui0, atol(z + 1) * (float)gssMul); uartLastOk = millis(); }
          ulen = 0; gssN = 0;
        } else if (gssN < sizeof(gssLine) - 1) gssLine[gssN++] = c;
      }
      if (ulen && millis() - ulast > 500) ulen = 0;
      break;
    }
    default: break;
  }
}
#else
#define HAS_UART_SENSOR 0
#endif

void detectMoreAll() {
  detectMore();
  detectExtra();   // sensors_more2.ino
#if HAS_VL53
  detectTof();
#endif
#if HAS_UART_SENSOR
  detectUart();
#endif
}

void pollMoreAll() {
  pollMore();
#if HAS_VL53
  pollTof();
#endif
#if HAS_UART_SENSOR
  pollUart();
#endif
}

#endif
