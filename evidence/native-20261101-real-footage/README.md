# Native run: real footage (2026-11-01 night, Claude Sonnet 5.5)

Premiere Pro 26.5.2.5, plugin v0.3.1 (UDT), disposable project `_qa_scratch\mid_v030c.prproj` (Save As of the earlier test project).
Footage: one of the owner's own game screen recordings, `Videos\Roblox\Roblox-2026-10-13T17_38_49.629Z.mp4`
(3.6 MB, 2 min 10 s), imported **by reference** (the file and its folder were not changed; checked afterwards).
Premiere showed a decode warning about a bad frame in that recording ("substituting"); that concerns the source file, not the plugin.
The Object Mask tool picked the blue character; the mask was tracked forward across the whole clip (about 49 fps) and the project saved.
Screenshots here are panel-only crops, because full screenshots show other players' names from the recording.

| ID | Case | Result | Image |
|---|---|---|---|
| M33 | Real clip with a tracked object mask | PASS_BOUNDED_NATIVE: 4 masked clips in the project (3 earlier + this one), the lane for the real clip is green, "Premiere says: yes"; mask data 8 files, 2310 KB (the real mask alone wrote a 2.1 MB file) | 01 |
| M34 | That mask's two data files removed | PASS_BOUNDED_NATIVE: FAIL naming the clip and "Mask 01"; the other three masks were not flagged; files restored and the scan returned to the expected WARN | 02 |

Saved-file reader on the real project: found 1 mask on the real clip with 3 ids (one non-file id, two `.prmf` files), same layout as the generated fixtures.

Not covered: footage with real people; several masks on real footage; a true two-PC handoff; a Premiere restart; a docked panel; other builds.
