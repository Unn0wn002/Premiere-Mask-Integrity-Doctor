"use strict";
// Reads object-mask facts from a SAVED Premiere project file (.prproj = gzip-compressed XML). Pure JS, no host
// access, so it is unit-tested in Node. Read-only: the caller passes the bytes; nothing is ever written.
//
// Why: the public UXP API only says whether a project or sequence has an object mask
// (ObjectMaskUtils.hasObjectMask), and the clip component chain does not list masks (seen natively 2026-11-01).
// The saved file does: VideoClipTrackItem -> SelectionComponents -> VideoComponentChain -> "AE.ADBE AEMask2"
// component -> one sub-component per mask -> its "Tracker" parameter, whose keyframe data names the mask data
// files (<guid>.prmf in "<project> Masks"). The format is UNDOCUMENTED; it was mapped on Premiere 26.5.2.5 only,
// so every miss is reported as UNKNOWN by the caller, never as "no mask".

// ---- gzip / DEFLATE (RFC 1951/1952) ------------------------------------------------------------------------
const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

// Canonical Huffman table: counts per bit length and symbols sorted by code.
function buildHuffman(lengths) {
  const counts = new Uint16Array(16);
  for (const l of lengths) counts[l] += 1;
  counts[0] = 0;
  const offs = new Uint16Array(16);
  for (let i = 1; i < 16; i += 1) offs[i] = offs[i - 1] + counts[i - 1];
  const symbols = new Uint16Array(lengths.length);
  for (let s = 0; s < lengths.length; s += 1) if (lengths[s]) symbols[offs[lengths[s]]++] = s;
  return { counts, symbols };
}

function inflateRaw(src) {
  let pos = 0, bit = 0, bitCount = 0;
  let out = new Uint8Array(Math.max(1024, src.length * 4));
  let outLen = 0;
  const need = (n) => {
    if (outLen + n <= out.length) return;
    let size = out.length * 2;
    while (size < outLen + n) size *= 2;
    const bigger = new Uint8Array(size);
    bigger.set(out.subarray(0, outLen));
    out = bigger;
  };
  const bits = (n) => {
    while (bitCount < n) {
      if (pos >= src.length) throw new Error("inflate: unexpected end of data");
      bit |= src[pos++] << bitCount;
      bitCount += 8;
    }
    const v = bit & ((1 << n) - 1);
    bit >>>= n;
    bitCount -= n;
    return v;
  };
  const decode = (h) => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len += 1) {
      code |= bits(1);
      const count = h.counts[len];
      if (code - count < first) return h.symbols[index + (code - first)];
      index += count;
      first += count;
      first <<= 1;
      code <<= 1;
    }
    throw new Error("inflate: bad Huffman code");
  };
  let fixedLit = null, fixedDist = null;
  let final = 0;
  while (!final) {
    final = bits(1);
    const type = bits(2);
    if (type === 0) {
      bit = 0; bitCount = 0;
      if (pos + 4 > src.length) throw new Error("inflate: truncated stored block");
      const len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      if (pos + len > src.length) throw new Error("inflate: truncated stored block");
      need(len);
      out.set(src.subarray(pos, pos + len), outLen);
      outLen += len;
      pos += len;
      continue;
    }
    let lit, dist;
    if (type === 1) {
      if (!fixedLit) {
        const l = new Uint8Array(288);
        l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
        fixedLit = buildHuffman(l);
        fixedDist = buildHuffman(new Uint8Array(30).fill(5));
      }
      lit = fixedLit; dist = fixedDist;
    } else if (type === 2) {
      const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < hclen; i += 1) cl[CL_ORDER[i]] = bits(3);
      const clh = buildHuffman(cl);
      const lens = new Uint8Array(hlit + hdist);
      for (let i = 0; i < hlit + hdist;) {
        const sym = decode(clh);
        if (sym < 16) lens[i++] = sym;
        else {
          let rep, val = 0;
          if (sym === 16) { if (i === 0) throw new Error("inflate: bad repeat"); val = lens[i - 1]; rep = 3 + bits(2); }
          else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          while (rep-- > 0) lens[i++] = val;
        }
      }
      lit = buildHuffman(lens.subarray(0, hlit));
      dist = buildHuffman(lens.subarray(hlit));
    } else throw new Error("inflate: bad block type");
    for (;;) {
      const sym = decode(lit);
      if (sym < 256) { need(1); out[outLen++] = sym; continue; }
      if (sym === 256) break;
      const li = sym - 257;
      if (li >= 29) throw new Error("inflate: bad length symbol");
      const len = LEN_BASE[li] + bits(LEN_EXTRA[li]);
      const di = decode(dist);
      if (di >= 30) throw new Error("inflate: bad distance symbol");
      const d = DIST_BASE[di] + bits(DIST_EXTRA[di]);
      if (d > outLen) throw new Error("inflate: distance too far back");
      need(len);
      for (let k = 0; k < len; k += 1) { out[outLen] = out[outLen - d]; outLen += 1; }
    }
  }
  return out.subarray(0, outLen);
}

function gunzip(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 18 || b[0] !== 0x1f || b[1] !== 0x8b || b[2] !== 8) throw new Error("not a gzip file");
  const flags = b[3];
  let p = 10;
  if (flags & 4) p += 2 + (b[p] | (b[p + 1] << 8));
  if (flags & 8) { while (b[p] !== 0) p += 1; p += 1; }
  if (flags & 16) { while (b[p] !== 0) p += 1; p += 1; }
  if (flags & 2) p += 2;
  return inflateRaw(b.subarray(p));
}

// UTF-8 bytes to string (the parts we read are ASCII; other characters only need to survive in names).
function utf8(bytes) {
  if (typeof TextDecoder === "function") return new TextDecoder("utf-8").decode(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64Latin1(text) {
  const clean = String(text).replace(/[^A-Za-z0-9+/]/g, "");
  let out = "", acc = 0, n = 0;
  for (let i = 0; i < clean.length; i += 1) {
    acc = (acc << 6) | B64.indexOf(clean[i]);
    n += 6;
    if (n >= 8) { n -= 8; out += String.fromCharCode((acc >> n) & 0xff); }
  }
  return out;
}

const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const unXml = (s) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");

// Top-level objects of the project XML: { id: { tag, body } } (Premiere writes each one tab-indented).
function indexObjects(xml) {
  const objs = {};
  const re = /\n\t<(\w+) Object(?:U?)ID="([^"]+)"[^>]*>([\s\S]*?)\n\t<\/\1>/g;
  let m;
  while ((m = re.exec(xml))) objs[m[2]] = { tag: m[1], body: m[3] };
  return objs;
}

// Masks of one VideoClipTrackItem: [{ instance, guids: [...] }] (guids from its Tracker parameters).
function masksOfItem(objs, itemBody) {
  const sel = /<SelectionComponents ObjectRef="(\d+)"\/>/.exec(itemBody);
  if (!sel || !objs[sel[1]]) return [];
  const masks = [];
  const compRefs = [...objs[sel[1]].body.matchAll(/<Component Index="\d+" ObjectRef="(\d+)"\/>/g)].map((x) => x[1]);
  for (const ref of compRefs) {
    const comp = objs[ref];
    if (!comp || !/<MatchName>[^<]*AEMask[^<]*<\/MatchName>/.test(comp.body)) continue;
    for (const sub of comp.body.matchAll(/<SubComponent Index="\d+" ObjectRef="(\d+)"\/>/g)) {
      const mask = objs[sub[1]];
      if (!mask) continue;
      const inst = /<InstanceName>([^<]*)<\/InstanceName>/.exec(mask.body);
      const guids = new Set();
      for (const p of mask.body.matchAll(/<Param Index="\d+" ObjectRef="(\d+)"\/>/g)) {
        const param = objs[p[1]];
        if (!param || !/<Name>Tracker<\/Name>/.test(param.body)) continue;
        for (const blob of param.body.matchAll(/Encoding="base64"[^>]*>([^<]+)</g)) {
          for (const g of base64Latin1(blob[1]).match(GUID_RE) || []) guids.add(g);
        }
      }
      masks.push({ instance: inst ? unXml(inst[1]) : null, guids: [...guids] });
    }
  }
  return masks;
}

// A nested sequence clip: SubClip -> Clip -> Source (VideoSequenceSource) -> <Sequence ObjectURef="guid"/>.
function nestedSequenceOf(objs, subClipId) {
  const clipRef = /<Clip ObjectRef="(\d+)"\/>/.exec(objs[subClipId].body);
  const clip = clipRef ? objs[clipRef[1]] : null;
  const srcRef = clip ? /<Source ObjectRef="(\d+)"\/>/.exec(clip.body) : null;
  const src = srcRef ? objs[srcRef[1]] : null;
  if (!src || src.tag !== "VideoSequenceSource") return null;
  const seq = /<Sequence ObjectURef="([^"]+)"\/>/.exec(src.body);
  return seq ? seq[1] : null;
}

// Returns { sequences: [{ guid, name, items: [{ track, startTicks, endTicks, name, masks, nestedSequence }] }] }.
function parseProjectMasks(xml) {
  const objs = indexObjects(xml);
  const sequences = [];
  for (const [id, o] of Object.entries(objs)) {
    if (o.tag !== "Sequence") continue;
    const name = /<Name>([^<]*)<\/Name>/.exec(o.body);
    const seq = { guid: id, name: name ? unXml(name[1]) : null, items: [] };
    for (const g of o.body.matchAll(/<Second ObjectRef="(\d+)"\/>/g)) {
      const group = objs[g[1]];
      if (!group || group.tag !== "VideoTrackGroup") continue;
      for (const tr of group.body.matchAll(/<Track Index="(\d+)" ObjectURef="([^"]+)"\/>/g)) {
        const track = objs[tr[2]];
        if (!track) continue;
        for (const ti of track.body.matchAll(/<TrackItem Index="\d+" ObjectRef="(\d+)"\/>/g)) {
          const item = objs[ti[1]];
          if (!item || item.tag !== "VideoClipTrackItem") continue;
          const start = /<Start>(-?\d+)<\/Start>/.exec(item.body);
          const end = /<End>(-?\d+)<\/End>/.exec(item.body);
          const sub = /<SubClip ObjectRef="(\d+)"\/>/.exec(item.body);
          const subName = sub && objs[sub[1]] ? /<Name>([^<]*)<\/Name>/.exec(objs[sub[1]].body) : null;
          seq.items.push({
            track: Number(tr[1]), startTicks: start ? start[1] : "0", endTicks: end ? end[1] : null,
            name: subName ? unXml(subName[1]) : null, masks: masksOfItem(objs, item.body),
            nestedSequence: sub ? nestedSequenceOf(objs, sub[1]) : null
          });
        }
      }
    }
    sequences.push(seq);
  }
  return { objects: Object.keys(objs).length, sequences };
}

// One call for the adapter: bytes of the .prproj -> parsed masks, or { error } (never throws).
function readProjectMasks(bytes) {
  try {
    const raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const xmlBytes = raw[0] === 0x1f && raw[1] === 0x8b ? gunzip(raw) : raw;
    const parsed = parseProjectMasks(utf8(xmlBytes));
    if (!parsed.objects) return { error: "no project objects found (unknown file format)" };
    return parsed;
  } catch (e) {
    return { error: e && e.message ? e.message : String(e) };
  }
}

module.exports = { inflateRaw, gunzip, base64Latin1, indexObjects, parseProjectMasks, readProjectMasks };
