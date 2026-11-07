"use strict";
// Tests the pure core with test doubles. These are NOT Premiere host evidence.
const test = require("node:test");
const assert = require("node:assert");
const core = require("../src/core");

test("worst verdict ordering", () => {
  assert.strictEqual(core.worst(["PASS", "UNKNOWN"]), "UNKNOWN");
  assert.strictEqual(core.worst(["PASS", "WARN", "UNKNOWN"]), "WARN");
  assert.strictEqual(core.worst(["WARN", "FAIL"]), "FAIL");
  assert.strictEqual(core.worst([]), "PASS");
});

test("sampleTimes: evenly spaced, never 0 or the end", () => {
  assert.deepStrictEqual(core.sampleTimes(10, 4), [2, 4, 6, 8]);
  const t = core.sampleTimes(7, 3);
  assert.strictEqual(t.length, 3);
  assert.ok(t[0] > 0 && t[2] < 7);
  assert.deepStrictEqual(core.sampleTimes(0, 3), []);
  assert.deepStrictEqual(core.sampleTimes(10, 0), []);
  assert.deepStrictEqual(core.sampleTimes("x", 3), []);
});

test("secondsToTicks uses the documented tick rate", () => {
  assert.strictEqual(core.secondsToTicks(1), "254016000000");
  assert.strictEqual(core.secondsToTicks(0.5), "127008000000");
});

test("presence: API missing is UNKNOWN, never PASS", () => {
  const r = core.evaluatePresence([{ name: "a", hasMask: false }], false);
  assert.strictEqual(r.verdict, "UNKNOWN");
});
test("presence: counts masks, none unknown -> PASS", () => {
  const r = core.evaluatePresence([{ name: "a", hasMask: true }, { name: "b", hasMask: false }], true);
  assert.strictEqual(r.verdict, "PASS");
  assert.strictEqual(r.withMask, 1);
  assert.strictEqual(r.withoutMask, 1);
});
test("presence: per-clip detail is reported with name, track, hasMask and error", () => {
  const r = core.evaluatePresence([{ name: "a", track: 0, hasMask: true }, { name: "b", track: 1, hasMask: null, error: "boom" }], true);
  assert.deepStrictEqual(r.clips[0], { name: "a", track: 0, hasMask: true, error: null });
  assert.deepStrictEqual(r.clips[1], { name: "b", track: 1, hasMask: null, error: "boom" });
  assert.strictEqual(core.evaluatePresence([{ name: "c", hasMask: false }], true).clips[0].track, null);
});
test("presence: any unreadable clip makes it UNKNOWN", () => {
  const r = core.evaluatePresence([{ name: "a", hasMask: true }, { name: "b", hasMask: null }], true);
  assert.strictEqual(r.verdict, "UNKNOWN");
  assert.strictEqual(r.unknown, 1);
});
test("presence: empty is UNKNOWN", () => {
  assert.strictEqual(core.evaluatePresence([], true).verdict, "UNKNOWN");
});

test("export: all ok non-empty -> PASS", () => {
  assert.strictEqual(core.evaluateExport([{ timeSeconds: 1, ok: true, bytes: 100 }]).verdict, "PASS");
});
test("export: false result or 0 bytes -> FAIL", () => {
  assert.strictEqual(core.evaluateExport([{ timeSeconds: 1, ok: false, bytes: 0 }]).verdict, "FAIL");
  const z = core.evaluateExport([{ timeSeconds: 2, ok: true, bytes: 0 }]);
  assert.strictEqual(z.verdict, "FAIL");
  assert.ok(/0 bytes/.test(z.reasons[0]));
});
test("export: per-frame details (attempts) are carried into the report", () => {
  const r = core.evaluateExport([{ timeSeconds: 1, ok: true, bytes: 5, variantUsed: "B", attempts: [{ variant: "A", returned: false }, { variant: "B", returned: true, bytes: 5 }] }]);
  assert.strictEqual(r.details[0].variantUsed, "B");
  assert.strictEqual(r.details[0].attempts.length, 2);
});
test("export: thrown error text is kept; no frames is UNKNOWN", () => {
  const r = core.evaluateExport([{ timeSeconds: 3, ok: false, bytes: 0, error: "disk locked" }]);
  assert.ok(/disk locked/.test(r.reasons[0]));
  assert.strictEqual(core.evaluateExport([]).verdict, "UNKNOWN");
});

test("compareBuffers", () => {
  assert.strictEqual(core.compareBuffers(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])).equal, true);
  const d = core.compareBuffers(new Uint8Array([1, 2, 3]), new Uint8Array([1, 9, 3]));
  assert.strictEqual(d.equal, false);
  assert.strictEqual(d.firstDiff, 1);
  const l = core.compareBuffers(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]));
  assert.strictEqual(l.equal, false);
  assert.strictEqual(l.firstDiff, 2);
  assert.strictEqual(core.compareBuffers(null, new Uint8Array([1])).missing, true);
});

test("determinism: identical -> PASS; differing -> WARN; unreadable -> UNKNOWN", () => {
  const same = [{ timeSeconds: 1, a: new Uint8Array([1, 2]), b: new Uint8Array([1, 2]) }];
  assert.strictEqual(core.evaluateDeterminism(same).verdict, "PASS");
  const diff = same.concat([{ timeSeconds: 2, a: new Uint8Array([1]), b: new Uint8Array([2]) }]);
  const r = core.evaluateDeterminism(diff);
  assert.strictEqual(r.verdict, "WARN");
  assert.strictEqual(r.different, 1);
  const un = [{ timeSeconds: 1, a: null, b: new Uint8Array([1]) }];
  assert.strictEqual(core.evaluateDeterminism(un).verdict, "UNKNOWN");
  assert.strictEqual(core.evaluateDeterminism([]).verdict, "UNKNOWN");
});

test("determinism: a difference outranks an unreadable pair (WARN, not UNKNOWN)", () => {
  const pairs = [
    { timeSeconds: 1, a: null, b: new Uint8Array([1]) },
    { timeSeconds: 2, a: new Uint8Array([1]), b: new Uint8Array([2]) }
  ];
  assert.strictEqual(core.evaluateDeterminism(pairs).verdict, "WARN");
});

test("matrix: summarises which combinations wrote a file", () => {
  const ok = core.summarizeMatrix([{ label: "a", returned: true, bytes: 10 }, { label: "b", returned: false, bytes: 0 }]);
  assert.strictEqual(ok.verdict, "PASS");
  assert.deepStrictEqual(ok.worked, ["a"]);
  const none = core.summarizeMatrix([{ label: "a", returned: false, bytes: 0 }, { label: "b", threw: "x", bytes: 0 }]);
  assert.strictEqual(none.verdict, "FAIL");
  assert.strictEqual(none.threw, 1);
  assert.strictEqual(core.summarizeMatrix([]).verdict, "UNKNOWN");
});

test("apiProbe: missing classes are reported", () => {
  const ok = core.summarizeApiProbe({
    classes: { ObjectMaskUtils: true, Exporter: true, EncoderManager: true, TickTime: true },
    objectMaskFunctions: ["hasObjectMask"], exporterFunctions: ["exportSequenceFrame"]
  });
  assert.strictEqual(ok.verdict, "PASS");
  assert.strictEqual(ok.hasObjectMaskPresent, true);
  const bad = core.summarizeApiProbe({ classes: { Exporter: true }, objectMaskFunctions: [], exporterFunctions: [] });
  assert.strictEqual(bad.verdict, "UNKNOWN");
  assert.ok(bad.missing.indexOf("ObjectMaskUtils") !== -1);
  assert.strictEqual(bad.hasObjectMaskPresent, false);
});

test("buildReport: overall is the worst part; empty is UNKNOWN; notes say mask internals are not read", () => {
  const r = core.buildReport({ presence: { verdict: "PASS" }, export: { verdict: "FAIL" } });
  assert.strictEqual(r.overall, "FAIL");
  assert.strictEqual(core.buildReport({}).overall, "UNKNOWN");
  assert.ok(r.notes.join(" ").indexOf("not read") !== -1);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(r)));
});

test("maskFolderFor: '<name> Masks' next to the project file", () => {
  assert.strictEqual(core.maskFolderFor("C:\\a\\b\\mid_mask_test.prproj"), "C:\\a\\b\\mid_mask_test Masks");
  assert.strictEqual(core.maskFolderFor("/Users/x/Edit.PRPROJ"), "/Users/x/Edit Masks");
  assert.strictEqual(core.maskFolderFor(""), null);
  assert.strictEqual(core.maskFolderFor(undefined), null);
});

test("shortName: short names unchanged; long names keep the start and the ending", () => {
  assert.strictEqual(core.shortName("subject_0001.png", 26), "subject_0001.png");
  const long = "Roblox-2026-10-13T17_38_49.629Z.mp4";
  const s = core.shortName(long, 26);
  assert.ok(s.length <= 26, s);
  assert.ok(s.startsWith("Roblox-2026-"), s);
  assert.ok(s.endsWith(".629Z.mp4".slice(-8)), s);
  assert.ok(s.indexOf("…") > 0);
  assert.strictEqual(core.shortName(undefined, 26), "");
  assert.strictEqual(core.shortName("x".repeat(100), 3).length <= 8, true);
});

test("blockLabel: only as many characters as the block width allows, never cut mid-word without an ellipsis", () => {
  assert.strictEqual(core.blockLabel("matte_red", 100), "matte_red");
  assert.strictEqual(core.blockLabel("subject_0001.png", 20), "subje…");
  assert.strictEqual(core.blockLabel("subject_0001.png", 5), "");
  assert.strictEqual(core.blockLabel("ab", 12), "ab");
  assert.strictEqual(core.blockLabel(undefined, 50), "");
  assert.strictEqual(core.blockLabel("x", "bad"), "");
});

test("displayPath: strips the Windows long-path prefix only", () => {
  assert.strictEqual(core.displayPath("\\\\?\\C:\\a\\b Masks"), "C:\\a\\b Masks");
  assert.strictEqual(core.displayPath("C:\\x\\y.prproj"), "C:\\x\\y.prproj");
  assert.strictEqual(core.displayPath(null), "");
});

test("formatTime: timecode with fps, seconds without", () => {
  assert.strictEqual(core.formatTime(5, 30), "00:00:05:00");
  assert.strictEqual(core.formatTime(6.6, 30), "00:00:06:18");
  assert.strictEqual(core.formatTime(3725.48, 25), "01:02:05:12");
  assert.strictEqual(core.formatTime(1.234, null), "1.23s");
  assert.strictEqual(core.formatTime(undefined, 30), "?");
});

const clip = (id, o) => Object.assign({ id, seq: 0, seqName: "S", track: 0, trackName: "V1", trackHidden: false, name: id, start: 0, end: 1, disabled: false, sourceKey: "path:" + id, hasMask: false }, o);
const okFolder = { checked: true, folder: "F", exists: true, files: 2, bytes: 4096 };

test("integrity: masked clips with the data folder present -> PASS with an info line", () => {
  const r = core.evaluateIntegrity([clip("a", { hasMask: true }), clip("b")], okFolder, true);
  assert.strictEqual(r.verdict, "PASS");
  assert.deepStrictEqual(r.findings.map((f) => f.code), ["F_MASK_DATA_OK"]);
  assert.strictEqual(r.counts.masked, 1);
  assert.strictEqual(r.counts.unmasked, 1);
});

test("integrity: missing or empty mask data folder is FAIL and names the masked clips", () => {
  const miss = core.evaluateIntegrity([clip("a", { hasMask: true })], { checked: true, folder: "F", exists: false }, true);
  assert.strictEqual(miss.verdict, "FAIL");
  assert.strictEqual(miss.findings[0].code, "F_MASK_DATA_MISSING");
  assert.deepStrictEqual(miss.findings[0].clipIds, ["a"]);
  const empty = core.evaluateIntegrity([clip("a", { hasMask: true })], { checked: true, folder: "F", exists: true, files: 0 }, true);
  assert.strictEqual(empty.findings[0].code, "F_MASK_DATA_EMPTY");
  assert.strictEqual(empty.verdict, "FAIL");
});

test("integrity: an unreadable folder is UNKNOWN, never PASS", () => {
  const r = core.evaluateIntegrity([clip("a", { hasMask: true })], { checked: false, error: "denied" }, true);
  assert.strictEqual(r.verdict, "UNKNOWN");
  assert.strictEqual(r.findings[0].code, "F_MASK_DATA_UNCHECKED");
});

test("integrity: no masks -> no folder finding", () => {
  const r = core.evaluateIntegrity([clip("a")], { checked: false, notNeeded: true }, true);
  assert.strictEqual(r.verdict, "PASS");
  assert.deepStrictEqual(r.findings, []);
});

test("integrity: disabled clip or hidden track with a mask is WARN", () => {
  const r = core.evaluateIntegrity([clip("a", { hasMask: true, disabled: true }), clip("b", { hasMask: true, trackHidden: true, trackName: "V2" })], okFolder, true);
  assert.strictEqual(r.verdict, "WARN");
  const codes = r.findings.map((f) => f.code).sort();
  assert.deepStrictEqual(codes, ["F_MASK_DATA_OK", "F_MASK_ON_DISABLED", "F_MASK_ON_HIDDEN_TRACK"]);
});

test("integrity: same media masked in one clip but not another is WARN on the unmasked clips", () => {
  const r = core.evaluateIntegrity([
    clip("a", { hasMask: true, sourceKey: "path:x" }), clip("b", { sourceKey: "path:x" }), clip("c", { sourceKey: "path:y" })
  ], okFolder, true);
  const f = r.findings.find((x) => x.code === "F_SOURCE_PARTLY_MASKED");
  assert.ok(f);
  assert.deepStrictEqual(f.clipIds, ["b"]);
  assert.strictEqual(r.verdict, "WARN");
});

test("integrity: unknown presence and missing source keys never create a partly-masked finding", () => {
  const r = core.evaluateIntegrity([clip("a", { hasMask: true, sourceKey: null }), clip("b", { sourceKey: null }), clip("c", { hasMask: null, sourceKey: "path:z" }), clip("d", { hasMask: true, sourceKey: "path:z" })], okFolder, true);
  assert.ok(!r.findings.some((x) => x.code === "F_SOURCE_PARTLY_MASKED"));
  assert.strictEqual(r.verdict, "UNKNOWN");
});

test("timelineLayout: percentages of the sequence; unknown times give null", () => {
  const l = core.timelineLayout([clip("a", { start: 5, end: 6.6 }), clip("b", { start: undefined }), clip("c", { seq: 1, start: 0, end: 1 })], { 0: 10 });
  assert.deepStrictEqual(l[0], { id: "a", left: 50, width: 16 });
  assert.strictEqual(l[1].left, null);
  assert.strictEqual(l[2].left, null);
  const tiny = core.timelineLayout([clip("t", { start: 0, end: 0.001 })], { 0: 100 });
  assert.ok(tiny[0].width >= 0.8);
});

test("buildReport carries the v0.3 scan and its verdict", () => {
  const scan = core.evaluateIntegrity([clip("a", { hasMask: true })], { checked: true, folder: "F", exists: false }, true);
  const r = core.buildReport({ scan, api: { verdict: "PASS" } });
  assert.strictEqual(r.overall, "FAIL");
  assert.strictEqual(r.schema, "MID-REPORT-2");
  assert.doesNotThrow(() => JSON.stringify(r));
});

test("integrity: Premiere says a sequence has an object mask but no clip carries one -> UNKNOWN, folder still checked", () => {
  const r = core.evaluateIntegrity([clip("a")], { checked: true, folder: "F", exists: false }, true, [{ seq: 0, name: "S", hasObjectMask: true }]);
  const codes = r.findings.map((f) => f.code);
  assert.ok(codes.includes("F_SEQ_MASK_UNLOCATED"));
  assert.ok(codes.includes("F_MASK_DATA_MISSING"));
  assert.strictEqual(r.verdict, "FAIL");
  assert.deepStrictEqual(r.objectMaskSequences, ["S"]);
});

test("integrity: sequence flag agreeing with a masked clip adds no unlocated finding; missing API is UNKNOWN", () => {
  const ok = core.evaluateIntegrity([clip("a", { hasMask: true })], okFolder, true, [{ seq: 0, name: "S", hasObjectMask: true }]);
  assert.strictEqual(ok.verdict, "PASS");
  const noApi = core.evaluateIntegrity([clip("a")], { notNeeded: true }, false, []);
  assert.strictEqual(noApi.findings[0].code, "F_OBJECT_API_MISSING");
  assert.strictEqual(noApi.verdict, "UNKNOWN");
});

test("tone: verdicts map to badge colours", () => {
  assert.strictEqual(core.tone("PASS"), "OK");
  assert.strictEqual(core.tone("WARN"), "WARN");
  assert.strictEqual(core.tone("FAIL"), "BAD");
  assert.strictEqual(core.tone("UNKNOWN"), "INFO");
});
