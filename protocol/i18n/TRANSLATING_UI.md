# UI strings (second file)

After content.json is done, also translate `protocol/i18n/source/ui.json` (≈420 short app UI strings; key = value = Korean) into `protocol/i18n/<lang>/ui.json` with the SAME keys.
- Use your glossary.json terms so the UI matches the quoted labels in content.json.
- Keep `{n}`, `{name}` etc. placeholders exactly; keep symbols (✓ → · …), units, A0/D2/USB/PDF/CSV names.
- Buttons/tabs: short. Messages: short complete sentences.
- "모둠" = group (school lab group). "측정" as a noun for one recording = run. "보드" = board (Arduino).
- Then run `python3 tools/i18n_check.py <lang>` — both content and ui must show 0 missing, 0 placeholder errors.
