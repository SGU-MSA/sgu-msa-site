import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "@/lib/validation/zod";
import {
  adminSeasonContext,
  listAdminPaymentItems,
} from "@/lib/backend/admin-payments";
import { hijriMonthName } from "@/lib/time/hijri";
import { AdminHeader } from "@/features/admin/AdminHeader";
import {
  SeasonEditor,
  type EditableSeason,
} from "@/features/admin/SeasonEditor";
import { seasonPreview } from "@/features/admin/payment-forms";
import { kindWords, longDay, seasonRule } from "@/features/admin/payment-words";
import { ArchivedEntry } from "@/features/admin/ArchivedEntry";
import { restoreSeasonAction } from "@/features/admin/season-actions";
import { boardPage } from "@/features/admin/page-state/board-page";
import { loadSeasonPage, seasonPath } from "@/features/season/load";
import { AppearsOn } from "@/features/admin/AppearsOn";
import { getForms } from "@/lib/content";
import { requestNow } from "@/lib/runtime/public-cache";

const parents = [{ label: "Seasons", href: "/admin/seasons" }];

/** How a fund or ticket uses the season: "follows Ramadan" or its own days. */
function howItUses(
  item: { shows_from: string; shows_until: string },
  season: string,
) {
  const own = [
    item.shows_from ? `own start ${longDay(item.shows_from)}` : "",
    item.shows_until ? `own end ${longDay(item.shows_until)}` : "",
  ].filter(Boolean);
  return own.length ? own.join(", ") : `follows ${season}`;
}

/**
 * Add or edit one season (PR6 WP-5; mockup `season-editor`, Gregorian dates
 * only, D-78), with the funds and tickets that use its days.
 */
async function SeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const [context, items, forms] = await Promise.all([
    adminSeasonContext(),
    listAdminPaymentItems(),
    getForms(),
  ]);
  if (context.unavailable || items.unavailable)
    return (
      <div className="admin-shell narrow">
        <AdminHeader title="Season" parents={parents} />
        <p role="alert" className="content-card">
          This page could not be loaded. Check your connection and reload.
        </p>
      </div>
    );
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    hijriMonthName(i + 1),
  );
  const season = isNew
    ? null
    : (context.seasons.find((row) => row.id === id) ?? null);
  const gone = isNew
    ? null
    : (context.archived.find((row) => row.id === id) ?? null);
  if (!isNew && !season && !gone) notFound();

  if (gone)
    return (
      <div className="admin-shell narrow">
        <AdminHeader
          title={`Archived · ${gone.name}`}
          parents={parents}
          current={gone.name}
        />
        <ArchivedEntry
          heading={gone.name}
          more={<p>{seasonRule(gone, monthNames)}</p>}
          intro="This season is archived and cannot be edited. Restore it to use it again."
          target={{ id: gone.id, version: gone.updated_at }}
          restore={{ action: restoreSeasonAction }}
        />
      </div>
    );

  const editable: EditableSeason = {
    id: season?.id ?? crypto.randomUUID(),
    name: season?.name ?? "",
    calendar: season && season.hijri_month === null ? "typed" : "islamic",
    hijri_month: season?.hijri_month ? String(season.hijri_month) : "",
    hijri_first_day: season?.hijri_first_day
      ? String(season.hijri_first_day)
      : "",
    hijri_last_day: season?.hijri_last_day ? String(season.hijri_last_day) : "",
    board_starts_on: season?.board_starts_on ?? "",
    board_ends_on: season?.board_ends_on ?? "",
    has_page: season?.has_page ? "on" : "",
    intro: season?.intro ?? "",
    schedule: JSON.stringify(season?.schedule ?? []),
    sign_up_form: season?.sign_up_form ?? "",
    photos: JSON.stringify(season?.photos ?? []),
    version: season?.updated_at ?? null,
  };
  // What the page shows besides the typed values (events, funds, tonight).
  const live = season
    ? await loadSeasonPage(season, await requestNow())
    : { tonight: null, events: [], funds: [], verse: null };
  const typed: Record<string, string> = { ...editable, version: "" };
  const using = season
    ? items.items.filter((item) => item.season_id === season.id)
    : [];
  return (
    <div className="admin-shell">
      <AdminHeader
        title={season ? season.name : "Add a season"}
        parents={parents}
        current={season?.name ?? "Add a season"}
      />
      <AppearsOn
        area="seasons"
        extra={
          season?.has_page
            ? [{ label: season.name, href: seasonPath(season.slug) }]
            : []
        }
      />
      {/* Full width, so Preview shows the page as wide as it is (PR5c). */}
      <div className="season-layout">
        <div>
          <SeasonEditor
            season={editable}
            monthNames={monthNames}
            today={context.today}
            adjustment={context.adjustment}
            initialPreview={seasonPreview(
              typed,
              context.today,
              context.adjustment,
            )}
            pagePath={season ? seasonPath(season.slug) : null}
            formChoices={Object.entries(forms.forms).map(
              ([key, entry]) => [key, entry.label] as const,
            )}
            forms={forms}
            live={{
              tonight: live.tonight,
              events: live.events,
              funds: live.funds,
              verse: live.verse,
            }}
          />
          <p className="muted">
            Any board member can edit seasons. Saving moves everything in “Uses
            these dates” at once.
          </p>
        </div>
        <aside
          className="content-card giving-aside"
          aria-labelledby="season-uses"
        >
          <h2 id="season-uses">Uses these dates</h2>
          {using.length ? (
            <ul className="giving-uses">
              {using.map((item) => (
                <li key={item.id}>
                  <Link
                    className="text-link"
                    href={`/admin/payments/${item.kind === "fund" ? "funds" : "tickets"}/${item.id}`}
                  >
                    {item.name}
                  </Link>
                  <span className="muted">
                    {" "}
                    · {kindWords[item.kind].one} ·{" "}
                    {howItUses(item, season?.name ?? "")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No fund or ticket uses this season yet.</p>
          )}
          <p className="muted">
            A fund&apos;s own start or end day replaces only that side of the
            season.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default boardPage(SeasonPage);
