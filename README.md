# ChemDict Lab

아두이노 IDE 없이, **꽂고 → 실험 고르고 → 측정**하는 화학 실험 앱입니다.
UNO R4 WiFi + 센서로 측정하고, 맥·윈도우(웹앱)와 아이패드·아이폰·맥(애플 앱)에서 같은 화면으로 봅니다.

```
센서 ─ UNO R4 WiFi (펌웨어 한 번만 업로드)
          │  USB ──────── 웹앱 (크롬·엣지 / 맥·윈도우·크롬북)
          └  블루투스 ─── 애플 앱 (아이패드·아이폰·맥) · 웹앱(크롬)
```

| 폴더 | 내용 |
|---|---|
| `protocol/` | 보드↔앱 통신 규칙, 실험 템플릿(JSON) — 두 앱이 함께 씀 |
| `firmware/` | UNO R4 WiFi 펌웨어 (USB+BLE, 데모 모드, 2점 보정) |
| `web/` | 웹앱 (React + TypeScript, Web Serial·Web Bluetooth, 시뮬레이터) |

## 웹앱 실행

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

`main` 브랜치에 올리면 GitHub Actions가 GitHub Pages로 배포합니다
(저장소 Settings → Pages → Source: **GitHub Actions** 한 번 설정 필요).

사파리는 USB·블루투스 연결을 지원하지 않습니다. 맥·윈도우에서는 크롬이나 엣지를 쓰세요.

## 실험 추가하기

`protocol/experiments/`에 JSON 파일 하나를 추가하면 웹앱(과 아이패드·맥 앱)에 함께 나타납니다. 형식은 `protocol/PROTOCOL.md` 6절.

## 현재 상태 (v0.2)

- [x] 통신 규칙 v1.1, 센서 카탈로그(`protocol/sensors.json`), 실험 템플릿 4개
- [x] 펌웨어 0.2: 포트별 센서 종류 지정(PORT), 1점·2점 보정, 데모 모드, DS18B20·Modulino Thermo 자동 인식
- [x] 웹앱: 센서 연결 설정, 시간 기록·값 입력 두 가지 모드, 여러 측정 겹쳐 비교, 예측 그리기, 안정 표시
- [x] 웹앱 해석: 구간 선택 통계, 직선 맞춤(R²), 당량점·반당량점, 평탄 구간(어는점)
- [x] 웹앱 활용: CSV(여러 측정), 표 복사(Numbers 붙여넣기), 그래프 이미지 저장, 데이터 표에서 점 삭제
- [x] 애플 앱 0.1: 블루투스·시뮬레이터, 시간 기록 모드, 센서 이름은 카탈로그에서
- [x] 연결 안내 탭: 보드 고르기(UNO R4 WiFi·R4 Minima·R3·UNO Q), 실험별 센서 연결 그림·순서·부착·주의 (`protocol/guide.json`)
- [x] 첫 실험 안내 완성: 입김 속 수증기 (Modulino Thermo 기온·습도)
- [x] 펌웨어 0.2.1: Modulino Thermo 신형(0x45) 인식, "센서 다시 찾기", 보드별 빌드(R4 Minima·R3는 시험용)
- [x] 바로 측정: 센서 카드(30종) → 보드에 맞춘 연결 그림 → [측정 시작] 한 번 (아날로그는 포트 자동 설정)
- [x] 보드 13종 연결 안내, 펌웨어 0.3.0은 7종 컴파일 확인 (UNO R4 WiFi·R4 Minima·Nano R4·Mega·UNO R3·Nano·Leonardo)
- [x] 펌웨어 0.3.0 센서: BMP/BME280, SHT3x, LPS22, SCD4x CO₂, TCS34725 색, HX711 무게, MAX6675 열전대, HC-SR04 거리 (실제 센서 확인 전)
- [ ] 펌웨어 0.3.0을 실제 보드에 올려 확인, 센서별 실물 확인
- [ ] 연결 안내: 나머지 실험(어는점·적정·희석)의 부착 안내
- [ ] 애플 앱: 값 입력 모드·해석 도구·센서 설정 (웹앱 기능 따라잡기), 연결 그림
- [x] 실제 보드(UNO R4 WiFi) 펌웨어 0.2.1 컴파일·업로드·명령 확인 (2026-10-17, 센서 없이 HELLO·START·STOP·DEMO·PORT·CAL)
- [x] DHT 온습도 센서(D4) 실제 보드에서 인식·측정 확인 (펌웨어 0.2.2, 2026-10-17)
- [ ] 실제 센서(Modulino Thermo, DS18B20, pH) 연결 확인, 웹앱 USB·블루투스 연결 확인
- [x] 웹앱 0.6: 자동 저장(최근 5개)·측정 파일(.chemdict) 열기/저장, 실험 QR·링크 공유, 직접 만드는 계산 열(수식)+그래프, 조건 시작, 준비물 목록(모둠 수)
- [x] 반 전체 결과 비교: 아이패드·맥 앱(유료)에서 .chemdict 파일을 모아 겹쳐 보기

## 라이선스

- 웹앱·펌웨어·센서 데이터: **PolyForm Noncommercial 1.0.0** — 학교·개인 비상업 사용 무료, 판매·상업적 재배포 금지. 요약은 [NOTICE.md](NOTICE.md), 정식 조건은 [LICENSE](LICENSE).
- 펌웨어의 LGPL 라이브러리 관련 추가 허가: [firmware/LICENSE](firmware/LICENSE), 제3자 고지: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- 아이패드·맥 앱은 별도 비공개 저장소의 유료 제품입니다.
- Arduino는 Arduino SA의 상표이며, ChemDict Lab은 Arduino 공식 제품이 아닙니다.
