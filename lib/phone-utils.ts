/**
 * Centralized utility for Kuwaiti phone number formatting and validation.
 */

/**
 * Normalizes a Kuwaiti phone number from various formats into a canonical +965XXXXXXXX format.
 * - Removes spaces, dashes, brackets, and any non-digit characters (except leading +).
 * - Accepts: 8 digits (local), 11 digits starting with 965, +965, or 00965.
 * - Rejects: Invalid lengths, foreign numbers, or missing input.
 * 
 * @param input The raw phone number string
 * @returns The normalized phone string (e.g. '+96555963037') or null if invalid.
 */
export function normalizeKuwaitiPhone(input: string | null | undefined): string | null {
  if (!input) return null;

  // Remove all non-digit characters
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;

  let localNumber = '';

  if (digits.length === 8) {
    // e.g. 55963037
    localNumber = digits;
  } else if (digits.length === 11 && digits.startsWith('965')) {
    // e.g. 96555963037 or +96555963037
    localNumber = digits.substring(3);
  } else if (digits.length === 13 && digits.startsWith('00965')) {
    // e.g. 0096555963037
    localNumber = digits.substring(5);
  } else {
    // Invalid length or prefix
    return null;
  }

  // Kuwaiti local numbers must be exactly 8 digits
  if (localNumber.length !== 8) {
    return null;
  }

  return `+965${localNumber}`;
}

/**
 * Converts a canonical phone number (+965XXXXXXXX) to the format required by kwtSMS (965XXXXXXXX).
 */
export function toKwtSmsPhone(canonicalPhone: string): string {
  if (canonicalPhone.startsWith('+')) {
    return canonicalPhone.substring(1);
  }
  return canonicalPhone;
}

/**
 * Masks a phone number for safe logging (e.g. +965****3037).
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return 'N/A';
  
  // Try to normalize first to get a standard length
  const normalized = normalizeKuwaitiPhone(phone);
  if (normalized) {
    // +965 5596 3037 -> +965****3037
    return `+965****${normalized.slice(-4)}`;
  }

  // If not valid Kuwaiti format, mask all but last 4 characters
  if (phone.length > 4) {
    return `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`;
  }
  return '****';
}
