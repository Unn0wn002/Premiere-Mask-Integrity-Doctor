"use strict";
// Panel wiring (v0.3). Japanese UI by default with an English toggle.
// Results: summary cards, findings, a clickable timeline map and a clip list. Clicking a clip moves the
// playhead so the Program monitor previews it (frame export does not work on the tested build).
const { entrypoints } = require("uxp");
const core = require("./src/core");
const { t } = require("./src/i18n");
const adapter = require("./src/premiereAdapter");

const LANG_KEY = "maskIntegrityDoctor.lang";
const state = { parts: {}, busy: false, lang: "ja", status: null, filter: "all", scope: "active", selected: null, seqRefs: [], seqs: [], scan: null, lastReport: null, preview: null };
const $ = (id) => document.getElementById(id);
const T = (key, params) => t(state.lang, key, params);

function loadLang() {
  try { const v = window.localStorage.getItem(LANG_KEY); if (v === "ja" || v === "en") state.lang = v; } catch (e) { /* default ja */ }
}
function saveLang() {
  try { window.localStorage.setItem(LANG_KEY, state.lang); } catch (e) { /* not essential */ }
}

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

// status is kept as { key, params, tone } so a language switch can redraw it. A tone turns it into a coloured badge.
function setStatus(key, params, tone) {
  state.status = key ? { key, params, tone } : null;
  const node = $("status");
  node.textContent = key ? T(key, params) : "";
  node.className = tone ? "badge tone-" + tone : "";
}

function setPreview(key, params) {
  state.preview = key ? { key, params } : null;
  $("previewStatus").textContent = key ? T(key, params) : "";
}

// A clip nesting a sequence with masks counts as masked for display; the chip says "nested" and how many.
const nestedCount = (c) => (c.hasMask !== true && c.nestedMasks ? c.nestedMasks.length : 0);
function maskClass(c) { return c.hasMask === true || nestedCount(c) ? "m-yes" : c.hasMask === false ? "m-no" : "m-unknown"; }
function maskWord(c) {
  if (c.hasMask === true) return c.masks && c.masks.length > 1 ? T("masks_n", { n: c.masks.length }) : T("yes");
  if (nestedCount(c)) return T("nested_n", { n: nestedCount(c) });
  return c.hasMask === false ? T("no") : T("unknown");
}

// Clip ids named by a WARN/FAIL finding (shown with a red outline and in the "To check" filter).
function issueIds(scan) {
  const ids = new Set();
  for (const f of scan.findings) if (f.severity === "FAIL" || f.severity === "WARN") f.clipIds.forEach((id) => ids.add(id));
  return ids;
}

async function showClip(c) {
  state.selected = c.id;
  renderTimeline();
  renderClips();
  const seq = state.seqs[c.seq];
  try {
    await adapter.previewClip(state.seqRefs[c.seq], c.start, seq ? seq.fps : null);
    setPreview("show_ok", { name: c.name });
  } catch (e) {
    setPreview("show_failed", { e: e && e.message ? e.message : String(e) });
  }
}

function renderCards() {
  const s = state.scan;
  $("nMasked").textContent = String(s.counts.masked + (s.counts.nested || 0));
  $("nUnmasked").textContent = String(s.counts.unmasked);
  $("nUnknown").textContent = String(s.counts.unknown);
  $("nIssues").textContent = String(s.findings.filter((f) => f.severity === "FAIL" || f.severity === "WARN" || f.severity === "UNKNOWN").length);
}

function renderFindings() {
  const box = $("findings");
  box.textContent = "";
  const s = state.scan;
  const byId = new Map(s.clips.map((c) => [c.id, c]));
  // Problems first, then presence counts and other information.
  const items = s.findings.map((f) => ({ severity: f.severity, text: T(f.code, f.p), clipIds: f.clipIds }));
  for (const c of s.codes) items.push({ severity: c.k === "P_COUNTS" ? "INFO" : "UNKNOWN", text: T(c.k, c.p), clipIds: [] });
  if (!s.counts.masked && s.maskData && s.maskData.notNeeded) items.push({ severity: "INFO", text: T("md_not_needed"), clipIds: [] });
  if (s.verdict === "PASS") items.push({ severity: "INFO", text: T("no_findings"), clipIds: [] });
  const order = { FAIL: 0, WARN: 1, UNKNOWN: 2, INFO: 3 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);
  for (const it of items) {
    const card = el("div", "finding sev-" + it.severity);
    card.appendChild(el("span", "chip sev-" + it.severity, T("S_" + it.severity)));
    card.appendChild(el("span", null, it.text));
    if (it.clipIds.length) {
      const row = el("div", "showrow");
      for (const id of it.clipIds.slice(0, 8)) {
        const c = byId.get(id);
        if (!c) continue;
        // A wrapping chip, not a fixed-height button: long clip names must not run past the card in a narrow dock.
        const b = el("div", "showchip", T("btn_show") + ": " + core.shortName(c.name, 26) + " (" + c.trackName + ")");
        b.title = c.name;
        b.addEventListener("click", () => showClip(c));
        row.appendChild(b);
      }
      card.appendChild(row);
    }
    box.appendChild(card);
  }
}

function renderTimeline() {
  const box = $("timeline");
  box.textContent = "";
  const s = state.scan;
  const issues = issueIds(s);
  const durations = {};
  for (const q of state.seqs) durations[q.index] = q.duration || Math.max(0, ...s.clips.filter((c) => c.seq === q.index).map((c) => Number(c.end) || 0));
  const layout = new Map(core.timelineLayout(s.clips, durations).map((l) => [l.id, l]));
  for (const q of state.seqs) {
    const wrap = el("div", "seq");
    const n = s.clips.filter((c) => c.seq === q.index).length;
    const om = q.hasObjectMask === true ? T("yes") : q.hasObjectMask === false ? T("no") : T("unknown");
    wrap.appendChild(el("div", "seqname", T("seq_line", { name: q.name, n }) + (q.isActive ? " · " + T("seq_open") : "") + " · " + T("seq_object_mask", { v: om })));
    for (let ti = q.tracks.length - 1; ti >= 0; ti -= 1) {
      const tr = q.tracks[ti];
      const clips = s.clips.filter((c) => c.seq === q.index && c.track === tr.index);
      if (!clips.length) continue;
      const row = el("div", "track");
      row.appendChild(el("div", "tlabel", tr.name));
      const lane = el("div", "lane" + (tr.hidden ? " hidden" : ""));
      for (const c of clips) {
        const l = layout.get(c.id);
        if (!l || l.left === null) continue;
        const b = el("div", "block " + maskClass(c) + (issues.has(c.id) ? " issue" : "") + (c.disabled ? " disabled" : "") + (state.selected === c.id ? " sel" : ""), core.blockLabel(c.name, l.width));
        b.style.left = l.left + "%";
        b.style.width = l.width + "%";
        b.title = c.name + " · " + maskWord(c);
        b.addEventListener("click", () => showClip(c));
        lane.appendChild(b);
      }
      row.appendChild(lane);
      wrap.appendChild(row);
    }
    box.appendChild(wrap);
  }
}

function renderClips() {
  const box = $("clips");
  box.textContent = "";
  const s = state.scan;
  const issues = issueIds(s);
  const list = s.clips.filter((c) => state.filter === "all" || (state.filter === "masked" ? c.hasMask === true : issues.has(c.id) || c.hasMask === null));
  if (!list.length) { box.appendChild(el("p", "note", T("no_clips"))); return; }
  for (const c of list) {
    const q = state.seqs[c.seq] || {};
    const row = el("div", "cliprow" + (state.selected === c.id ? " sel" : ""));
    row.appendChild(el("span", "chip " + maskClass(c), maskWord(c)));
    const mid = el("div", "grow");
    mid.appendChild(el("div", "cname", c.name));
    const meta = T("clip_meta", { track: c.trackName, start: core.formatTime(c.start, q.fps), end: core.formatTime(c.end, q.fps) }) + (state.seqs.length > 1 ? " · " + c.seqName : "");
    mid.appendChild(el("div", "cmeta", meta));
    // With Details open, list each mask and the data-file ids its Tracker names (evidence for the user).
    if (!$("jsonBox").hidden && c.masks) mid.appendChild(el("div", "cmeta", c.masks.map((m) => (m.instance || "?") + ": " + (m.guids.join(", ") || "-")).join(" | ") || "-"));
    row.appendChild(mid);
    if (c.disabled) row.appendChild(el("span", "chip tag", T("tag_disabled")));
    if (c.trackHidden) row.appendChild(el("span", "chip tag", T("tag_hidden")));
    if (issues.has(c.id)) row.appendChild(el("span", "chip sev-WARN", "!"));
    const b = el("button", "small", T("btn_show"));
    b.addEventListener("click", () => showClip(c));
    row.appendChild(b);
    box.appendChild(row);
  }
}

function renderApiLine() {
  const api = state.parts.api;
  if (!api) { $("apiLine").textContent = ""; return; }
  const yn = (b) => T(b ? "yes" : "no");
  let s = T("api_line", { v: T("V_" + api.verdict), has: yn(api.hasObjectMaskPresent), exp: yn(api.exportSequenceFramePresent) });
  if (api.missing.length) s += " " + T("api_missing", { list: api.missing.join(", ") });
  $("apiLine").textContent = s;
}

function renderAll() {
  renderApiLine();
  if (!state.scan) return;
  $("results").hidden = false;
  renderCards();
  renderFindings();
  renderTimeline();
  renderClips();
}

function show() {
  const report = core.buildReport(Object.assign({ generatedAt: new Date().toISOString() }, state.parts));
  $("output").value = JSON.stringify(report, null, 2);
  $("saveButton").disabled = false;
  setStatus("overall", { v: T("V_" + report.overall) }, core.tone(report.overall));
  state.lastReport = report;
  renderAll();
  return report;
}

function applyLanguage() {
  document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = T(n.getAttribute("data-i18n")); });
  if (state.status) setStatus(state.status.key, state.status.params, state.status.tone);
  if (state.preview) setPreview(state.preview.key, state.preview.params);
  if (state.lastReport) setStatus("overall", { v: T("V_" + state.lastReport.overall) }, core.tone(state.lastReport.overall));
  renderAll();
}

async function run(labelKey, fn) {
  if (state.busy) return;
  state.busy = true;
  $("scanButton").disabled = true;
  setStatus("busy", { label: T(labelKey) });
  try { await fn(); show(); } catch (e) { setStatus("failed", { label: T(labelKey), e: e && e.message ? e.message : String(e) }, "BAD"); }
  state.busy = false;
  $("scanButton").disabled = false;
}

async function scan() {
  state.parts.api = adapter.probeApi();
  const r = await adapter.scanIntegrity(state.scope);
  state.seqRefs = r.sequences.map((q) => q.ref);
  state.seqs = r.sequences.map((q) => ({ index: q.index, name: q.name, fps: q.fps, duration: q.duration, tracks: q.tracks, isActive: q.isActive, hasObjectMask: q.hasObjectMask }));
  const result = core.evaluateIntegrity(r.clips, r.maskData, r.apiPresent, r.sequences.map((q) => ({ seq: q.index, name: q.name, hasObjectMask: q.hasObjectMask })), r.savedState,
    { projectHasObjectMask: r.projectHasObjectMask });
  result.projectHasObjectMask = r.projectHasObjectMask;
  result.sequences = state.seqs;
  result.capabilities = r.capabilities;
  result.projectName = r.projectName;
  state.scan = result;
  state.projectPath = r.projectPath;
  state.selected = null;
  setPreview(null);
  state.parts.scan = result;
  delete state.parts.presence;
}

entrypoints.setup({
  panels: {
    "mask-integrity-doctor": {
      show() {
        if (state.bound) return;
        state.bound = true;
        loadLang();
        applyLanguage();
        $("langButton").addEventListener("click", () => {
          state.lang = state.lang === "ja" ? "en" : "ja";
          saveLang();
          applyLanguage();
        });
        $("scanButton").addEventListener("click", () => run("label_scan", scan));
        $("probeButton").addEventListener("click", () => run("label_probe", async () => { state.parts.api = adapter.probeApi(); }));
        $("jsonButton").addEventListener("click", () => { $("jsonBox").hidden = !$("jsonBox").hidden; if (state.scan) renderClips(); });
        // Toggle groups (styled chips; UXP ignores backgrounds on <button> and "selected" on sp-action-button here).
        const toggle = (group, attr, apply) => document.querySelectorAll(".seg." + group).forEach((b) => b.addEventListener("click", () => {
          document.querySelectorAll(".seg." + group).forEach((x) => { x.className = "seg " + group + (x === b ? " on" : ""); });
          apply(b.getAttribute(attr));
        }));
        toggle("scope", "data-scope", (v) => { state.scope = v; });
        toggle("filter", "data-filter", (v) => { state.filter = v; if (state.scan) renderClips(); });
        $("saveButton").addEventListener("click", () => {
          try {
            const where = adapter.saveReportNextToProject(state.projectPath, $("output").value);
            setPreview("saved", { path: where });
          } catch (e) { setPreview("save_failed", { e: e && e.message ? e.message : String(e) }); }
        });
      }
    }
  }
});
