import { restorePrayerVersionAction } from "@/features/admin/actions";
import type { ActivityEntry } from "@/lib/community/activity";
import { restoredPrayerSettings } from "@/lib/community/schema";
import { systemText } from "@/lib/system-text";
import { VersionHistory } from "./history/VersionHistory";
import { PrayerVersion } from "./history/PrayerVersion";

/** How many changes the history lists (PR3 contract, Design → Prayer history). */
export const prayerHistoryLength = 20;

/**
 * Prayer history (ADR 0013; review 3 D): the last prayer-settings changes,
 * each with Restore, which first shows the settings that version brings
 * back (checked as the restore will check them) and asks.
 */
export function PrayerHistory({
  entries,
  unavailable,
  version,
}: {
  /** Read with `limit: prayerHistoryLength + 1` (`historyList`). */
  entries: readonly ActivityEntry[];
  unavailable: boolean;
  /** The current settings' version: a restore over newer settings is refused. */
  version: string;
}) {
  return (
    <VersionHistory
      id="prayer-history"
      item={systemText.history.prayerItem}
      length={prayerHistoryLength}
      entries={entries}
      unavailable={unavailable}
      empty="No changes yet."
      action={restorePrayerVersionAction}
      fields={(earlier) => ({ entry: String(earlier.entryId), version })}
      preview={(entry) => {
        const parsed = restoredPrayerSettings(entry.before ?? {});
        return parsed.success
          ? { show: <PrayerVersion settings={parsed.data} /> }
          : {
              refused: systemText.pages.restoreRefused(
                parsed.error.issues[0].message,
              ),
            };
      }}
    />
  );
}
