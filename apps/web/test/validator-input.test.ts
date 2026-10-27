import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductSchema, createRFQSchema, loginSchema, registerSchema } from '../src/lib/validators';

const validProduct = {
  name: 'Kain Katun',
  slug: 'kain-katun',
  sku: 'KK-001',
  category: 'Katun',
  composition: '100% cotton',
  gsm: 180,
  widthCm: 150,
  pricePerMeter: 0,
  stockMeters: 0,
  moqRetail: 1,
  description: 'Kain sintetis untuk pengujian lokal.',
};

const validRFQ = {
  organizationId: 'c579ddf8-0d54-4c99-a609-5c9cd3927caf',
  qtyRequested: 120,
  specDetails: {
    nama: 'Pengguna Uji',
    email: 'uji@example.invalid',
    telepon: '081234567890',
    perusahaan: 'Perusahaan Uji',
  },
  attachments: [],
};

test('registration validation accepts valid input and does not grant a client-supplied role', () => {
  const result = registerSchema.safeParse({
    name: 'Pengguna Uji',
    email: 'uji@example.invalid',
    phone: '081234567890',
    password: 'synthetic-test-password',
    role: 'super_admin',
  });
  assert.equal(result.success, true);
  if (result.success) assert.equal('role' in result.data, false);
});

test('registration and login validation reject malformed or missing credentials', () => {
  assert.equal(registerSchema.safeParse({ name: 'A', email: 'bukan-email', password: '123' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'bukan-email', password: '' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'uji@example.invalid', password: 'synthetic-password' }).success, true);
});

test('product schema rejects negative prices, stock, and invalid dimensions', () => {
  assert.equal(createProductSchema.safeParse({ ...validProduct, pricePerMeter: -1 }).success, false);
  assert.equal(createProductSchema.safeParse({ ...validProduct, stockMeters: -1 }).success, false);
  assert.equal(createProductSchema.safeParse({ ...validProduct, gsm: 0 }).success, false);
  assert.equal(createProductSchema.safeParse({ ...validProduct, widthCm: 1.5 }).success, false);
  assert.equal(createProductSchema.safeParse(validProduct).success, true);
});

test('RFQ schema rejects invalid quantity, organization ID, deadline, and contact fields', () => {
  assert.equal(createRFQSchema.safeParse({ ...validRFQ, qtyRequested: 0 }).success, false);
  assert.equal(createRFQSchema.safeParse({ ...validRFQ, organizationId: 'not-a-uuid' }).success, false);
  assert.equal(createRFQSchema.safeParse({ ...validRFQ, deadline: 'not-a-date' }).success, false);
  assert.equal(createRFQSchema.safeParse({ ...validRFQ, specDetails: { ...validRFQ.specDetails, email: 'invalid' } }).success, false);
  assert.equal(createRFQSchema.safeParse(validRFQ).success, true);
});
