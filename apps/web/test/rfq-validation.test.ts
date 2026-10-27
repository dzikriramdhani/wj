import assert from 'node:assert/strict';
import test from 'node:test';
import { createRFQSchema } from '../src/lib/validators';

const validRFQ = {
  organizationId: 'c579ddf8-0d54-4c99-a609-5c9cd3927caf',
  qtyRequested: 120,
  deadline: '2026-11-30T16:59:59.000Z',
  specDetails: {
    nama: 'Pengguna Uji',
    email: 'uji@example.invalid',
    telepon: '081234567890',
    perusahaan: 'Perusahaan Uji',
  },
  attachments: [],
};

test('RFQ requires an organization and accepts an ISO target date', () => {
  const withoutOrganization = {
    qtyRequested: validRFQ.qtyRequested,
    deadline: validRFQ.deadline,
    specDetails: validRFQ.specDetails,
    attachments: validRFQ.attachments,
  };
  assert.equal(createRFQSchema.safeParse(withoutOrganization).success, false);
  assert.equal(createRFQSchema.safeParse(validRFQ).success, true);
});
