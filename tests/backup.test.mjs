import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const codec = require('../backup-codec.js');

const manifest = {
  format: 'private-workbench-full-backup', version: 1,
  records: { version: 2, data: { books: [{ id: 'book_1', title: '测试书' }] } },
  assets: { photos: [], files: [{ id: 'file_1', blobKey: 'files/file_1/original' }] }
};
const first = new Blob([new Uint8Array([0, 1, 2, 3, 254, 255])], { type: 'application/octet-stream' });
const second = new Blob(['一段录音内容'], { type: 'audio/mpeg' });

const packed = await codec.pack(manifest, [
  { key: 'files/file_1/original', blob: first },
  { key: 'files/file_2/original', blob: second }
]);
const unpacked = await codec.unpack(packed);
assert.equal(unpacked.manifest.format, manifest.format);
assert.equal(unpacked.entries.size, 2);
assert.deepEqual(
  Array.from(new Uint8Array(await unpacked.entries.get('files/file_1/original').blob.arrayBuffer())),
  [0, 1, 2, 3, 254, 255]
);
assert.equal(await unpacked.entries.get('files/file_2/original').blob.text(), '一段录音内容');

const corrupted = new Uint8Array(await packed.arrayBuffer());
corrupted[corrupted.length - 1] ^= 0xff;
await assert.rejects(() => codec.unpack(new Blob([corrupted])), /附件校验失败/);
const manifestCorrupted = new Uint8Array(await packed.arrayBuffer());
manifestCorrupted[20] ^= 0x01;
await assert.rejects(() => codec.unpack(new Blob([manifestCorrupted])), /清单校验失败/);
await assert.rejects(() => codec.unpack(new Blob(['not-a-backup'])), /完整备份损坏/);

console.log('PASS  full backup container round-trip and corruption detection');
