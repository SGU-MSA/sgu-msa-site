import {
  listActivity,
  readAdminMusallahPin,
  readAdminPrayer,
} from "@/lib/backend/admin-content";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { AppearsOn } from "@/features/admin/AppearsOn";
import { PinEditor } from "@/features/admin/PinEditor";
import { PrayerEditor } from "@/features/admin/PrayerEditor";
import { jumuahNoticeWords } from "@/features/admin/fields";
import {
  PrayerHistory,
  prayerHistoryLength,
} from "@/features/admin/PrayerHistory";
import { pinStarts } from "@/lib/community/managed";
import { directionsLinks } from "@/lib/maps/location";
import { localDate } from "@/lib/community/schema";
import { prayerCalculation } from "@/lib/prayer/calculate";
import { prayerFormText } from "@/lib/prayer/congregation";
import { clock } from "@/lib/runtime/providers";
import { boardPage } from "@/features/admin/page-state/board-page";

/**
 * What the screen needs beside the saved settings, worked out on the server
 * from the shared clock: today in Grenada and today's calculated adhan per
 * prayer, for the live preview beside each prayer (review fixes P2).
 */
async function today() {
  const now = clock().now();
  const { starts } = await pinStarts(now);
  return {
    date: localDate(now),
    adhan: Object.fromEntries(
      starts.filter((row) => row.day === 0).map((row) => [row.id, row.iso]),
    ),
  };
}
async function PrayerAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const [data, history, pin] = await Promise.all([
    readAdminPrayer(),
    // One more dates the version before the oldest listed change.
    listActivity({ area: "prayer_settings", limit: prayerHistoryLength + 1 }),
    readAdminMusallahPin(),
  ]);
  const query = await searchParams;
  return (
    <div className="admin-shell narrow">
      <AdminHeader title="Prayer & iqamah" tour="prayer" />
      <AppearsOn area="prayer" />
      {query.notice === "failed" ? (
        <p role="alert" className="form-error">
          {jumuahNoticeWords.failed}
        </p>
      ) : null}
      {query.restored ? (
        <p role="status" className="success-message">
          Earlier prayer settings restored. Check the times on the Prayer page.
        </p>
      ) : null}
      {!data ? (
        <p role="alert">
          Settings could not be loaded. Check database setup and reload.
        </p>
      ) : (
        <>
          <PrayerEditor
            key={data.version}
            values={prayerFormText(data.settings)}
            version={data.version}
            method={prayerCalculation.label}
            today={await today()}
          />
          <PrayerHistory
            entries={history.entries}
            unavailable={history.unavailable}
            version={data.version}
          />
        </>
      )}
      {pin ? (
        <PinEditor
          key={pin.version}
          pin={pin.pin}
          version={pin.version}
          links={directionsLinks(pin.pin)}
          appearsOn={<AppearsOn area="musallah" />}
        />
      ) : (
        <section
          id="musallah-location"
          className="content-card"
          aria-labelledby="musallah-location-heading"
        >
          <h2 id="musallah-location-heading">Musallah location</h2>
          <p role="alert">
            The musallah location could not be loaded. Check your connection and
            reload.
          </p>
        </section>
      )}
    </div>
  );
}

export default boardPage(PrayerAdmin);
