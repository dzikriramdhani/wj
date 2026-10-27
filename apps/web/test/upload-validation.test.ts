import assert from 'node:assert/strict';
import test from 'node:test';
import { hasExpectedFileSignature } from '../src/lib/upload-validation';

test('accepts supported PDF, JPEG, PNG, WebP, and AVIF signatures', () => {
  assert.equal(hasExpectedFileSignature('application/pdf', new TextEncoder().encode('%PDF-1.7')), true);
  assert.equal(hasExpectedFileSignature('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), true);
  assert.equal(hasExpectedFileSignature('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(hasExpectedFileSignature('image/webp', new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])), true);
  assert.equal(hasExpectedFileSignature('image/avif', new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])), true);
});

test('accepts a PDF header that starts within the first 1024 bytes', () => {
  const prefix = new Uint8Array(1029);
  prefix.set(new TextEncoder().encode('%PDF-1.7'), 1020);
  assert.equal(hasExpectedFileSignature('application/pdf', prefix), true);
});

test('rejects a declared MIME type that does not match the file signature', () => {
  assert.equal(hasExpectedFileSignature('image/png', new TextEncoder().encode('%PDF-1.7')), false);
  assert.equal(hasExpectedFileSignature('application/pdf', new TextEncoder().encode('<html>')), false);
});

test('rejects unsupported MIME types and truncated signatures', () => {
  assert.equal(hasExpectedFileSignature('image/gif', new Uint8Array([0x47, 0x49, 0x46])), false);
  assert.equal(hasExpectedFileSignature('image/png', new Uint8Array([0x89, 0x50, 0x4e])), false);
});
