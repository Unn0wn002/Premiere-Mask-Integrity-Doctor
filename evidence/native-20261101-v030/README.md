# Native run: v0.3.0 integrity scan and preview UI (2026-11-01, Claude Opus 5.5)

Host: Premiere Pro 26.5.2.5, UXP Developer Tools 2.3.0.5, Windows 11, one machine. Plugin loaded through UDT (no install).
Projects (disposable, `_qa_scratch\`, git-ignored): `mid_mask_test.prproj` (built this session) and two copies,
`mid_mask_handoff.prproj` and `mid_mask_wrongdata.prproj`.
Fixture: `scripts/make_fixtures.py` -> `_qa_scratch\fixtures\subject_seq\subject_0001..0048.png` (a light disc on a dark
gradient). Imported as an image sequence and placed twice on V1 (5:00 and 6:18) after the red matte.
A real **Object Mask** was created on the first instance with the Object Mask tool, tracked forward and saved.

## Findings about the host (VERIFIED_THIS_SESSION)
1. **`ObjectMaskUtils.hasObjectMask` takes a Project or Sequence, not a clip** (Adobe reference, since 26.3). The
   v0.1/v0.2 scan passed a clip and always got `false`. **Correction:** M02 "PASS (no mask)" from the earlier runs did
   not exercise detection, and the per-clip "mask: no" lines in `evidence/native-20261101-presence-only` and later
   are not evidence of anything. Those folders are kept unchanged as history; this note supersedes their claim.
2. `hasObjectMask(sequence)` and `hasObjectMask(project)` returned `true` for the masked project.
3. The clip component chain (`getComponentChain`) lists only `AE.ADBE Motion` / `AE.ADBE Opacity`; masks are not
   exposed (screenshot 01). So the public API cannot say **which** clip has a mask.
4. Premiere stores object-mask data **outside** the project: `<project name> Masks\<guid>.prmf` (2 files, 58 KB here)
   and warns that the folder must travel with the project.
5. The saved `.prproj` (gzip XML) links each clip to its masks: `VideoClipTrackItem` -> `SelectionComponents` ->
   `VideoComponentChain` -> `AE.ADBE AEMask2` -> one sub-component per mask -> `Tracker` parameter whose keyframe
   data contains the `.prmf` GUIDs (plus one non-file id). Format undocumented; mapped on this build only.
6. Opening a copied project whose Masks folder is missing: Premiere silently **re-created** the folder by copying from
   the original project's folder (still reachable here). Real loss therefore needs the original to be unreachable
   (other PC); simulated below by moving files inside the copy's folder while it was open.
7. UXP reports a missing folder as error `-4058` (Windows ENOENT). `getFileForSaving` never showed a dialog from this
   floating panel (promise stayed pending, also from the debugger console), so the report is written beside the project.
8. `sequence.setPlayerPosition` moved the playhead and did **not** mark the project as edited.

## Cases (all PASS_BOUNDED_NATIVE unless stated)
| ID | Case | Result | Screenshot |
|---|---|---|---|
| M03 | Masked clip found per clip (saved-file reader) | 1 masked / 2 not; correct clip (5:00) | 02 |
| M12 | Same media masked in one instance, not the other | WARN with Show button on the 6:18 clip | 02 |
| M13 | Show / timeline click moves the playhead (preview) | Program monitor shows the clip; project not dirtied | 03 |
| M14 | Masked clip disabled / on hidden track | 2 WARN findings + tags; edits undone afterwards | 04 |
| M15 | Mask data folder missing | **FAIL** "mask data folder is missing" (after the -4058 fix) | 05 |
| M16 | Folder present but the mask's .prmf files missing | **FAIL** "Mask 01 … has no data file" | 06 |
| M17 | Unsaved timeline change | UNKNOWN "timeline differs from the saved project"; new clip shown as unknown | 07 |
| M18 | Japanese UI + All sequences scope | correct text; scan identical | 08 |
| M19 | Toggle chips + Masked filter | selected chip blue; list filtered | 09 |
| M20 | Save report beside the project | file written, path shown (`report_mid_mask_handoff.json`) | 10 |

`report_mid_mask_handoff.json` records `capabilities`: every host call used by the scan returned normally.
It contains local paths of this machine (private repo).

## Not covered
Real footage of people/objects; several masks per clip; nested sequences (handled as UNKNOWN by design, not seen);
docked-panel save dialog; persistence of language across restart; Mac; other Premiere builds; mask quality (never).
`mid_mask_wrongdata.prproj` was prepared but not used (Premiere would re-copy the data, see finding 6).
