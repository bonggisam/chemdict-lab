"""
2022 개정 교육과정 센서 실험 → protocol/experiments/cur-*.json 생성

- 이 파일만 고치고 실행합니다:  python3 tools/make_experiments.py
- 손으로 만든 실험(free, temp-humidity, ph-dilution, titration, freezing-point)은 그대로 두고
  그 파일들의 level·course·textbooks 같은 '찾기' 정보만 META로 덧붙입니다.
- 성취기준 코드는 교육과정 원문(교육부 고시 제2022-33호 [별책9])에서 확인한 것만 넣습니다.
- 교과서(출판사) 정보는 공개 자료에서 확인한 것만 넣습니다 (sure: confirmed / mentioned / similar).
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "protocol" / "experiments"

# 센서 종류 → 그래프 기본값 (라벨, 단위, 최소, 최대)
Y = {
    "T": ("온도", "°C", None, None), "TK": ("고온", "°C", None, None), "TA": ("기온", "°C", None, None),
    "RH": ("습도", "%", 0, 100), "BP": ("기압", "kPa", None, None), "P": ("기체 압력", "kPa", None, None),
    "CO2": ("이산화탄소", "ppm", None, None), "O2": ("산소", "%", None, None), "L": ("빛", "%", 0, 100),
    "COLR": ("빨강", "%", 0, 100), "COLG": ("초록", "%", 0, 100), "COLB": ("파랑", "%", 0, 100),
    "pH": ("pH", "", 0, 14), "EC": ("전도도", "µS/cm", None, None), "TDS": ("TDS", "ppm", None, None),
    "TURB": ("투명도", "%", 0, 100), "V": ("전압", "V", None, None), "M": ("질량", "g", None, None),
    "DIST": ("거리", "cm", None, None), "FSR": ("힘(상대값)", "%", 0, 100), "SND": ("소리(상대값)", "%", 0, 100),
    "SOIL": ("토양 수분", "%", 0, 100), "UV": ("자외선 지수", "", 0, None), "GAS": ("가스(상대값)", "%", 0, 100),
    "POT": ("가변저항", "%", 0, 100),
}

# 센서 종류 → 연결 안내 부품 (guide.json parts[].id) 기본값
PART = {
    "T": "ds18b20", "TK": "max6675", "TA": "dht", "RH": "dht", "BP": "bmp280", "P": "mpx5700", "CO2": "scd4x",
    "O2": "o2", "L": "ldr", "COLR": "tcs34725", "COLG": "tcs34725", "COLB": "tcs34725", "pH": "ph", "EC": "ec",
    "TDS": "tds", "TURB": "turbidity", "V": "voltage", "M": "hx711", "DIST": "hcsr04", "FSR": "fsr", "SND": "sound",
    "SOIL": "soil", "UV": "uv", "GAS": "mq-gas", "POT": "pot",
}

EXPS = []


def exp(id, level, course, area, title, summary, sensors, standards=(), std_texts=(), mode="time", interval=1000,
        event=None, steps=(), analysis=("stats", "fit"), materials=(), attach=(), cautions=(), textbooks=(),
        y=None, markers=("관찰 기록", "한 일 (예: 시약 넣음)"), parts=None, choose=False):
    ys = []
    for s in sensors:
        lab, unit, lo, hi = Y[s]
        if y and s in y:
            lab, unit, lo, hi = y[s]
        d = {"sensor": s, "label": lab, "unit": unit}
        if lo is not None:
            d["min"] = lo
        if hi is not None:
            d["max"] = hi
        ys.append(d)
    pids = parts or list(dict.fromkeys(PART[s] for s in sensors))
    e = {
        "id": f"cur-{id}",
        "order": 100 + len(EXPS),
        "title": title,
        "subject": course,
        "level": level,
        "course": course,
        "area": area,
        "summary": summary,
        "standards": list(standards),
        "standardTexts": list(std_texts),
        "sensors": list(sensors),
        "mode": mode,
        "intervalMs": interval,
        "x": {"label": event["label"], "unit": event["unit"]} if event else {"label": "시간", "unit": "s"},
        "y": ys,
        "markers": {"enabled": mode == "time", "label": markers[0], "prompt": markers[1]},
        "analysis": list(analysis),
        "steps": list(steps),
        "setup": {"parts": pids, "choose": choose, "materials": list(materials), "attach": list(attach), "cautions": list(cautions)},
        "textbooks": [dict(publisher=p, course=c, note=n, sure=s) for (p, c, n, s) in textbooks],
    }
    if event:
        e["event"] = event
    EXPS.append(e)


# ============================================================================ 실험 목록
# (조사 결과를 바탕으로 아래에 채움)

# ============================================================================ 기존 실험에 '찾기' 정보 덧붙이기
META = {}


def main():
    for f in OUT.glob("cur-*.json"):
        f.unlink()
    for e in EXPS:
        (OUT / f"{e['id']}.json").write_text(json.dumps(e, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for fid, meta in META.items():
        p = OUT / f"{fid}.json"
        d = json.loads(p.read_text(encoding="utf-8"))
        d.update(meta)
        p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("experiments", len(EXPS), "meta", len(META))


if __name__ == "__main__":
    main()
