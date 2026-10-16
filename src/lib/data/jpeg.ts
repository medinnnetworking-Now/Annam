// Minimal JPEG checks: confirm the file is a JPEG and remove metadata segments (EXIF, GPS, XMP, comments).
export function isJpeg(b: Uint8Array) { return b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; }

/** Returns the JPEG without APP1 to APP15 and COM segments. Image data is untouched. */
export function stripJpegMetadata(b: Uint8Array): Uint8Array {
  if (!isJpeg(b)) throw new Error('Not a JPEG');
  const out: number[] = [0xff, 0xd8]; let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new Error('Malformed JPEG');
    const marker = b[i + 1]!;
    if (marker === 0xda) { for (let j = i; j < b.length; j++) out.push(b[j]!); return Uint8Array.from(out); } // start of scan: copy the rest
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    if (len < 2 || i + 2 + len > b.length) throw new Error('Malformed JPEG');
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!drop) for (let j = i; j < i + 2 + len; j++) out.push(b[j]!);
    i += 2 + len;
  }
  throw new Error('Malformed JPEG');
}
