# 제3자 소프트웨어 고지 (Third-party notices)

ChemDict Lab은 아래 오픈소스를 사용합니다. 각 소프트웨어의 저작권은 원저작자에게 있습니다.

## 웹앱 (web/)
| 이름 | 라이선스 | 출처 |
|---|---|---|
| React, React DOM | MIT | https://github.com/facebook/react |
| Vite, @vitejs/plugin-react, vite-plugin-pwa, Workbox | MIT | https://github.com/vitejs/vite · https://github.com/vite-pwa/vite-plugin-pwa |
| Vitest (개발용 시험 도구, 배포 파일에는 들어가지 않음) | MIT | https://github.com/vitest-dev/vitest |
| TypeScript | Apache-2.0 | https://github.com/microsoft/TypeScript |
| GoatCounter count.js (웹앱이 실행 중에 불러오는 익명 통계 스크립트, 저장소에는 들어 있지 않음) | EUPL-1.2 | https://github.com/arp242/goatcounter |

글꼴은 앱에 들어 있지 않습니다. 기기에 Pretendard(SIL OFL 1.1)가 있으면 쓰고, 없으면 시스템 글꼴을 씁니다.

## 펌웨어 (firmware/, web/public/firmware/*.hex)
| 이름 | 라이선스 | 출처 |
|---|---|---|
| Arduino 코어 (Renesas, AVR) | LGPL-2.1 | https://github.com/arduino/ArduinoCore-renesas · https://github.com/arduino/ArduinoCore-avr |
| ArduinoBLE | LGPL-2.1 | https://github.com/arduino-libraries/ArduinoBLE |
| DallasTemperature | LGPL-2.1 | https://github.com/milesburton/Arduino-Temperature-Control-Library |
| OneWire | MIT 형식 (OneWire 라이선스) | https://github.com/PaulStoffregen/OneWire |
| VL53L0X (Pololu) | MIT 형식 (Pololu 라이선스, ST API 기반) | https://github.com/pololu/vl53l0x-arduino |

LGPL 라이브러리가 링크된 hex 파일은 `firmware/LICENSE`의 추가 허가에 따라 펌웨어 소스(이 저장소 firmware/)로 다시 링크할 수 있습니다.

## 상표
Arduino는 Arduino SA의 상표입니다. ChemDict Lab은 Arduino 공식 제품이 아니며, Arduino와 함께 쓸 수 있는(for Arduino) 앱입니다. 센서·보드 제품명은 각 회사의 상표이며, 호환 여부를 알리는 데만 씁니다.
