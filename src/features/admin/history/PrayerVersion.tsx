import { prayerBoxNames, type PrayerSettings } from "@/lib/community/schema";
import {
  jumuahSessionName,
  prayerIds,
  prayerLabel,
  type JumuahChange,
  type JumuahSession,
} from "@/lib/prayer/adjustments";
import { formatTimeOfDay } from "@/lib/time/time-of-day";
import { longDay } from "../payment-words";

const time = (value: string) => (value ? formatTimeOfDay(value) : "—");
const day = (value: string) => (value ? longDay(value) : "—");
/** One Jumu'ah prayer: "khutbah 12:45 PM, iqamah 1:00 PM". */
const prayer = (row: JumuahSession) =>
  `khutbah ${time(row.khutbah)}, iqamah ${time(row.iqamah)}`;
/** A one-date change's Jumu'ah, after its date and reason ("" as usual). */
function fridayChange(jumuah: JumuahChange) {
  if (jumuah.change === "cancelled") return ": No Jumu’ah this week";
  if (jumuah.change !== "changed") return "";
  return `: ${jumuah.sessions
    .map(
      (row, index) =>
        `${jumuahSessionName(index).toLowerCase()}, ${prayer(row)}`,
    )
    .join("; ")}`;
}

/**
 * A prayer-settings version as History's Restore shows it (review 3 D): each
 * box of the Prayer & iqamah screen with that version's answer, in the
 * screen's own names. "—" is an empty box.
 */
export function PrayerVersion({ settings }: { settings: PrayerSettings }) {
  const rows: [string, string][] = [
    ...prayerIds.map((id): [string, string] => {
      const minutes = settings.iqamah_offsets[id];
      return [
        prayerLabel(id),
        minutes === null
          ? time(settings[id])
          : `${minutes} minutes after adhan`,
      ];
    }),
    // Each weekly Jumu'ah prayer on its own line, in order (review fixes P2).
    ...(settings.jumuah_sessions.length
      ? settings.jumuah_sessions.map((row, index): [string, string] => [
          `Jumu’ah, ${jumuahSessionName(index).toLowerCase()}`,
          prayer(row),
        ])
      : [["Jumu’ah", "—"] as [string, string]]),
    [prayerBoxNames.valid_from, day(settings.valid_from)],
    [prayerBoxNames.valid_until, day(settings.valid_until)],
    [
      prayerBoxNames.exceptions,
      settings.exceptions.length
        ? settings.exceptions
            .map(
              (row) =>
                `${longDay(row.date)} (${row.reason})${fridayChange(row.jumuah)}`,
            )
            .join("; ")
        : "—",
    ],
    [prayerBoxNames.notice, settings.notice || "—"],
  ];
  return (
    <dl className="activity-fields prayer-version">
      {rows.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
