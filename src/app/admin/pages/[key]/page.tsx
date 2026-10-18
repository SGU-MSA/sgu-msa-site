import { notFound } from "next/navigation";
import { listActivity, readAdminPageText } from "@/lib/backend/admin-content";
import { requirePageEditor } from "@/lib/backend/server";
import { activityTime, actorLabel } from "@/lib/community/activity";
import { getForms } from "@/lib/content";
import { getLists } from "@/lib/community/queries";
import { listNames } from "@/lib/community/lists";
import { pageFields, withEveryField } from "@/lib/content/page-fields";
import {
  hiddenSections,
  previewPages,
  sharedTexts,
} from "@/lib/content/page-layouts";
import type { PageTextKey } from "@/lib/content/documents";
import { systemText } from "@/lib/system-text";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { FormsHowTo } from "@/features/admin/pages/FormsHowTo";
import {
  PageHistory,
  pageHistoryLength,
} from "@/features/admin/pages/PageHistory";
import { PageTextEditor } from "@/features/admin/pages/PageTextEditor";
import { layoutOwners } from "@/features/admin/pages/page-editor";
import { previewSlots } from "@/features/admin/pages/preview-slots";
import {
  editedOn,
  pageScreenPath,
  pagesOnScreen,
} from "@/features/admin/pages/pages-list";
import type { OtherPagePreview } from "@/features/admin/pages/previews";
import Link from "next/link";
import { previewLive } from "@/features/admin/pages/preview-live";
import { boardPage } from "@/features/admin/page-state/board-page";
import { AppearsOn } from "@/features/admin/AppearsOn";

/** The hidden sections of `key` on the pages that show it (`hiddenSections`). */
async function hiddenElsewhere(key: PageTextKey) {
  return [...hiddenSections(key, {}, await layoutOwners(key))];
}
/**
 * The other pages Preview can switch to (shared text, option A,
 * 2026-10-06): each with its stored words, live data, server-drawn parts and
 * hidden sections; a page that cannot be read is left out.
 */
async function otherPreviews(key: PageTextKey): Promise<OtherPagePreview[]> {
  const read = await Promise.all(
    previewPages(key)
      .filter((page) => page !== key)
      .map(async (page) => {
        const [text, live, hidden] = await Promise.all([
          readAdminPageText(page),
          previewLive(page),
          hiddenElsewhere(page),
        ]);
        return text
          ? {
              key: page,
              document: withEveryField(page, text.document),
              live,
              slots: previewSlots(page),
              hidden,
            }
          : null;
      }),
  );
  return read.filter((entry) => entry !== null);
}

/**
 * One page's text (PR5b WP3): the editor with Preview, then its
 * History. A page with sections lists them (review 3 B); `?section=` opens
 * one. The page texts whose sections it shows come along (dashboard polish:
 * Jumu'ah and Musallah directions on Prayer & Musallah), edited in place;
 * Preview can show each other page with words edited here. The words shown
 * only inside other pages (Jumu'ah, Musallah directions, Newsletter
 * archive) have no editor of their own: their screen says where they are
 * edited and keeps their History (shared text, option A, 2026-10-06).
 */
async function PageTextScreen({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageEditor();
  const { key: requested } = await params;
  const key = pagesOnScreen.find((name) => name === requested);
  if (!key) notFound();
  const query = await searchParams;
  const pages = editedOn(key);
  const [data, history, forms, live, owners, shared, others, { lists }] =
    await Promise.all([
      readAdminPageText(key),
      listActivity({
        area: "page_texts",
        recordId: key,
        // One more dates the version before the oldest listed change.
        limit: pageHistoryLength + 1,
      }),
      getForms(),
      previewLive(key),
      layoutOwners(key),
      Promise.all(
        sharedTexts(key).map(async (text) => {
          const read = await readAdminPageText(text);
          return read
            ? {
                key: text,
                document: withEveryField(text, read.document),
                version: read.version,
              }
            : null;
        }),
      ),
      pages ? [] : otherPreviews(key),
      getLists(),
    ]);
  // The Lists' options a list box offers (review fixes P3).
  const listChoices = Object.fromEntries(
    listNames.map((name) => [
      name,
      lists[name].map((option) => [option.slug, option.name] as const),
    ]),
  );
  const section = typeof query.section === "string" ? query.section : null;
  const page = pageFields[key];
  const elsewhere = [...hiddenSections(key, {}, owners)];
  const last = history.entries[0];
  return (
    <div className="admin-shell narrow">
      <AdminHeader
        title={page.title}
        parents={[{ label: "Pages", href: "/admin/pages" }]}
      />
      <AppearsOn area={`page:${key}`} />
      {query.restored ? (
        <p role="status" className="success-message">
          {systemText.pages.restored}
        </p>
      ) : null}
      {!data || shared.some((text) => !text) ? (
        <p role="alert" className="form-error">
          {systemText.pages.notLoaded}
        </p>
      ) : (
        <>
          {pages ? (
            last ? (
              <p className="muted">
                {`Last saved by ${actorLabel(last)} on ${activityTime(last.occurred_at)}.`}
              </p>
            ) : null
          ) : (
            <p className="muted">
              {last
                ? `Last saved by ${actorLabel(last)} on ${activityTime(last.occurred_at)}. `
                : ""}
              Boxes marked “(optional)” can stay empty: that part of the page is
              then hidden.
            </p>
          )}
          {key === "forms" ? <FormsHowTo /> : null}
          {pages ? (
            <p className="content-card">
              {systemText.pageSections.editedOn}{" "}
              {pages.map((page, at) => (
                <span key={page}>
                  {at ? ", " : null}
                  <Link
                    className="text-link"
                    href={`${pageScreenPath(page)}?section=${encodeURIComponent(
                      pageFields[key].sections[0].id,
                    )}`}
                  >
                    {pageFields[page].title}
                  </Link>
                </span>
              ))}
            </p>
          ) : (
            <PageTextEditor
              key={data.version}
              pageKey={key}
              document={withEveryField(key, data.document)}
              version={data.version}
              formKeys={Object.entries(forms.forms).map(
                ([form, entry]) => [form, entry.label] as const,
              )}
              listChoices={listChoices}
              live={live}
              slots={previewSlots(key)}
              hiddenElsewhere={elsewhere}
              openSection={section}
              shared={shared.flatMap((text) => (text ? [text] : []))}
              otherPreviews={others}
            />
          )}
          <PageHistory
            pageKey={key}
            entries={history.entries}
            unavailable={history.unavailable}
            version={data.version}
            document={data.document}
            live={live}
            hiddenElsewhere={elsewhere}
          />
        </>
      )}
    </div>
  );
}

export default boardPage(PageTextScreen);
