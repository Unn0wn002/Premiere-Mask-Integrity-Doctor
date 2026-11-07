"use strict";
// Pure logic for the Mask Integrity Doctor. No Premiere / UXP / file-system access here, so it can be
// unit-tested in Node with test doubles (those tests are NOT host evidence).

const SCHEMA = "MID-REPORT-2";
const TICKS_PER_SECOND = 254016000000; // documented Premiere tick rate; UNVERIFIED on the target host
const RANK = { PASS: 0, UNKNOWN: 1, WARN: 2, FAIL: 3 };

// Colour tone for a verdict (the coloured result badge in the panel).
function tone(verdict) {
  if (verdict === "PASS") return "OK";
  if (verdict === "WARN") return "WARN";
  if (verdict === "FAIL") return "BAD";
  return "INFO";
}

function worst(verdicts) {
  let w = "PASS";
  for (const v of verdicts) { if (RANK[v] > RANK[w]) w = v; }
  return w;
}

// Evenly spaced sample times in seconds, never at exactly 0 or the very end.
function sampleTimes(durationSeconds, count) {
  const d = Number(durationSeconds);
  const n = Math.floor(Number(count));
  if (!(d > 0) || !(n >= 1)) return [];
  const out = [];
  for (let i = 1; i <= n; i += 1) { out.push(Math.round((d * i / (n + 1)) * 1000) / 1000); }
  return out;
}

function secondsToTicks(seconds) {
  return String(Math.round(Number(seconds) * TICKS_PER_SECOND));
}

// items: [{ name, hasMask: true | false | null, error?: string }]; apiPresent: boolean
// reasons keeps the English text (JSON report); codes holds { k: message key, p: params } for the UI.
function evaluatePresence(items, apiPresent) {
  const out = { verdict: "PASS", reasons: [], codes: [], withMask: 0, withoutMask: 0, unknown: 0, total: items.length, clips: items.map((it) => ({ name: it.name, track: it.track === undefined ? null : it.track, hasMask: it.hasMask, error: it.error || null })) };
  const say = (code, params, msg) => { out.codes.push({ k: code, p: params }); out.reasons.push(msg); };
  if (!apiPresent) {
    out.verdict = "UNKNOWN";
    say("P_API_MISSING", null, "ObjectMaskUtils is not available on this host; mask presence cannot be reported.");
    out.unknown = items.length;
    return out;
  }
  for (const it of items) {
    if (it.hasMask === true) out.withMask += 1;
    else if (it.hasMask === false) out.withoutMask += 1;
    else out.unknown += 1;
  }
  if (out.total === 0) { out.verdict = "UNKNOWN"; say("P_NONE_INSPECTED", null, "No clips were inspected."); }
  else if (out.unknown > 0) {
    out.verdict = "UNKNOWN";
    say("P_UNREADABLE", { u: out.unknown, t: out.total }, out.unknown + " of " + out.total + " clips could not be checked for an object mask.");
  } else {
    say("P_COUNTS", { m: out.withMask, w: out.withoutMask }, out.withMask + " clip(s) with an object mask, " + out.withoutMask + " without.");
  }
  return out;
}

// results: [{ timeSeconds, ok: boolean, bytes: number, error?: string }]
function evaluateExport(results) {
  const out = { verdict: "PASS", reasons: [], ok: 0, failed: 0, total: results.length, details: results };
  if (results.length === 0) { out.verdict = "UNKNOWN"; out.reasons.push("No frames were exported."); return out; }
  for (const r of results) {
    if (r.ok === true && r.bytes > 0) out.ok += 1;
    else {
      out.failed += 1;
      out.reasons.push("Frame at " + r.timeSeconds + " s failed" + (r.error ? ": " + r.error : (r.ok === true ? ": 0 bytes" : ".")));
    }
  }
  if (out.failed > 0) out.verdict = "FAIL";
  else out.reasons.push("All " + out.total + " sample frames were exported and are non-empty.");
  return out;
}

function compareBuffers(a, b) {
  const lenA = a ? a.length : -1;
  const lenB = b ? b.length : -1;
  if (lenA < 0 || lenB < 0) return { equal: false, lenA, lenB, firstDiff: null, missing: true };
  if (lenA !== lenB) return { equal: false, lenA, lenB, firstDiff: Math.min(lenA, lenB), missing: false };
  for (let i = 0; i < lenA; i += 1) {
    if (a[i] !== b[i]) return { equal: false, lenA, lenB, firstDiff: i, missing: false };
  }
  return { equal: true, lenA, lenB, firstDiff: null, missing: false };
}

// pairs: [{ timeSeconds, a: Uint8Array|null, b: Uint8Array|null }]
function evaluateDeterminism(pairs) {
  const out = { verdict: "PASS", reasons: [], identical: 0, different: 0, unreadable: 0, total: pairs.length, details: [] };
  if (pairs.length === 0) { out.verdict = "UNKNOWN"; out.reasons.push("No frame pairs to compare."); return out; }
  for (const p of pairs) {
    const c = compareBuffers(p.a, p.b);
    out.details.push({ timeSeconds: p.timeSeconds, equal: c.equal, lenA: c.lenA, lenB: c.lenB, firstDiff: c.firstDiff });
    if (c.missing) out.unreadable += 1;
    else if (c.equal) out.identical += 1;
    else out.different += 1;
  }
  if (out.unreadable > 0) { out.verdict = "UNKNOWN"; out.reasons.push(out.unreadable + " pair(s) could not be read back."); }
  if (out.different > 0) {
    out.verdict = "WARN";
    out.reasons.push(out.different + " of " + out.total + " frame(s) differ between two identical exports (render is not deterministic here, or the codec adds variable data).");
  }
  if (out.verdict === "PASS") out.reasons.push("All " + out.total + " frame pairs are byte-identical.");
  return out;
}

// Describes what the host exposes, from a plain list of names. Used to settle the UNVERIFIED API questions.
function summarizeApiProbe(probe) {
  const needed = ["ObjectMaskUtils", "Exporter", "EncoderManager", "TickTime"];
  const missing = needed.filter((n) => !(probe.classes && probe.classes[n] === true));
  return {
    verdict: missing.length === 0 ? "PASS" : "UNKNOWN",
    missing,
    objectMaskFunctions: (probe.objectMaskFunctions || []).slice(),
    exporterFunctions: (probe.exporterFunctions || []).slice(),
    hasObjectMaskPresent: (probe.objectMaskFunctions || []).indexOf("hasObjectMask") !== -1,
    exportSequenceFramePresent: (probe.exporterFunctions || []).indexOf("exportSequenceFrame") !== -1
  };
}

// results: [{ label, returned, threw?, bytes? }]. Summarises which export parameter combinations produced a file.
function summarizeMatrix(results) {
  const worked = results.filter((r) => r.bytes > 0).map((r) => r.label);
  const returnedTrue = results.filter((r) => r.returned === true).map((r) => r.label);
  const threw = results.filter((r) => r.threw).length;
  const out = { verdict: "UNKNOWN", total: results.length, worked, returnedTrue, threw, reasons: [] };
  if (results.length === 0) { out.reasons.push("No combinations were tried."); return out; }
  if (worked.length > 0) {
    out.verdict = "PASS";
    out.reasons.push(worked.length + " of " + results.length + " combinations wrote a non-empty file.");
  } else {
    out.verdict = "FAIL";
    out.reasons.push("None of " + results.length + " combinations wrote a file" + (threw ? " (" + threw + " threw)." : "."));
  }
  return out;
}

// Premiere 26.x stores object-mask data outside the project file, in "<project name> Masks" next to it
// (observed natively 2026-11-01: <guid>.prmf files; the host warns that the folder must travel with the project).
function maskFolderFor(projectPath) {
  const p = String(projectPath || "");
  const cut = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  if (cut < 0) return null;
  const base = p.slice(cut + 1).replace(/\.prproj$/i, "");
  if (!base) return null;
  return p.slice(0, cut + 1) + base + " Masks";
}

// Windows long-path prefix (\?\) that project.path carries on Premiere 26.5, removed for display and file names.
function displayPath(p) { return String(p || "").replace(/^\\\\\?\\/, ""); }

// Shortens a long name in the middle so the start and the ending (file extension) stay visible.
function shortName(name, max) {
  const s = String(name === undefined || name === null ? "" : name);
  const limit = Math.max(8, Number(max) || 26);
  if (s.length <= limit) return s;
  const tail = Math.min(10, Math.floor(limit / 3));
  return s.slice(0, limit - tail - 1) + "…" + s.slice(s.length - tail);
}

// Label for a timeline block that is widthPct percent of its lane: only as many characters as fit a narrow dock
// (about 0.34 characters per percent), ending in an ellipsis when cut; nothing when there is no room.
function blockLabel(name, widthPct) {
  const s = String(name === undefined || name === null ? "" : name);
  const n = Math.floor(Number(widthPct) * 0.34);
  if (!(n >= 3)) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

// Sequence time as HH:MM:SS:FF when the frame rate is known, otherwise seconds with two decimals.
function formatTime(seconds, fps) {
  const s = Number(seconds);
  if (!isFinite(s)) return "?";
  const f = Number(fps);
  if (!(f > 0)) return s.toFixed(2) + "s";
  const rate = Math.round(f);
  const total = Math.round(s * f);
  const ff = total % rate;
  const secs = Math.floor(total / rate);
  const pad = (n) => (n < 10 ? "0" : "") + n;
  return pad(Math.floor(secs / 3600)) + ":" + pad(Math.floor(secs / 60) % 60) + ":" + pad(secs % 60) + ":" + pad(ff);
}

// clips: [{ id, seq, seqName, track, trackName, trackHidden, name, start, end, disabled, sourceKey, hasMask, error }]
// maskData: { checked, folder, exists, files, bytes, error } (folder check result from the adapter)
// Findings: { code, severity: FAIL | WARN | UNKNOWN | INFO, clipIds, p }. English text stays in `reasons`.
// seqFlags: [{ seq, name, hasObjectMask: true | false | null }] from ObjectMaskUtils.hasObjectMask(sequence),
// the only host-documented object-mask check (it accepts a Project or Sequence, not a clip).
// Per-clip hasMask comes from the saved project file (applySavedMasks); null when it could not be established.
// Clips that nest a sequence carry nestedMasks (masks inside it). opts: { projectHasObjectMask }.
function evaluateIntegrity(clips, maskData, apiPresent, seqFlags, savedState, opts) {
  const flags = seqFlags || [];
  const saved = savedState || null;
  const projectHasObjectMask = opts && opts.projectHasObjectMask === true;
  const presence = evaluatePresence(clips, true);
  const nested = clips.filter((c) => c.hasMask !== true && c.nestedMasks && c.nestedMasks.length > 0);
  const out = {
    verdict: presence.verdict, reasons: presence.reasons.slice(), codes: presence.codes.slice(), findings: [],
    counts: { masked: presence.withMask, nested: nested.length, unmasked: presence.withoutMask - nested.length, unknown: presence.unknown,
      total: clips.length, sequences: new Set(clips.map((c) => c.seq)).size },
    maskData: maskData || null, clips
  };
  const find = (code, severity, clipIds, p, msg) => { out.findings.push({ code, severity, clipIds, p }); out.reasons.push(msg); };
  const masked = clips.filter((c) => c.hasMask === true);
  const dependent = masked.concat(nested); // clips whose render needs mask data
  out.objectMaskSequences = flags.filter((f) => f.hasObjectMask === true).map((f) => f.name);
  // Presence counted nesting clips as "without"; restate the count without them (they get their own line below).
  if (nested.length) {
    const i = out.codes.findIndex((x) => x.k === "P_COUNTS");
    if (i >= 0) {
      out.codes[i] = { k: "P_COUNTS", p: { m: presence.withMask, w: out.counts.unmasked } };
      out.reasons[i] = presence.withMask + " clip(s) with an object mask, " + out.counts.unmasked + " without.";
    }
  }
  for (const c of nested) {
    find("F_NESTED_MASKS", "INFO", [c.id], { name: c.name, n: c.nestedMasks.length, seq: c.nestedSequence },
      "\"" + c.name + "\" nests sequence \"" + c.nestedSequence + "\" with " + c.nestedMasks.length + " object mask(s); their data files are checked too.");
  }
  if (projectHasObjectMask && !dependent.length && !out.objectMaskSequences.length) {
    find("F_PROJECT_MASKS_ELSEWHERE", "INFO", [], null, "Other sequences in this project use object masks. Scan all sequences to check them.");
  }

  out.savedState = saved;
  if (saved && !saved.readable) find("F_SAVED_FILE_UNREADABLE", "UNKNOWN", [], { e: saved.error || "-" }, "The saved project file could not be read, so masks cannot be located per clip (" + (saved.error || "-") + ").");
  if (saved && saved.readable && (saved.liveUnmatched > 0 || saved.savedUnmatched > 0)) {
    find("F_UNSAVED_CHANGES", "UNKNOWN", [], { n: saved.liveUnmatched + saved.savedUnmatched }, "The timeline differs from the saved project file (" + (saved.liveUnmatched + saved.savedUnmatched) + " clip(s)). Save the project and scan again.");
  }
  if (!apiPresent) find("F_OBJECT_API_MISSING", "UNKNOWN", [], null, "ObjectMaskUtils is not available on this host; object masks cannot be confirmed per sequence.");
  for (const f of flags) {
    const inSeq = clips.filter((c) => c.seq === f.seq);
    if (f.hasObjectMask === true && !inSeq.some((c) => c.hasMask === true)) {
      find("F_SEQ_MASK_UNLOCATED", "UNKNOWN", [], { name: f.name }, "Premiere reports an object mask in sequence \"" + f.name + "\" but no clip with a mask component was found (for example inside a nested sequence).");
    }
  }

  const md = maskData || {};
  if (dependent.length > 0 || out.objectMaskSequences.length > 0 || projectHasObjectMask) {
    if (!md.checked) find("F_MASK_DATA_UNCHECKED", "UNKNOWN", [], { e: md.error || "-" }, "The mask data folder could not be checked (" + (md.error || "-") + ").");
    else if (!md.exists) find("F_MASK_DATA_MISSING", "FAIL", dependent.map((c) => c.id), { folder: displayPath(md.folder) }, "Clips use object masks but the mask data folder is missing: " + displayPath(md.folder));
    else if (!(md.files > 0)) find("F_MASK_DATA_EMPTY", "FAIL", dependent.map((c) => c.id), { folder: displayPath(md.folder) }, "Clips use object masks but the mask data folder has no .prmf files: " + displayPath(md.folder));
    else find("F_MASK_DATA_OK", "INFO", [], { n: md.files, kb: Math.max(1, Math.round((md.bytes || 0) / 1024)) }, "Mask data folder found with " + md.files + " .prmf file(s).");
  }
  // Per mask: its Tracker names its data files; if none of them is in the folder, that mask's data is lost.
  if (md.checked && md.exists && md.files > 0) {
    const have = new Set((md.guids || []).map((g) => String(g).toLowerCase()));
    for (const c of masked) {
      for (const m of c.masks || []) {
        if (m.guids && m.guids.length && !m.guids.some((g) => have.has(String(g).toLowerCase()))) {
          find("F_CLIP_MASK_DATA_MISSING", "FAIL", [c.id], { name: c.name, mask: m.instance || "?" }, "Mask " + (m.instance || "?") + " on \"" + c.name + "\" has no data file in the mask data folder.");
        }
      }
    }
    for (const c of nested) {
      for (const m of c.nestedMasks) {
        if (m.guids && m.guids.length && !m.guids.some((g) => have.has(String(g).toLowerCase()))) {
          find("F_NESTED_MASK_DATA_MISSING", "FAIL", [c.id], { name: c.name, mask: m.instance || "?", seq: m.sequence },
            "Mask " + (m.instance || "?") + " inside nested sequence \"" + m.sequence + "\" (used by \"" + c.name + "\") has no data file in the mask data folder.");
        }
      }
    }
  }
  for (const c of dependent) {
    if (c.disabled === true) find("F_MASK_ON_DISABLED", "WARN", [c.id], { name: c.name }, "Masked clip is disabled and will not render: " + c.name);
    if (c.trackHidden === true) find("F_MASK_ON_HIDDEN_TRACK", "WARN", [c.id], { name: c.name, track: c.trackName }, "Masked clip is on a hidden track (" + c.trackName + "): " + c.name);
  }
  const bySource = new Map();
  for (const c of clips) {
    if (!c.sourceKey || (c.hasMask !== true && c.hasMask !== false)) continue;
    if (!bySource.has(c.sourceKey)) bySource.set(c.sourceKey, []);
    bySource.get(c.sourceKey).push(c);
  }
  for (const group of bySource.values()) {
    const m = group.filter((c) => c.hasMask === true);
    const u = group.filter((c) => c.hasMask === false);
    if (m.length && u.length) {
      find("F_SOURCE_PARTLY_MASKED", "WARN", u.map((c) => c.id), { name: m[0].name, m: m.length, u: u.length },
        "Same media is masked in " + m.length + " clip(s) but not in " + u.length + " other(s): " + m[0].name + ". Check whether those also need a mask.");
    }
  }
  out.verdict = worst([out.verdict].concat(out.findings.map((f) => (f.severity === "INFO" ? "PASS" : f.severity))));
  return out;
}

// Every mask inside a nested sequence (and sequences nested in it), as [{ instance, guids, sequence, clip }].
// Premiere's hasObjectMask(outer sequence) returned false for an outer sequence that only nests a masked one
// (seen natively 2026-11-01), yet exporting the outer sequence renders those masks, so they are followed here.
function nestedMasksOf(saved, guid, seen) {
  if (seen.has(guid)) return [];
  seen.add(guid);
  const sq = saved.sequences.find((s) => s.guid === guid);
  if (!sq) return [];
  const out = [];
  for (const it of sq.items) {
    for (const m of it.masks) out.push({ instance: m.instance, guids: m.guids, sequence: sq.name, clip: it.name });
    if (it.nestedSequence) out.push(...nestedMasksOf(saved, it.nestedSequence, seen));
  }
  return out;
}

// Copies per-clip masks from the parsed SAVED project (projectFile.readProjectMasks) onto the live clips.
// Match: sequence guid (else name) + video track index + start time in ticks. Live clips without a saved
// counterpart keep hasMask null (UNKNOWN); saved masked items without a live clip mean unsaved edits.
// seqInfo: [{ seq, guid, name }]. Returns { readable, error, matched, liveUnmatched, savedUnmatched }.
function applySavedMasks(clips, seqInfo, saved) {
  const state = { readable: !!(saved && !saved.error && saved.sequences), error: saved && saved.error ? saved.error : null, matched: 0, liveUnmatched: 0, savedUnmatched: 0 };
  if (!state.readable) return state;
  const used = new Set();
  for (const info of seqInfo) {
    const sq = saved.sequences.find((s) => info.guid && s.guid === info.guid) || saved.sequences.find((s) => s.name === info.name);
    for (const c of clips.filter((x) => x.seq === info.seq)) {
      const startTicks = c.startTicks !== undefined && c.startTicks !== null ? String(c.startTicks) : String(Math.round(Number(c.start) * TICKS_PER_SECOND));
      const hit = sq ? sq.items.find((it) => !used.has(it) && it.track === c.track && String(it.startTicks) === startTicks) : null;
      if (!hit) { state.liveUnmatched += 1; continue; }
      used.add(hit);
      state.matched += 1;
      c.masks = hit.masks;
      c.hasMask = hit.masks.length > 0;
      if (hit.nestedSequence) {
        const inner = saved.sequences.find((s) => s.guid === hit.nestedSequence);
        c.nestedSequence = inner ? inner.name : hit.nestedSequence;
        c.nestedMasks = nestedMasksOf(saved, hit.nestedSequence, new Set());
      }
    }
    if (sq) state.savedUnmatched += sq.items.filter((it) => !used.has(it) && it.masks.length > 0).length;
  }
  return state;
}

// Horizontal position of each clip on a 0-100% strip of its sequence (for the timeline preview).
function timelineLayout(clips, durationBySeq) {
  return clips.map((c) => {
    const d = Number(durationBySeq && durationBySeq[c.seq]);
    const s = Number(c.start), e = Number(c.end);
    if (!(d > 0) || !isFinite(s) || !isFinite(e)) return { id: c.id, left: null, width: null };
    const left = Math.max(0, Math.min(100, (s / d) * 100));
    const width = Math.max(0.8, Math.min(100 - left, ((e - s) / d) * 100));
    return { id: c.id, left: Math.round(left * 100) / 100, width: Math.round(width * 100) / 100 };
  });
}

function buildReport(parts) {
  const verdicts = [];
  for (const k of ["api", "presence", "scan", "export", "determinism", "matrix"]) { if (parts[k]) verdicts.push(parts[k].verdict); }
  return {
    schema: SCHEMA,
    tool: "Premiere Mask Integrity Doctor v0.3.2",
    generatedAt: parts.generatedAt || null,
    host: parts.host || null,
    overall: verdicts.length ? worst(verdicts) : "UNKNOWN",
    api: parts.api || null,
    scan: parts.scan || null,
    presence: parts.presence || null,
    export: parts.export || null,
    determinism: parts.determinism || null,
    matrix: parts.matrix || null,
    notes: [
      "Mask internals (geometry, keyframes, tracking) are not read; anything about them is UNKNOWN.",
      "This report checks delivery consistency only. It cannot tell whether a mask is correct."
    ]
  };
}

module.exports = {
  SCHEMA, TICKS_PER_SECOND, tone, worst, sampleTimes, secondsToTicks, evaluatePresence, evaluateExport,
  compareBuffers, evaluateDeterminism, summarizeApiProbe, summarizeMatrix, buildReport,
  maskFolderFor, formatTime, evaluateIntegrity, timelineLayout, applySavedMasks, displayPath, shortName, blockLabel
};
