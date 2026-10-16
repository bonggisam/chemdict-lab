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
| `apple/` | SwiftUI 앱 (iOS·iPadOS 16+, macOS 13+, CoreBluetooth) |

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

`protocol/experiments/`에 JSON 파일 하나를 추가하면 웹앱과 애플 앱에 함께 나타납니다. 형식은 `protocol/PROTOCOL.md` 6절.

## 현재 상태 (v0.2)

- [x] 통신 규칙 v1.1, 센서 카탈로그(`protocol/sensors.json`), 실험 템플릿 4개
- [x] 펌웨어 0.2: 포트별 센서 종류 지정(PORT), 1점·2점 보정, 데모 모드, DS18B20·Modulino Thermo 자동 인식
- [x] 웹앱: 센서 연결 설정, 시간 기록·값 입력 두 가지 모드, 여러 측정 겹쳐 비교, 예측 그리기, 안정 표시
- [x] 웹앱 해석: 구간 선택 통계, 직선 맞춤(R²), 당량점·반당량점, 평탄 구간(어는점)
- [x] 웹앱 활용: CSV(여러 측정), 표 복사(Numbers 붙여넣기), 그래프 이미지 저장, 데이터 표에서 점 삭제
- [x] 애플 앱 0.1: 블루투스·시뮬레이터, 시간 기록 모드, 센서 이름은 카탈로그에서
- [ ] 애플 앱: 값 입력 모드·해석 도구·센서 설정 (웹앱 기능 따라잡기)
- [ ] 실제 보드에서 펌웨어 컴파일·동작 확인
- [ ] 반 전체 결과 비교
