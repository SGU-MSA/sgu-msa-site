"use server";
import { redirect } from "next/navigation";
import { redirectSaved } from "../save-state/saved-flash";
import { publicDataChanged } from "../public-refresh";
import { z } from "@/lib/validation/zod";
import { pageTextKeys, type PageTextKey } from "@/lib/content/documents";
import { versionBefore } from "@/lib/community/activity";
import {
  pageSectionTitle,
  pageTextSaveSchema,
  photosIn,
  restoredPageText,
  sectionProblems,
  withEveryField,
  withPhotoSource,
} from "@/lib/content/page-fields";
import {
  hiddenSections,
  isLayoutKey,
  pageLayouts,
  sharedTexts,
  storedSections,
  type PageLayout,
} from "@/lib/content/page-layouts";
import type { PageTextChange } from "@/lib/backend/providers/contract";
import { MAX_NEW_PHOTOS_PER_SAVE } from "@/lib/media/photo-limits";
import { activityLog, contentEditor } from "@/lib/runtime/providers";
import {
  chooseFileAgain,
  outOfDate,
  staleScreen,
  systemText,
  unavailableMessage,
} from "@/lib/system-text";
import type { EditorState } from "../actions";
import { refuse } from "../fields";
import { removeUnusedFiles } from "../file-cleanup";
import { keepTyped, typedValues, type KeptFormState } from "../form-state";
import { layoutOwners, pageEditorRefusal } from "./page-editor";
import {
  chosenPhotos,
  documentField,
  hiddenOnPage,
  pageTextForm,
  pageTextsForm,
  versionField,
  type PageTexts,
} from "./page-form";
import { pageScreenPath } from "./pages-list";

const pageKey = z.enum(pageTextKeys);
const words = systemText.pages;

/** This document's sections another page hides, by id (review 3 B). */
async function hiddenElsewhere(key: PageTextKey): Promise<string[]> {
  return [...hiddenSections(key, {}, await layoutOwners(key))];
}

/**
 * A section of another page text a History restore shows again, whose words
 * were left with an empty required box while it was hidden (review 3 B):
 * the problem on its "Show this section on the page" box, else nothing.
 * (Save page checks those words itself: they are on its screen.)
 */
async function showsUnfinished(
  key: PageTextKey,
  before: unknown,
  after: unknown,
): Promise<Record<string, string>> {
  if (!isLayoutKey(key)) return {};
  const layout: PageLayout = pageLayouts[key];
  const wasHidden = new Set(
    storedSections(before)
      .filter((entry) => !entry.shown)
      .map((entry) => entry.id),
  );
  const problems: Record<string, string> = {};
  for (const entry of storedSections(after)) {
    const source = layout.sections.find(
      (section) => section.id === entry.id,
    )?.source;
    if (
      !entry.shown ||
      !wasHidden.has(entry.id) ||
      source?.from !== "text" ||
      source.key === key
    )
      continue;
    const other = await contentEditor().readPageText(source.key);
    const drawn = [
      entry.id,
      ...(layout.sections.find((section) => section.id === entry.id)?.with ??
        []),
    ];
    if (
      other &&
      drawn.some((id) => sectionProblems(source.key, other.document, id).length)
    )
      problems[`sections.${entry.id}`] = systemText.pageSections.fillFirst(
        pageSectionTitle(key, entry.id),
      );
  }
  return problems;
}

/**
 * Saves one page's text (PR5b WP3, D-6, D-22) with the sections of other
 * page texts the page shows (Jumu'ah and Musallah directions on Prayer &
 * Musallah; dashboard polish, 2026-10-06): each posted document over its
 * stored one, field by field (`mergePageText`), checked by its own save
 * rules (`pageTextsForm`: required boxes, lengths, links, Google Forms
 * links, photo descriptions), new photos stored through the upload pipeline
 * (at most `MAX_NEW_PHOTOS_PER_SAVE` in all), then saved in one step with
 * the versions on screen (`savePageTexts`): the page's own text, and a
 * shared text only when this save changes it. A refusal names each problem
 * on its box and keeps what was typed. Photos a text no longer names are
 * deleted afterwards (D-23).
 */
export async function savePageTextAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  const refusal = await pageEditorRefusal();
  if (refusal) return refuseKeeping(refusal);
  const key = pageKey.safeParse(values.key);
  if (!key.success) return refuseKeeping(words.unknownPage);
  const page = key.data;
  const keys = [page, ...sharedTexts(page)];
  const chosen = new Map(
    keys.map((owner) => [owner, chosenPhotos(form, page, owner)]),
  );
  const chosenCount = [...chosen.values()].flat().length;
  const again = chosenCount ? chooseFileAgain(words.photosAgain) : null;
  if (chosenCount > MAX_NEW_PHOTOS_PER_SAVE)
    return refuseKeeping(words.tooManyPhotos(MAX_NEW_PHOTOS_PER_SAVE));
  const posted: PageTexts = {};
  try {
    for (const owner of keys)
      posted[owner] = JSON.parse(values[documentField(owner, page)] ?? "");
  } catch {
    return refuseKeeping(outOfDate);
  }
  const read = await Promise.all(
    keys.map((owner) => contentEditor().readPageText(owner)),
  );
  const current = new Map(keys.map((owner, at) => [owner, read[at]]));
  if (read.some((text) => !text))
    return refuseKeeping(unavailableMessage("save"));
  if (
    keys.some(
      (owner) =>
        current.get(owner)?.version !== values[versionField(owner, page)],
    )
  )
    return refuseKeeping(staleScreen);
  const stored: PageTexts = Object.fromEntries(
    keys.map((owner) => [owner, current.get(owner)?.document]),
  );
  const elsewhere = await hiddenElsewhere(page);
  const pathsOf = (owner: PageTextKey) =>
    (chosen.get(owner) ?? []).map((photo) => photo.path);
  const parsed = pageTextsForm(page, stored, posted, pathsOf, elsewhere);
  if (!parsed.ok)
    return "fields" in parsed
      ? refuseKeeping(again, parsed.fields)
      : refuseKeeping(outOfDate);
  // A shared text is saved only when this save changes it: compared with
  // its stored text read back through the same rules.
  const changes = parsed.documents.filter(({ key: owner, document }) => {
    if (owner === page || pathsOf(owner).length) return true;
    const same = pageTextForm(
      owner,
      stored[owner],
      withEveryField(owner, stored[owner]),
      [],
      hiddenOnPage(owner, page, posted[page]),
    );
    return (
      !same.ok || JSON.stringify(same.document) !== JSON.stringify(document)
    );
  });
  const uploaded: string[] = [];
  const withAgain = (message: string) =>
    again ? `${message} ${again}` : message;
  try {
    for (const change of changes)
      for (const { path, file } of chosen.get(change.key) ?? []) {
        const name = await contentEditor().upload("image", file);
        if (!name) continue;
        uploaded.push(name);
        change.document = withPhotoSource(change.document, path, name);
      }
  } catch (error) {
    await removeUnusedFiles(uploaded);
    return refuseKeeping(
      withAgain(
        error instanceof Error ? error.message : unavailableMessage("save"),
      ),
    );
  }
  const saved = await contentEditor().savePageTexts(
    changes.map(({ key: owner, document }) => {
      const hidden = new Set([
        ...hiddenSections(owner, document),
        ...(owner === page
          ? elsewhere
          : hiddenOnPage(owner, page, changes[0].document)),
      ]);
      return {
        key: owner,
        // The same shape the save rules accepted, with the stored photo names.
        document: pageTextSaveSchema(owner, hidden).parse(document),
        version: current.get(owner)!.version,
      } as PageTextChange;
    }),
  );
  if (!saved.ok) {
    // Nothing names the new photos: they go again (D-23).
    await removeUnusedFiles(uploaded);
    return refuseKeeping(
      withAgain(
        saved.reason === "conflict" ? staleScreen : unavailableMessage("save"),
      ),
    );
  }
  // Photos a text named before and no longer names (replaced or removed).
  for (const { key: owner, document } of changes) {
    const still = new Set(photosIn(document));
    await removeUnusedFiles(
      photosIn(current.get(owner)?.document).filter((name) => !still.has(name)),
    );
  }
  publicDataChanged();
  return redirectSaved(pageScreenPath(page));
}

/**
 * Page history (D-12; review 3 D): puts back a page's text as it was before
 * a logged change, read again from the log (the form names only the entry),
 * checked against today's save rules like any save, and saved with the
 * version on screen and the time of the version it puts back
 * (`restored_from`), so the log names it "Restored to the version of …".
 * Nothing is deleted: photos replaced since then stay as they are now
 * (`restoredPageText`), and the restore is a new log entry.
 */
export async function restorePageTextVersionAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  const refusal = await pageEditorRefusal();
  if (refusal) return refuse(refusal);
  const key = pageKey.safeParse(form.get("key"));
  const entryId = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(form.get("entry"));
  const version = z.string().min(1).safeParse(form.get("version"));
  if (!key.success || !entryId.success || !version.success)
    return refuse(staleScreen);
  // The entry and the change before it, which dates the version before it.
  const { entries, unavailable } = await activityLog().list({
    area: "page_texts",
    recordId: key.data,
    before: entryId.data + 1,
    limit: 2,
  });
  if (unavailable) return refuse(unavailableMessage("load that version"));
  const [entry, previous] = entries;
  const earlier =
    entry?.id === entryId.data ? versionBefore(entry, previous ?? null) : null;
  if (!earlier?.snapshot.document) return refuse(staleScreen);
  const current = await contentEditor().readPageText(key.data);
  if (!current) return refuse(unavailableMessage("load that version"));
  if (current.version !== version.data) return refuse(words.restoreFailed);
  const restored = restoredPageText(
    key.data,
    earlier.snapshot.document,
    current.document,
    await hiddenElsewhere(key.data),
  );
  if (!restored.ok) return refuse(words.restoreRefused(restored.problem));
  const [unfinished] = Object.values(
    await showsUnfinished(key.data, current.document, restored.document),
  );
  if (unfinished) return refuse(words.restoreRefused(unfinished));
  const saved = await contentEditor().savePageText(
    key.data,
    restored.document,
    version.data,
    earlier.savedAt,
  );
  if (!saved.ok) return refuse(words.restoreFailed);
  publicDataChanged();
  redirect(`${pageScreenPath(key.data)}?restored=1`);
}
