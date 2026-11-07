> **Historical status document (last updated 2026-11-01).** For current status see [PROJECT_STATUS.md](PROJECT_STATUS.md). Content below is kept unchanged for history; known outdated: stops at 55/55 automated tests (62/62 in the 2026-11-04 audit) and has no 2026-11-02 package/install rows.

# Test matrix

Evidence classes: VERIFIED_THIS_SESSION, HISTORICAL_RECORDED, UNVERIFIED, NOT_RUN, BLOCKED. Native results are never claimed from mock tests or CI.

## Automated (test doubles, not host evidence) - 23/23 pass 2026-11-01 (incl. 5 translation-coverage tests)
Verdict ordering, sample times, tick conversion, presence (API missing, counts, unreadable, empty), export (ok, false, 0 bytes, error text, none), buffer comparison, determinism (identical, differing, unreadable, difference outranks unreadable), API probe summary, diagnostic-matrix summary, per-attempt export details, report assembly. Static checks: syntax, host-independent core, no project-mutating tokens, dockable panel manifest.

## Native Premiere (disposable project only)
| ID | Case | Status |
|---|---|---|
| M01 | Panel loads in UDT, is dockable; Probe API lists the classes/functions | PASS_BOUNDED_NATIVE 2026-11-01 (loads, docks, survives Reload; `hasObjectMask` and `exportSequenceFrame` present). Close behaviour not separately tested |
| M02 | Sequence with no masks: presence report | Recorded PASS 2026-11-01 is **INVALID** (the call could only return false); unmasked clips are reported correctly in the v0.3 run (2 of 3 clips) |
| M03 | Sequence with one Object-Masked clip: presence finds it | PASS_BOUNDED_NATIVE 2026-11-01 (v0.3 saved-file reader; generated fixture with a real Object Mask; evidence/native-20261101-v030). v0.2 per-clip `hasObjectMask(clip)` was WRONG (always false) |
| M04 | Export 4 frames succeeds into a chosen folder | **FAIL** 2026-11-01 (now OUT OF SCOPE: export disabled in the beta): `exportSequenceFrame` returned false in all 16 tried parameter combinations, no file written, cause UNKNOWN (see evidence/native-20261101-m01-m04) |
| M05 | Two exports are byte-identical (determinism) | OUT OF SCOPE (disabled in the presence-only beta; was BLOCKED by M04) |
| M06 | Forced failure (read-only folder) reported, not hidden | OUT OF SCOPE (export disabled) |
| M09 | Presence-only panel v0.1.0 after the scope cut: Probe, Scan, Save report | PASS_BOUNDED_NATIVE 2026-11-01 (evidence/native-20261101-presence-only) |
| M10 | Japanese-first UI with English toggle, docked (v0.2.0) | PASS_BOUNDED_NATIVE 2026-11-01 (evidence/native-20261101-japanese-ui) |
| M11 | Coloured result badge (green PASS path) | PASS_BOUNDED_NATIVE 2026-11-01 (evidence/native-20261101-readability); red/amber unit-tested only |
| M07 | Short encode / AME parity | NOT_RUN (not implemented) |
| M08 | Reproduce 26.5.1 repeated-mask hang / handoff loss | NOT_RUN (not planned) |
| M12-M20 | v0.3: partly-masked media, preview/Show, disabled + hidden track, folder missing, mask files missing, unsaved changes, Japanese + all sequences, chips/filter, save beside project | PASS_BOUNDED_NATIVE 2026-11-01 (evidence/native-20261101-v030) |

## Automated v0.3 - 49/49 pass 2026-11-01
Adds: mask-folder path, timecode, display path, integrity rules (folder missing/empty/unchecked, per-mask data missing, disabled, hidden track, partly masked, unsaved, unreadable, unlocated, API missing), timeline layout, saved-mask matching, gzip inflate vs zlib (stored/fixed/dynamic), base64, synthetic project parse, real local project (skipped in CI), i18n coverage of every finding code. Static checks: only one file write (the report).
| M21-M29 | Round 2: two masks per clip, one mask's data lost, nested sequence (v0.3.0 false PASS -> fixed in v0.3.1), nested data lost, all sequences, Show across sequences, language after reload; docked NOT_RUN | evidence/native-20261101-v031 |

## Automated v0.3.1 - 53/53 pass 2026-11-01
Adds: nested-sequence link in the reader, nested masks collected (and loop-safe), nested data missing, project masks elsewhere, corrected presence count, i18n coverage of the new codes.
| M31-M32 | Masked clip on V2; hidden V2 warning | PASS_BOUNDED_NATIVE 2026-11-01 (evidence/native-20261101-v031-v2track) |
| M29 | v0.3.1 docked | NOT_RUN (automated dragging cannot dock; do it by hand) |
| M33-M34 | Real recorded video: tracked object mask found; its data files removed -> FAIL for that mask only | PASS_BOUNDED_NATIVE 2026-11-01 (evidence/native-20261101-real-footage) |
| M29 | v0.3.x docked (owner docked it by hand) | PASS_BOUNDED_NATIVE 2026-11-01 (evidence/native-20261101-v032-docked); supersedes the earlier NOT_RUN |
| M35-M37 | Long names in the narrow dock: finding chips and timeline labels (v0.3.2 fix) | PASS_BOUNDED_NATIVE 2026-11-01 (same folder) |

## Automated v0.3.2 - 55/55 pass 2026-11-01
Adds: shortName, blockLabel.
