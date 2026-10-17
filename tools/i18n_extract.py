"""
번역할 한국어 문장 모으기 → protocol/i18n/source/content.json  (키 → 한국어)

- 실행: python3 tools/i18n_extract.py   (guide.json·experiments·sensors.json을 고친 뒤 다시 실행)
- 각 언어 번역은 protocol/i18n/<lang>/content.json 에 같은 키로 둡니다 (빠진 키는 한국어로 보임).
- 확인: python3 tools/i18n_check.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
P = ROOT / "protocol"
OUT = P / "i18n" / "source" / "content.json"
HANGUL = re.compile(r"[가-힣]")

src: dict[str, str] = {}


def put(key, val):
    if isinstance(val, str) and HANGUL.search(val):
        src[key] = val


def walk_list(prefix, arr):
    for i, v in enumerate(arr or []):
        put(f"{prefix}.{i}", v)


# ---------------------------------------------------------------- guide.json
g = json.loads((P / "guide.json").read_text(encoding="utf-8"))
walk_list("guide.common", g["common"])
for c in g["categories"]:
    put(f"cat.{c}", c)
walk_list("guide.planned", g["planned"])
for b in g["boards"]:
    k = f"board.{b['id']}"
    for f in ("name", "firmwareNote", "usb", "logic", "adc", "qwiic"):
        put(f"{k}.{f}", b.get(f))
    walk_list(f"{k}.notes", b.get("notes"))
for cid, c in g["connectors"].items():
    k = f"conn.{cid}"
    put(f"{k}.name", c["name"])
    for i, w in enumerate(c["wires"]):
        put(f"{k}.wires.{i}", w["term"])
    walk_list(f"{k}.steps", c["steps"])
    walk_list(f"{k}.cautions", c["cautions"])
    if c.get("breadboard"):
        put(f"{k}.bb", c["breadboard"]["why"])
    if c.get("resistor"):
        put(f"{k}.res", c["resistor"]["value"])
for p in g["parts"]:
    k = f"part.{p['id']}"
    put(f"{k}.name", p["name"])
    walk_list(f"{k}.items", p["items"])
    walk_list(f"{k}.cautions", p["cautions"])
for t in g["troubles"]:
    k = f"trouble.{t['id']}"
    put(f"{k}.title", t["title"])
    walk_list(f"{k}.steps", t["steps"])
bb = g["breadboard"]
put("bb.intro", bb["intro"])
walk_list("bb.structure", bb["structure"])
walk_list("bb.rules", bb["rules"])
for r in bb["resistors"]:
    put(f"bb.res.{r['value']}.bands", r["bands"])
    put(f"bb.res.{r['value']}.use", r["use"])
for c in bb["circuits"]:
    k = f"bb.circuit.{c['id']}"
    put(f"{k}.name", c["name"])
    put(f"{k}.what", c["what"])
    walk_list(f"{k}.steps", c["steps"])
    put(f"{k}.caution", c.get("caution"))
    for i, pt in enumerate(c["parts"]):
        put(f"{k}.part.{i}", pt["label"])

# ---------------------------------------------------------------- sensors.json
s = json.loads((P / "sensors.json").read_text(encoding="utf-8"))
for x in s["analog"] + s["digital"]:
    put(f"sensor.{x['type']}.name", x.get("name"))
    for f in ("note", "desc", "hint"):
        put(f"sensor.{x['type']}.{f}", x.get(f))
    cal = x.get("cal") or {}
    for f in ("label", "hint", "p1", "p2", "note"):
        put(f"sensor.{x['type']}.cal.{f}", cal.get(f))
    walk_list(f"sensor.{x['type']}.cal.steps", cal.get("steps"))

# ---------------------------------------------------------------- experiments
for f in sorted((P / "experiments").glob("*.json")):
    e = json.loads(f.read_text(encoding="utf-8"))
    k = f"exp.{e['id']}"
    for fld in ("title", "subject", "summary"):
        put(f"{k}.{fld}", e.get(fld))
    for fld in ("level", "course", "area"):
        if e.get(fld):
            put(f"{fld}.{e[fld]}", e[fld])        # 공통 값 (찾기 화면의 단추·글자)
    put(f"{k}.x", e["x"]["label"])
    for i, y in enumerate(e["y"]):
        put(f"{k}.y.{i}", y["label"])
    if e.get("event"):
        put(f"{k}.event", e["event"]["label"])
        put(f"{k}.event.unit", e["event"]["unit"])
    put(f"{k}.markers.label", e["markers"]["label"])
    put(f"{k}.markers.prompt", e["markers"]["prompt"])
    walk_list(f"{k}.steps", e["steps"])
    walk_list(f"{k}.std", e.get("standardTexts"))
    st = e.get("setup") or {}
    walk_list(f"{k}.materials", st.get("materials"))
    walk_list(f"{k}.attach", st.get("attach"))
    walk_list(f"{k}.cautions", st.get("cautions"))
    for i, t in enumerate(e.get("textbooks") or []):
        put(f"{k}.tb.{i}.publisher", t["publisher"])
        put(f"{k}.tb.{i}.course", t["course"])
        put(f"{k}.tb.{i}.note", t["note"])
    if e.get("breadboard"):
        put(f"{k}.bb", e["breadboard"]["why"])

# ---------------------------------------------------------------- 화면 문구: web/src 의 t('…') · tk('…')
UI = re.compile(r"""\bt[k]?\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")""")
ui: dict[str, str] = {}
for f in sorted((ROOT / "web" / "src").rglob("*.ts*")):
    for m in UI.finditer(f.read_text(encoding="utf-8")):
        k = (m.group(1) if m.group(1) is not None else m.group(2)).replace("\\'", "'").replace('\\"', '"')
        if HANGUL.search(k):
            ui[k] = k
(P / "i18n" / "source" / "ui.json").write_text(json.dumps(ui, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("ui strings", len(ui), "chars", sum(len(v) for v in ui))

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(src, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("strings", len(src), "chars", sum(len(v) for v in src.values()), "->", OUT)
