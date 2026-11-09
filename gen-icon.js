// 生成 PWA 图标（纯 Node，无外部依赖）：深色圆角底 + 白色「工」字
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // raw scanlines，每行前置 filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 绘制 ----------
function drawIcon(size) {
  const bg = [17, 17, 19, 255];      // #111113
  const fg = [255, 255, 255, 255];   // 白
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => { const i = (y * size + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3]; };
  const r = size * 0.22;
  const inRound = (x, y) => {
    const dx = Math.max(r - x, x - (size - 1 - r), 0);
    const dy = Math.max(r - y, y - (size - 1 - r), 0);
    return dx * dx + dy * dy <= r * r;
  };
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, fg); };
  // 背景 + 「工」字形（上横、中竖、下横）
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (inRound(x, y)) set(x, y, bg);
  const s = size;
  rect(Math.round(0.30 * s), Math.round(0.28 * s), Math.round(0.70 * s), Math.round(0.37 * s)); // 上横
  rect(Math.round(0.46 * s), Math.round(0.28 * s), Math.round(0.54 * s), Math.round(0.72 * s)); // 中竖
  rect(Math.round(0.27 * s), Math.round(0.63 * s), Math.round(0.73 * s), Math.round(0.72 * s)); // 下横
  return px;
}

const outDir = process.argv[2] || '.';
for (const size of [180, 192, 512]) {
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  const png = encodePNG(size, drawIcon(size));
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(`${name}  ${size}x${size}  ${png.length} bytes`);
}
