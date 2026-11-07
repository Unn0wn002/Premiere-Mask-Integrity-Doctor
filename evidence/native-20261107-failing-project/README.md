# Native check: failing project in the installed panel (2026-11-07, Claude Code via computer use)

Class: PASS_BOUNDED_NATIVE on one Windows machine, Premiere Pro 26.5.2.x, the **installed** Mask Integrity Doctor 0.3.2 (UXP plugin folder `com.unn0wn002.mask-integrity.beta_0.3.2`, owner's normal profile, not a clean profile). Screenshots were viewed during the run and were not saved; the observed text is recorded here.

## Fixture
`_qa_scratch/b3_fail/mask_fail.prproj`, sha256 `afa3b94d2e1e48b92a5310928e8b22e560feedc7e33cbfeefc43228a9e4d1244`: a byte copy of the disposable `mid_mask_handoff.prproj` (a sequence with a masked clip) **without its `Masks` folder**, so the mask data files are missing. The project file was not modified (hash unchanged after the run); it was closed with Don't Save.

## Result
1. Premiere itself, on opening the project, showed its own "Missing mask files" dialog ("Could not find the mask data in ... mask_fail Masks"). I chose **Not now** (no Locate, no Restore).
2. Mask Integrity Doctor (Japanese UI, docked), scope "open sequence", Scan: **結果：FAIL（失敗）** (red). Counters: masked 1, no mask 2, unknown 0, to check 2.
3. Finding (problem): the clip uses an object mask but the mask data folder was not found; the mask may be lost, with the missing folder path shown.

This closes the previously NOT_RUN gate "failing project (missing mask data) in the installed panel". It is one fixture on one build.

## Side effects
A stray Ctrl+W closed the Mask panel tab; I reopened it from Window > UXP Plugins. No project was saved or changed.

## Not covered
Clean-profile install/lifecycle, a handoff to another PC, other Premiere builds, mask shape or `.prmf` corruption checks (by design). Distribution remains NOT approved.
