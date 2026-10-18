/**
 * Which directions buttons a device sees (PR7 D-1, D-7, E-6): Apple devices
 * (iPhone, iPad, iPod and Mac) show Apple Maps and Google Maps; every other
 * device shows Google Maps only. iPadOS reports itself as a Mac, which also
 * counts as Apple, so the user agent alone decides. Runs in the browser only:
 * pages never read the user agent on the server.
 */
export function isAppleDevice(userAgent: string): boolean {
  return /\b(iPhone|iPad|iPod|Macintosh)\b/.test(userAgent);
}
