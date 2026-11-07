# Native run M01 / M02 / M04 — 2026-11-01

Host: Adobe Premiere Pro 2026, file version 26.5.2.5 (Windows 11, one machine). UXP Developer Tools 2.3.0.5. Panel loaded from `manifest.json` via UDT "Add Plugin" then "Load" (nothing installed beyond that registration; the Audio Doctor's existing registration was not touched).
Disposable project: `_qa_scratch\mid_test.prproj` (inside this project folder; git-ignored) with one 1920×1080 30 fps red Color Matte (5 s) in a sequence `matte_red`. Driven through the UI by Claude with the owner's go-ahead. The saved JSON reports in this folder are the panel's own output.

## Observed
| Case | Observation | Result |
|---|---|---|
| M01 load | UDT: "Plugin Load Successful", state Loaded; the panel appeared in Premiere as a floating window. | PASS_BOUNDED_NATIVE |
| M01 dockable | Dragging the panel tab onto the Properties panel docked it as a tab beside Properties; the docked position survived a UDT Reload. | PASS_BOUNDED_NATIVE |
| M01 Probe API (`m01_probe.json`) | Classes present: `ObjectMaskUtils`, `Exporter`, `EncoderManager`, `TickTime`. `ObjectMaskUtils` exposes `hasObjectMask`; `Exporter` exposes `exportSequenceFrame`. Overall PASS. Saving the report through UXP (`getFileForSaving` + `write`) worked. | PASS_BOUNDED_NATIVE (settles the API-presence unknown) |
| M02 presence (`m02_presence.json`) | 1 clip inspected; `hasObjectMask(clip)` returned a boolean: "0 clip(s) with an object mask, 1 without". | PASS_BOUNDED_NATIVE (unmasked clip only) |
| M04 export, attempt 1 (`m04_export_attempt1.json`, code at commit 4099d79) | 4 frames: all failed. Folder `frames_m04` stayed empty. The error text came from reading the file back ("Could not find an entry of 'blob:/blob-3/mid_1.png'"). | FAIL |
| M04 export, attempt 2 (`m04_export_attempt2.json`) | The panel now tried two argument forms per frame and recorded the raw return: `exportSequenceFrame` returned **false** for both (filename = full path, and filename = bare name; filepath = folder + "/"), no exception. No file written. | FAIL |
| M04 diagnostic matrix (`m04_matrix.json`) | 16 combinations (320×180 and 1920×1080; time 0 and 1 s; png and jpg; both argument forms): **all returned false**, none threw, no file appeared in the empty `frames_diag` folder. | FAIL (cause UNKNOWN) |
| Stray-file check | No `diag_*`, `mid_*` image files found under 02_Projects, Documents or Temp afterwards (searched, last 30 minutes). | — |

## Result
- M01 PASS, M02 PASS (unmasked clip), M04 **FAIL**: on this Premiere build, `Exporter.exportSequenceFrame` declined to write a frame for this sequence in every tried form. The panel reported the failure each time instead of hiding it.
- M05 (determinism) **BLOCKED**: it depends on a successful export. Not run.
- M03 (clip with an Object Mask) NOT_RUN: no masked footage; an Object Mask needs real footage with a subject, which I did not create.
- M06 (read-only target folder) NOT_RUN; M07/M08 NOT_RUN.

## Not established (UNKNOWN)
Why `exportSequenceFrame` returns false. Untested ideas: the sequence needs a specific state (focus/in-out), width/height must match the sequence, a different path style, a different time type, or the call needs the project in a particular access mode. One diagnostic round was done; further guesses were deliberately not made without a better lead (e.g. Adobe's API forum or a working sample).

## Limits
One machine, one Premiere build (26.5.2.5), one tiny generated sequence with no real footage and no audio. Mask correctness was never in scope.
