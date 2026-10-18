/**
 * Spreadsheet files (CSV) the board downloads: the Payments CSV (PR6) and
 * the term export's spreadsheets (review fixes P5). One cell rule for both.
 * Pure and browser-safe.
 */

/** A spreadsheet cell: formula starters are made text, and quotes added when needed. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * A whole CSV file: the header row, then one row per entry, each line ended
 * with CRLF. `bom` starts the file with the UTF-8 mark, so Excel reads names
 * with accents or Arabic correctly when the file is opened by double-click.
 */
export function csvFile(
  header: readonly string[],
  rows: readonly (readonly string[])[],
  { bom = false }: { bom?: boolean } = {},
): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `${bom ? "﻿" : ""}${lines.join("\r\n")}\r\n`;
}
