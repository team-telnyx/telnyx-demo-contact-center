// Country calling codes and their expected national number lengths
const COUNTRY_CODES = [
  { code: '+1', country: 'US/CA', label: 'US +1', lengths: [10] },
  { code: '+44', country: 'GB', label: 'UK +44', lengths: [10, 11] },
  { code: '+61', country: 'AU', label: 'AU +61', lengths: [9] },
  { code: '+49', country: 'DE', label: 'DE +49', lengths: [10, 11] },
  { code: '+33', country: 'FR', label: 'FR +33', lengths: [9] },
  { code: '+81', country: 'JP', label: 'JP +81', lengths: [10, 11] },
  { code: '+52', country: 'MX', label: 'MX +52', lengths: [10] },
  { code: '+55', country: 'BR', label: 'BR +55', lengths: [10, 11] },
  { code: '+91', country: 'IN', label: 'IN +91', lengths: [10] },
  { code: '+86', country: 'CN', label: 'CN +86', lengths: [11] },
];

/**
 * Validate an E.164 phone number.
 * Returns { valid, error, formatted }
 */
export function validatePhoneNumber(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Phone number is required', formatted: '' };
  }

  // Strip spaces, dashes, parens
  const cleaned = input.replace(/[\s\-\(\)\.]/g, '');

  // Must start with +
  if (!cleaned.startsWith('+')) {
    return { valid: false, error: 'Must start with + country code (e.g. +1)', formatted: cleaned };
  }

  // E.164: + followed by 1-15 digits
  if (!/^\+[1-9]\d{1,14}$/.test(cleaned)) {
    return { valid: false, error: 'Invalid format. Use E.164 (e.g. +12125551234)', formatted: cleaned };
  }

  // Check against known country code patterns for better feedback
  const matchedCountry = COUNTRY_CODES.find((c) => cleaned.startsWith(c.code));
  if (matchedCountry) {
    const nationalNumber = cleaned.slice(matchedCountry.code.length);
    const validLength = matchedCountry.lengths.some((len) => nationalNumber.length === len);
    if (!validLength) {
      return {
        valid: false,
        error: `${matchedCountry.country} numbers should be ${matchedCountry.lengths.join(' or ')} digits after ${matchedCountry.code}`,
        formatted: cleaned,
      };
    }
  }

  return { valid: true, error: null, formatted: cleaned };
}

/**
 * Format a raw digit string with a country code prefix into E.164.
 * If input already has +, just clean it.
 */
export function toE164(input, countryCode = '+1') {
  if (!input) return '';
  const cleaned = input.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  return countryCode + cleaned;
}

/**
 * Format E.164 number for display: +1 (212) 555-1234
 */
export function formatPhoneDisplay(e164) {
  if (!e164) return '';
  // US/CA formatting
  if (e164.startsWith('+1') && e164.length === 12) {
    const area = e164.slice(2, 5);
    const prefix = e164.slice(5, 8);
    const line = e164.slice(8);
    return `+1 (${area}) ${prefix}-${line}`;
  }
  return e164;
}

export { COUNTRY_CODES };
