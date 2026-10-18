import "server-only";
import type { AttentionReads } from "../community/attention";
import { contentProvider, paymentsProvider } from "../runtime/providers";

/**
 * What the "Needs attention" list is worked out from (daily-check contract,
 * stage 2): the prayer settings, the current seasons, the funds and tickets
 * visitors can see, and the space the uploads take. Public reads only, so
 * the dashboard and the nightly check (which has no session) read the same
 * rows and list the same problems. Each part is null when it cannot be read.
 */
export async function readAttention(): Promise<AttentionReads> {
  const payments = paymentsProvider();
  const [prayer, items, seasons, storage] = await Promise.all([
    contentProvider().getPrayerSettings(),
    payments.items(),
    payments.seasons(),
    contentProvider().getStorageUse(),
  ]);
  return {
    prayer: prayer.unavailable ? null : prayer.settings,
    giving:
      items.unavailable || seasons.unavailable
        ? null
        : { seasons: seasons.seasons, items: items.items, links: items.links },
    storageBytes: storage.bytes,
  };
}
