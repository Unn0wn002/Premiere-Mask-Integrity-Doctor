> **Historical status document (last updated 2026-11-01).** For current status see [PROJECT_STATUS.md](PROJECT_STATUS.md). Content below is kept unchanged for history; known outdated: the presence-only, "real mask untested" and "not tested" lines are superseded by later native evidence (v0.3.0-v0.3.2, 0.3.2 package install).

# Known limitations

- Verified natively once (Premiere 26.5.2.5, one tiny sequence): panel load/dock, API presence, `getActiveSequence`, video-track and clip enumeration, `hasObjectMask(clip)` returning a boolean for an unmasked clip, `TickTime` creation, UXP folder picking, folder read and `getFileForSaving`/`write`.
- **Scope is presence only (owner decision):** no frame export, determinism or encode checks. **`exportSequenceFrame` does not work here:** it returned false (no exception) for every tried combination of size, time, extension and argument form on a generated colour-matte sequence; cause UNKNOWN. Those checks were removed from the panel.
- It reports only whether a clip has an object mask. It cannot tell whether a mask is correct or leaking; it has no access to mask geometry.
- Detection of a real mask is untested (no masked footage); only the unmasked answer (`false`) was observed.
- Premiere/Media Encoder parity and short encodes are not implemented.
- The research packets (Drive, 2026-11-01) mark idea 32 HOLD pending real-host tests and buyer validation; demand is unproven.
- Object-Mask test footage must be created by hand in the Premiere UI.
- Single machine, no Mac, one Premiere build.
- Japanese UI text has not been reviewed by a native speaker. The JSON report stays in English. Language choice is stored in the panel's localStorage (persistence across a Premiere restart not tested).

## v0.3.0 (2026-11-01)
- **Correction:** before v0.3, `hasObjectMask` was called with a clip; Adobe documents it for a Project or Sequence only, and it always returned false. Earlier "no mask" results did not test detection.
- Per-clip mask location comes from the **saved** project file, whose format is undocumented and was mapped on Premiere 26.5.2.5 only. Unsaved edits make clips UNKNOWN until the project is saved; a format change in another build would show as UNKNOWN or "unreadable", never as "no mask" (by design, not proven on other builds).
- A mask counts as having data if at least one GUID in its Tracker data matches a `.prmf` file (the Tracker also holds one non-file id). Not checked: file contents or corruption.
- When a project is copied without its Masks folder, Premiere re-creates the folder from the original location if it can still reach it. The FAIL cases were therefore simulated by moving files inside a copy's folder; a true other-PC handoff was not tested.
- Report saving writes `<project> - Mask Report <date time>.json` beside the project. (Correction 2026-11-01 evening: `getFileForSaving` does open its dialog, but behind the Premiere window, which is easy to miss; the beside-the-project save avoids that.) It needs the project to be saved somewhere first.
- Not tested: real footage, several masks per clip, nested sequences, docked-panel behaviour of v0.3, language persistence across restart, Mac, other builds. Japanese text not reviewed by a native speaker.
- The 0.8% minimum block width in the timeline map can make very short clips look longer than they are.
- v0.3.1: Premiere's own `hasObjectMask(sequence)` is false for a sequence that only nests a masked one; the plugin follows nesting through the saved file instead (tested one level deep plus a synthetic loop test). Masks on V2+ tracks and real footage are still untested natively. v0.3 docked was not re-tested (automated drag could not dock).
- Update 2026-11-01 night: masks on a V2 track and the hidden-track warning on V2 were verified natively. Docked behaviour of v0.3.x is still untested (automation cannot dock the panel).
- Update 2026-11-01 night: one real recorded video (2 min 10 s game screen recording) with a tracked mask was scanned correctly, including per-mask data loss. Still untested: footage of people, several masks on real footage, other builds.
- Update 2026-11-01 night: the docked panel was verified (the owner docked it; automation cannot). Very narrow docks may still wrap text heavily; timeline blocks narrower than about 9% show no label (tooltip only).
