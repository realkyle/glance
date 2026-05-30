const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcVal]);
}

function buildEyePNG(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA

  const raw = Buffer.alloc(size * (1 + size * 4));
  const cx = size / 2 - 0.5, cy = size / 2 - 0.5;
  const outerR = size / 2 - 1;
  const irisR  = size * 0.28;
  const pupilR = size * 0.13;
  const glintR = size * 0.07;
  const glintX = cx + size * 0.1, glintY = cy - size * 0.1;

  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const px = row + 1 + x * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const glintDist = Math.sqrt((x - glintX) ** 2 + (y - glintY) ** 2);
      let r = 0, g = 0, b = 0, a = 0;
      if (dist < outerR)     { r = 0x8b; g = 0x5c; b = 0xf6; a = 200; }
      if (dist < irisR)      { r = 0x6d; g = 0x28; b = 0xd9; a = 255; }
      if (dist < pupilR)     { r = 0x0a; g = 0x05; b = 0x1a; a = 255; }
      if (glintDist < glintR){ r = 255;  g = 255;  b = 255;  a = 220; }
      raw[px] = r; raw[px + 1] = g; raw[px + 2] = b; raw[px + 3] = a;
    }
  }
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

function buildICO(sizes) {
  const pngs = sizes.map(s => buildEyePNG(s));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(sizes.length, 4);

  let dataOffset = 6 + sizes.length * 16;
  const entries = pngs.map((png, i) => {
    const s = sizes[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(s >= 256 ? 0 : s, 0);
    entry.writeUInt8(s >= 256 ? 0 : s, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dataOffset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...pngs]);
}

fs.mkdirSync(path.join(__dirname, '../assets'), { recursive: true });
const ico = buildICO([16, 32, 48, 256]);
fs.writeFileSync(path.join(__dirname, '../assets/icon.ico'), ico);
console.log('Generated assets/icon.ico');
