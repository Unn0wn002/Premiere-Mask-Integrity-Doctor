# Changelog

## Unreleased
- 2026-11-01: v0 code (core, adapter, panel, manifest), 15 unit tests, static checks. Not loaded in Premiere.
- 2026-11-01 (later): native M01/M02 PASS, M04 FAIL (exportSequenceFrame returned false in all tried combinations), M05 BLOCKED; panel gained per-attempt diagnostics and a diagnostic-matrix button; 17 tests.
- 2026-11-01 (owner decision): presence-only beta v0.1.0 — panel cut to Probe API / Scan mask presence / Save report; per-clip detail added; export code disabled; 18 tests; native re-check PASS.
- 2026-11-01 (later): v0.2.0 Japanese-first UI with English toggle, readable summary, presence codes; 23 tests; native check PASS.
- 2026-11-01 (later): readability: large coloured result line/badge (green/amber/red); tone mapping unit-tested; native check recorded; 24 tests.
- 2026-11-01 (later): **v0.3.0** integrity scan + preview UI (owner: "complete it, improve the features and the result preview UI").
  - Found natively: `hasObjectMask` accepts only a Project/Sequence, so v0.1/v0.2 per-clip results were always false (corrected; see evidence/native-20261101-v030).
  - Per-clip masks from the saved project file (`src/projectFile.js`: own gzip inflate + XML mapping); sequence/project flags from `hasObjectMask`.
  - New checks: mask data folder missing/empty (FAIL), a mask's data files missing (FAIL), same media partly masked, masked clip disabled / on hidden track (WARN), unsaved changes, unreadable file, unlocated sequence mask, API missing (UNKNOWN).
  - New UI: scope chips, blue Scan, counters, findings with Show buttons, clickable timeline map, filterable clip list with timecodes; Show moves the playhead (preview).
  - Save report writes JSON next to the project (UXP save dialog never opened on this build). Manifest: fullAccess file permission.
  - 49 tests (incl. inflate vs zlib, synthetic project, real local project); static checks restrict writes to the report.
- 2026-11-01 (evening): **v0.3.1** after test round 2 (owner: "do the test for v0.3.0"). Found natively: an outer sequence that only nests a masked sequence got a false PASS (`hasObjectMask(sequence)` is false there). Now nested sequences are followed and their masks' data checked; project-level masks elsewhere are pointed out; chips show mask counts. Save dialog correction: it opens behind Premiere. 53 tests. Evidence: evidence/native-20261101-v031.
- 2026-11-01 (night): **v0.3.2** after the owner docked the panel and reported clipped text. Finding "Show" buttons are wrapping chips with shortened names; timeline labels fit the block width (ellipsis). 55 tests; verified in the docked panel. Evidence: evidence/native-20261101-v032-docked.
