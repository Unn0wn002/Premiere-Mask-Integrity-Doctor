# Native re-check: presence-only panel v0.1.0 — 2026-11-01

Host: Adobe Premiere Pro 2026 26.5.2.5 and UXP Developer Tools 2.3.0.5 (same machine and session as `native-20261101-m01-m04`). Disposable project `_qa_scratch\mid_test.prproj` (one red Color Matte clip in sequence `matte_red`, no real footage).
Change under test: the owner chose a presence-only beta, so the panel was cut down to Probe API, Scan mask presence and Save report; the folder picker and all export buttons were removed from the panel (the export code stays in `src/premiereAdapter.js`, disabled). `manifest.json` version 0.1.0. The presence report now lists each clip (name, track, hasMask, error). 18/18 unit tests (test doubles).

## Observed
1. UDT Reload: "Plugin Reload Successful". The panel stayed docked beside Properties and showed the new presence-only text.
2. Clicked Probe API, then Scan mask presence, then Save report (`presence_only_v010.json`, saved through UXP `getFileForSaving` + `write`; copy in this folder).
3. Report: overall PASS. `api`: all required classes present, `hasObjectMask` and `exportSequenceFrame` present. `presence`: PASS, "0 clip(s) with an object mask, 1 without"; `clips[0]` = { name: "matte_red", track: 0, hasMask: false, error: null }. `export` and `matrix` are null (feature removed from the panel).

## Result
PASS_BOUNDED_NATIVE for the presence-only panel on a sequence with one unmasked clip.

## Not established
Detection of a real object mask (no masked footage; M03 NOT_RUN). Behaviour with several tracks, nested sequences, disabled clips, or other Premiere builds. The export problem (`exportSequenceFrame` returning false) remains unexplained.

## State left
Premiere open with the disposable project; panel loaded in UDT; Audio Doctor registration untouched.
