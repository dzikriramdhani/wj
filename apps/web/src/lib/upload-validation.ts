const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const jpegSignature = [0xff, 0xd8, 0xff];
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const riffSignature = [0x52, 0x49, 0x46, 0x46]; // RIFF
const webpSignature = [0x57, 0x45, 0x42, 0x50]; // WEBP
const isoBmffSignature = [0x66, 0x74, 0x79, 0x70]; // ftyp

function startsWithBytes(value: Uint8Array, signature: number[], offset = 0) {
  return signature.every((byte, index) => value[offset + index] === byte);
}

function startsWithAscii(value: Uint8Array, signature: string, offset: number) {
  return [...signature].every((character, index) => value[offset + index] === character.charCodeAt(0));
}

export function hasExpectedFileSignature(mimeType: string, prefix: Uint8Array) {
  if (mimeType === 'image/jpeg') return startsWithBytes(prefix, jpegSignature);
  if (mimeType === 'image/png') return startsWithBytes(prefix, pngSignature);
  if (mimeType === 'image/webp') return startsWithBytes(prefix, riffSignature)
    && startsWithBytes(prefix, webpSignature, 8);
  if (mimeType === 'image/avif') return startsWithBytes(prefix, isoBmffSignature, 4)
    && (startsWithAscii(prefix, 'avif', 8) || startsWithAscii(prefix, 'avis', 8));

  if (mimeType === 'application/pdf') {
    const lastPossibleOffset = Math.min(prefix.length - pdfSignature.length, 1024);
    for (let offset = 0; offset <= lastPossibleOffset; offset += 1) {
      if (startsWithBytes(prefix, pdfSignature, offset)) return true;
    }
  }

  return false;
}
