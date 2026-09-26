/** Reads pixel dimensions from a PNG/JPEG data URL (enough to lay out letterhead images). */
export function dataUrlImageSize(dataUrl: string): { width: number; height: number } | null {
  const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
  if (!m) return null;
  const b = Buffer.from(m[2], "base64");
  if (m[1] === "png") return b.length > 24 ? { width: b.readUInt32BE(16), height: b.readUInt32BE(20) } : null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
