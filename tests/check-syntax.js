"use strict";
// Static checks: syntax of every source file, the core stays host-independent, and the panel never mutates the project.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const files = ["index.js", "src/core.js", "src/premiereAdapter.js", "src/i18n.js", "src/projectFile.js"].map((f) => path.join(root, f));
for (const f of files) execFileSync(process.execPath, ["--check", f], { stdio: "inherit" });

for (const pure of [files[1], files[4]]) {
  const text = fs.readFileSync(pure, "utf8");
  for (const bad of ["premierepro", "require(\"uxp\")", "require('uxp')", "document.", "require(\"fs\")", "writeFile"]) {
    if (text.includes(bad)) throw new Error(path.basename(pure) + " must be host-independent but contains: " + bad);
  }
}

const forbidden = [
  "lockedAccess", "executeTransaction", "createRemoveItemAction", "createInsertAction", "createOverwriteAction",
  "createSetNameAction", "importFiles", "deleteItem", ".save(", "saveAs(", "createBin", "removeItem",
  "writeFileSync", "unlinkSync", "rmdirSync", "renameSync", "mkdirSync"
];
// The single allowed write: the JSON report beside the project, inside saveReportNextToProject.
const adapterText = fs.readFileSync(files[2], "utf8");
const writes = adapterText.split("writeFileSync").length - 1;
const saveFn = /function saveReportNextToProject[\s\S]*?\r?\n}\r?\n/.exec(adapterText);
if (writes !== 1 || !saveFn || !saveFn[0].includes("writeFileSync")) throw new Error("writeFileSync must appear once, only in saveReportNextToProject");
for (const f of files) {
  let text = fs.readFileSync(f, "utf8");
  if (f === files[2]) text = text.replace(saveFn[0], "");
  for (const t of forbidden) {
    if (text.includes(t)) throw new Error(path.basename(f) + " contains a project-mutating token: " + t);
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
if (manifest.host.app !== "premierepro") throw new Error("manifest host must be premierepro");
if (manifest.entrypoints[0].type !== "panel") throw new Error("entrypoint must be a panel (dockable)");
if (!manifest.entrypoints[0].preferredDockedSize) throw new Error("panel must declare a docked size");

console.log("static checks ok");
