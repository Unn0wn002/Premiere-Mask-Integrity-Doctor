# Premiere Mask Integrity Doctor

A read-only Premiere Pro UXP panel that checks object-mask integrity before handoff:
which clips use object masks, whether their mask data files (`<project> Masks\*.prmf`) are in place, and
easy-to-miss problems (same media masked in one place but not another, masked clip disabled or on a hidden track).
It never edits the project, never reads or judges mask shapes, and creates no masks.

**Status: private beta 0.3.2 (Japanese-first UI), `main` `fd20bcd`. Verified in Premiere 26.5.2.5 on disposable projects with a real
Object Mask, and the 0.3.2 CCX installed and scanned (floating and docked) in the owner's normal profile (see `evidence/native-20261102-package-install/`). Not released, not approved for distribution.** See PROJECT_STATUS.md for current status.
See `PROJECT_STATUS.md`, `TEST_MATRIX.md`, `KNOWN_LIMITATIONS.md`.

## How it decides
- Premiere's own `ObjectMaskUtils.hasObjectMask(sequence | project)` says whether a sequence has an object mask.
- The public API cannot say which clip, so the panel reads the **saved** project file (read-only) to locate masks per
  clip and the data files each mask needs. Unsaved timeline changes are reported as UNKNOWN ("save and scan again").
- Nested sequences are followed: masks inside them count, and their data files are checked (Premiere's own check says "no" for the outer sequence).
- Anything it cannot establish is UNKNOWN, never PASS.

## Panel
Scope chips (open sequence / all sequences) → Scan → coloured result, four counters, findings with **Show** buttons,
a timeline map (green = masked, grey = no mask, amber = unknown, red outline = to check) and a filterable clip list.
**Show** or clicking a clip moves the playhead so the Program monitor previews that frame (frame export does not work
on the tested build). Details: Probe API, Save report (JSON written next to the project; path shown), Show JSON.

## Language
Starts in Japanese; the 「English」 / 「日本語」 button switches language (stored in the panel's local storage). Text: `src/i18n.js`.

## Files
`manifest.json` (dockable panel, fullAccess file permission for reading the project and mask folder), `index.html` /
`index.js` (panel), `src/core.js` (pure rules), `src/projectFile.js` (pure gzip/XML reader for saved projects),
`src/premiereAdapter.js` (host calls; the old export functions are disabled), `scripts/make_fixtures.py`, `tests/`.

## Tests
```
node --test tests/*.test.js
node tests/check-syntax.js
```
Unit tests use test doubles and a synthetic project (plus the real disposable project when present locally).
They are not Premiere host evidence. The static checks also enforce that the only file write is the report.

## To try it (needs the owner's go-ahead for any install)
Load the folder in UXP Developer Tools (Add Plugin → `manifest.json` → Load), open the panel, **save the project**, then Scan.

## Package (0.3.2, unsigned developer ZIP)

`node scripts/prepare-beta.js` builds a reproducible developer ZIP, a staging folder and a receipt in `artifacts/` (git-ignored); `scripts/verify-package.ps1` verifies a ZIP or a UDT-made CCX against the receipt (archive integrity only). The CCX itself is made with the UDT Package action. Evidence: `evidence/native-20261102-package-install/`.

## User guide

See [USER_GUIDE.md](USER_GUIDE.md) for what it does, install, use, reading the result and removal.

## License

MIT. See [LICENSE](LICENSE). This beta is not approved for distribution; the license covers the source only.
