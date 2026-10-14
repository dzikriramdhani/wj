import assert from 'node:assert/strict';
import test from 'node:test';
import { validateResetPassword } from '../src/lib/reset-password';

test('requires a 12 to 128 character reset password', () => {
  assert.equal(validateResetPassword('short', 'short'), 'Password minimal 12 karakter.');
  assert.equal(validateResetPassword('a'.repeat(129), 'a'.repeat(129)), 'Password maksimal 128 karakter.');
});

test('rejects a mismatched or common reset password', () => {
  assert.equal(validateResetPassword('unbelievable', 'unbelievable'), 'Password terlalu umum. Gunakan password lain.');
  assert.equal(validateResetPassword('TepatPanjang123', 'BerbedaPanjang1'), 'Konfirmasi password tidak sama.');
});

test('accepts a non-common confirmed reset password', () => {
  assert.equal(validateResetPassword('KainWinaJaya!2026', 'KainWinaJaya!2026'), null);
});
