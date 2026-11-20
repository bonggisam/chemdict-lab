"""
화면 디자인 10가지 만들기 → protocol/themes.json + web/src/styles.css 의 THEMES 구간

- 실행: python3 tools/make_themes.py   (색을 고치면 다시 실행. themes.json·styles.css의 THEMES 구간은 직접 고치지 않음)
- 웹앱은 <html data-theme="디자인 id" data-scheme="light|dark"> 로 고른다 (web/src/lib/theme.ts).
- 애플 앱은 tools/make_palettes.py 가 themes.json 을 읽어 Palettes.swift 를 만든다.
- 모든 디자인이 글자 대비(WCAG 2.1 AA)를 넘어야 파일을 쓴다. 기준은 docs/DESIGN.md "화면 디자인".
- 측정(run) 색·주의·위험 색은 디자인마다 바꾸지 않는다 (밝은 화면용 / 어두운 화면용 두 벌).
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "protocol" / "themes.json"
CSS = ROOT / "web" / "src" / "styles.css"
BEGIN = "/* THEMES:BEGIN — tools/make_themes.py 가 만든 구간입니다. 직접 고치지 마세요. */"
END = "/* THEMES:END */"

BRAND_DEEP = "#0f1a17"   # 민트·강조 빛 위의 글자 (단계 원 '끝남')
WHITE = "#ffffff"

# 밝은 화면·어두운 화면에 공통인 색 (디자인마다 같음)
SERIES = {"light": ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"],
          "dark": ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"]}
STATE = {"light": dict(mark="#c2410c", danger="#c62828", dangerInk="#ffffff", ok="#15803d", pin="#1d5fb0"),
         "dark": dict(mark="#ff8a52", danger="#f87171", dangerInk="#0f1a17", ok="#4ade80", pin="#8cbcff")}

# ---- 밝은 디자인 6가지: 바탕·글자·강조(accent)·빛(glow)·중간(mid)만 정하면 나머지는 계산
LIGHT = [
    dict(id="light", name="민트", bg="#f7f8f7", surface="#ffffff", ink="#16201c", muted="#55625c", line="#e3e7e5", field="#7a8d85",
         accent="#007a5e", glow="#00d49a", mid="#00b386", badgeInk="#00664e",
         # 2.0 기본 화면과 똑같이 유지
         chromeStrong="#0f1a17", chromeFaint="#66736d", chromeBtnLine="#cfd7d3", mutedHc="#2b3a33"),
    dict(id="ocean", name="바다", bg="#f4f8fb", surface="#ffffff", ink="#13202b", muted="#51616f", line="#dfe7ee", field="#73889b",
         accent="#0a67a3", glow="#38b2f5", mid="#1c93dc", badgeInk="#08507f"),
    dict(id="lavender", name="라벤더", bg="#f8f6fc", surface="#ffffff", ink="#1e1a2b", muted="#5d5870", line="#e7e3f0", field="#857c9e",
         accent="#6941c6", glow="#a78bfa", mid="#8b5cf6", badgeInk="#53329e"),
    dict(id="blossom", name="벚꽃", bg="#fcf6f8", surface="#ffffff", ink="#2a1a20", muted="#6b5560", line="#f0e2e7", field="#9a7c88",
         accent="#b0306a", glow="#f472b6", mid="#e04e94", badgeInk="#8c2354"),
    dict(id="paper", name="종이", bg="#f6f1e7", surface="#fffdf8", ink="#2b2418", muted="#655a48", line="#e6dcc8", field="#8d7f66",
         accent="#7a4b12", glow="#d9a04a", mid="#b9812f", badgeInk="#5f3a0d"),
    dict(id="mono", name="흑백", bg="#f5f5f6", surface="#ffffff", ink="#18181b", muted="#55565c", line="#e4e4e7", field="#7c7d86",
         accent="#2f3542", glow="#8b93a7", mid="#5f6779", badgeInk="#2b303b"),
]

# ---- 어두운 디자인 4가지 (fill: 애플 앱의 채운 버튼 바탕 — 글자가 늘 흰색이라 강조색보다 어두운 색을 따로 둠. 웹은 --accent + --accent-ink)
DARK = [
    dict(id="dark", name="숲", bg="#0b1411", surface="#13211c", ink="#e3eee9", muted="#93a89f", line="#24362f", field="#5f7770",
         accent="#2ee6b0", accentInk="#06231a", glow="#00d49a", mid="#00b386",
         chromeBg="#0f1a17", chromeBg2="#17271f", chromeInk="#e8f3ee", chromeMuted="#b9cdc4", chromeFaint="#8aa298", chromeNInk="#d6efe5",
         selBg="#0f1a17", badgeBg="#0f1a17", badgeInk="#00d49a", mutedHc="#c9d8d1", fill="#007a5e"),
    dict(id="board", name="칠판", bg="#16291f", surface="#1d3528", ink="#f1f5ea", muted="#a9bfae", line="#31503e", field="#6f8d79",
         accent="#ffd866", accentInk="#2a2203", glow="#ffd866", mid="#e6bd45",
         chromeBg="#11221a", chromeBg2="#193025", chromeInk="#f1f5ea", chromeMuted="#bfd0c2", chromeFaint="#93ab99", chromeNInk="#ffe9a8",
         selBg="#0c1a13", badgeBg="#0c1a13", badgeInk="#ffd866", fill="#8c6a00"),
    dict(id="navy", name="밤바다", bg="#0b1220", surface="#131d31", ink="#e3eaf6", muted="#94a3ba", line="#24314a", field="#5f7191",
         accent="#6cb6ff", accentInk="#06182b", glow="#4aa3ff", mid="#2f8be6",
         chromeBg="#0d1526", chromeBg2="#162238", chromeInk="#e8eef8", chromeMuted="#b9c6da", chromeFaint="#8798b3", chromeNInk="#d6e6fb",
         selBg="#0a1120", badgeBg="#0a1120", badgeInk="#6cb6ff", fill="#1f6fd1"),
    dict(id="contrast", name="고대비", bg="#000000", surface="#101010", ink="#ffffff", muted="#c8c8c8", line="#3d3d3d", field="#8f8f8f",
         accent="#ffd60a", accentInk="#000000", glow="#ffd60a", mid="#e6c009",
         chromeBg="#000000", chromeBg2="#151515", chromeInk="#ffffff", chromeMuted="#d0d0d0", chromeFaint="#a8a8a8", chromeNInk="#ffe566",
         selBg="#262626", badgeBg="#1c1c1c", badgeInk="#ffd60a", fill="#1456d9"),
]


# ---------------------------------------------------------------- 색 계산
def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hexs(c):
    return "#%02x%02x%02x" % tuple(round(x) for x in c)


def mix(a, b, t):
    """색 a를 불투명도 t로 b 위에 얹은 색"""
    A, B = rgb(a), rgb(b)
    return hexs(tuple(A[i] * t + B[i] * (1 - t) for i in range(3)))


def lum(h):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb(h)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def cr(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def rgbs(h):
    return ", ".join(str(v) for v in rgb(h))


def rgba(h, a):
    return f"rgba({rgbs(h)}, {a})"


# ---------------------------------------------------------------- 토큰 채우기
def fill_light(p):
    s = p["surface"]
    t = dict(p)
    t["scheme"] = "light"
    t["accentInk"] = WHITE
    t["tint"] = mix(p["mid"], s, 0.10)
    t["chromeBg"] = s
    t["chromeBg2"] = s
    t["chromeInk"] = p["ink"]
    t.setdefault("chromeStrong", p["ink"])
    t["chromeMuted"] = p["muted"]
    t.setdefault("chromeFaint", mix(p["muted"], WHITE, 0.88))
    t["chromeLine"] = p["line"]
    t["chromeBtn"] = p["bg"]
    t.setdefault("chromeBtnLine", mix(p["field"], p["line"], 0.2))
    t["chromeNInk"] = p["accent"]
    t["selBg"] = p["accent"]
    t["selInk"] = WHITE
    t["badgeBg"] = mix(p["mid"], s, 0.14)
    t["fill"] = p["accent"]
    t.setdefault("mutedHc", mix(p["ink"], p["muted"], 0.7))
    t["css"] = {
        "--tint": rgba(p["mid"], "0.10"),
        "--badge-bg": rgba(p["mid"], "0.14"),
        "--chrome-hover": rgba(p["ink"] if p["id"] != "light" else BRAND_DEEP, "0.05"),
        "--chrome-line": p["line"],
        "--chrome-btn": p["bg"],
        "--chrome-btn-line": t["chromeBtnLine"],
        "--shadow": f"0 1px 0 {p['line']}, 0 6px 18px -10px {rgba(p['ink'] if p['id'] != 'light' else BRAND_DEEP, '0.15')}",
    }
    return t


def fill_dark(p):
    s = p["surface"]
    t = dict(p)
    t["scheme"] = "dark"
    t["tint"] = mix(p["accent"], s, 0.12)
    t["chromeStrong"] = WHITE
    t["chromeLine"] = mix(WHITE, p["chromeBg"], 0.08)
    t["chromeBtn"] = mix(WHITE, p["chromeBg"], 0.06)
    t["chromeBtnLine"] = mix(WHITE, p["chromeBg"], 0.16)
    t["selInk"] = WHITE
    t.setdefault("mutedHc", mix(p["ink"], p["muted"], 0.6))
    t["css"] = {
        "--tint": rgba(p["accent"], "0.12"),
        "--badge-bg": p["badgeBg"],
        "--chrome-hover": "rgba(255, 255, 255, 0.05)",
        "--chrome-line": "rgba(255, 255, 255, 0.08)",
        "--chrome-btn": "rgba(255, 255, 255, 0.06)",
        "--chrome-btn-line": "rgba(255, 255, 255, 0.16)",
        "--shadow": "0 1px 0 rgba(0, 0, 0, 0.3), 0 8px 22px -10px rgba(0, 0, 0, 0.6)",
    }
    return t


# ---------------------------------------------------------------- 대비 검사
def check(t):
    bad = []

    def need(label, a, b, m):
        v = cr(a, b)
        if v < m:
            bad.append(f"{t['id']}: {label} {v:.2f} < {m}")

    sch, s, b = t["scheme"], t["surface"], t["bg"]
    for where, base in (("바탕", b), ("카드", s)):
        need(f"글자/{where}", t["ink"], base, 7)
        need(f"흐린 글자/{where}", t["muted"], base, 4.5)
        need(f"대비 높인 흐린 글자/{where}", t["mutedHc"], base, 7)
        need(f"강조/{where}", t["accent"], base, 4.5)
        need(f"입력칸 테두리/{where}", t["field"], base, 3)
    need("강조 버튼 글자", t["accentInk"], t["accent"], 4.5)
    need("고른 칩 글자", t["selInk"], t["selBg"], 4.5)
    need("채운 버튼 글자(애플)", WHITE, t["fill"], 4.5)
    need("채운 버튼/카드(애플)", t["fill"], t["surface"], 1.5)
    need("배지 글자", t["badgeInk"], t["badgeBg"], 4.5)
    need("강조/옅은 강조 바탕", t["accent"], t["tint"], 4.5)
    need("글자/옅은 강조 바탕", t["ink"], t["tint"], 7)
    need("끝난 단계 번호", BRAND_DEEP, t["glow"], 4.5)
    for k in ("chromeInk", "chromeStrong", "chromeMuted", "chromeFaint", "chromeNInk"):
        need(f"{k}/목차", t[k], t["chromeBg"], 4.5)
        need(f"{k}/위쪽 띠", t[k], t["chromeBg2"], 4.5)
    st = STATE[sch]
    for k in ("mark", "danger", "ok", "pin"):
        need(f"{k}/카드", st[k], s, 4.5)
        need(f"{k}/바탕", st[k], b, 4.3)
    need("위험 버튼 글자", st["dangerInk"], st["danger"], 4.5)
    if sch == "dark":   # 밝은 화면의 측정 색은 흰 카드 기준으로 이미 검증한 값 (dataviz 검증기)
        for i, c in enumerate(SERIES[sch]):
            need(f"측정 색 {i + 1}/그래프", c, s, 3)
    return bad


# ---------------------------------------------------------------- CSS
def css_block(t):
    sch = t["scheme"]
    st, se, c = STATE[sch], SERIES[sch], t["css"]
    sel = ':root, :root[data-theme="light"]' if t["id"] == "light" else f':root[data-theme="{t["id"]}"]'
    lines = [
        f"--bg: {t['bg']}; --surface: {t['surface']}; --ink: {t['ink']}; --muted: {t['muted']}; --muted-hc: {t['mutedHc']}; --line: {t['line']}; --field: {t['field']};",
        f"--accent: {t['accent']}; --accent-ink: {t['accentInk']}; --tint: {c['--tint']};",
        f"--mint: {t['glow']}; --mint-2: {t['mid']}; --glow-rgb: {rgbs(t['glow'])}; --mid-rgb: {rgbs(t['mid'])};",
        f"--mark: {st['mark']}; --danger: {st['danger']}; --danger-ink: {st['dangerInk']}; --ok: {st['ok']}; --pin: {st['pin']};",
        "".join(f"--s{i + 1}: {v}; " for i, v in enumerate(se)).strip(),
        f"--shadow: {c['--shadow']};",
        f"--chrome-bg: {t['chromeBg']}; --chrome-bg-2: {t['chromeBg2']}; --chrome-ink: {t['chromeInk']}; --chrome-strong: {t['chromeStrong']};",
        f"--chrome-muted: {t['chromeMuted']}; --chrome-faint: {t['chromeFaint']}; --chrome-hover: {c['--chrome-hover']};",
        f"--chrome-line: {c['--chrome-line']}; --chrome-btn: {c['--chrome-btn']}; --chrome-btn-line: {c['--chrome-btn-line']}; --chrome-n-ink: {t['chromeNInk']};",
        f"--sel-bg: {t['selBg']}; --sel-ink: {t['selInk']}; --badge-bg: {c['--badge-bg']}; --badge-ink: {t['badgeInk']};",
        f"color-scheme: {sch};",
    ]
    return f"/* {t['name']} ({t['id']}) */\n{sel} {{\n" + "\n".join("  " + x for x in lines) + "\n}"


JSON_KEYS = ["bg", "surface", "ink", "muted", "line", "field", "accent", "accentInk", "tint", "glow", "mid",
             "chromeBg", "chromeBg2", "chromeInk", "chromeStrong", "chromeMuted", "chromeFaint", "chromeLine",
             "chromeBtn", "chromeBtnLine", "chromeNInk", "selBg", "selInk", "badgeBg", "badgeInk", "fill"]


def main():
    designs = [fill_light(p) for p in LIGHT] + [fill_dark(p) for p in DARK]
    ids = [d["id"] for d in designs]
    assert len(set(ids)) == len(ids), "디자인 id가 겹칩니다"
    bad = [m for d in designs for m in check(d)]
    if bad:
        print("대비가 모자랍니다:")
        for m in bad:
            print("  ✗", m)
        sys.exit(1)

    out = {
        "v": 1,
        "default": "light",
        "system": {"light": "light", "dark": "dark"},   # '기기 설정 따르기'가 고르는 디자인
        "series": SERIES,
        "state": STATE,
        "designs": [{
            "id": d["id"], "name": d["name"], "scheme": d["scheme"],
            "swatch": [d["bg"], d["accent"], d["glow"]],   # 고르기 칩에 보이는 색: 바탕 · 강조 · 빛
            "tokens": {k: d[k] for k in JSON_KEYS},
        } for d in designs],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    css = CSS.read_text(encoding="utf-8")
    block = BEGIN + "\n" + "\n".join(css_block(d) for d in designs) + "\n" + END
    pat = re.compile(re.escape(BEGIN) + r".*?" + re.escape(END), re.S)
    if not pat.search(css):
        print("styles.css에 THEMES 구간 표시가 없습니다."); sys.exit(1)
    CSS.write_text(pat.sub(lambda _: block, css), encoding="utf-8")
    print(f"디자인 {len(designs)}가지 (밝은 {len(LIGHT)} · 어두운 {len(DARK)}), 대비 검사 통과 → {OUT.relative_to(ROOT)}, {CSS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
