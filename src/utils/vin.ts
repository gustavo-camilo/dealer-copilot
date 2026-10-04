/**
 * VIN helpers (ISO 3779 / North American check digit).
 */

export const VIN_LENGTH = 17;

/**
 * Uppercases, drops anything that is not a letter or digit, and maps the
 * letters a VIN can never contain to the digits people usually meant
 * (I → 1, O and Q → 0).
 */
export function normalizeVin(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/I/g, '1')
    .replace(/[OQ]/g, '0')
    .slice(0, VIN_LENGTH);
}

const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Validates position 9 (the check digit). Returns null until the VIN is
 * complete. Vehicles built for markets outside North America may not use a
 * check digit, so callers should treat `false` as a warning, not an error.
 */
export function isVinCheckDigitValid(vin: string): boolean | null {
  if (vin.length !== VIN_LENGTH) return null;

  let sum = 0;
  for (let i = 0; i < VIN_LENGTH; i++) {
    const char = vin[i];
    const value = /\d/.test(char) ? Number(char) : TRANSLITERATION[char];
    if (value === undefined) return false;
    sum += value * WEIGHTS[i];
  }

  const remainder = sum % 11;
  const expected = remainder === 10 ? 'X' : String(remainder);
  return vin[8] === expected;
}
