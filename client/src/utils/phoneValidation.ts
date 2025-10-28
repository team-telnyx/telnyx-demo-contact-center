/**
 * Phone validation utilities for Softphone components
 */

export interface CountryCode {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
}

// Popular country codes with flags
export const COUNTRY_CODES: CountryCode[] = [
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧' },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺' },
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷' },
  { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹' },
  { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸' },
  { name: 'Mexico', code: 'MX', dialCode: '+52', flag: '🇲🇽' },
  { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷' },
  { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵' },
  { name: 'China', code: 'CN', dialCode: '+86', flag: '🇨🇳' },
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳' },
  { name: 'Russia', code: 'RU', dialCode: '+7', flag: '🇷🇺' },
  { name: 'South Korea', code: 'KR', dialCode: '+82', flag: '🇰🇷' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱' },
  { name: 'Belgium', code: 'BE', dialCode: '+32', flag: '🇧🇪' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭' },
  { name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪' },
  { name: 'Norway', code: 'NO', dialCode: '+47', flag: '🇳🇴' },
];

/**
 * Check if a string is a valid E.164 phone number
 */
export function isValidE164(number: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(String(number || '').trim());
}

/**
 * Check if a string is a valid SIP URI
 */
export function isValidSipUri(input: string): boolean {
  return /^sip:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(String(input || '').trim());
}

/**
 * Check if a value is valid for dialing (E.164 or SIP URI)
 */
export function isValidDialTo(value: string): boolean {
  const v = String(value || '').trim();
  if (!v) return false;
  return isValidE164(v) || isValidSipUri(v);
}

/**
 * Format a phone number for display (adds dashes for readability)
 */
export function formatPhoneNumber(number: string): string {
  const cleaned = String(number || '').replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // US/Canada format: +1 (XXX) XXX-XXXX
    return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
  } else if (cleaned.length === 10) {
    // 10 digit format: (XXX) XXX-XXXX
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  }
  return number;
}

/**
 * Clean a phone number (remove all non-digit characters except +)
 */
export function cleanPhoneNumber(number: string): string {
  return String(number || '').replace(/[^\d+]/g, '');
}

/**
 * Get the country code from a phone number
 */
export function getCountryCodeFromNumber(number: string): CountryCode | null {
  const cleaned = cleanPhoneNumber(number);

  // Try to match the dial code
  for (const country of COUNTRY_CODES) {
    if (cleaned.startsWith(country.dialCode)) {
      return country;
    }
  }

  // Default to US if starts with 1
  if (cleaned.startsWith('+1') || cleaned.startsWith('1')) {
    return COUNTRY_CODES[0]; // US
  }

  return null;
}

/**
 * Validate phone number and return error message if invalid
 */
export function validatePhoneNumber(number: string): string | null {
  const trimmed = String(number || '').trim();

  if (!trimmed) {
    return 'Phone number is required';
  }

  if (isValidSipUri(trimmed)) {
    return null; // SIP URI is valid
  }

  const cleaned = cleanPhoneNumber(trimmed);

  if (cleaned.length < 7) {
    return 'Phone number is too short';
  }

  if (cleaned.length > 15) {
    return 'Phone number is too long';
  }

  if (!isValidE164(cleaned)) {
    return 'Invalid phone number format. Use E.164 format (e.g., +12125551234) or SIP URI';
  }

  return null; // Valid
}

/**
 * Build a full phone number from country code and number
 */
export function buildPhoneNumber(countryCode: string, number: string): string {
  const cleaned = cleanPhoneNumber(number);

  // If number already has country code, return as is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Remove leading country code if it matches
  const withoutCode = cleaned.replace(new RegExp(`^${countryCode.replace('+', '')}`), '');

  return `${countryCode}${withoutCode}`;
}
