/**
 * Generates a unique ID. Prefers `crypto.randomUUID()` when available
 * (modern browsers and secure contexts), falling back to a Math.random
 * based identifier for older environments.
 *
 * Note: `String.prototype.substr` is deprecated; we use `substring` here.
 */
export function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return (
    Math.random().toString(36).substring(2, 11) +
    Date.now().toString(36)
  );
}
