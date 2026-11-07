# Premiere Mask Integrity Doctor — scope and test plan (DRAFT, 2026-11-01)

Status: DRAFT for owner approval. No repo, code or native run exists yet (this folder holds only this document, `PROJECT_LOG.md` and an ignored scratch folder).
Source: idea **32** in the Drive idea sheet (rank 3, sheet score 87, difficulty 4, feasibility "DOCUMENTED PATH", open-source threat LOW, workaround threat MODERATE, price idea ¥1,500–¥3,500). These are research-stage scores, not tested results.

## 1. What it is
A read-only Premiere Pro panel that checks the DELIVERY integrity of object-masked footage: it finds which clips/sequences use Object Masks, exports deterministic sample frames and short test encodes, and flags what can be observed from the outputs (render inconsistencies, Premiere-vs-Media Encoder differences). It does NOT read or reconstruct internal mask geometry/keyframes/tracking (not exposed by Adobe), create masks, or repair anything.

## 2. What the research says (Drive packets; sources NOT re-checked by me)
- Idea 32 notes: `ObjectMaskUtils.hasObjectMask`, `Exporter.exportSequenceFrame` and `EncoderManager.exportSequence` are documented in Premiere 26.x and support a bounded output-integrity prototype; JP/EN pain about Object Mask malfunctions, a 26.5.1 repeated-mask hang regression and mask-data loss in Project Manager handoff.
- **The latest cycle packets (2026-11-01 13:00) mark ID 32 HOLD** pending versioned host tests and buyer validation: availability of the API "does not establish internal mask tracking reconstruction or a robust export QC detector". Treat the product value as unproven.
- Standing standard from the same packets: Adobe products ship as a host-integrated DOCKABLE panel (UXP panel for Premiere).

## 3. Proposed MVP (bounded beta, same evidence standard as the other plugins)
1. **Presence report:** which clips/sequences in the open project report an object mask (via `ObjectMaskUtils.hasObjectMask`).
2. **Sample frames:** export N deterministic low-resolution frames at fixed times from a chosen sequence (`Exporter.exportSequenceFrame`) into a user-chosen folder.
3. **Determinism check:** export the same frames twice and compare bytes/hashes; a mismatch is a render-consistency warning.
4. **Optional parity check:** a short encode through the Premiere/Media Encoder path compared with the frame exports (only if the API allows it on the test host).
5. Verdicts: PASS / WARN / UNKNOWN per check; anything about mask internals is reported UNKNOWN, never guessed.
6. Output: dockable UXP panel + JSON/HTML report (like the Premiere Audio Doctor).

Out of scope: mask creation/tracking, leakage detection from geometry, root-cause diagnosis, any project edit.

## 4. Honest limits and unknowns (UNVERIFIED)
- "Blur/mosaic leakage" cannot be detected without knowing the mask geometry; frame-level analysis would only detect inconsistency between renders, not a wrong mask. This narrows the claim made by the research notes.
- Whether the three APIs behave as documented on the real Premiere 26.5.x host here is untested.
- Premiere work needs UXP Developer Tools, a loaded panel and manual UI steps; there is no scripting equivalent of my After Effects runs. The Premiere Audio Doctor took many bounded sessions of this kind.
- Object Mask fixtures must be created in the Premiere UI by hand (no way to generate them from a script); reproducing the 26.5.1 hang or the Project Manager handoff loss is NOT planned.
- No Mac; no Windows build matrix.

## 5. Test plan (this Windows machine, disposable Premiere project only)
| ID | Case | Status |
|---|---|---|
| M01 | Panel loads in UDT, dockable, closes cleanly | NOT_RUN |
| M02 | Project with no masks → presence report shows none | NOT_RUN |
| M03 | Project with one Object-Masked clip → presence report finds it | NOT_RUN |
| M04 | Sample-frame export of N frames succeeds into a chosen folder | NOT_RUN |
| M05 | Double export produces identical hashes (determinism) | NOT_RUN |
| M06 | Forced failure (read-only target folder) is reported, not hidden | NOT_RUN |
| M07 | Short encode / AME parity | NOT_RUN — only if the API supports it here |
| M08 | Reproduce 26.5.1 repeated-mask hang or Project Manager handoff loss | NOT_RUN — not planned |

Native results would cover this machine and Premiere build only.

## 6. Time estimate (mine, not measured)
About 6–10 working days (UXP panel scaffold, API probing on the real host, hand-built fixtures, bounded native runs, docs). This is the heaviest of the candidate ideas.

## 7. Alternatives that are cheaper (from the sheet, same research caveats)
- AE Media Reopen Integrity Doctor (53, rank 6, "PLAUSIBLE", difficulty 4).
- AE Object Matte Integrity Doctor (32-A, rank 17, "DOCUMENTED PATH", difficulty 4).
- Reuse the After Effects scripting approach already proven for the Write Sentinel and Unicode Guard.

## 8. Decisions needed from owner
1. Approve this scope (accepting the narrowed "delivery consistency only" claim and the HOLD note), or pick an alternative from section 7.
2. Create the local repo `Premiere-Mask-Integrity-Doctor` in this folder?
3. OK to drive Premiere (UXP Developer Tools and the Premiere UI) for native tests, with a disposable project?
