# Native run: masks on V2 and docking retry (2026-11-01 night, Claude Sonnet 5.5)

Premiere Pro 26.5.2.5, plugin v0.3.1 loaded through UDT, project `_qa_scratch\mid_v030b.prproj` (disposable).
The masked two-subject clip (two object masks) was moved from V1 to **V2** of the `twosub_0001` sequence with Alt+Up
and the project saved.

| ID | Case | Result | Screenshot |
|---|---|---|---|
| M31 | Masked clip on V2, scope All sequences | PASS_BOUNDED_NATIVE: lane "V2 twosub_0001.png" is green; the sequence reports "mask: yes"; 3 masked in total | 01 |
| M32 | Same clip with V2 hidden (eye off) | PASS_BOUNDED_NATIVE: WARN "masked clip is on a hidden track (V2)" with a Show button; counter "to check" 2; V2 turned back on and project saved afterwards | 02 |
| M29 | v0.3.1 docked | NOT_RUN again: a slow stepped drag of the panel tab toward the Effect Controls tab strip did not move the floating window and showed no drop target, same as the three earlier attempts. Docking must be done by hand | - |

Host notes (VERIFIED_THIS_SESSION): dragging clips with the mouse does not work through this input path (neither from the
bin nor inside the timeline); Ctrl+C / Ctrl+V pasted onto V1 even with V2 targeted; Alt+Up moved the selected clip up one
track. These are automation limits, not plugin behaviour.

Still not covered: real camera footage, a true two-PC handoff, a Premiere restart, Mac, other builds, a docked panel.
