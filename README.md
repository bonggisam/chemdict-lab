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

## 현재 상태 (v0.1)

- [x] 통신 규칙 v1, 실험 템플릿 4개 (자유 측정, pH 희석, 중화 적정, 어는점)
- [x] 펌웨어: USB+BLE 동시, 데모 모드, 아날로그 4채널, DS18B20·Modulino Thermo 자동 인식, pH 2점 보정
- [x] 웹앱: USB·블루투스·시뮬레이터 연결, 실험 선택, 실시간 그래프, 표시, pH 보정, CSV
- [x] 애플 앱: 블루투스·시뮬레이터 연결, 같은 화면 흐름, Swift Charts, CSV 공유
- [ ] 실제 보드에서 펌웨어 컴파일·동작 확인
- [ ] 표시값(부피 등)을 x축으로 쓰는 그래프 (적정 곡선)
- [ ] 반 전체 결과 비교
