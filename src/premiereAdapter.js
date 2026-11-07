"use strict";
// Host-bound code (Premiere Pro UXP). NOT unit-tested. Read-only with respect to the project: it never creates
// actions, locks the project, imports, deletes or saves.
// Used by the panel: probeApi, scanIntegrity (v0.3), previewClip (moves the playhead only).
// scanMaskPresence is the v0.2 scan (verified natively once, see evidence/), kept for reference.
// DISABLED, not wired to the panel: exportFrames, exportMatrix, determinismCheck, sequenceDurationSeconds.
// exportSequenceFrame returned false for every tried parameter combination on Premiere 26.5.2.5 (cause UNKNOWN),
// so those functions are kept only for a future investigation.
const ppro = require("premierepro");
const { storage } = require("uxp");
const core = require("./core");
const projectFile = require("./projectFile");

function errorText(e) { return e ? (e.message || String(e)) : "Unknown error"; }

function ownFunctionNames(obj) {
  if (!obj) return [];
  const names = new Set();
  try { Object.getOwnPropertyNames(obj).forEach((n) => { if (typeof obj[n] === "function") names.add(n); }); } catch (e) { /* ignore */ }
  try {
    const proto = Object.getPrototypeOf(obj);
    if (proto && proto !== Object.prototype && proto !== Function.prototype) {
      Object.getOwnPropertyNames(proto).forEach((n) => { if (n !== "constructor") names.add(n); });
    }
  } catch (e) { /* ignore */ }
  return Array.from(names).sort();
}

// Settles the UNVERIFIED API questions on the real host: which classes and functions exist.
function probeApi() {
  const classes = {};
  ["ObjectMaskUtils", "Exporter", "EncoderManager", "TickTime", "Project", "Sequence"].forEach((n) => {
    classes[n] = !!(ppro && ppro[n]);
  });
  return core.summarizeApiProbe({
    classes,
    objectMaskFunctions: ownFunctionNames(ppro && ppro.ObjectMaskUtils),
    exporterFunctions: ownFunctionNames(ppro && ppro.Exporter)
  });
}

async function activeSequence() {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("No active project");
  const seq = await project.getActiveSequence();
  if (!seq) throw new Error("No active sequence");
  return { project, sequence: seq };
}

async function collectVideoClips(sequence) {
  const clips = [];
  const trackCount = await sequence.getVideoTrackCount();
  for (let t = 0; t < trackCount; t += 1) {
    const track = await sequence.getVideoTrack(t);
    const items = await track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
    for (let i = 0; i < items.length; i += 1) {
      let name = "(unnamed)";
      try { name = String(await items[i].getName()); } catch (e) { /* keep default */ }
      clips.push({ track: t, index: i, name, clip: items[i] });
    }
  }
  return clips;
}

// v0.2 mask presence per clip. WRONG (found 2026-11-01): hasObjectMask accepts only a Project or Sequence, so
// passing a clip always returned false. Kept unused for the record; scanIntegrity replaces it.
async function scanMaskPresence() {
  const apiPresent = !!(ppro.ObjectMaskUtils && typeof ppro.ObjectMaskUtils.hasObjectMask === "function");
  const { sequence } = await activeSequence();
  const clips = await collectVideoClips(sequence);
  const items = [];
  for (const c of clips) {
    const item = { name: c.name, track: c.track, hasMask: null };
    if (apiPresent) {
      try { item.hasMask = !!(await ppro.ObjectMaskUtils.hasObjectMask(c.clip)); } catch (e) { item.error = errorText(e); }
    }
    items.push(item);
  }
  return core.evaluatePresence(items, apiPresent);
}

// ---- v0.3 integrity scan -------------------------------------------------------------------------------
// Every optional host call goes through `attempt`, which records whether that call worked on this host
// (report.scan.capabilities), so an unsupported call shows up as UNKNOWN data instead of a guess.

async function attempt(caps, label, fn) {
  try {
    const v = await fn();
    if (caps[label] === undefined) caps[label] = true;
    return v;
  } catch (e) {
    caps[label] = "failed: " + errorText(e);
    return undefined;
  }
}

function secondsOf(t) {
  if (!t) return undefined;
  if (typeof t.seconds === "number") return t.seconds;
  if (t.ticks !== undefined) return Number(t.ticks) / core.TICKS_PER_SECOND;
  return undefined;
}

async function sequenceFps(caps, sequence) {
  const tb = await attempt(caps, "sequence.getTimebase", () => sequence.getTimebase());
  const ticks = Number(tb);
  if (ticks > 0) return core.TICKS_PER_SECOND / ticks;
  const settings = await attempt(caps, "sequence.getSettings", () => sequence.getSettings());
  const rate = settings ? await attempt(caps, "settings.getVideoFrameRate", () => settings.getVideoFrameRate()) : undefined;
  if (rate && Number(rate.value) > 0) return Number(rate.value);
  if (rate && Number(rate.ticksPerFrame) > 0) return core.TICKS_PER_SECOND / Number(rate.ticksPerFrame);
  return undefined;
}

async function sourceKeyOf(caps, item) {
  const pi = await attempt(caps, "trackItem.getProjectItem", () => item.getProjectItem());
  if (!pi) return { key: null, name: null };
  let path;
  if (ppro.ClipProjectItem && typeof ppro.ClipProjectItem.cast === "function") {
    const clipItem = await attempt(caps, "ClipProjectItem.cast", () => ppro.ClipProjectItem.cast(pi));
    if (clipItem) path = await attempt(caps, "clipProjectItem.getMediaFilePath", () => clipItem.getMediaFilePath());
  }
  const name = pi.name !== undefined ? String(pi.name) : null;
  return { key: path ? "path:" + path : (name ? "name:" + name : null), name };
}

async function scanSequence(caps, sequence, seqIndex, apiPresent, clips) {
  const seqName = (await attempt(caps, "sequence.name", () => sequence.name)) || "Sequence " + (seqIndex + 1);
  const fps = await sequenceFps(caps, sequence);
  const endT = await attempt(caps, "sequence.getEndTime", () => sequence.getEndTime());
  const trackCount = await sequence.getVideoTrackCount();
  const tracks = [];
  for (let t = 0; t < trackCount; t += 1) {
    const track = await sequence.getVideoTrack(t);
    const trackName = (await attempt(caps, "track.name", () => track.name)) || "V" + (t + 1);
    const muted = await attempt(caps, "track.isMuted", () => track.isMuted());
    tracks.push({ index: t, name: "V" + (t + 1), label: String(trackName), hidden: muted === true ? true : (muted === false ? false : null) });
    const items = await track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      const c = { id: seqIndex + ":" + t + ":" + i, seq: seqIndex, seqName: String(seqName), track: t, trackName: "V" + (t + 1),
        trackHidden: tracks[t].hidden, name: "(unnamed)", start: undefined, end: undefined, disabled: null, sourceKey: null, hasMask: null };
      try { c.name = String(await it.getName()); } catch (e) { /* keep default */ }
      const st = await attempt(caps, "trackItem.getStartTime", () => it.getStartTime());
      c.start = secondsOf(st);
      c.startTicks = st && st.ticks !== undefined ? String(st.ticks) : null;
      c.end = secondsOf(await attempt(caps, "trackItem.getEndTime", () => it.getEndTime()));
      const dis = await attempt(caps, "trackItem.isDisabled", () => it.isDisabled());
      c.disabled = dis === true ? true : (dis === false ? false : null);
      const src = await sourceKeyOf(caps, it);
      c.sourceKey = src.key;
      clips.push(c);
    }
  }
  let hasObjectMask = null;
  if (apiPresent) {
    const v = await attempt(caps, "ObjectMaskUtils.hasObjectMask(sequence)", () => ppro.ObjectMaskUtils.hasObjectMask(sequence));
    hasObjectMask = v === true ? true : (v === false ? false : null);
  }
  const guid = await attempt(caps, "sequence.guid", () => String(sequence.guid));
  return { index: seqIndex, guid: guid || null, name: String(seqName), fps: fps || null, duration: secondsOf(endT) || null, tracks, hasObjectMask, ref: sequence };
}

// UXP's fs accepts a native path or a file: URL depending on the build; both forms are tried.
function pathForms(p) { return [p, "file:/" + String(p).replace(/\\/g, "/")]; }

// Which clips carry masks, from the SAVED project file (see src/projectFile.js for why). Read-only.
function readSavedProject(caps, projectPath) {
  if (!projectPath) return { error: "project path unavailable" };
  const fs = require("fs");
  let lastError = null;
  for (const p of pathForms(projectPath)) {
    let bytes;
    try { bytes = fs.readFileSync(p); } catch (e) { lastError = errorText(e); continue; }
    caps["fs.readFileSync(project)"] = p === projectPath ? "native" : "file-url";
    const parsed = projectFile.readProjectMasks(new Uint8Array(bytes));
    if (parsed.error) caps["projectFile.parse"] = "failed: " + parsed.error;
    return parsed;
  }
  caps["fs.readFileSync(project)"] = "failed: " + lastError;
  return { error: lastError };
}

// Reads "<project name> Masks" next to the saved project file. Read-only: lists names and sizes, never opens .prmf.
function checkMaskFolder(caps, projectPath) {
  const folder = core.maskFolderFor(projectPath);
  if (!folder) return { checked: false, folder: null, error: "project path unavailable" };
  const out = { checked: false, folder, exists: false, files: 0, bytes: 0, guids: [] };
  const fs = require("fs");
  const forms = pathForms(folder);
  let lastError = null;
  for (const dir of forms) {
    let names;
    try { names = fs.readdirSync(dir); } catch (e) {
      lastError = errorText(e);
      // UXP on Windows reports a missing folder as "-4058" (libuv ENOENT), seen natively 2026-11-01.
      if (/ENOENT|-4058|no such|not exist|not found|cannot find/i.test(lastError)) { out.checked = true; out.pathForm = dir === folder ? "native" : "file-url"; return out; }
      continue;
    }
    out.checked = true;
    out.exists = true;
    out.pathForm = dir === folder ? "native" : "file-url";
    const sep = dir === folder ? "\\" : "/";
    for (const n of names) {
      if (!/\.prmf$/i.test(n)) continue;
      out.files += 1;
      out.guids.push(n.replace(/\.prmf$/i, "").toLowerCase());
      try { out.bytes += Number(fs.lstatSync(dir + sep + n).size) || 0; } catch (e) { /* size optional */ }
    }
    caps["fs.readdirSync"] = out.pathForm;
    return out;
  }
  caps["fs.readdirSync"] = "failed: " + lastError;
  out.error = lastError;
  return out;
}

// scope: "active" or "all". Returns plain data for core.evaluateIntegrity plus what the timeline preview needs.
async function scanIntegrity(scope) {
  const caps = {};
  const apiPresent = !!(ppro.ObjectMaskUtils && typeof ppro.ObjectMaskUtils.hasObjectMask === "function");
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("No active project");
  const active = await project.getActiveSequence();
  let sequences = [];
  if (scope === "all") sequences = (await attempt(caps, "project.getSequences", () => project.getSequences())) || [];
  if (!sequences.length) {
    if (!active) throw new Error("No active sequence");
    sequences = [active];
  }
  const activeGuid = active ? await attempt(caps, "sequence.guid", () => String(active.guid)) : undefined;
  const clips = [];
  const seqs = [];
  for (let s = 0; s < sequences.length; s += 1) {
    const info = await scanSequence(caps, sequences[s], s, apiPresent, clips);
    info.isActive = sequences[s] === active || (info.guid !== null && info.guid === activeGuid);
    seqs.push(info);
  }
  let projectHasObjectMask = null;
  if (apiPresent) {
    const v = await attempt(caps, "ObjectMaskUtils.hasObjectMask(project)", () => ppro.ObjectMaskUtils.hasObjectMask(project));
    projectHasObjectMask = v === true ? true : (v === false ? false : null);
  }
  const projectPath = await attempt(caps, "project.path", () => String(project.path));
  const saved = readSavedProject(caps, projectPath);
  const savedState = core.applySavedMasks(clips, seqs.map((q) => ({ seq: q.index, guid: q.guid, name: q.name })), saved);
  const needFolder = projectHasObjectMask === true || seqs.some((q) => q.hasObjectMask === true) || clips.some((c) => c.hasMask === true);
  const maskData = needFolder ? checkMaskFolder(caps, projectPath) : { checked: false, notNeeded: true };
  const projectName = await attempt(caps, "project.name", () => project.name);
  return { apiPresent, projectHasObjectMask, projectPath: projectPath || null, clips, sequences: seqs, maskData, savedState, capabilities: caps, projectName: projectName ? String(projectName) : null };
}

// Writes the JSON report next to the project file, as "<project> - Mask Report <time>.json", and returns its path.
// The UXP save dialog (getFileForSaving) never opened on Premiere 26.5.2.5 from this panel (seen 2026-11-01), so the
// report goes beside the project instead. This is the plugin's only write; it never touches the project or masks.
function saveReportNextToProject(projectPath, text) {
  const clean = core.displayPath(projectPath);
  const cut = Math.max(clean.lastIndexOf("\\"), clean.lastIndexOf("/"));
  if (!clean || cut < 0) throw new Error("project path unavailable (save the project first)");
  const base = clean.slice(cut + 1).replace(/\.prproj$/i, "");
  const d = new Date();
  const two = (n) => (n < 10 ? "0" : "") + n;
  const stamp = d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()) + " " + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
  const target = clean.slice(0, cut + 1) + base + " - Mask Report " + stamp + ".json";
  const fs = require("fs");
  let lastError = null;
  for (const p of pathForms(target)) {
    try { fs.writeFileSync(p, text, { encoding: "utf-8" }); return target; } catch (e) { lastError = errorText(e); }
  }
  throw new Error(lastError || "write failed");
}

// Preview: moves the playhead of an already-open sequence a few frames into the clip, so the Program monitor shows it.
// Opening another sequence uses project.setActiveSequence (a view change; the project content is not edited).
async function previewClip(seqRef, startSeconds, fps) {
  const project = await ppro.Project.getActiveProject();
  const active = await project.getActiveSequence();
  if (seqRef && active !== seqRef && typeof project.setActiveSequence === "function") await project.setActiveSequence(seqRef);
  const target = (seqRef || active);
  const offset = fps > 0 ? 2 / fps : 0.05;
  return target.setPlayerPosition(makeTicks(Math.max(0, Number(startSeconds) + offset)));
}

function makeTicks(seconds) {
  if (ppro.TickTime && typeof ppro.TickTime.createWithSeconds === "function") return ppro.TickTime.createWithSeconds(seconds);
  if (ppro.TickTime && typeof ppro.TickTime.createWithTicks === "function") return ppro.TickTime.createWithTicks(core.secondsToTicks(seconds));
  throw new Error("TickTime factory not available");
}

// Exports N sample frames into folderEntry as <prefix>_<k>.png. Per the documented example, filename is the full
// path and filepath is the folder path (UNVERIFIED; checked by M04).
async function exportFrames(folderEntry, prefix, count, width, height, durationSeconds) {
  const { sequence } = await activeSequence();
  const times = core.sampleTimes(durationSeconds, count);
  const base = String(folderEntry.nativePath).replace(/\\/g, "/").replace(/\/+$/, "");
  const results = [];
  for (let k = 0; k < times.length; k += 1) {
    const fileName = prefix + "_" + (k + 1) + ".png";
    const r = { timeSeconds: times[k], fileName, ok: false, bytes: 0, attempts: [] };
    // Two argument forms are tried and recorded; the docs example is ambiguous (UNVERIFIED which one works):
    //   A: filename = full path, filepath = folder path with a trailing slash
    //   B: filename = bare file name, filepath = folder path with a trailing slash
    const variants = [["A", base + "/" + fileName], ["B", fileName]];
    for (const [variant, fileArg] of variants) {
      const attempt = { variant };
      try {
        attempt.returned = await ppro.Exporter.exportSequenceFrame(sequence, makeTicks(times[k]), fileArg, base + "/", width, height);
      } catch (e) { attempt.error = errorText(e); }
      try {
        const entry = await folderEntry.getEntry(fileName);
        const buf = await entry.read({ format: storage.formats.binary });
        attempt.bytes = buf.byteLength;
      } catch (e) { attempt.readError = errorText(e); }
      r.attempts.push(attempt);
      if (attempt.bytes > 0) { r.ok = true; r.bytes = attempt.bytes; r.variantUsed = variant; break; }
    }
    if (!r.ok) {
      const last = r.attempts[r.attempts.length - 1];
      r.error = "no file written (" + r.attempts.map((a) => a.variant + ": returned=" + String(a.returned) + (a.error ? ", threw=" + a.error : "")).join("; ") + ")";
      if (last && last.readError) r.error += "; readback: " + last.readError;
    }
    results.push(r);
  }
  return { times, results, verdict: core.evaluateExport(results) };
}

// Diagnostic: tries a grid of exportSequenceFrame parameter combinations (one frame each) and records what the
// host returns and whether a file appears. Writes up to 16 small files into the chosen folder.
async function exportMatrix(folderEntry, durationSeconds) {
  const { sequence } = await activeSequence();
  const base = String(folderEntry.nativePath).replace(/\\/g, "/").replace(/\/+$/, "");
  const sizes = [[320, 180], [1920, 1080]];
  const times = [0, Math.max(0.1, Math.min(1, durationSeconds / 2))];
  const exts = ["png", "jpg"];
  const forms = ["A", "B"];
  const results = [];
  let n = 0;
  for (const [w, h] of sizes) for (const t of times) for (const ext of exts) for (const form of forms) {
    n += 1;
    const fileName = "diag_" + n + "." + ext;
    const label = w + "x" + h + " t=" + t + " " + ext + " form" + form;
    const r = { label };
    try {
      r.returned = await ppro.Exporter.exportSequenceFrame(sequence, makeTicks(t), form === "A" ? base + "/" + fileName : fileName, base + "/", w, h);
    } catch (e) { r.threw = errorText(e); }
    try {
      const entry = await folderEntry.getEntry(fileName);
      r.bytes = (await entry.read({ format: storage.formats.binary })).byteLength;
    } catch (e) { r.bytes = 0; }
    results.push(r);
  }
  const summary = core.summarizeMatrix(results);
  summary.details = results;
  return summary;
}

async function readBytes(folderEntry, fileName) {
  try {
    const entry = await folderEntry.getEntry(fileName);
    return new Uint8Array(await entry.read({ format: storage.formats.binary }));
  } catch (e) { return null; }
}

// Exports the same frames twice (prefix A and B) and compares the files byte for byte.
async function determinismCheck(folderEntry, count, width, height, durationSeconds) {
  const a = await exportFrames(folderEntry, "mid_A", count, width, height, durationSeconds);
  const b = await exportFrames(folderEntry, "mid_B", count, width, height, durationSeconds);
  const pairs = [];
  for (let k = 0; k < a.times.length; k += 1) {
    pairs.push({
      timeSeconds: a.times[k],
      a: await readBytes(folderEntry, "mid_A_" + (k + 1) + ".png"),
      b: await readBytes(folderEntry, "mid_B_" + (k + 1) + ".png")
    });
  }
  return { export: core.evaluateExport(a.results.concat(b.results)), determinism: core.evaluateDeterminism(pairs) };
}

async function sequenceDurationSeconds() {
  const { sequence } = await activeSequence();
  const end = await sequence.getEndTime();
  return Number(end.seconds);
}

module.exports = { probeApi, scanMaskPresence, scanIntegrity, previewClip, saveReportNextToProject, exportFrames, exportMatrix, determinismCheck, sequenceDurationSeconds };
