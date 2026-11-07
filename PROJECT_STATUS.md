# Project status — Premiere Mask Integrity Doctor

## Current status — 2026-11-06 (authoritative)

Compiled 2026-11-06 from `PROJECT_LOG.md` (latest entry 2026-11-02), `evidence/native-20261102-package-install/README.md`, the 2026-11-04 audit (`D:\Work\Projects\_docs\AUDIT_20261104\README.md`) and read-only git commands. Nothing was re-run for this summary.

- **Version / candidate:** 0.3.2 (`manifest.json`). `main` at `fd20bcd` (merge of PR #1 `release/package-0.3.2-20261102`, 2026-11-02), equal to `origin/main` (git, 2026-11-06). `release/package-0.3.2-20261102` is at `17af269` locally and on origin. Working tree: only untracked local-only instruction files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.agents/`, `.claude/`).
- **Release state & approvals:** private GitHub repo only; not released; distribution NOT APPROVED (`AGENTS.md`). Push, merge, tag, release or install each need the owner's explicit yes. The 2026-11-02 log line "NOT pushed" is superseded by git: the branch is on origin and merged via PR #1; the merge has no `PROJECT_LOG.md` entry. CI `validation` run 41470552036 succeeded for `fd20bcd` (audit `Premiere-Mask-Integrity-Doctor-github.json`).

### Completed gates (one Windows machine, Premiere 26.5.2.5; HISTORICAL_RECORDED, not re-run since)
- Developer ZIP and CCX (sha256 `c6b36333...b098d`) verified against the receipt: PASS_ARCHIVE_INTEGRITY — `evidence/native-20261102-package-install/` (`package-receipt.json`, `ccx-verification.json`).
- Creative Cloud install in the owner's normal profile (NOT a clean profile), installed files equal the package; installed panel scan floating and docked (about 290 px): PASS, 1 masked clip — PASS_BOUNDED_NATIVE, same folder (`01-*.jpg`, `02-*.jpg`).
- Real Object Mask per clip, mask-data folder and per-mask file checks, partly-masked media, disabled/hidden-track warnings, unsaved guard (M03, M12-M20) — PASS_BOUNDED_NATIVE, `evidence/native-20261101-v030/`.
- Two masks per clip, per-mask data loss, nested sequences (M21-M28) — PASS_BOUNDED_NATIVE, `evidence/native-20261101-v031/`.
- Mask on V2 and hidden-V2 warning (M31-M32) — PASS_BOUNDED_NATIVE, `evidence/native-20261101-v031-v2track/`.
- Real recorded footage with a tracked mask, per-mask data loss (M33-M34) — PASS_BOUNDED_NATIVE, `evidence/native-20261101-real-footage/`.
- Docked panel and narrow-dock text fix (M29, M35-M37) — PASS_BOUNDED_NATIVE, `evidence/native-20261101-v032-docked/`.

### Remaining gates
- Clean-profile install, restart, upgrade, uninstall and reinstall — NOT_RUN (`evidence/native-20261102-package-install/README.md`).
- Failing project (missing mask data) in the installed panel — PASS_BOUNDED_NATIVE 2026-11-07: FAIL result with the missing-mask-data finding on installed 0.3.2 (`evidence/native-20261107-failing-project/README.md`); the development-build cases remain in `evidence/native-20261101-v030/`.
- True other-PC handoff — NOT_RUN (FAIL cases were simulated inside a copy; `KNOWN_LIMITATIONS.md`, audit).
- Other Premiere builds, Mac, footage of people — NOT_RUN; the undocumented saved-project format is mapped on 26.5.2.5 only (audit).
- Native-speaker review of the Japanese UI — NOT_RUN (evidence READMEs).
- M07 encode/AME parity NOT_RUN (not implemented); M08 not planned; M04 frame export FAIL and OUT OF SCOPE; M05/M06 OUT OF SCOPE (`TEST_MATRIX.md`).
- Distribution approval — not granted (`AGENTS.md`).

### Open defects
- **P2 (2026-11-04 audit):** `scripts/verify-package.ps1:49` reads the staged manifest from the receipt's absolute `stagingDirectory` (old `C:\Users\unn0w\Downloads\02_Projects` root), so verifying the existing CCX with the original receipt fails (`DirectoryNotFoundException`); the ZIP check passes and rebased receipt copies pass. Packages are not corrupt. Not fixed. Evidence: audit `Premiere-Mask-Integrity-Doctor-ccx-verification.log`, `-ccx-rebased-verification.json`.
- **P2 (2026-11-04 audit):** conflicting status documents — reconciled by this section and the 2026-11-06 banners.
- Known limits (by design, not defects): mask shapes/correctness and `.prmf` corruption are not checked; frame export is disabled.

### Latest automated test result
- 62/62 `node --test` tests, 0 skipped, plus syntax/read-only static checks: PASS in the 2026-11-04 audit run (audit README, "Fresh checks"; `D:\Work\Projects\_docs\AUDIT_20261104\Premiere-Mask-Integrity-Doctor\results.jsonl`). Not re-run on 2026-11-06. Test doubles plus a local saved-project parser test; not Premiere host evidence.

### Where evidence lives
- Native records: `evidence/native-YYYYMMDD-*/` (newest: `evidence/native-20261102-package-install/`). Package outputs: `artifacts/` (git-ignored). Audit records: `D:\Work\Projects\_docs\AUDIT_20261104\` (files prefixed `Premiere-Mask-Integrity-Doctor`).

### Status documents
- This section — CURRENT. `PROJECT_LOG.md` — CURRENT dated history. `CHANGELOG.md` — CURRENT for release notes through v0.3.2; does not cover the 2026-11-02 packaging.
- `KNOWN_LIMITATIONS.md` (2026-11-01) and `TEST_MATRIX.md` (2026-11-01, stops at 55/55, no package rows) — HISTORICAL, bannered 2026-11-06.
- `docs/PROJECT_SPECIFICATION.md` — scope document (approved 2026-11-01); its "DRAFT / no repo" header line is outdated; left unchanged.
- `README.md` — status sentence updated 2026-11-06. Everything below in this file — HISTORICAL.

### Next recommended step
With the owner's go-ahead, fix the P2 verifier relocation defect (explicit staging-directory override checked against the receipt hashes), then run the clean-profile lifecycle checks (install needs the owner's yes).

## Earlier status entries (historical — superseded by the section above, kept unchanged)

Last updated: 2026-11-01. Source idea: 32 in the Drive idea sheet (research-stage scores, not tested). Scope: `docs/PROJECT_SPECIFICATION.md`.

## State
- **v0.3.1 (2026-11-01 evening):** test round 2 found a false PASS on sequences that only nest masked sequences; fixed (nested masks followed and their data checked). Two masks per clip and per-mask data loss verified natively. 53 tests. Evidence: `evidence/native-20261101-v031/`. Pushed to the private repo 2026-11-01 (8ebc610, CI green).
- **v0.3.0 (2026-11-01): integrity scan + preview UI**, verified natively with a real Object Mask (`evidence/native-20261101-v030/`): per-clip masks from the saved project file, mask-data folder and per-mask file checks, partly-masked media, disabled/hidden-track warnings, unsaved-change guard, timeline map, Show = playhead preview, report saved beside the project. 49 tests. Pushed to the private repo 2026-11-01 (83314d8, CI green).
- **Correction (2026-11-01):** v0.1/v0.2 called `hasObjectMask` with a clip; it only accepts a Project/Sequence and always returned false, so earlier per-clip results were meaningless.
- **v0.2.0 (2026-11-01): Japanese-first UI with an English toggle** and a readable summary above the JSON (text in `src/i18n.js`). Verified natively: `evidence/native-20261101-japanese-ui/`. 23 tests incl. translation coverage.
- **Scope (owner decision 2026-11-01): presence-only beta v0.1.0.** The panel offers Probe API, Scan mask presence and Save report only. Frame export, determinism and the diagnostic matrix are disabled (code kept, not wired to the panel).
- v0 code: pure logic (`src/core.js`), host adapter (`src/premiereAdapter.js`), panel (`index.html`, `index.js`), manifest.
- Unit tests 18/18 and static checks pass (2026-11-01; test doubles, not host evidence). The static checks also enforce: panel entrypoint, core is host-independent, no project-mutating calls.
- Premiere 26.5.2.5 (2026-11-01, one machine, disposable project): M01 PASS (loads, docks, API probe), M02 PASS (unmasked clip), **M04 FAIL** (`exportSequenceFrame` returned false in all 16 tried combinations, cause UNKNOWN), M05 BLOCKED, M03/M06/M07/M08 NOT_RUN. Evidence: `evidence/native-20261101-m01-m04/`.
- Presence-only panel re-verified natively after the cut: `evidence/native-20261101-presence-only/` (overall PASS; per-clip detail reported).
- GitHub: private repo Unn0wn002/Premiere-Mask-Integrity-Doctor (pushed 2026-11-01; CI green). Not released; distribution NOT APPROVED.

## API status
- `exportSequenceFrame(sequence, time, filename, filepath, width, height)`, since 25.6, returns Promise<boolean>: from the Adobe docs page (read 2026-11-01 through a summarising fetch tool; the meaning of filename vs filepath is ambiguous in the docs, UNVERIFIED).
- `ObjectMaskUtils` class added in v26.3.0 (Adobe changelog). On the real host (26.5.2.5) it exposes `hasObjectMask`, and `hasObjectMask(clip)` returned a boolean for an unmasked clip (VERIFIED natively, bounded).
- `EncoderManager.exportSequence`: not found in the docs pages read; the parity check (M07) is not implemented.

## Next
Real footage with people, masks on V2+, a true two-PC handoff, and a docked-panel check (dock by hand). Export investigation stays parked.

## Update 2026-11-01 night
v0.3.2: docked panel verified; clipped text in the narrow dock fixed (owner's report). 55 tests. Evidence `evidence/native-20261101-v032-docked/`. Committed locally; push needs the owner's yes.

**Update 2026-11-07 (UI polish, source only):** the source now has the page lang attribute follows the language switch and the status line is a live region (U4, U5). A CCX of this build was made and natively checked by development load (`evidence/native-20261107-polish/README.md`): sha256 `71d39f5a1c6bacf6cf04b89e3c915298b7cb68cb07a322816d95b2c9e960f2b4`, staging `03b5b516...`. The owner installed that CCX through Creative Cloud on 2026-11-07 (21:03 local): in the per-user UXP plugin folder 6 of 7 runtime files are byte-identical to the CCX staging build and `manifest.json` has equal values (UDT reformats the manifest). The installed package therefore matches this source; the earlier CCX recorded above is superseded. The installed panel itself was not re-checked in Premiere after the install. Not approved for distribution.
