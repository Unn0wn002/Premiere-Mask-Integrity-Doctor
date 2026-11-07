# Docked panel check and text-overflow fix: v0.3.2 (2026-11-01 night)

The owner docked the panel by hand (next to Source and Effect Controls, narrow) and sent two screenshots (01, 02).
Premiere 26.5.2.5, plugin loaded through UDT, project `_qa_scratch\mid_v030c.prproj` (disposable).

## Bug the owner saw (USER_STATED + screenshots, v0.3.1)
- The finding "Show" buttons were fixed-height buttons: long clip names ran past the card edge and were cut off
  (for example "表示: Roblox-2026-10-13T17_38_49.629Z…", "subject_0001.png (V1)").
- Timeline blocks cut their labels mid-word ("subject_0001", "subject_000").

## Fix (v0.3.2, 55/55 unit tests)
- Show buttons in findings are wrapping chips; long names are shortened in the middle, keeping the ending
  (`Roblox-2026-10-13…629Z.mp4`); the full name is the tooltip (`core.shortName`).
- Timeline block labels show only as many characters as the block width allows, ending in "…", or nothing when there is
  no room (`core.blockLabel`); the full name stays in the tooltip.

## Native verification (VERIFIED_THIS_SESSION, docked panel)
| ID | Case | Result | Image |
|---|---|---|---|
| M29 | v0.3.x docked: scan, findings, timeline map, clip list, language, scope chips | PASS_BOUNDED_NATIVE (docked by the owner; plugin reload keeps it docked) | 03, 04, 05 |
| M35 | FAIL finding for the real clip's mask in the narrow dock | PASS_BOUNDED_NATIVE: chip "表示: Roblox-2026-10-13…629Z.mp4 (V1)" inside the card | 03 |
| M36 | Timeline blocks in the narrow dock | PASS_BOUNDED_NATIVE: "subje…" and a long label ending "…629Z.m…" | 04 |
| M37 | Final 0.3.2 build, All sequences | PASS_BOUNDED_NATIVE: label v0.3.2, 4 masked, WARN | 05 |

The data files moved for the FAIL check were restored afterwards (8 files present). Screenshots 03-05 are panel-only crops.
Images 01 and 02 are the owner's own screenshots and show only plugin text.
Not covered: restarting Premiere, the docked panel at other widths, a true two-PC handoff, footage of people.
