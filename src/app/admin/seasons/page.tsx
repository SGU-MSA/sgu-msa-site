import Link from "next/link";
import {
  adminSeasonContext,
  listAdminPaymentItems,
} from "@/lib/backend/admin-payments";
import { hijriMonthName } from "@/lib/time/hijri";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { ArchivedRow } from "@/features/admin/ArchiveActions";
import { ViewTabs } from "@/features/admin/ViewTabs";
import { listView } from "@/features/admin/fields";
import { SeasonDays } from "@/features/admin/GivingParts";
import { seasonRule } from "@/features/admin/payment-words";
import { restoreSeasonAction } from "@/features/admin/season-actions";
import { boardPage } from "@/features/admin/page-state/board-page";
import { seasonPath } from "@/features/season/load";

const notices: Record<string, string> = {
  archived: "Season archived. Find it under Archived.",
  restored: "Season restored.",
};

/**
 * Seasons (PR6 WP-5, D-12, D-15; mockup `seasons-list`, Gregorian dates
 * only, D-78): every season with its rule, this year's days marked expected,
 * confirmed or typed, and how many funds and tickets follow it. Any board
 * member edits seasons.
 */
async function SeasonsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const view = listView(query.view);
  const archived = view === "archived";
  const [context, items] = await Promise.all([
    adminSeasonContext(),
    listAdminPaymentItems(),
  ]);
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    hijriMonthName(i + 1),
  );
  const notice = Object.keys(notices).find((key) => query[key]);
  const usedBy = (id: string) => {
    const using = items.items.filter((item) => item.season_id === id);
    const funds = using.filter((item) => item.kind === "fund").length;
    const tickets = using.length - funds;
    const parts = [
      funds ? `${funds} ${funds === 1 ? "fund" : "funds"}` : "",
      tickets ? `${tickets} ${tickets === 1 ? "ticket" : "tickets"}` : "",
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  };
  return (
    <div className="admin-shell">
      <AdminHeader title="Seasons" />
      {notice ? (
        <p role="status" className="success-message">
          {notices[notice]}
        </p>
      ) : null}
      <ViewTabs href="/admin/seasons" view={view} label="Seasons" />
      {archived ? (
        <p className="muted">
          Archived seasons are not used by any fund. Restore one to use it
          again.
        </p>
      ) : (
        <>
          <p className="muted">
            Days are worked out from the Islamic calendar and marked{" "}
            <em>expected</em>. When the moon sighting is announced, open the
            season and confirm the day. Funds tied to a season follow it.
          </p>
          <div className="admin-actions">
            <Link className="button-primary" href="/admin/seasons/new">
              Add a season
            </Link>
          </div>
        </>
      )}
      {context.unavailable || items.unavailable ? (
        <p role="alert" className="content-card">
          Seasons could not be loaded. Check your connection and reload.
        </p>
      ) : archived ? (
        context.archived.length ? (
          <ul className="admin-list">
            {context.archived.map((season) => (
              <ArchivedRow
                key={season.id}
                name={season.name}
                view={`/admin/seasons/${season.id}`}
                fields={{ id: season.id, version: season.updated_at }}
                restore={{ action: restoreSeasonAction }}
              >
                <p className="muted">{seasonRule(season, monthNames)}</p>
              </ArchivedRow>
            ))}
          </ul>
        ) : (
          <p className="content-card">No archived seasons.</p>
        )
      ) : context.seasons.length ? (
        <table className="login-table giving-table">
          <thead>
            <tr>
              <th scope="col">Season</th>
              <th scope="col">Rule</th>
              <th scope="col">This year</th>
              <th scope="col">Used by</th>
              <th scope="col">Public page</th>
            </tr>
          </thead>
          <tbody>
            {context.seasons.map((season) => (
              <tr key={season.id}>
                <th scope="row">
                  <Link
                    className="text-link"
                    href={`/admin/seasons/${season.id}`}
                  >
                    {season.name}
                    <span className="sr-only"> (edit)</span>
                  </Link>
                </th>
                <td data-label="Rule:">{seasonRule(season, monthNames)}</td>
                <td data-label="This year:">
                  <SeasonDays dates={context.dates.get(season.id)} />
                </td>
                <td data-label="Used by:">{usedBy(season.id)}</td>
                <td data-label="Public page:">
                  {season.has_page ? (
                    <a
                      className="text-link"
                      href={seasonPath(season.slug)}
                      target="_blank"
                      rel="noopener"
                    >
                      {seasonPath(season.slug)} ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="content-card">No seasons yet.</p>
      )}
      {!archived && context.adjustment === null ? (
        <p role="status" className="muted">
          The prayer settings could not be loaded, so the Islamic-calendar days
          can&apos;t be worked out right now. Reload to try again.
        </p>
      ) : null}
      {!archived ? (
        <p className="muted">
          Ramadan, Eid al-Fitr and Eid al-Adha come with the site. The two Eids
          are separate from Ramadan: confirming one never moves another. Earlier
          confirmed days stay in Recent changes.
        </p>
      ) : null}
    </div>
  );
}

export default boardPage(SeasonsPage);
