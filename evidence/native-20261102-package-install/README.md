# Package, install and docked check of Mask Integrity Doctor 0.3.2 (2026-11-02, Claude Sonnet 5.5)

Class: PASS_ARCHIVE_INTEGRITY (package) and PASS_BOUNDED_NATIVE (installed, docked smoke check) on one machine, Premiere Pro 26.5.2.5, Creative Cloud Desktop, the owner's normal profile (NOT a clean profile).

## Candidate
- Source: branch `release/package-0.3.2-20261102` (main plus the new packaging scripts, commit 62b7301, working tree clean). Version 0.3.2, plugin id `com.unn0wn002.mask-integrity.beta`, 7 runtime files (manifest, index.html, index.js, src/core.js, src/i18n.js, src/premiereAdapter.js, src/projectFile.js). The packaging scripts (`scripts/prepare-beta.js`, `scripts/verify-package.ps1`, `tests/packaging.test.js`) are copied from the Audio Doctor and adapted to this file list.
- Staging identity `ab69efc12ed2`; unsigned developer ZIP sha256 `4378653f437982cbc9a1a7e7def975786eacfbeeacd12b71b5088a37272020eb`. CCX made with the UDT Package action (the UDT row for the same id was removed, the staging manifest added, packaged, then the original repository binding restored); CCX sha256 `c6b363338a14ff353caf220aa9fcb4c775c58a86c77d266691944f78953b098d`, 28,170 bytes.
- Files (git-ignored, project folder): `artifacts\mask-integrity-0.3.2-ab69efc12ed2*` and `artifacts\ccx-mask-integrity-0.3.2-ab69efc12ed2\com.unn0wn002.mask-integrity.beta_premierepro.ccx`. Copies of the receipt and CCX verification are here.
- Permission note: the manifest asks for `localFileSystem: fullAccess` (the panel reads the saved .prproj and the project's Masks folder). The Creative Cloud install dialog lists "Read and write to files on your device".

## Results
| Check | Result | Evidence |
|---|---|---|
| Developer ZIP verified against the receipt (7 files, bytes and identity) | PASS_ARCHIVE_INTEGRITY | `package-receipt.json` |
| CCX verified with `-AllowManifestReformat`: 6 files byte-exact, manifest values equal | PASS_ARCHIVE_INTEGRITY | `ccx-verification.json` |
| Install through Creative Cloud (non-marketplace confirmation, then OK): "Mask Integrity Doctor - Private Beta is now installed", version 0.3.2; no administrator (UAC) prompt; the first launch did not show the "Compatible app required" message this time | PASS_BOUNDED_NATIVE | n/a (dialogs observed) |
| Installed files equal the package: 6 byte-exact, manifest values equal; Premiere's plugin registry lists it enabled, 0.3.2 | PASS (file and registry check) | n/a |
| Installed panel opened floating, scanned the saved fixture project `_qa_scratch\mid_v030b.prproj`: "結果：PASS（正常）", 1 masked clip | PASS_BOUNDED_NATIVE | `01` |
| Docked beside Project (about 290 px wide), same scan: PASS, counters 1 / 0 / 0 / 0, nothing cut off | PASS_BOUNDED_NATIVE | `02` |
| Clean-profile install, restart, upgrade, uninstall and reinstall | NOT_RUN | no clean profile |
| A failing project (missing mask data) in the installed context | NOT_RUN in this round (covered natively on the development build in `evidence/native-20261101-v030/`) | n/a |

## Notes
- The scanned project is a disposable test project; it was opened but not changed or saved. It and the docked Mask panel are still open in Premiere.
- To remove the plugin: Creative Cloud > Plugins > Manage plugins > the plugin's "..." > Uninstall.
- Japanese wording is not native-reviewed. Nothing was published or released.
