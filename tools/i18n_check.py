"""
번역 파일 확인: python3 tools/i18n_check.py [lang ...]
- 빠진 키, 남은 한글, {자리표시} 불일치, 숫자 불일치(경고)를 보여 줍니다.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
I18N = ROOT / "protocol" / "i18n"
SRC = {"content": json.loads((I18N / "source" / "content.json").read_text(encoding="utf-8"))}
ui = I18N / "source" / "ui.json"
if ui.exists():
    SRC["ui"] = json.loads(ui.read_text(encoding="utf-8"))
HANGUL = re.compile(r"[가-힣]")
PH = re.compile(r"\{[a-zA-Z0-9_]+\}")
NUM = re.compile(r"\d+(?:[.,]\d+)?")

langs = sys.argv[1:] or sorted(p.name for p in I18N.iterdir() if p.is_dir() and p.name != "source")
bad = 0
for lang in langs:
    for name, src in SRC.items():
        f = I18N / lang / f"{name}.json"
        if not f.exists():
            print(f"{lang}/{name}: 파일 없음"); bad += 1; continue
        tr = json.loads(f.read_text(encoding="utf-8"))
        missing = [k for k in src if not tr.get(k)]
        extra = [k for k in tr if k not in src]
        hangul = [k for k, v in tr.items() if k in src and HANGUL.search(v)]
        ph = [k for k in src if k in tr and sorted(PH.findall(src[k])) != sorted(PH.findall(tr[k]))]
        nums = [k for k in src if k in tr and sorted(set(NUM.findall(src[k].replace(",", "")))) != sorted(set(NUM.findall(tr[k].replace(",", ""))))]
        print(f"{lang}/{name}: {len(tr)}/{len(src)}  빠짐 {len(missing)}  남는키 {len(extra)}  한글 {len(hangul)}  자리표시 {len(ph)}  숫자경고 {len(nums)}")
        for k in (missing[:5] + ph[:5]):
            print("   ", k, "|", src.get(k, "")[:60])
        bad += len(missing) + len(ph)
sys.exit(1 if bad else 0)
