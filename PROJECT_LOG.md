# Premiere Mask Integrity Doctor - project log

Evidence classes: VERIFIED_THIS_SESSION, HISTORICAL_RECORDED, USER_STATED, UNVERIFIED, NOT_RUN, BLOCKED. Last updated: 2026-11-01. Not a release record.

## Identity
Research idea **32** (rank 3, sheet score 87, difficulty 4). Read-only Premiere Pro panel for object-mask delivery integrity. Folder `02_Projects\Premiere-Mask-Integrity-Doctor`. Branch `main`, pushed to the private GitHub repo Unn0wn002/Premiere-Mask-Integrity-Doctor (2026-11-01).

## Where the records are
`docs/PROJECT_SPECIFICATION.md` (scope, approved by the owner 2026-11-01), `PROJECT_STATUS.md`, `TEST_MATRIX.md`, `KNOWN_LIMITATIONS.md`, `CHANGELOG.md`, shared `HANDOFF_LOG_2026-10-29.md`.

## Timeline
- 2026-11-01 [VERIFIED_THIS_SESSION]: folder created inside 02_Projects per the owner's folder rule; scope drafted from sheet idea 32 and the Drive packets.
- 2026-11-01 [VERIFIED_THIS_SESSION]: owner approved the scope; repo created; v0 core, adapter, panel and manifest written; 15 unit tests and static checks pass. Nothing was loaded in Premiere.
- 2026-11-01 [Adobe docs read via a fetch tool]: `exportSequenceFrame(sequence, time, filename, filepath, width, height)` since 25.6; `ObjectMaskUtils` class since 26.3.0; `hasObjectMask` signature not found (UNVERIFIED).
- 2026-11-01 [Drive packet CYCLE-20261101-1300WIB__PREMIERE, HISTORICAL_RECORDED, not re-verified]: ID 32 = HOLD pending host and buyer validation.

## Native run (2026-11-01, owner authorized driving Premiere)
- Premiere 26.5.2.5 and UDT 2.3.0.5; disposable project `_qa_scratch\mid_test.prproj` with a red Color Matte sequence. Panel loaded via UDT (no install), docked beside Properties.
- M01 PASS; M02 PASS; M04 FAIL after one panel fix and one 16-combination diagnostic (all `returned=false`); M05 BLOCKED. Evidence: `evidence/native-20261101-m01-m04/`.

## Scope decision (2026-11-01, owner)
Presence-only beta. The panel was cut to Probe API, Scan mask presence and Save report (v0.1.0); export code is kept but disabled. Re-verified natively: `evidence/native-20261101-presence-only/` (overall PASS).

## Current state
Presence-only beta v0.1.0; 18/18 unit tests. Native (Premiere 26.5.2.5): M01 PASS, M02 PASS, M04 FAIL, M05/M06 out of scope, M03 NOT_RUN.

## Open items
Cause of `exportSequenceFrame` returning false is UNKNOWN. The Mask Doctor's value is unproven (HOLD in research packets) and now only half-working. Premiere was left open with the disposable project and the panel loaded in UXP Developer Tools.

## Next step
Test a clip with a real Object Mask (needs real footage) before calling presence detection proven; otherwise leave as a bounded presence-only beta.
- 2026-11-01: counts as plugin 6 of the owners course set (bounded presence-only beta).

- 2026-11-01 quality review across all six plugins: see `02_Projects\_docs\QUALITY_REVIEW_20261101.md`.
- 2026-11-01 (later): Japanese-first UI (v0.2.0) added on the owner's request; UDT reload; Japanese and English summaries verified in Premiere. Evidence: `evidence/native-20261101-japanese-ui/`. Japanese wording not native-reviewed.
- 2026-11-01 (later): owner said "push them and set it Private". Created PRIVATE GitHub repo https://github.com/Unn0wn002/Premiere-Mask-Integrity-Doctor and pushed `main` (6d5698c); first CI run `validation` succeeded. Not released, not public.
- 2026-11-01 (later): readability pass on the owner's request ("All six"): coloured result line/badge; native check recorded in `evidence/native-20261101-readability/`. Pushed to the private repo.

- 2026-11-01 (later, owner: "Start with Premiere Mask Doctor, we need to complete it, and improving the Feature, include the UI ... better Preview UI"): **v0.3.0**.
  - Built a real Object Mask test (generated PNG-sequence fixture, `_qa_scratch\mid_mask_test.prproj`). Found that `hasObjectMask` takes a Project/Sequence only, so v0.1/v0.2 per-clip results were always false (correction recorded; old evidence left unchanged).
  - Found Premiere keeps mask data in `<project> Masks\*.prmf` and that the saved .prproj maps clips -> masks -> data GUIDs. New pure reader `src/projectFile.js`.
  - New checks and preview UI (see CHANGELOG). Native M03 + M12-M20 PASS_BOUNDED_NATIVE: `evidence/native-20261101-v030/`. 49/49 tests, static checks ok.
  - Host behaviours recorded: missing folder error `-4058`; save dialog never opens from the floating panel (report now written beside the project); Premiere re-copies mask data when a copied project's original folder is still reachable.
  - Left open in Premiere: `mid_mask_handoff.prproj` (unmodified; its re-created Masks folder restored) and `mid_mask_test.prproj`; panel floating. Not pushed (needs owner's yes).
- 2026-11-01 (later, owner: "Yes, push it"): pushed `main` 59541fc..83314d8 to the PRIVATE repo; CI `validation` run 41318657679 succeeded. Not released, not public.
- 2026-11-01 (evening, owner: "i like the new ui ... do the test for v0.3.0"): test round 2 in `_qa_scratch\mid_v030b.prproj` (two-subject fixture, two masks on one clip, a nesting sequence). Found and fixed a false PASS for sequences that only nest masked ones -> **v0.3.1** (nested masks followed and data-checked, project-level hint, mask counts in chips). Also corrected the save-dialog note: dialogs open behind Premiere (four stale ones found and cancelled). M21-M28 PASS_BOUNDED_NATIVE, M29 docked NOT_RUN. 53/53 tests. Evidence `evidence/native-20261101-v031/`. Committed locally, not pushed.
- 2026-11-01 (evening, owner: "yes push it"): pushed `main` 5b94efa..8ebc610 (v0.3.1) to the PRIVATE repo; CI `validation` succeeded. Not released, not public.
- 2026-11-01 (night, owner: "start test it"): tested a masked clip on V2 (found, green lane) and on a hidden V2 (WARN) in `mid_v030b.prproj` (moved with Alt+Up, saved, V2 visibility restored). Docking retry failed again (no drop target). Evidence `evidence/native-20261101-v031-v2track/`. No code changes.
- 2026-11-01 (night, owner: "Yes, push it"): pushed `main` c480433..f851f09 (V2 test evidence) to the PRIVATE repo; CI `validation` succeeded.
- 2026-11-01 (night, owner: "do the next actions"): tested real footage (the owner's 13 Oct Roblox screen recording, imported by reference, source untouched): tracked mask found, removing its two data files gave FAIL for that mask only. Evidence `evidence/native-20261101-real-footage/` (panel crops only). No code changes. Docking still needs the owner's hands. Project `_qa_scratch\mid_v030c.prproj` left open in Premiere.
- 2026-11-01 (night, owner: "Yes, push it"): pushed `main` f851f09..cee2c9d (real-footage evidence) to the PRIVATE repo; CI `validation` succeeded.
- 2026-11-01 (night, owner docked the panel and reported clipped text): fixed in **v0.3.2** (wrapping Show chips with shortened names, timeline labels fit the block). Docked panel verified natively (M29 now PASS_BOUNDED_NATIVE). 55/55 tests. Evidence `evidence/native-20261101-v032-docked/`. Mask test files restored; Premiere left open on `mid_v030c.prproj` with the panel docked.
- 2026-11-01 (night, owner: "Yes, push it"): pushed `main` d392520..5a2c24f (v0.3.2) to the PRIVATE repo; CI `validation` succeeded.

- 2026-11-02 (owner: "Do 3 Recommendation"/"continue the project"): packaged Mask Integrity Doctor 0.3.2 (packaging scripts adapted from the Audio Doctor; staging ab69efc12ed2; CCX made with UDT Package, sha256 c6b36333...), archive integrity PASS; INSTALLED through Creative Cloud in the owner's normal profile (no UAC), installed files equal the package; installed panel scanned `mid_v030b.prproj` floating and docked: PASS, 1 masked clip. Clean-profile cases NOT_RUN. UDT binding for this plugin restored to the repository manifest. Evidence `evidence/native-20261102-package-install/`. Branch `release/package-0.3.2-20261102`, NOT pushed.
- 2026-11-06 — Status files reconciled (owner-approved status-file cleanup): `PROJECT_STATUS.md` gained an authoritative "Current status — 2026-11-06" section above the unchanged earlier entries; historical banners added at the top of `KNOWN_LIMITATIONS.md` and `TEST_MATRIX.md`; the README status sentence now says 0.3.2 / `fd20bcd` and points to `PROJECT_STATUS.md`. Recorded from git: the release branch is on origin and merged into `main` via PR #1 (supersedes the 2026-11-02 "NOT pushed" note). No evidence, source, tests, scripts or manifests were changed, no tests were run, and nothing was committed.
- 2026-11-07 (XP-01, executor Claude Code; owner handoff via Codex; no commit/push/install approved): repaired the P2 receipt-relocation defect in `scripts/verify-package.ps1` with the same fix as Audio: optional `-StagingDirectory`, all seven allowlisted staged files authenticated against the receipt SHA-256, receipt never rewritten, exact-byte ZIP verification independent of the stage. Same tests added to `tests/packaging.test.js`; RED 7 of 14 failing, GREEN after: `node --test tests/*.test.js` 69/69 (was 62) and `node tests/check-syntax.js` ok, exit 0, no packaging case skipped (Windows PowerShell 5.1). Evidence class CONTROLLED_NODE_TEST_DOUBLES_NOT_NATIVE; PASS_ARCHIVE_INTEGRITY for archive bytes only. Not run: the fix against the real historical receipt/CCX, pwsh 7, any native check. Changes are UNCOMMITTED. Report: D:/Work/Projects/_docs/PLAN_20261106/_portfolio/runs/XP-01_20261107-0027.md
- 2026-11-07 (history replacement, Aria's explicit yes; executor Claude Code): a personal email address was found in commit metadata of this repo's history, so the GitHub repo was deleted by the owner (the repo was deleted and recreated) and `Unn0wn002/Premiere-Mask-Integrity-Doctor` was recreated PRIVATE with one clean commit `2c9ac5e` (same tree as the local task branch; author and committer are the GitHub no-reply identity). The old history and the old pull-request list are backed up locally in `_qa_scratch/backup-full-history-20261107/` (a git bundle of all refs, plus `pull-requests.json`). This working checkout's `origin` push URL is disabled so old history cannot be pushed by accident, and its git identity is now the no-reply address. Still private; making it public needs a separate yes.
- 2026-11-07 (publication, Aria's explicit "do all"; executor Claude Code): after a scan of a fresh clone of the remote (1 commit, 1 branch, no personal email or secret in metadata or full-history content; 6 files mention the Windows username), the recreated repo `Unn0wn002/Premiere-Mask-Integrity-Doctor` was changed from PRIVATE to PUBLIC (MIT detected). Anonymous checks: README, LICENSE and USER_GUIDE return 200 and the public API shows one clean identity. Still a beta, not approved for distribution.
- 2026-11-07 (host check via computer use, Aria's approval; executor Claude Code): failing project in the installed 0.3.2 panel, PASS_BOUNDED_NATIVE. A project copy without its Masks folder opened with Premiere's own "Missing mask files" dialog (Not now chosen); the panel scan returned FAIL with the missing-mask-data finding (counters 1 / 2 / 0 / 2). Evidence `evidence/native-20261107-failing-project/README.md`. The project file was unchanged; no product code changed.
