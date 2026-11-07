"use strict";
// Saved-project reader: gzip/inflate against Node's zlib, and the mask map on a synthetic project that mirrors
// the structure seen in a real Premiere 26.5.2.5 file. These are NOT host evidence.
const test = require("node:test");
const assert = require("node:assert");
const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");
const pf = require("../src/projectFile");
const core = require("../src/core");

test("gunzip matches zlib for stored, fixed and dynamic blocks", () => {
  const text = Buffer.from("mask ".repeat(20000) + "end日本");
  for (const level of [0, 1, 6, 9]) {
    const gz = zlib.gzipSync(text, { level });
    assert.ok(Buffer.from(pf.gunzip(gz)).equals(text), "level " + level);
  }
  const random = Buffer.alloc(70000);
  for (let i = 0; i < random.length; i += 1) random[i] = (i * 7919 + (i >> 3)) & 0xff;
  assert.ok(Buffer.from(pf.gunzip(zlib.gzipSync(random))).equals(random));
  assert.throws(() => pf.gunzip(Buffer.from("not gzip at all, sorry")));
});

test("base64Latin1 decodes like Buffer", () => {
  const b = Buffer.from("\u0000ÿabc-7e20343b-11a5-4976-a3e5-752a50a55b9e\u0001", "latin1");
  assert.strictEqual(pf.base64Latin1(b.toString("base64")), b.toString("latin1"));
});

const GUID_A = "7e20343b-11a5-4976-a3e5-752a50a55b9e";
const GUID_B = "cc6ae7fe-7f2e-4211-84a7-2926b5d0c13a";
const trackerBlob = Buffer.from("\u0010\u0000$\u0000\u0000\u0000" + GUID_B + "\u0000\u0004$\u0000" + GUID_A + "\u0000", "latin1").toString("base64");

// Minimal project in Premiere's layout: one sequence, V1 with two clips; the second carries mask "01".
function syntheticXml() {
  return [
    "<?xml version=\"1.0\"?>\n<PremiereData Version=\"3\">",
    "\t<Sequence ObjectUID=\"seq-guid-1\" ClassID=\"x\" Version=\"1\">\n\t\t<Name>Main &amp; Cut</Name>\n\t\t<TrackGroups Version=\"1\"><TrackGroup Version=\"1\" Index=\"0\"><Second ObjectRef=\"10\"/></TrackGroup><TrackGroup Version=\"1\" Index=\"1\"><Second ObjectRef=\"11\"/></TrackGroup></TrackGroups>\n\t</Sequence>",
    "\t<VideoTrackGroup ObjectID=\"10\" ClassID=\"x\" Version=\"1\">\n\t\t<Tracks Version=\"1\"><Track Index=\"0\" ObjectURef=\"trk-1\"/></Tracks>\n\t</VideoTrackGroup>",
    "\t<AudioTrackGroup ObjectID=\"11\" ClassID=\"x\" Version=\"1\">\n\t\t<Tracks Version=\"1\"><Track Index=\"0\" ObjectURef=\"trk-a\"/></Tracks>\n\t</AudioTrackGroup>",
    "\t<VideoClipTrack ObjectUID=\"trk-1\" ClassID=\"x\" Version=\"1\">\n\t\t<TrackItems Version=\"1\"><TrackItem Index=\"0\" ObjectRef=\"20\"/><TrackItem Index=\"1\" ObjectRef=\"21\"/></TrackItems>\n\t</VideoClipTrack>",
    "\t<VideoClipTrackItem ObjectID=\"20\" ClassID=\"x\" Version=\"1\">\n\t\t<ClipTrackItem><TrackItem><End>254016000000</End></TrackItem><SubClip ObjectRef=\"30\"/></ClipTrackItem>\n\t</VideoClipTrackItem>",
    "\t<VideoClipTrackItem ObjectID=\"21\" ClassID=\"x\" Version=\"1\">\n\t\t<ClipTrackItem><TrackItem><Start>254016000000</Start><End>508032000000</End></TrackItem><SubClip ObjectRef=\"31\"/></ClipTrackItem>\n\t\t<SelectionComponents ObjectRef=\"40\"/>\n\t</VideoClipTrackItem>",
    "\t<SubClip ObjectID=\"30\" ClassID=\"x\" Version=\"1\">\n\t\t<Name>plain.mp4</Name>\n\t</SubClip>",
    "\t<SubClip ObjectID=\"31\" ClassID=\"x\" Version=\"1\">\n\t\t<Name>person.mp4</Name>\n\t</SubClip>",
    "\t<VideoComponentChain ObjectID=\"40\" ClassID=\"x\" Version=\"1\">\n\t\t<ComponentChain><Components Version=\"1\"><Component Index=\"0\" ObjectRef=\"50\"/></Components></ComponentChain>\n\t</VideoComponentChain>",
    "\t<VideoFilterComponent ObjectID=\"50\" ClassID=\"x\" Version=\"1\">\n\t\t<SubComponents Version=\"1\"><SubComponent Index=\"0\" ObjectRef=\"51\"/></SubComponents><MatchName>AE.ADBE AEMask2</MatchName>\n\t</VideoFilterComponent>",
    "\t<VideoFilterComponent ObjectID=\"51\" ClassID=\"x\" Version=\"1\">\n\t\t<Params><Param Index=\"0\" ObjectRef=\"60\"/><Param Index=\"1\" ObjectRef=\"61\"/></Params><InstanceName>01</InstanceName><MatchName>AE.ADBE AEMask2</MatchName>\n\t</VideoFilterComponent>",
    "\t<ArbVideoComponentParam ObjectID=\"60\" ClassID=\"x\" Version=\"1\">\n\t\t<Name>Tracker</Name><StartKeyframeValue Encoding=\"base64\" BinaryHash=\"h\">" + trackerBlob + "</StartKeyframeValue>\n\t</ArbVideoComponentParam>",
    "\t<ArbVideoComponentParam ObjectID=\"61\" ClassID=\"x\" Version=\"1\">\n\t\t<Name>User Interactions</Name><StartKeyframeValue Encoding=\"base64\">" + Buffer.from("dc7d312c-6b24-4ef0-882a-7f809ef3ad46").toString("base64") + "</StartKeyframeValue>\n\t</ArbVideoComponentParam>",
    "</PremiereData>\n"
  ].join("\n");
}

test("parseProjectMasks: maps the masked clip, its mask instance and only the Tracker GUIDs", () => {
  const r = pf.parseProjectMasks(syntheticXml());
  assert.strictEqual(r.sequences.length, 1);
  const s = r.sequences[0];
  assert.strictEqual(s.guid, "seq-guid-1");
  assert.strictEqual(s.name, "Main & Cut");
  assert.strictEqual(s.items.length, 2);
  assert.deepStrictEqual(s.items[0], { track: 0, startTicks: "0", endTicks: "254016000000", name: "plain.mp4", masks: [], nestedSequence: null });
  assert.strictEqual(s.items[1].name, "person.mp4");
  assert.deepStrictEqual(s.items[1].masks, [{ instance: "01", guids: [GUID_B, GUID_A] }]);
});

test("readProjectMasks: gzip bytes in, error object (never a throw) for junk", () => {
  const gz = zlib.gzipSync(Buffer.from(syntheticXml()));
  const r = pf.readProjectMasks(new Uint8Array(gz));
  assert.strictEqual(r.sequences[0].items[1].masks.length, 1);
  assert.ok(pf.readProjectMasks(Buffer.from([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8])).error);
  assert.ok(pf.readProjectMasks(Buffer.from("hello")).error);
});

const live = (id, track, start, o) => Object.assign({ id, seq: 0, track, trackName: "V" + (track + 1), name: id, startTicks: String(start), hasMask: null }, o);

test("applySavedMasks: matches by sequence guid + track + start ticks", () => {
  const saved = pf.parseProjectMasks(syntheticXml());
  const clips = [live("a", 0, 0), live("b", 0, 254016000000)];
  const st = core.applySavedMasks(clips, [{ seq: 0, guid: "seq-guid-1", name: "x" }], saved);
  assert.deepStrictEqual(st, { readable: true, error: null, matched: 2, liveUnmatched: 0, savedUnmatched: 0 });
  assert.strictEqual(clips[0].hasMask, false);
  assert.strictEqual(clips[1].hasMask, true);
  assert.strictEqual(clips[1].masks[0].instance, "01");
});

test("applySavedMasks: falls back to the sequence name; moved clips count as unsaved changes", () => {
  const saved = pf.parseProjectMasks(syntheticXml());
  const clips = [live("a", 0, 0), live("b", 0, 999)];
  const st = core.applySavedMasks(clips, [{ seq: 0, guid: null, name: "Main & Cut" }], saved);
  assert.strictEqual(st.matched, 1);
  assert.strictEqual(st.liveUnmatched, 1);
  assert.strictEqual(st.savedUnmatched, 1);
  assert.strictEqual(clips[1].hasMask, null);
});

test("applySavedMasks: unreadable file leaves every clip UNKNOWN", () => {
  const clips = [live("a", 0, 0)];
  const st = core.applySavedMasks(clips, [{ seq: 0, guid: "g", name: "n" }], { error: "boom" });
  assert.strictEqual(st.readable, false);
  assert.strictEqual(clips[0].hasMask, null);
});

test("integrity: a mask whose Tracker files are all missing is FAIL; one present file is enough", () => {
  const folder = (guids) => ({ checked: true, folder: "F", exists: true, files: guids.length, bytes: 1, guids });
  const clip = { id: "b", seq: 0, track: 0, trackName: "V1", name: "person.mp4", hasMask: true, masks: [{ instance: "01", guids: [GUID_B, GUID_A] }] };
  const ok = core.evaluateIntegrity([clip], folder([GUID_A, "e710f900-b87b-4138-b213-2eab8808b691"]), true, [], { readable: true, matched: 1, liveUnmatched: 0, savedUnmatched: 0 });
  assert.strictEqual(ok.verdict, "PASS");
  const bad = core.evaluateIntegrity([clip], folder(["00000000-0000-0000-0000-000000000000"]), true, [], { readable: true, matched: 1, liveUnmatched: 0, savedUnmatched: 0 });
  assert.strictEqual(bad.verdict, "FAIL");
  assert.ok(bad.findings.some((f) => f.code === "F_CLIP_MASK_DATA_MISSING" && f.clipIds[0] === "b"));
});

test("integrity: unsaved changes and unreadable saved file are UNKNOWN", () => {
  const c = { id: "a", seq: 0, track: 0, trackName: "V1", name: "a", hasMask: false };
  const unsaved = core.evaluateIntegrity([c], { notNeeded: true }, true, [], { readable: true, matched: 0, liveUnmatched: 1, savedUnmatched: 0 });
  assert.ok(unsaved.findings.some((f) => f.code === "F_UNSAVED_CHANGES"));
  assert.strictEqual(unsaved.verdict, "UNKNOWN");
  const unread = core.evaluateIntegrity([Object.assign({}, c, { hasMask: null })], { notNeeded: true }, true, [], { readable: false, error: "denied" });
  assert.ok(unread.findings.some((f) => f.code === "F_SAVED_FILE_UNREADABLE"));
  assert.strictEqual(unread.verdict, "UNKNOWN");
});

// Outer sequence whose only clip nests "Main & Cut" (layout seen natively: SubClip -> Clip -> VideoSequenceSource).
// One top-level object in Premiere's layout (tab-indented open and close lines).
const TAB = String.fromCharCode(9), NL = String.fromCharCode(10);
const obj = (tag, id, body) => TAB + "<" + tag + " " + id + " ClassID=\"x\" Version=\"1\">" + NL + TAB + TAB + body + NL + TAB + "</" + tag + ">";
function nestedXml() {
  return syntheticXml().replace("</PremiereData>", [
    obj("Sequence", "ObjectUID=\"seq-outer\"", "<Name>Outer</Name><TrackGroups Version=\"1\"><TrackGroup Version=\"1\" Index=\"0\"><Second ObjectRef=\"12\"/></TrackGroup></TrackGroups>"),
    obj("VideoTrackGroup", "ObjectID=\"12\"", "<Tracks Version=\"1\"><Track Index=\"0\" ObjectURef=\"trk-2\"/></Tracks>"),
    obj("VideoClipTrack", "ObjectUID=\"trk-2\"", "<TrackItems Version=\"1\"><TrackItem Index=\"0\" ObjectRef=\"22\"/></TrackItems>"),
    obj("VideoClipTrackItem", "ObjectID=\"22\"", "<ClipTrackItem><TrackItem><End>508032000000</End></TrackItem><SubClip ObjectRef=\"32\"/></ClipTrackItem>"),
    obj("SubClip", "ObjectID=\"32\"", "<Clip ObjectRef=\"33\"/><Name>Main &amp; Cut</Name>"),
    obj("VideoClip", "ObjectID=\"33\"", "<Clip><Source ObjectRef=\"34\"/></Clip>"),
    obj("VideoSequenceSource", "ObjectID=\"34\"", "<SequenceSource><Sequence ObjectURef=\"seq-guid-1\"/></SequenceSource>"),
    "</PremiereData>"].join(NL));
}

test("parseProjectMasks: a nested sequence clip points at its inner sequence", () => {
  const r = pf.parseProjectMasks(nestedXml());
  const outer = r.sequences.find((s) => s.name === "Outer");
  assert.strictEqual(outer.items[0].nestedSequence, "seq-guid-1");
  assert.deepStrictEqual(outer.items[0].masks, []);
  assert.strictEqual(r.sequences.find((s) => s.guid === "seq-guid-1").items[1].nestedSequence, null);
});

test("nested: the outer clip collects the inner masks; their missing data is FAIL on the outer clip", () => {
  const saved = pf.parseProjectMasks(nestedXml());
  const clips = [live("n", 0, 0, { name: "Main & Cut" })];
  const st = core.applySavedMasks(clips, [{ seq: 0, guid: "seq-outer", name: "Outer" }], saved);
  assert.strictEqual(st.matched, 1);
  assert.strictEqual(clips[0].hasMask, false);
  assert.strictEqual(clips[0].nestedSequence, "Main & Cut");
  assert.strictEqual(clips[0].nestedMasks.length, 1);
  const flags = [{ seq: 0, name: "Outer", hasObjectMask: false }];
  const folder = (guids) => ({ checked: true, folder: "F", exists: true, files: guids.length, bytes: 1, guids });
  const ok = core.evaluateIntegrity(clips, folder([GUID_A]), true, flags, st);
  assert.strictEqual(ok.verdict, "PASS");
  assert.strictEqual(ok.counts.nested, 1);
  assert.strictEqual(ok.counts.unmasked, 0);
  assert.deepStrictEqual(ok.codes.find((x) => x.k === "P_COUNTS").p, { m: 0, w: 0 });
  assert.ok(ok.findings.some((f) => f.code === "F_NESTED_MASKS"));
  assert.ok(ok.findings.some((f) => f.code === "F_MASK_DATA_OK"));
  const bad = core.evaluateIntegrity(clips, folder(["00000000-0000-0000-0000-000000000000"]), true, flags, st);
  assert.strictEqual(bad.verdict, "FAIL");
  assert.ok(bad.findings.some((f) => f.code === "F_NESTED_MASK_DATA_MISSING" && f.clipIds[0] === "n"));
  const gone = core.evaluateIntegrity(clips, { checked: true, folder: "F", exists: false }, true, flags, st);
  assert.ok(gone.findings.some((f) => f.code === "F_MASK_DATA_MISSING" && f.clipIds[0] === "n"));
});

test("nested: a sequence that nests itself (directly or via another) does not loop", () => {
  const saved = { sequences: [
    { guid: "a", name: "A", items: [{ track: 0, startTicks: "0", masks: [{ instance: "01", guids: ["g"] }], nestedSequence: "b" }] },
    { guid: "b", name: "B", items: [{ track: 0, startTicks: "0", masks: [], nestedSequence: "a" }] }
  ] };
  const clips = [live("x", 0, 0)];
  core.applySavedMasks(clips, [{ seq: 0, guid: "b", name: "B" }], saved);
  assert.strictEqual(clips[0].nestedMasks.length, 1);
});

test("project-level: masks elsewhere in the project are pointed out and the folder is still checked", () => {
  const c = { id: "a", seq: 0, track: 0, trackName: "V1", name: "a", hasMask: false };
  const r = core.evaluateIntegrity([c], { checked: true, folder: "F", exists: false }, true, [{ seq: 0, name: "S", hasObjectMask: false }],
    { readable: true, matched: 1, liveUnmatched: 0, savedUnmatched: 0 }, { projectHasObjectMask: true });
  assert.ok(r.findings.some((f) => f.code === "F_PROJECT_MASKS_ELSEWHERE"));
  assert.ok(r.findings.some((f) => f.code === "F_MASK_DATA_MISSING"));
  assert.strictEqual(r.verdict, "FAIL");
});

// Optional: the real disposable project from the native session, when it exists on this machine (skipped in CI).
const realProject = path.join(__dirname, "..", "_qa_scratch", "mid_mask_test.prproj");
test("real saved project (local only): the masked clip is found", { skip: !fs.existsSync(realProject) }, () => {
  const r = pf.readProjectMasks(fs.readFileSync(realProject));
  assert.ok(!r.error, r.error);
  const masked = r.sequences.flatMap((s) => s.items).filter((i) => i.masks.length);
  assert.ok(masked.length >= 1);
  assert.ok(masked.every((i) => i.masks.every((m) => m.guids.length > 0)));
});
