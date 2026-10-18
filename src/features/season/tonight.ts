import type { TonightState } from "@/lib/community/season-page";

export type TonightRow = { label: string; value: string };

/**
 * Tonight's rows on a Ramadan-month season page (D-26): Iftar is Maghrib's
 * start and Tarawih is Isha's iqamah, both from Prayer & iqamah, so nothing
 * is typed twice. A time that is not known (no start at the musallah pin,
 * no Isha iqamah today) is left out rather than invented.
 */
export function tonightRows(
  state: TonightState,
  times: { maghribStart: string | null; ishaIqamah: string | null },
): TonightRow[] {
  return (
    [
      ["Iftar", state.iftar ? times.maghribStart : null],
      ["Tarawih", state.tarawih ? times.ishaIqamah : null],
    ] as const
  ).flatMap(([label, value]) => (value ? [{ label, value }] : []));
}
