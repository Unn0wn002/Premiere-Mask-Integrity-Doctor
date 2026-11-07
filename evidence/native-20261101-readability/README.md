# Native run: coloured result badge — 2026-11-01

Owner request: make the plugins' UI easier to see. Code: commit bb9c755 (coloured badge for the overall result: PASS green, WARN amber, FAIL red, other grey; `tone()` in the core, unit-tested). UDT Reload in Premiere 26.5.2.5 (one machine), disposable project `_qa_scratch\mid_test.prproj`.

## Observed
「API を確認」 then 「マスクの有無をスキャン」 → a large green badge 「結果：PASS（正常）」 above the Japanese summary. Red/amber badges not shown natively (unit-tested only).

## Result
M11 coloured result badge (green path): PASS_BOUNDED_NATIVE. Tests 24/24.
