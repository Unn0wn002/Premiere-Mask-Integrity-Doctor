# Native run: v0.3.0 test round 2 and v0.3.1 fixes (2026-11-01 evening, Claude Opus 5.5)

Owner request: "do the test for v0.3.0". Host: Premiere Pro 26.5.2.5, UDT 2.3.0.5, Windows 11, one machine; plugin
loaded through UDT. Project: `_qa_scratch\mid_v030b.prproj` (Save As of the earlier test project) with three sequences:
`matte_red` (one masked clip, one unmasked instance), `twosub_0001` (one clip with **two** object masks, 01 = disc,
02 = square, both tracked) and a second `twosub_0001` that **nests** the first (made with New Sequence From Clip).
Fixture: `python scripts/make_fixtures.py 48 two` -> `_qa_scratch\fixtures\two_subject_seq\` (generated, no real footage).

## Host behaviour found (VERIFIED_THIS_SESSION)
1. **Correction to the v0.3.0 record:** `getFileForSaving` does open its dialog, but **behind the Premiere window**.
   Four dialogs from the earlier clicks (and the debugger test) were found queued behind Premiere and cancelled
   (screenshot 01). The v0.3.0 note "never opened" was wrong; the report-beside-the-project design stays because it
   is visible and verified.
2. Save As copies the `<project> Masks` folder to the new name (`mid_v030b Masks`, 2 files, before new masks).
3. Two masks on one clip are saved as two sub-components (instances 01, 02), each with its own Tracker GUIDs and two
   `.prmf` files.
4. **`hasObjectMask(sequence)` is false for a sequence that only nests a masked sequence** (timeline label "Premiere
   says: no", screenshot 04), although exporting it renders those masks. v0.3.0 therefore gave a **false PASS** there.
5. In the saved file a nested clip links SubClip -> Clip -> `VideoSequenceSource` -> `<Sequence ObjectURef=guid>`.
6. `project.setActiveSequence` + `setPlayerPosition` (Show on a clip in another sequence) switched the timeline and
   moved the playhead; the project was not marked edited.

## Fixed in v0.3.1 (53/53 unit tests)
- Nested sequences are followed (cycle-safe); masks inside count for the folder check and their data files are
  checked (`F_NESTED_MASKS` info, `F_NESTED_MASK_DATA_MISSING` FAIL on the nesting clip).
- If Premiere says the project has object masks but none are in the scanned scope: info "scan all sequences", and the
  folder is still checked (`F_PROJECT_MASKS_ELSEWHERE`).
- Clip chips show the count: "yes (2)", "nested (2)". The Masked counter includes nesting clips; the presence line no
  longer counts them as "without".

## Cases
| ID | Case | Result | Screenshot |
|---|---|---|---|
| M21 | Two masks on one clip, all data present | PASS_BOUNDED_NATIVE (1 masked, 6 files, PASS) | 02 |
| M22 | Only mask 02's two .prmf files removed | PASS_BOUNDED_NATIVE: FAIL names "Mask 02" only | 03 |
| M23 | Outer sequence nesting a masked sequence (v0.3.0) | **FAIL of the plugin** (false PASS) -> fixed in v0.3.1 | 04 |
| M24 | Same, v0.3.1 | PASS_BOUNDED_NATIVE: "nested (2)", info line, folder checked | 05 |
| M25 | Nested mask 02 data removed (v0.3.1) | PASS_BOUNDED_NATIVE: FAIL "Mask 02 inside nested sequence …" | 06 |
| M26 | All sequences scope, 3 sequences | PASS_BOUNDED_NATIVE: lanes per sequence, 3 masked (2 direct + 1 nested), WARN kept | 07 |
| M27 | Show on a clip in a sequence that is not open | PASS_BOUNDED_NATIVE: timeline switched, playhead moved | 08 |
| M28 | Language after plugin reload | PASS_BOUNDED_NATIVE: Japanese kept (Premiere restart not tested) | 09 |
| M30 | Final v0.3.1 build, all sequences, Japanese | PASS_BOUNDED_NATIVE: label v0.3.1, 3 masked, "2 with, 2 without" | 10 |
| M29 | v0.3 docked | NOT_RUN: three automated drag attempts did not dock the floating window; v0.2 was verified docked | - |

All files moved for the FAIL cases were put back; the project was saved only after creating the masks and the nest.

## Not covered
Real camera footage of people; masks on V2+ (the reader treats every video track the same, but only V1 was used);
a true two-PC handoff; Premiere restart; Mac; other builds.
