/** Title-cases make/model names from the decoder ("TOYOTA" → "Toyota"), keeping BMW upper-case. */
export function formatVehicleName(name?: string) {
  if (!name) return '';
  // Special case for BMW
  if (name.toUpperCase() === 'BMW') return 'BMW';
  // Capitalize first letter of each word
  return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
