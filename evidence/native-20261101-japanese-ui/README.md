# Native run: Japanese-first UI (v0.2.0) — 2026-11-01

Host: Adobe Premiere Pro 2026 26.5.2.5, UXP Developer Tools 2.3.0.5, one machine. Owner request: "Yes, add Japanese UI". Code: commit 706d487 (`src/i18n.js` with Japanese and English text, presence codes with parameters, a readable summary above the JSON, language toggle stored in the panel's localStorage; manifest 0.2.0). Disposable project `_qa_scratch\mid_test.prproj` (one red Color Matte clip). Panel reloaded with UDT "Reload"; it stayed docked.

## Observed
1. Panel in Japanese: title 「Mask Integrity Doctor（マスク確認）」, description, 「API を確認」「マスクの有無をスキャン」「レポートを保存（JSON）」 and an 「English」 button.
2. 「API を確認」 then 「マスクの有無をスキャン」: summary 「結果：PASS（正常）」, 「API：PASS（正常）（ObjectMaskUtils.hasObjectMask：あり、Exporter.exportSequenceFrame：あり）」, 「マスクの有無：PASS（正常）」, 「オブジェクトマスクのあるクリップ 0 件、ないクリップ 1 件。」, 「matte_red（トラック 1）：マスク なし」.
3. 「English」 redrew everything in English (“Overall: PASS”, “0 clip(s) with an object mask, 1 without.”, “matte_red (track 1): mask no”) without re-scanning; 「日本語」 switched back.
4. The JSON report itself stays English (labelled 「詳細（JSON・英語）」).

## Result
M10 Japanese UI with English toggle, docked: PASS_BOUNDED_NATIVE. Tests 23/23 (18 core + 5 translation coverage); static checks pass.

## Not established
Native-speaker review of the Japanese text; whether the language choice survives a Premiere restart (stored in UXP localStorage; not restarted).
