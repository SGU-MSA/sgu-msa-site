import "server-only";
import { cookies } from "next/headers";
import {
  compareByDate,
  dateAscending,
  prayerSettingsSchema,
  recordFromRow,
  recordToRow,
} from "../../community/schema";
import { editorialDocuments } from "../../content/documents";
import { nameTaken, resourceCategoriesInUse } from "../../community/lists";
import { documentNamesPhoto } from "../../content/page-fields";
import {
  contentDirectory,
  readYamlDocument,
} from "../../content/providers/yaml";
import {
  demoAdmin,
  sandboxCredentials,
  sandboxNoMoneyCredentials,
} from "../../demo/fixtures";
import {
  nextVersion,
  recordActivity,
  sandboxActor,
  sandboxEditsPages,
  sandboxStore,
  starterVersion,
  type SandboxStore,
} from "../../demo/store";
import { sessionCookieOptions } from "../config";
import { passwordSchema } from "../password";
import { normalizeUpload } from "../storage";
import type {
  AdminAuth,
  ContentEditor,
  PageTextChange,
  WriteResult,
} from "./contract";

/**
 * Sandbox board writes and sign-in over the in-memory store (D-6). They apply
 * the same `updated_at` check and the same archive and permission rules as
 * the database, and append to the sandbox activity log as its triggers do.
 * `seed` comes from the composition point; adapters never read the clock, so
 * sandbox changes are stamped with the seed time.
 */
const conflict: WriteResult = { ok: false, reason: "conflict" };
const ok: WriteResult = { ok: true };

/**
 * Mirror of `community_file_in_use()`: any item (archived or not), person,
 * page text, season page or merch item names the file.
 */
function sandboxFileInUse(store: SandboxStore, name: string) {
  return (
    Object.values(store.records).some((table) =>
      [...table.values()].some(
        (row) => row.image_path === name || row.file_path === name,
      ),
    ) ||
    [...store.people.values()].some((row) => row.photo_path === name) ||
    [...store.pageTexts.values()].some((row) =>
      documentNamesPhoto(row.document, name),
    ) ||
    // PR5c: season pages and merch items, archived or not.
    [...store.seasons.values(), ...store.merchItems.values()].some((row) =>
      documentNamesPhoto(row.photos, name),
    )
  );
}

/** The collections "Free up space" clears (`release_archived_files()`): those in the term zip. */
const releasedCollections = ["events", "news_posts", "newsletters"] as const;

export function createSampleContentEditor(seed: Date): ContentEditor {
  const instant = new Date(seed);
  /**
   * A page's text and version now: the sandbox's saved copy, else its
   * starter text from `content/*.yaml` at version `starterVersion`.
   */
  const pageText = async (
    key: Parameters<ContentEditor["readPageText"]>[0],
  ) => {
    const saved = store().pageTexts.get(key);
    if (saved)
      return {
        document: saved.document,
        version: saved.updated_at,
        restoredFrom: saved.restored_from,
      };
    const read = readYamlDocument(key, contentDirectory);
    return read.unavailable
      ? null
      : {
          document: read.document as unknown,
          version: starterVersion(instant),
          restoredFrom: null,
        };
  };
  const store = () => sandboxStore(instant);
  /**
   * Page texts saved in one step, or none (as `public.save_page_texts`):
   * every version is checked before anything changes; each is logged.
   */
  const savePageTexts = async (
    changes: readonly PageTextChange[],
    restoredFrom?: string,
  ): Promise<WriteResult> => {
    const sandbox = store();
    // RLS: the Executive board only (review 3 B).
    if (!sandboxEditsPages(sandbox)) return conflict;
    const keys = new Set(changes.map((change) => change.key));
    if (!changes.length || keys.size !== changes.length)
      return { ok: false, reason: "unavailable" };
    const current = await Promise.all(
      changes.map((change) => pageText(change.key)),
    );
    if (current.some((text) => !text))
      return { ok: false, reason: "unavailable" };
    if (changes.some((change, at) => current[at]!.version !== change.version))
      return conflict;
    changes.forEach(({ key, document }, at) => {
      const before = current[at]!;
      const saved = {
        document: structuredClone(document) as unknown,
        restored_from: restoredFrom ?? null,
        updated_at: nextVersion(),
      };
      sandbox.pageTexts.set(key, saved);
      recordActivity(
        sandbox,
        instant,
        "page_texts",
        {
          key,
          document: before.document,
          restored_from: before.restoredFrom,
          updated_at: before.version,
        },
        { key, ...saved },
      );
    });
    return ok;
  };
  const prayerRow = (prayer: SandboxStore["prayer"]) => ({
    ...prayer.settings,
    restored_from: prayer.restoredFrom,
    updated_at: prayer.version,
  });
  return {
    async listRecords(kind, view = "current") {
      const records = [...store().records[kind].values()]
        .filter((row) => Boolean(row.archived_at) === (view === "archived"))
        .map((row) => structuredClone(row))
        .sort(compareByDate(dateAscending(kind, "board")));
      return { records, unavailable: false };
    },
    async readRecord(kind, id) {
      const row = store().records[kind].get(id);
      return { record: row ? structuredClone(row) : null, unavailable: false };
    },
    async readPrayer() {
      // The same tolerant read as the database adapter (PR4 D-14).
      const { settings, version } = store().prayer;
      const parsed = prayerSettingsSchema.safeParse(settings);
      return parsed.success ? { settings: parsed.data, version } : null;
    },
    async saveRecord(kind, row, version) {
      const sandbox = store();
      const table = sandbox.records[kind];
      const existing = table.get(row.id);
      // Insert needs a new id; update needs the version the editor loaded.
      if (version === null ? existing : existing?.updated_at !== version)
        return conflict;
      // `events_one_per_ticket_item` (PR6 WP-9): archived events count too.
      const ticket = kind === "events" ? row.ticket_payment_item_id : "";
      if (
        ticket &&
        [...table.values()].some(
          (other) =>
            other.id !== row.id && other.ticket_payment_item_id === ticket,
        )
      )
        return { ok: false, reason: "ticket_taken" };
      // Only this collection's columns are stored (E-4), as in the database.
      const saved = {
        ...recordFromRow(recordToRow(kind, row)),
        archived_at: existing?.archived_at ?? null,
        updated_at: nextVersion(),
      };
      table.set(row.id, saved);
      recordActivity(sandbox, instant, kind, existing ?? null, saved);
      return ok;
    },
    async archiveRecord(kind, id, version) {
      const sandbox = store();
      const table = sandbox.records[kind];
      const existing = table.get(id);
      if (existing?.updated_at !== version || existing.archived_at)
        return conflict;
      const saved = {
        ...existing,
        archived_at: instant.toISOString(),
        updated_at: nextVersion(),
      };
      table.set(id, saved);
      recordActivity(sandbox, instant, kind, existing, saved);
      return ok;
    },
    async restoreRecord(kind, id, version) {
      const sandbox = store();
      const table = sandbox.records[kind];
      const existing = table.get(id);
      if (existing?.updated_at !== version || !existing.archived_at)
        return conflict;
      const saved = {
        ...existing,
        archived_at: null,
        published: false,
        updated_at: nextVersion(),
      };
      table.set(id, saved);
      recordActivity(sandbox, instant, kind, existing, saved);
      return ok;
    },
    async purgeRecord(kind, id, version) {
      const sandbox = store();
      const table = sandbox.records[kind];
      const existing = table.get(id);
      // RLS: archived rows only, and only for "manage people" holders.
      if (
        existing?.updated_at !== version ||
        !existing.archived_at ||
        !sandboxActor(sandbox)?.can_manage_people
      )
        return conflict;
      table.delete(id);
      recordActivity(sandbox, instant, kind, existing, null);
      return ok;
    },
    async savePrayerSettings(settings, version, restoredFrom) {
      const sandbox = store();
      if (sandbox.prayer.version !== version) return conflict;
      const before = prayerRow(sandbox.prayer);
      sandbox.prayer = {
        settings: structuredClone(settings),
        version: nextVersion(),
        restoredFrom: restoredFrom ?? null,
      };
      recordActivity(
        sandbox,
        instant,
        "prayer_settings",
        before,
        prayerRow(sandbox.prayer),
      );
      return ok;
    },
    async readPageText(key) {
      const current = await pageText(key);
      if (!current) return null;
      // The same tolerant read as the database adapter.
      const parsed = editorialDocuments[key].schema.safeParse(current.document);
      return parsed.success
        ? { document: parsed.data, version: current.version }
        : null;
    },
    savePageText(key, document, version, restoredFrom) {
      return savePageTexts(
        [{ key, document, version } as PageTextChange],
        restoredFrom,
      );
    },
    savePageTexts(changes) {
      return savePageTexts(changes);
    },
    async readMusallahPin() {
      const { pin, version } = store().musallah;
      return { pin: { ...pin }, version };
    },
    async saveMusallahPin(pin, version) {
      const sandbox = store();
      if (sandbox.musallah.version !== version) return conflict;
      const row = (musallah: SandboxStore["musallah"]) => ({
        ...musallah.pin,
        updated_at: musallah.version,
      });
      const before = row(sandbox.musallah);
      const { latitude, longitude } = pin;
      sandbox.musallah = {
        pin: { id: 1, latitude, longitude },
        version: nextVersion(),
      };
      recordActivity(
        sandbox,
        instant,
        "musallah_location",
        before,
        row(sandbox.musallah),
      );
      return ok;
    },
    async upload(field, file) {
      const upload = await normalizeUpload(field, file);
      if (!upload) return null;
      store().media.set(upload.name, {
        bytes: upload.bytes,
        contentType: upload.contentType,
        // The sandbox's clock (its seed), like its Recent changes.
        uploadedAt: instant.toISOString(),
      });
      return upload.name;
    },
    async removeFile(name) {
      const sandbox = store();
      // Storage policy: any admin, and only files no row names (D-23).
      if (sandboxActor(sandbox) && !sandboxFileInUse(sandbox, name))
        sandbox.media.delete(name);
      return { ok: true };
    },
    async listRecordsDated(kind, range) {
      const records = [...store().records[kind].values()]
        .filter((row) => row.date >= range.from && row.date <= range.until)
        .map((row) => structuredClone(row))
        .sort(
          (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
        );
      return { records, unavailable: false };
    },
    async releaseArchivedFiles(range) {
      const sandbox = store();
      // As `release_archived_files()`: "manage people" holders only.
      if (!sandboxActor(sandbox)?.can_manage_people)
        return { ok: false, reason: "forbidden" };
      const chosen = releasedCollections.flatMap((kind) =>
        [...sandbox.records[kind].values()]
          .filter(
            (row) =>
              row.archived_at &&
              row.date >= range.from &&
              row.date <= range.until &&
              (row.image_path || row.file_path),
          )
          .map((existing) => ({ kind, existing })),
      );
      const named = new Set(
        chosen
          .flatMap(({ existing }) => [existing.image_path, existing.file_path])
          .filter(Boolean),
      );
      // As the database: a file is freed when nothing names it once these
      // items stop naming it (tried, then put back); the rest keep their link.
      const put = (rows: typeof chosen, blank: boolean) => {
        for (const { kind, existing } of rows)
          sandbox.records[kind].set(
            existing.id,
            blank ? { ...existing, image_path: "", file_path: "" } : existing,
          );
      };
      put(chosen, true);
      const freed = new Set(
        [...named].filter((name) => !sandboxFileInUse(sandbox, name)),
      );
      put(chosen, false);
      for (const { kind, existing } of chosen) {
        const image_path = freed.has(existing.image_path)
          ? ""
          : existing.image_path;
        const file_path = freed.has(existing.file_path)
          ? ""
          : existing.file_path;
        if (
          image_path === existing.image_path &&
          file_path === existing.file_path
        )
          continue;
        const saved = {
          ...existing,
          image_path,
          file_path,
          updated_at: nextVersion(),
        };
        sandbox.records[kind].set(existing.id, saved);
        recordActivity(sandbox, instant, kind, existing, saved);
      }
      return { ok: true, files: [...freed].sort() };
    },
    async listFiles() {
      // The storage rules: any admin reads every file.
      if (!sandboxActor(store())) return { files: [], unavailable: true };
      const files = [...store().media].map(([name, file]) => ({
        name,
        bytes: file.bytes.length,
        uploadedAt: file.uploadedAt,
      }));
      // Newest first: the map keeps upload order.
      return { files: files.reverse(), unavailable: false };
    },
    async readFile(name) {
      const sandbox = store();
      const media = sandboxActor(sandbox) ? sandbox.media.get(name) : null;
      return {
        file: media
          ? new Blob([media.bytes], { type: media.contentType })
          : null,
        unavailable: false,
      };
    },
    readFiles(names) {
      const sandbox = store();
      const signedIn = Boolean(sandboxActor(sandbox));
      return {
        async *[Symbol.asyncIterator]() {
          for (const name of names) {
            const media = signedIn ? sandbox.media.get(name) : null;
            yield {
              name,
              file: media
                ? new Blob([media.bytes], { type: media.contentType })
                : null,
            };
          }
        },
      };
    },
    async fileInUse(name) {
      return sandboxFileInUse(store(), name);
    },
    async listOptions() {
      if (!sandboxActor(store())) return { options: [], unavailable: true };
      return {
        options: [...store().listOptions.values()]
          .sort((a, b) => a.position - b.position)
          .map(({ id, list, name, slug, position, updated_at }) => ({
            id,
            list,
            name,
            slug,
            position,
            updated_at,
          })),
        unavailable: false,
      };
    },
    // Mirrors `list_options` (one name per list, case and spaces aside; the
    // list and slug stay) and its log trigger.
    async saveListOption(option, version) {
      const sandbox = store();
      if (!sandboxActor(sandbox)) return conflict;
      const before = sandbox.listOptions.get(option.id) ?? null;
      if (version ? before?.updated_at !== version : before) return conflict;
      const rows = [...sandbox.listOptions.values()].filter(
        (row) => row.list === (before?.list ?? option.list),
      );
      if (nameTaken(rows, option.name, option.id))
        return { ok: false, reason: "name_taken" };
      const saved = before
        ? { ...before, name: option.name, updated_at: nextVersion() }
        : { ...option, updated_at: nextVersion(), archived_at: null };
      sandbox.listOptions.set(option.id, saved);
      recordActivity(sandbox, instant, "list_options", before, saved);
      return ok;
    },
    // Mirrors `list_options_guard`: nothing may use a deleted option.
    async deleteListOption(id, version) {
      const sandbox = store();
      const row = sandbox.listOptions.get(id);
      if (!sandboxActor(sandbox) || !row || row.updated_at !== version)
        return conflict;
      const events = [...sandbox.records.events.values()].some(
        (event) => event.category_id === id || event.term_id === id,
      );
      const resources =
        row.list === "resource_categories" &&
        resourceCategoriesInUse((await pageText("resources"))?.document).has(
          row.slug,
        );
      if (events || resources) return { ok: false, reason: "in_use" };
      sandbox.listOptions.delete(id);
      recordActivity(sandbox, instant, "list_options", row, null);
      return ok;
    },
  };
}

const sessionCookie = "sgu-msa-sandbox-admin";
/** Marks a session signed in with `sandboxNoMoneyCredentials`. */
const noMoneySuffix = ".no-money";

/**
 * Accepts only the sandbox credentials; the session is an httpOnly cookie
 * holding the store's per-process token. The "board" sign-in is the same
 * account without "Manage money" and "Manage people" (tests of the money
 * and manager gates). The sandbox sends no email and stores no password.
 */
export function createSampleAdminAuth(seed: Date): AdminAuth {
  const instant = new Date(seed);
  const store = () => sandboxStore(instant);
  const session = async () => {
    const value = (await cookies()).get(sessionCookie)?.value;
    if (value === store().session) return "full" as const;
    if (value === store().session + noMoneySuffix) return "no_money" as const;
    return null;
  };
  return {
    async current() {
      const access = sandboxActor(store());
      const signedIn = await session();
      if (!access || !signedIn) return null;
      return {
        userId: demoAdmin.userId,
        email: demoAdmin.email,
        canManagePeople: access.can_manage_people && signedIn === "full",
        canManageMoney: access.can_manage_money && signedIn === "full",
        canEditPages: sandboxEditsPages(store()),
      };
    },
    async signIn({ email, password }) {
      const full =
        email === sandboxCredentials.username &&
        password === sandboxCredentials.password;
      const noMoney =
        email === sandboxNoMoneyCredentials.username &&
        password === sandboxNoMoneyCredentials.password;
      if (!full && !noMoney) return "invalid";
      if (!sandboxActor(store())) return "not-admin";
      (await cookies()).set(
        sessionCookie,
        full ? store().session : store().session + noMoneySuffix,
        sessionCookieOptions(),
      );
      return "ok";
    },
    async signOut() {
      (await cookies()).delete(sessionCookie);
    },
    async requestPasswordReset() {
      return { ok: true, delivery: "sandbox" };
    },
    // The sandbox never sends a link, so no link is ever valid.
    async verifyEmailLink() {
      return "expired";
    },
    async setPassword(password) {
      if (!passwordSchema.safeParse(password).success) return "weak";
      if (!(await session())) return "no-session";
      // Nothing is stored: the sandbox always signs in with its fixed credentials.
      return "ok";
    },
  };
}
