export const MAX_REQUIREMENT_BYTES = 10 * 1024 * 1024;

/** Basic container/signature validation, not a malware scanner or full decoder. */
export function inspectRequirementBytes(bytes: Uint8Array): string | null {
  if (!bytes.length || bytes.length > MAX_REQUIREMENT_BYTES) return null;
  const ascii = (start: number, end: number) => new TextDecoder('ascii').decode(bytes.subarray(start, end));
  if (ascii(0, 5) === '%PDF-' && /^%PDF-\d\.\d/.test(ascii(0, 8))
    && /%%EOF\s*$/.test(ascii(Math.max(0, bytes.length - 1024), bytes.length))) return 'application/pdf';
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return 'image/jpeg';
  if (bytes.length >= 45 && bytes.subarray(0, 8).every((v, i) => v === [137,80,78,71,13,10,26,10][i])) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8, header = false, data = false;
    while (offset + 12 <= bytes.length) {
      const size = view.getUint32(offset), kind = ascii(offset + 4, offset + 8);
      if (size > bytes.length - offset - 12) return null;
      if (!header) {
        if (kind !== 'IHDR' || size !== 13 || !view.getUint32(offset + 8) || !view.getUint32(offset + 12)) return null;
        header = true;
      }
      if (kind === 'IDAT' && size > 0) data = true;
      offset += size + 12;
      if (kind === 'IEND') return size === 0 && offset === bytes.length && data ? 'image/png' : null;
    }
  }
  return null;
}
