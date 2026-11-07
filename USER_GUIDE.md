# Premiere Mask Integrity Doctor: user guide

Host: Adobe Premiere Pro 26.5.2 on Windows. Status: beta, not released.

## What it does
A read-only UXP panel that checks object-mask integrity before handoff: which clips use object masks, whether their mask data files (`<project> Masks\*.prmf`) are present, and easy-to-miss problems such as the same media masked in one place but not another, or a masked clip that is disabled or on a hidden track.

## What it does not do
It never edits the project, never judges mask shapes or quality, creates no masks, and does not check whether a mask file is corrupt. Frame export does not work on the tested build and is disabled.

## Install
1. Open the packaged `.ccx` with Creative Cloud Desktop and follow its install flow, then restart Premiere Pro.
2. Open the panel from the Window menu and dock it as a tab.
3. For development: load `manifest.json` in Adobe UXP Developer Tools (Add Plugin > Load).

## Use
1. **Save the project first.** The panel reads the saved project file; unsaved changes are reported as UNKNOWN.
2. Choose the scope (open sequence or all sequences) and press the scan button.
3. Read the coloured result, the four counters (masked, unmasked, unknown, to check) and the findings. **Show** moves the playhead to that clip.
4. Optionally save the JSON report. It is written next to the project file and the path is shown.
5. The language button switches Japanese and English.

## Reading the result
PASS means no problem was found in what could be established. Anything the panel cannot establish is UNKNOWN, never PASS.

## Remove
Creative Cloud Desktop > Plugins > Manage plugins > the plugin's menu > Uninstall. Delete any saved `* - Mask Report *.json` files you do not want. (Removal has not been tested in a clean profile.)

## Limits
- The saved-project format was read on one Premiere build only.
- Not tested: clean-profile lifecycle, a failing project in the installed panel, and a handoff to another PC.
- Beta, not released and not approved for distribution. Verified on one Windows machine only; no macOS, other-build or clean-profile claim is made (see `PROJECT_STATUS.md`).
- The Japanese wording has not had a native-speaker review.
- A scan describes what was checked. It never certifies the final output of your project.

Full status and evidence: `PROJECT_STATUS.md`. Licence: MIT (see `LICENSE`).
