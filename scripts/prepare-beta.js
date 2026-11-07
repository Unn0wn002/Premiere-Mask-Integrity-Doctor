// Runtime-only developer handoff for the Mask Integrity Doctor (derived from the Audio Doctor packaging script). Adobe UDT is still required to produce a CCX.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = Object.freeze(['manifest.json', 'index.html', 'index.js', 'src/core.js', 'src/i18n.js', 'src/premiereAdapter.js', 'src/projectFile.js']);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ZIP STORE needs no external tools. Order, UTF-8 paths and DOS date are fixed;
// source mtimes, OS, checkout path and compression-library versions cannot vary it.
function developerArchive(runtime) {
  const local = [], central = [];
  let offset = 0;
  for (const { file, bytes } of runtime) {
    const name = Buffer.from(file, 'utf8');
    const crc = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6); header.writeUInt16LE(0x21, 12);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, bytes);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x800, 8); record.writeUInt16LE(0x21, 14);
    record.writeUInt32LE(crc, 16); record.writeUInt32LE(bytes.length, 20);
    record.writeUInt32LE(bytes.length, 24); record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42); central.push(record, name);
    offset += header.length + name.length + bytes.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(runtime.length, 8);
  end.writeUInt16LE(runtime.length, 10); end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

function inventory(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink()) throw Error('Symlinks are not permitted in staging');
    const relative = prefix + entry.name;
    if (entry.isDirectory()) {
      if (!files.some(file => file.startsWith(relative + '/'))) throw Error(`Unexpected staging directory: ${relative}`);
      return inventory(path.join(dir, entry.name), relative + '/');
    }
    return [relative];
  });
}

function immutableFile(destination, bytes) {
  if (fs.existsSync(destination)) {
    if (fs.lstatSync(destination).isSymbolicLink()) throw Error(`Symlink destination: ${destination}`);
    if (!fs.readFileSync(destination).equals(bytes)) throw Error(`Changed staging file: ${path.basename(destination)}`);
  } else {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes, { flag: 'wx' });
  }
}

function sourceIdentity() {
  function git(args) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    return result.status === 0 ? result.stdout.trim() : null;
  }
  const changes = git(['status', '--porcelain', '--untracked-files=normal']);
  return { branch: git(['branch', '--show-current']), commit: git(['rev-parse', 'HEAD']), workingTreeDirty: changes === null ? null : changes.length > 0 };
}

function prepareBeta(outputRoot = path.join(root, 'artifacts')) {
  // Capture once and normalize known text assets to Git's LF representation.
  // Windows autocrlf checkout settings must not change the archive identity.
  const runtime = files.map(file => {
    const source = path.join(root, file);
    if (fs.lstatSync(source).isSymbolicLink()) throw Error(`Symlink runtime source: ${file}`);
    const bytes = Buffer.from(fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n'), 'utf8');
    if (bytes.length > 10485760) throw Error(`Oversize runtime file: ${file}`);
    return { file, bytes };
  });
  const manifest = JSON.parse(runtime[0].bytes.toString('utf8').replace(/^\uFEFF/, ''));
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(manifest.version) || typeof manifest.id !== 'string') throw Error('Invalid package manifest identity');
  const hashes = runtime.map(({ file, bytes }) => ({ file, sha256: sha256(bytes) }));
  const identity = sha256(JSON.stringify(hashes));
  const name = `mask-integrity-${manifest.version}-${identity.slice(0, 12)}`;
  const output = path.resolve(outputRoot);
  const destination = path.join(output, name);
  fs.mkdirSync(output, { recursive: true });
  if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) throw Error('Symlink staging directory');
  fs.mkdirSync(destination, { recursive: true });
  for (const file of inventory(destination)) if (!files.includes(file)) throw Error(`Unexpected staging file: ${file}`);
  for (const { file, bytes } of runtime) immutableFile(path.join(destination, file), bytes);
  const archive = developerArchive(runtime);
  const packageFile = path.join(output, `${name}-developer.zip`);
  immutableFile(packageFile, archive);
  const receipt = {
    receiptVersion: 1, version: manifest.version, pluginId: manifest.id,
    identity, files: hashes, source: sourceIdentity(),
    normalization: 'UTF-8 runtime text; CRLF normalized to LF',
    qualification: 'STATIC ONLY; unsigned developer ZIP; host validation and installation qualification pending',
    packageKind: 'unsigned-developer-zip', nativeValidation: 'NOT_ESTABLISHED_BY_PACKAGING',
    installationQualified: false, stagingDirectory: destination,
    packageFile, packageSha256: sha256(archive)
  };
  const receiptPath = path.join(output, `${name}-receipt.json`);
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  return { ...receipt, receiptPath };
}
if (require.main === module) console.log(JSON.stringify(prepareBeta(), null, 2));
module.exports = { prepareBeta, files };
