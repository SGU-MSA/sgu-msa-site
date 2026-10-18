/**
 * The space uploaded photos and PDFs take in Supabase Storage (photo library
 * and daily check, 2026-10-06). One rule for the Photos screen, the
 * dashboard's "Needs attention" box and the nightly email. Pure and
 * browser-safe; the number of bytes is read by the caller
 * (`ContentProvider.getStorageUse`, `community_storage_bytes()`).
 */

/**
 * Supabase's free plan: 1 GB of Storage. Counted as 1,000,000,000 bytes, the
 * smaller reading of "1 GB", so the warnings come early rather than late.
 */
export const STORAGE_LIMIT_BYTES = 1_000_000_000;
/** `STORAGE_LIMIT_BYTES` as the board reads it. */
export const STORAGE_LIMIT_LABEL = "1 GB";
/** The dashboard warns, and the nightly check emails, from these levels (percent full). */
export const STORAGE_WARN_PERCENTS = [80, 95] as const;
export type StorageLevel = (typeof STORAGE_WARN_PERCENTS)[number];

/** Whole percent of the free space used (0–100 and above). */
export function storagePercent(bytes: number): number {
  return Math.floor((Math.max(0, bytes) * 100) / STORAGE_LIMIT_BYTES);
}

/** The highest warning level reached, or null below 80%. */
export function storageLevel(bytes: number): StorageLevel | null {
  const percent = storagePercent(bytes);
  return (
    [...STORAGE_WARN_PERCENTS].reverse().find((level) => percent >= level) ??
    null
  );
}

/** "820 KB", "1.2 MB", "0.5 GB": a size as the board reads it (1 MB = 1,000,000 bytes). */
export function sizeLabel(bytes: number): string {
  const value = Math.max(0, bytes);
  if (value === 0) return "0 KB";
  if (value < 1_000_000) return `${Math.max(1, Math.round(value / 1000))} KB`;
  if (value < 1_000_000_000) {
    const mb = value / 1_000_000;
    return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  }
  return `${(value / 1_000_000_000).toFixed(2)} GB`;
}
