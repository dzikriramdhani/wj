import { commonPasswords } from './passwords/common-passwords';

export const RESET_PASSWORD_MIN_LENGTH = 12;
export const RESET_PASSWORD_MAX_LENGTH = 128;

export function isCommonPassword(password: string) {
  return commonPasswords.has(password.toLowerCase());
}

export function validateResetPassword(password: string, confirmation: string) {
  if (password.length < RESET_PASSWORD_MIN_LENGTH) {
    return 'Password minimal 12 karakter.';
  }
  if (password.length > RESET_PASSWORD_MAX_LENGTH) {
    return 'Password maksimal 128 karakter.';
  }
  if (password !== confirmation) {
    return 'Konfirmasi password tidak sama.';
  }
  if (isCommonPassword(password)) {
    return 'Password terlalu umum. Gunakan password lain.';
  }
  return null;
}
