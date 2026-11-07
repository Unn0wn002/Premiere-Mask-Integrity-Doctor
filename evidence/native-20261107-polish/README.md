# Native check: polished Mask Integrity Doctor build (U4 and U5, 2026-11-07, Claude Code via computer use)

Class: PASS_ARCHIVE_INTEGRITY (CCX) and PASS_BOUNDED_NATIVE (development load, DOM read), Premiere Pro 26.5.2 on one Windows machine. Screenshots were viewed and not saved; the console output is recorded here.

## Package
- Source: local branch `polish/lang-aria-20261107` (commit `86bdd40`), version 0.3.2 unchanged, staging identity `03b5b516ddd3d26efcbf923fe2fb7dce6e482e42c0d35331a5a90d635fbdc2c0`.
- CCX made with the UXP Developer Tools Package action: `com.unn0wn002.mask-integrity.beta_premierepro.ccx`, 28,264 bytes, sha256 `71d39f5a1c6bacf6cf04b89e3c915298b7cb68cb07a322816d95b2c9e960f2b4`.
- `scripts/verify-package.ps1 -AllowManifestReformat` against the receipt: `runtimeMatchesStaging` true, manifest values equal; archive integrity only, installation not qualified.

## Native check (dev-loaded exact staging build via UDT into Premiere)
- Console in the plugin context: startup `lang` **en** with the language button 日本語; the `#status` element has **role="status"** and **aria-live="polite"** (U5).
- After switching language: **ja**, button English. Switching back: **en**, button 日本語 (U4). Before this change the attribute was fixed at `ja`.

## Side effects and limits
- The first Package attempt wrote the CCX into the staging folder (the dialog's folder field could not be typed into); I moved it to the CCX folder and confirmed the staging folder again holds exactly the 7 receipt files.
- Development-loading the same plugin id displaced the installed panel in that Premiere session; after quitting and restarting Premiere the installed panel was listed again (installed files were untouched). The panels were reopened as floating panels, so a docked layout may need re-docking. Entries for both staged plugins remain in the UXP Developer Tools workspace (state Not loaded).
- **Not installed.** Installing the CCX goes through a Creative Cloud dialog owned by Adobe Desktop Service, whose window access was declined, so I did not operate it. The CCX is ready for the owner to open and install; the installed 0.3.x panels were not replaced.
- The language toggle was driven by dispatching a click event from the debug console (a plain `click()` call did not toggle in UXP), not by a mouse click. One Premiere version (26.5.2), one machine.
- Distribution remains NOT approved.
