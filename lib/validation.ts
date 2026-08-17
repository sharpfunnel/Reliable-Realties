const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS_RE = /^\+?[0-9\s\-()]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!PHONE_CHARS_RE.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  // 10-digit local number, optionally preceded by a 1-3 digit country code.
  return digits.length >= 10 && digits.length <= 13;
}

const NAME_RE = /^[A-Za-z\s'.-]{2,}$/;

export function isValidName(value: string): boolean {
  return NAME_RE.test(value.trim());
}

export function sanitizePhoneInput(value: string): string {
  const cleaned = value.replace(/[^0-9\s\-+()]/g, "");
  let digitCount = 0;
  let result = "";
  for (const char of cleaned) {
    if (/[0-9]/.test(char)) {
      digitCount += 1;
      // Allow up to a 3-digit country code ahead of the 10-digit number.
      if (digitCount > 13) continue;
    }
    result += char;
  }
  return result;
}

export function sanitizeNameInput(value: string): string {
  return value.replace(/[^A-Za-z\s'.-]/g, "");
}
