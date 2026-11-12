/* Private Workbench full-backup container.
 * Layout: 8-byte magic + uint32 manifest length + uint32 manifest CRC + UTF-8 manifest + raw payloads.
 * Payload offsets are relative to the first byte after the manifest.
 */
(function (global) {
'use strict';

const MAGIC = 'PWBK0001';
const MAX_MANIFEST = 16 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let crcTable = null;

function table() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

function crc32(bytes) {
  const t = table(); let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = t[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function fail(message) { throw new Error('完整备份损坏：' + message); }

async function pack(manifest, entries) {
  if (!manifest || typeof manifest !== 'object') throw new Error('备份清单无效');
  const keys = new Set(); const payload = []; const blobs = []; let offset = 0;
  for (const entry of (entries || [])) {
    const key = String(entry && entry.key || '');
    const blob = entry && entry.blob;
    if (!key || keys.has(key)) throw new Error('备份附件标识重复或为空');
    if (!(blob instanceof Blob)) throw new Error('备份附件不是有效文件：' + key);
    keys.add(key);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    payload.push({ key, offset, length: blob.size, crc32: crc32(bytes), type: blob.type || 'application/octet-stream' });
    blobs.push(blob); offset += blob.size;
  }
  const packedManifest = Object.assign({}, manifest, { payload });
  const manifestBytes = encoder.encode(JSON.stringify(packedManifest));
  if (manifestBytes.length > MAX_MANIFEST) throw new Error('备份清单过大');
  const header = new Uint8Array(16);
  header.set(encoder.encode(MAGIC), 0);
  new DataView(header.buffer).setUint32(8, manifestBytes.length, true);
  new DataView(header.buffer).setUint32(12, crc32(manifestBytes), true);
  return new Blob([header, manifestBytes].concat(blobs), { type: 'application/x-private-workbench-backup' });
}

async function unpack(file) {
  if (!(file instanceof Blob) || file.size < 16) fail('文件太小');
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (decoder.decode(header.slice(0, 8)) !== MAGIC) fail('文件类型不正确');
  const manifestLength = new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(8, true);
  const expectedManifestCrc = new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(12, true);
  if (!manifestLength || manifestLength > MAX_MANIFEST || 16 + manifestLength > file.size) fail('清单长度异常');
  const manifestBytes = new Uint8Array(await file.slice(16, 16 + manifestLength).arrayBuffer());
  if (crc32(manifestBytes) !== expectedManifestCrc) fail('清单校验失败');
  let manifest;
  try { manifest = JSON.parse(decoder.decode(manifestBytes)); }
  catch (_) { fail('清单无法解析'); }
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.payload)) fail('清单格式错误');

  const payloadStart = 16 + manifestLength;
  const seen = new Set(); const ranges = []; const entries = new Map();
  for (const meta of manifest.payload) {
    const key = String(meta && meta.key || '');
    const offset = Number(meta && meta.offset), length = Number(meta && meta.length), expected = Number(meta && meta.crc32);
    if (!key || seen.has(key)) fail('附件标识重复或为空');
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0) fail('附件范围异常：' + key);
    if (payloadStart + offset + length > file.size) fail('附件超出文件范围：' + key);
    if (!Number.isInteger(expected) || expected < 0 || expected > 0xFFFFFFFF) fail('附件校验值异常：' + key);
    seen.add(key); ranges.push({ start: offset, end: offset + length, key });
    const blob = file.slice(payloadStart + offset, payloadStart + offset + length, meta.type || 'application/octet-stream');
    const actual = crc32(new Uint8Array(await blob.arrayBuffer()));
    if (actual !== expected) fail('附件校验失败：' + key);
    entries.set(key, { meta, blob });
  }
  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) if (ranges[i].start < ranges[i - 1].end) fail('附件范围重叠');
  return { manifest, entries };
}

const api = { MAGIC, crc32, pack, unpack };
global.PWBackupCodec = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
