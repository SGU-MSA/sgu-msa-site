"use client";
import type { PrayerSettings } from "@/lib/community/schema";
import { seasonPageState } from "@/lib/community/season-page";
import type { FormsContent } from "@/lib/content/schemas";
import { formDestination } from "@/lib/integrations/form-destination";
import { fixBeforeSaving } from "@/lib/system-text";
import quiet from "@/shared/ui/page.module.css";
import { SeasonBody } from "@/features/season/SeasonBody";
import type { SeasonPageData } from "@/features/season/load";
import { seasonFromForm } from "./payment-forms";
import { photoRows } from "./SeasonPageFields";

/** What the season's page shows besides what is typed: read on the server. */
export type SeasonPreviewLive = Pick<
  SeasonPageData,
  "tonight" | "events" | "funds" | "verse"
>;

/**
 * The season screen's Preview (PR5c, D-23): the season's page as the
 * typed values would show it today, drawn by the page's own body. New
 * photos not saved yet show as placeholders.
 */
export function SeasonPreview({
  values,
  today,
  adjustment,
  forms,
  live,
}: {
  values: Record<string, string>;
  today: string;
  adjustment: PrayerSettings["hijri_adjustment"] | null;
  forms: FormsContent;
  live: SeasonPreviewLive;
}) {
  const parsed = seasonFromForm(values);
  if (!parsed.ok) {
    const problems = [...new Set(Object.values(parsed.fields))];
    return (
      <div role="note">
        <p>{fixBeforeSaving(problems.length)}</p>
        <ul>
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>
    );
  }
  const season = { ...parsed.row, photos: photoRows(values.photos) };
  return (
    <>
      {season.has_page ? null : (
        <p className="muted">
          This season has no page on the website. Tick “Give this season its own
          page” to show it.
        </p>
      )}
      <div className={quiet.page}>
        <SeasonBody
          data={{
            ...live,
            season,
            state: seasonPageState(season, today, adjustment),
            signUp: season.sign_up_form
              ? formDestination(forms, season.sign_up_form)
              : null,
          }}
        />
      </div>
    </>
  );
}
