const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { prepareBeta, files } = require('../scripts/prepare-beta');
const verifier = path.resolve(__dirname, '../scripts/verify-package.ps1');
// Prefer PowerShell 7 (pwsh); fall back to Windows PowerShell 5.1 so the verifier tests also run where only it exists.
function findPowerShell() {
  for (const exe of ['pwsh', 'powershell']) {
    const probe = spawnSync(exe, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8' });
    if (probe.status === 0) return { exe, version: String(probe.stdout).trim() };
  }
  return null;
}
const powerShell = findPowerShell();
const pwshAvailable = powerShell !== null;
if (powerShell) console.log(`# packaging tests use ${powerShell.exe} ${powerShell.version}`);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function fixture(callback) {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'arid-package-'));
  try { return callback(prepareBeta(output), output); }
  finally { fs.rmSync(output, { recursive: true, force: true }); }
}

function verify(receipt, output, packageFile = receipt.packageFile, options = []) {
  return spawnSync(powerShell.exe, ['-NoProfile', '-File', verifier, '-Package', packageFile, '-Receipt', receipt.receiptPath, '-Output', path.join(output, 'verification.json'), ...options], { encoding: 'utf8' });
}

function reformatManifest(archivePath, output) {
  const script = path.join(output, 'reformat.ps1');
  // Windows PowerShell 5.1 needs System.IO.Compression loaded as well, and keeps exit code 0 after non-terminating
  // errors, so errors are made fatal to stop the helper from silently leaving the archive unchanged.
  fs.writeFileSync(script, `param([string]$ArchivePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open($ArchivePath, [IO.Compression.ZipArchiveMode]::Update)
try {
  $entry = $zip.GetEntry('manifest.json')
  $reader = [IO.StreamReader]::new($entry.Open())
  try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json | ConvertTo-Json -Depth 100 -Compress } finally { $reader.Dispose() }
  $entry.Delete()
  $replacement = $zip.CreateEntry('manifest.json')
  $writer = [IO.StreamWriter]::new($replacement.Open(), [Text.UTF8Encoding]::new($false))
  try { $writer.Write($manifest) } finally { $writer.Dispose() }
} finally { $zip.Dispose() }
`);
  const result = spawnSync(powerShell.exe, ['-NoProfile', '-File', script, '-ArchivePath', archivePath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

test('developer ZIP is reproducible and its receipt identifies seven exact runtime files', () => fixture((first, output) => {
  const bytes = fs.readFileSync(first.packageFile);
  const second = prepareBeta(output);
  assert.equal(second.identity, first.identity);
  assert.equal(second.packageSha256, sha256(bytes));
  assert.deepEqual(fs.readFileSync(second.packageFile), bytes);
  assert.equal(first.packageKind, 'unsigned-developer-zip');
  assert.equal(first.installationQualified, false);
  assert.equal(first.nativeValidation, 'NOT_ESTABLISHED_BY_PACKAGING');
  assert.match(first.source.commit, /^[a-f0-9]{40}$/);
  assert.equal(first.identity, sha256(JSON.stringify(first.files)));
  assert.deepEqual(first.files.map(item => item.file), [...files]);
  for (const item of first.files) assert.equal(sha256(fs.readFileSync(path.join(first.stagingDirectory, item.file))), item.sha256);
}));

test('packaging refuses altered staging and an altered existing archive', () => fixture((receipt, output) => {
  const staged = path.join(receipt.stagingDirectory, 'index.html');
  const original = fs.readFileSync(staged);
  fs.appendFileSync(staged, 'changed');
  assert.throws(() => prepareBeta(output), /Changed staging file/);
  fs.writeFileSync(staged, original);
  fs.appendFileSync(receipt.packageFile, 'changed');
  assert.throws(() => prepareBeta(output), /Changed staging file/);
}));

test('LF and CRLF source checkouts produce the same developer archive identity', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'arid-checkouts-'));
  try {
    const candidates = ['lf', 'crlf'].map(style => {
      const checkout = path.join(output, style);
      fs.mkdirSync(path.join(checkout, 'scripts'), { recursive: true });
      const builder = path.join(checkout, 'scripts/prepare-beta.js');
      fs.copyFileSync(path.resolve(__dirname, '../scripts/prepare-beta.js'), builder);
      for (const file of files) {
        const target = path.join(checkout, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const text = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n');
        fs.writeFileSync(target, style === 'crlf' ? text.replace(/\n/g, '\r\n') : text);
      }
      const result = spawnSync(process.execPath, [builder], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    });
    assert.equal(candidates[0].identity, candidates[1].identity);
    assert.equal(candidates[0].packageSha256, candidates[1].packageSha256);
    assert.deepEqual(fs.readFileSync(candidates[0].packageFile), fs.readFileSync(candidates[1].packageFile));
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});

test('independent verifier confirms archive bytes without granting native qualification', { skip: !pwshAvailable && 'No PowerShell (pwsh or powershell) available' }, () => fixture((receipt, output) => {
  const result = verify(receipt, output);
  assert.equal(result.status, 0, result.stderr);
  const verification = JSON.parse(fs.readFileSync(path.join(output, 'verification.json'), 'utf8').replace(/^\uFEFF/, ''));
  assert.equal(verification.runtimeMatchesStaging, true);
  assert.equal(verification.developerArchiveHashMatches, true);
  assert.equal(verification.installationQualified, false);
  assert.equal(verification.nativeValidation, 'NOT_ESTABLISHED_BY_PACKAGING');
  assert.equal(verification.files.length, 7);
  assert.ok(verification.files.every(item => item.exactBytes));
}));

test('verifier rejects receipt allowlist, identity and manifest-identity tampering', { skip: !pwshAvailable && 'No PowerShell (pwsh or powershell) available' }, () => fixture((receipt, output) => {
  for (const alter of [
    candidate => { candidate.files[0].file = '../secret.txt'; },
    candidate => { candidate.files[0].sha256 = '0'.repeat(64); },
    candidate => { candidate.pluginId = 'another.plugin'; }
  ]) {
    const candidate = JSON.parse(JSON.stringify(receipt));
    alter(candidate); fs.writeFileSync(receipt.receiptPath, JSON.stringify(candidate));
    const result = verify(receipt, output);
    assert.notEqual(result.status, 0, 'Tampered receipt must fail');
    assert.match(result.stderr, /Receipt allowlist|Receipt identity|manifest identity/);
  }
}));

test('verifier rejects a modified ZIP hash and unexpected CCX entry path', { skip: !pwshAvailable && 'No PowerShell (pwsh or powershell) available' }, () => fixture((receipt, output) => {
  const original = fs.readFileSync(receipt.packageFile);
  const changed = Buffer.from(original); changed[40] ^= 1;
  fs.writeFileSync(receipt.packageFile, changed);
  assert.match(verify(receipt, output).stderr, /Developer ZIP hash mismatch/);
  const ccx = path.join(output, 'malformed.ccx');
  // Same-length replacement in local and central names preserves ZIP structure.
  fs.writeFileSync(ccx, Buffer.from(original.toString('latin1').replaceAll('manifest.json', '../evil.jsonx'), 'latin1'));
  assert.match(verify(receipt, output, ccx).stderr, /Unexpected package entry/);
}));

test('CCX manifest reformat requires explicit opt-in and authentic staged manifest', { skip: !pwshAvailable && 'No PowerShell (pwsh or powershell) available' }, () => fixture((receipt, output) => {
  const ccx = path.join(output, 'reformatted.ccx');
  fs.copyFileSync(receipt.packageFile, ccx);
  reformatManifest(ccx, output);
  assert.match(verify(receipt, output, ccx).stderr, /Package differs from staging receipt/);
  const accepted = verify(receipt, output, ccx, ['-AllowManifestReformat']);
  assert.equal(accepted.status, 0, accepted.stderr);
  const verification = JSON.parse(fs.readFileSync(path.join(output, 'verification.json'), 'utf8').replace(/^\uFEFF/, ''));
  assert.equal(verification.files[0].exactBytes, false);
  assert.equal(verification.files[0].manifestValuesEqual, true);
  assert.equal(verification.installationQualified, false);
  fs.appendFileSync(path.join(receipt.stagingDirectory, 'manifest.json'), '\n');
  assert.match(verify(receipt, output, ccx, ['-AllowManifestReformat']).stderr, /Staged manifest differs from receipt/);
}));

// Relocation helpers (XP-01): the receipt's stagingDirectory is an absolute path that goes stale when the project folder moves.
const PS_SKIP = { skip: !pwshAvailable && 'No PowerShell (pwsh or powershell) available' };
const readVerification = output => JSON.parse(fs.readFileSync(path.join(output, 'verification.json'), 'utf8').replace(/^\uFEFF/, ''));

// Copies the stage to a path with spaces and Japanese characters, then makes only the original stage unavailable.
function relocateStage(receipt, output, name = '再配置 stage 場所') {
  const relocated = path.join(output, name);
  fs.cpSync(receipt.stagingDirectory, relocated, { recursive: true });
  fs.renameSync(receipt.stagingDirectory, `${receipt.stagingDirectory}-unavailable`);
  return relocated;
}

function reformattedCcx(receipt, output) {
  const ccx = path.join(output, 'reformatted.ccx');
  fs.copyFileSync(receipt.packageFile, ccx);
  reformatManifest(ccx, output);
  return ccx;
}

test('relocated CCX verifies with explicit authenticated stage and unchanged receipt', PS_SKIP, () => fixture((receipt, output) => {
  const ccx = reformattedCcx(receipt, output);
  const relocated = relocateStage(receipt, output);
  assert.ok(!fs.existsSync(receipt.stagingDirectory), 'original stage must be unavailable');
  const receiptBefore = sha256(fs.readFileSync(receipt.receiptPath));
  const result = verify(receipt, output, ccx, ['-AllowManifestReformat', '-StagingDirectory', relocated]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(sha256(fs.readFileSync(receipt.receiptPath)), receiptBefore, 'receipt must stay byte-identical');
  const verification = readVerification(output);
  assert.equal(verification.installationQualified, false);
  assert.equal(verification.nativeValidation, 'NOT_ESTABLISHED_BY_PACKAGING');
  assert.equal(verification.files[0].exactBytes, false);
  assert.equal(verification.files[0].manifestValuesEqual, true);
}));

function alterCcxRuntime(archivePath, output, entryName = 'index.js') {
  const script = path.join(output, 'alter-runtime.ps1');
  fs.writeFileSync(script, `param([string]$ArchivePath, [string]$EntryName)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open($ArchivePath, [IO.Compression.ZipArchiveMode]::Update)
try {
  $entry = $zip.GetEntry($EntryName)
  $reader = [IO.StreamReader]::new($entry.Open())
  try { $text = $reader.ReadToEnd() } finally { $reader.Dispose() }
  $entry.Delete()
  $replacement = $zip.CreateEntry($EntryName)
  $writer = [IO.StreamWriter]::new($replacement.Open(), [Text.UTF8Encoding]::new($false))
  try { $writer.Write($text + '// altered') } finally { $writer.Dispose() }
} finally { $zip.Dispose() }
`);
  const result = spawnSync(powerShell.exe, ['-NoProfile', '-File', script, '-ArchivePath', archivePath, '-EntryName', entryName], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

// Runs one verification and proves it was refused without rewriting the receipt.
function assertRejected(receipt, output, ccx, options, pattern) {
  const before = fs.readFileSync(receipt.receiptPath);
  fs.rmSync(path.join(output, 'verification.json'), { force: true });
  const result = verify(receipt, output, ccx, options);
  assert.notEqual(result.status, 0, 'verification must be refused');
  assert.match(result.stderr, pattern);
  assert.ok(fs.readFileSync(receipt.receiptPath).equals(before), 'receipt must never be rewritten');
  assert.ok(!fs.existsSync(path.join(output, 'verification.json')), 'no verification result may be written for a refusal');
}

test('relocated stage: missing override names -StagingDirectory instead of a raw file error', PS_SKIP, () => fixture((receipt, output) => {
  const ccx = reformattedCcx(receipt, output);
  relocateStage(receipt, output);
  assertRejected(receipt, output, ccx, ['-AllowManifestReformat'], /Staging directory not found[\s\S]*-StagingDirectory/);
  assertRejected(receipt, output, ccx, ['-AllowManifestReformat', '-StagingDirectory', path.join(output, 'nowhere')], /Staging directory not found[\s\S]*-StagingDirectory/);
}));

test('relocated stage: altered staged manifest or non-manifest file is rejected', PS_SKIP, () => fixture((receipt, output) => {
  const ccx = reformattedCcx(receipt, output);
  const relocated = relocateStage(receipt, output);
  fs.appendFileSync(path.join(relocated, 'manifest.json'), '\n');
  assertRejected(receipt, output, ccx, ['-AllowManifestReformat', '-StagingDirectory', relocated], /Staged manifest differs from receipt/);
  fs.writeFileSync(path.join(relocated, 'manifest.json'), fs.readFileSync(path.join(receipt.stagingDirectory + '-unavailable', 'manifest.json')));
  fs.appendFileSync(path.join(relocated, 'index.js'), '// altered');
  assertRejected(receipt, output, ccx, ['-AllowManifestReformat', '-StagingDirectory', relocated], /Staged file differs from receipt: index\.js/);
  fs.rmSync(path.join(relocated, 'index.js'));
  assertRejected(receipt, output, ccx, ['-AllowManifestReformat', '-StagingDirectory', relocated], /Staged file missing: index\.js/);
}));

test('relocated stage: altered CCX runtime file is rejected even with an authentic stage', PS_SKIP, () => fixture((receipt, output) => {
  const ccx = reformattedCcx(receipt, output);
  alterCcxRuntime(ccx, output);
  const relocated = relocateStage(receipt, output);
  assertRejected(receipt, output, ccx, ['-AllowManifestReformat', '-StagingDirectory', relocated], /Package differs from staging receipt: index\.js/);
}));

test('relocated stage: receipt identity tampering is rejected and never rebased', PS_SKIP, () => fixture((receipt, output) => {
  const ccx = reformattedCcx(receipt, output);
  const relocated = relocateStage(receipt, output);
  const tampered = JSON.parse(JSON.stringify(receipt));
  tampered.files[1].sha256 = '0'.repeat(64); // identity covers file hashes, so the receipt no longer matches itself
  fs.writeFileSync(receipt.receiptPath, JSON.stringify(tampered));
  assertRejected(receipt, output, ccx, ['-AllowManifestReformat', '-StagingDirectory', relocated], /Receipt identity mismatch/);
}));

test('relocated stage: the override does not replace the explicit manifest reformat opt-in', PS_SKIP, () => fixture((receipt, output) => {
  const ccx = reformattedCcx(receipt, output);
  const relocated = relocateStage(receipt, output);
  assertRejected(receipt, output, ccx, ['-StagingDirectory', relocated], /Package differs from staging receipt: manifest\.json/);
}));

test('exact-byte verification does not depend on a relocated or missing stage', PS_SKIP, () => fixture((receipt, output) => {
  relocateStage(receipt, output);
  const receiptBefore = sha256(fs.readFileSync(receipt.receiptPath));
  const result = verify(receipt, output, receipt.packageFile, ['-StagingDirectory', path.join(output, 'nowhere')]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(readVerification(output).files.every(item => item.exactBytes));
  assert.equal(sha256(fs.readFileSync(receipt.receiptPath)), receiptBefore);
}));
