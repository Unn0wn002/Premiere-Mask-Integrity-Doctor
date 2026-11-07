"use strict";
// Translation coverage for the panel UI (not host evidence).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../src/core");
const { MESSAGES, t } = require("../src/i18n");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "index.js"), "utf8");

test("ja and en have the same keys", () => {
  assert.deepStrictEqual(Object.keys(MESSAGES.ja).sort(), Object.keys(MESSAGES.en).sort());
});

test("every key used by the panel exists in both languages", () => {
  const used = new Set();
  for (const m of html.matchAll(/data-i18n="([a-z_0-9]+)"/g)) used.add(m[1]);
  for (const m of js.matchAll(/\bT\("([a-z_]+)"/g)) used.add(m[1]);
  for (const m of js.matchAll(/(?:setStatus|run)\("([a-z_]+)"/g)) used.add(m[1]);
  for (const v of ["PASS", "UNKNOWN", "WARN", "FAIL"]) used.add("V_" + v);
  const missing = [...used].filter((k) => !(k in MESSAGES.ja) || !(k in MESSAGES.en));
  assert.deepStrictEqual(missing, []);
  assert.ok(used.size > 20);
});

test("every presence code has text in both languages with placeholders filled", () => {
  const cases = [
    core.evaluatePresence([{ name: "a", hasMask: false }], false),
    core.evaluatePresence([], true),
    core.evaluatePresence([{ name: "a", hasMask: null }, { name: "b", hasMask: true }], true),
    core.evaluatePresence([{ name: "a", hasMask: true }, { name: "b", hasMask: false }], true)
  ];
  const seen = new Set();
  for (const r of cases) {
    assert.strictEqual(r.codes.length, r.reasons.length);
    for (const c of r.codes) {
      seen.add(c.k);
      for (const lang of ["ja", "en"]) {
        const s = t(lang, c.k, c.p);
        assert.ok(c.k in MESSAGES[lang], "missing " + lang + " " + c.k);
        assert.ok(!/\{[a-z]+\}/.test(s), "unfilled placeholder: " + s);
      }
    }
  }
  assert.deepStrictEqual([...seen].sort(), ["P_API_MISSING", "P_COUNTS", "P_NONE_INSPECTED", "P_UNREADABLE"]);
});

test("every integrity finding code and severity has text in both languages", () => {
  const c = (id, o) => Object.assign({ id, seq: 0, track: 0, trackName: "V1", name: id, sourceKey: "k", hasMask: true, disabled: true, trackHidden: true }, o);
  const scans = [
    core.evaluateIntegrity([c("a"), c("b", { hasMask: false })], { checked: true, folder: "F", exists: true, files: 1, bytes: 10 }, true),
    core.evaluateIntegrity([c("a")], { checked: true, folder: "F", exists: false }, true),
    core.evaluateIntegrity([c("a")], { checked: true, folder: "F", exists: true, files: 0 }, true),
    core.evaluateIntegrity([c("a")], { checked: false, error: "x" }, true),
    core.evaluateIntegrity([c("a", { hasMask: false })], { notNeeded: true }, false, [{ seq: 0, name: "S", hasObjectMask: true }]),
    core.evaluateIntegrity([c("a", { masks: [{ instance: "01", guids: ["g1"] }] })], { checked: true, folder: "F", exists: true, files: 1, guids: ["g2"] }, true, [], { readable: true, liveUnmatched: 1, savedUnmatched: 0 }),
    core.evaluateIntegrity([c("a", { hasMask: null })], { notNeeded: true }, true, [], { readable: false, error: "x" }),
    core.evaluateIntegrity([c("n", { hasMask: false, nestedSequence: "Inner", nestedMasks: [{ instance: "01", guids: ["g1"], sequence: "Inner" }] })],
      { checked: true, folder: "F", exists: true, files: 1, guids: ["g2"] }, true, []),
    core.evaluateIntegrity([c("a", { hasMask: false })], { checked: true, folder: "F", exists: true, files: 1, guids: ["g"] }, true, [], null, { projectHasObjectMask: true })
  ];
  const seen = new Set();
  for (const s of scans) for (const f of s.findings) {
    seen.add(f.code);
    for (const lang of ["ja", "en"]) {
      assert.ok(f.code in MESSAGES[lang], "missing " + lang + " " + f.code);
      assert.ok(("S_" + f.severity) in MESSAGES[lang], "missing severity " + f.severity);
      assert.ok(!/\{[a-z]+\}/.test(t(lang, f.code, f.p)), "unfilled placeholder in " + f.code);
    }
  }
  assert.deepStrictEqual([...seen].sort(), ["F_CLIP_MASK_DATA_MISSING", "F_MASK_DATA_EMPTY", "F_MASK_DATA_MISSING", "F_MASK_DATA_OK", "F_MASK_DATA_UNCHECKED",
    "F_MASK_ON_DISABLED", "F_MASK_ON_HIDDEN_TRACK", "F_NESTED_MASKS", "F_NESTED_MASK_DATA_MISSING", "F_OBJECT_API_MISSING", "F_PROJECT_MASKS_ELSEWHERE", "F_SAVED_FILE_UNREADABLE", "F_SEQ_MASK_UNLOCATED", "F_SOURCE_PARTLY_MASKED", "F_UNSAVED_CHANGES"]);
});

test("English codes text matches the English reasons in the report", () => {
  const r = core.evaluatePresence([{ name: "a", hasMask: true }, { name: "b", hasMask: false }], true);
  assert.strictEqual(t("en", r.codes[0].k, r.codes[0].p), r.reasons[0]);
});

test("t falls back to English, then to the key", () => {
  assert.strictEqual(t("fr", "btn_scan"), "Scan");
  assert.strictEqual(t("ja", "nope"), "nope");
  assert.notStrictEqual(t("ja", "btn_scan"), t("en", "btn_scan"));
});
