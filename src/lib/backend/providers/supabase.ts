import "server-only";
import {
  isAuthApiError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";
import { z } from "../../validation/zod";
import {
  dateAscending,
  musallahPinSchema,
  prayerSettingsSchema,
  recordFromRow,
  recordToRow,
  storedFileName,
  type Collection,
} from "../../community/schema";
import { editorialDocuments } from "../../content/documents";
import { listOptionSchema } from "../../community/lists";
import type { Clock } from "../../runtime/clock";
import { passwordSchema } from "../password";
import { adminClient } from "../server";
import { normalizeUpload, uploadFailed } from "../storage";
import type {
  AdminAuth,
  ContentEditor,
  ListView,
  Outcome,
  StoredFile,
  VersionedRecord,
} from "./contract";

/**
 * Board writes and sign-in on Supabase: the user's session cookie client, so
 * RLS (`public.is_admin()`, `public.can_manage_people()`) decides every read
 * and write, and the activity log triggers record each change.
 */
const versioned = (row: Record<string, unknown>): VersionedRecord => ({
  ...recordFromRow(row),
  updated_at: String(row.updated_at),
  archived_at: row.archived_at ? String(row.archived_at) : null,
});

type DatabaseError = { code?: string } | null;

/**
 * An error means the write did not reach the database (or a rule refused it:
 * `refusals` maps a raised SQLSTATE to its reason); no row means the version
 * no longer matched, or RLS hid the row.
 */
export function outcome<R extends string = never>(
  result: { data: unknown[] | null; error: DatabaseError | unknown },
  refusals: Record<string, R> = {},
): Outcome<R> {
  if (result.error) {
    const code = (result.error as DatabaseError)?.code;
    const reason = code ? refusals[code] : undefined;
    return { ok: false, reason: reason ?? "unavailable" };
  }
  return result.data?.length ? { ok: true } : { ok: false, reason: "conflict" };
}
export const unavailable = { ok: false, reason: "unavailable" } as const;

/** Only current items, or only archived ones. */
export function inView<
  Q extends {
    is(column: string, value: null): Q;
    not(column: string, operator: string, value: null): Q;
  },
>(query: Q, view: ListView | undefined): Q {
  return view === "archived"
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);
}

/** Postgres `unique_violation`. */
const uniqueViolation = "23505";
/** Postgres `foreign_key_violation`: a list option still in use (`list_options_guard`). */
const foreignKeyViolation = "23503";
const optionColumns = "id, list, name, slug, position, updated_at";

/**
 * `clock` stamps `archived_at`; it comes from the composition point.
 * `connect` is the session client (tests pass a stub).
 */
export function createSupabaseContentEditor(
  clock: Clock,
  connect: typeof adminClient = adminClient,
): ContentEditor {
  return {
    async listRecords(kind, view) {
      const client = await connect();
      if (!client) return { records: [], unavailable: true };
      const { data, error } = await inView(client.from(kind).select("*"), view)
        .order("date", { ascending: dateAscending(kind, "board") })
        .limit(500);
      return error
        ? { records: [], unavailable: true }
        : { records: (data ?? []).map(versioned), unavailable: false };
    },
    async readRecord(kind, id) {
      const client = await connect();
      if (!client) return { record: null, unavailable: true };
      const { data, error } = await client
        .from(kind)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) return { record: null, unavailable: true };
      return { record: data ? versioned(data) : null, unavailable: false };
    },
    async readPrayer() {
      const client = await connect();
      if (!client) return null;
      const { data, error } = await client
        .from("prayer_settings")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) return null;
      // A stored row the schema refuses shows "Settings could not be loaded"
      // instead of the error page (PR4 Failure Modes).
      const parsed = prayerSettingsSchema.safeParse(data);
      return parsed.success
        ? { settings: parsed.data, version: String(data.updated_at) }
        : null;
    },
    async saveRecord(kind: Collection, row, version) {
      const client = await connect();
      if (!client) return unavailable;
      // Only this collection's columns (E-4); empty dates and times as null.
      const payload = recordToRow(kind, row);
      return outcome(
        await (version
          ? client
              .from(kind)
              .update(payload)
              .eq("id", row.id)
              .eq("updated_at", version)
              .select("id")
          : client.from(kind).insert(payload).select("id")),
        // `events_one_per_ticket_item`: one event per ticket (PR6 WP-9).
        kind === "events" ? { [uniqueViolation]: "ticket_taken" as const } : {},
      );
    },
    async archiveRecord(kind, id, version) {
      const client = await connect();
      if (!client) return unavailable;
      return outcome(
        await client
          .from(kind)
          .update({ archived_at: clock.now().toISOString() })
          .eq("id", id)
          .eq("updated_at", version)
          .is("archived_at", null)
          .select("id"),
      );
    },
    async restoreRecord(kind, id, version) {
      const client = await connect();
      if (!client) return unavailable;
      // D-13: restored items come back as unpublished drafts.
      return outcome(
        await client
          .from(kind)
          .update({ archived_at: null, published: false })
          .eq("id", id)
          .eq("updated_at", version)
          .not("archived_at", "is", null)
          .select("id"),
      );
    },
    async purgeRecord(kind, id, version) {
      const client = await connect();
      if (!client) return unavailable;
      return outcome(
        await client
          .from(kind)
          .delete()
          .eq("id", id)
          .eq("updated_at", version)
          .not("archived_at", "is", null)
          .select("id"),
      );
    },
    async savePrayerSettings(settings, version, restoredFrom) {
      const client = await connect();
      if (!client) return unavailable;
      return outcome(
        await client
          .from("prayer_settings")
          .update({ ...settings, restored_from: restoredFrom ?? null })
          .eq("id", 1)
          .eq("updated_at", version)
          .select("id"),
      );
    },
    async readPageText(key) {
      const client = await connect();
      if (!client) return null;
      const { data, error } = await client
        .from("page_texts")
        .select("document, updated_at")
        .eq("key", key)
        .maybeSingle();
      if (error || !data) return null;
      // A stored document the schema refuses shows "could not be loaded"
      // instead of an editor that would drop parts of it.
      const parsed = editorialDocuments[key].schema.safeParse(data.document);
      return parsed.success
        ? { document: parsed.data, version: String(data.updated_at) }
        : null;
    },
    async savePageText(key, document, version, restoredFrom) {
      const client = await connect();
      if (!client) return unavailable;
      return outcome(
        await client
          .from("page_texts")
          .update({ document, restored_from: restoredFrom ?? null })
          .eq("key", key)
          .eq("updated_at", version)
          .select("key"),
      );
    },
    async savePageTexts(changes) {
      const client = await connect();
      if (!client) return unavailable;
      // `public.save_page_texts`: every text or none, under the board
      // member's RLS; versions passed back exactly as they were read.
      const { data, error } = await client.rpc("save_page_texts", {
        keys: changes.map((change) => change.key),
        documents: changes.map((change) => change.document),
        versions: changes.map((change) => change.version),
      });
      const result = z.enum(["ok", "conflict"]).safeParse(data);
      if (error || !result.success) return unavailable;
      return result.data === "ok"
        ? { ok: true }
        : { ok: false, reason: "conflict" };
    },
    async readMusallahPin() {
      const client = await connect();
      if (!client) return null;
      const { data, error } = await client
        .from("musallah_location")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) return null;
      const parsed = musallahPinSchema.safeParse(data);
      return parsed.success
        ? { pin: parsed.data, version: String(data.updated_at) }
        : null;
    },
    async saveMusallahPin(pin, version) {
      const client = await connect();
      if (!client) return unavailable;
      const { latitude, longitude } = pin;
      return outcome(
        await client
          .from("musallah_location")
          .update({ latitude, longitude })
          .eq("id", 1)
          .eq("updated_at", version)
          .select("id"),
      );
    },
    async upload(field, file) {
      const upload = await normalizeUpload(field, file);
      if (!upload) return null;
      const client = await connect();
      if (!client) throw new Error(uploadFailed);
      const { error } = await client.storage
        .from("community")
        .upload(upload.name, upload.bytes, {
          contentType: upload.contentType,
          upsert: false,
        });
      if (error) throw new Error(uploadFailed);
      return upload.name;
    },
    async removeFile(name) {
      const client = await connect();
      if (!client) return unavailable;
      // The storage policy keeps files that a row still names.
      const { error } = await client.storage.from("community").remove([name]);
      return error ? unavailable : { ok: true };
    },
    async listRecordsDated(kind, range) {
      const client = await connect();
      if (!client) return { records: [], unavailable: true };
      const records: VersionedRecord[] = [];
      // PostgREST returns 1000 rows at most per call.
      for (let offset = 0; ; offset += ROW_PAGE) {
        const { data, error } = await client
          .from(kind)
          .select("*")
          .gte("date", range.from)
          .lte("date", range.until)
          .order("date", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + ROW_PAGE - 1);
        if (error) return { records: [], unavailable: true };
        records.push(...(data ?? []).map(versioned));
        if ((data ?? []).length < ROW_PAGE) break;
      }
      return { records, unavailable: false };
    },
    async releaseArchivedFiles(range) {
      const client = await connect();
      if (!client) return unavailable;
      // `public.release_archived_files`: one step under the board member's
      // RLS; "manage people" only (insufficient_privilege otherwise).
      const { data, error } = await client.rpc("release_archived_files", {
        from_day: range.from,
        until_day: range.until,
      });
      if (error)
        return {
          ok: false,
          reason: error.code === "42501" ? "forbidden" : "unavailable",
        };
      const files = z.array(storedFileName).safeParse(data);
      return files.success ? { ok: true, files: files.data } : unavailable;
    },
    async listFiles() {
      const client = await connect();
      if (!client) return { files: [], unavailable: true };
      const files: StoredFile[] = [];
      // Storage lists 1000 names at most per call; the bucket has no folders.
      for (let offset = 0; ; offset += FILE_PAGE) {
        const { data, error } = await client.storage
          .from("community")
          .list("", {
            limit: FILE_PAGE,
            offset,
            sortBy: { column: "created_at", order: "desc" },
          });
        if (error) return { files: [], unavailable: true };
        for (const file of data ?? []) {
          if (!storedFileName.safeParse(file.name).success) continue;
          const size = Number(file.metadata?.size);
          files.push({
            name: file.name,
            bytes: Number.isFinite(size) && size > 0 ? size : 0,
            uploadedAt: file.created_at ?? null,
          });
        }
        if ((data ?? []).length < FILE_PAGE) break;
      }
      return { files, unavailable: false };
    },
    async readFile(name) {
      const client = await connect();
      if (!client) return { file: null, unavailable: true };
      // Board members read every file (the `admin_read` storage policy).
      const { data, error } = await client.storage
        .from("community")
        .download(name);
      return { file: error ? null : data, unavailable: false };
    },
    readFiles(names) {
      // The session is read now, inside the request; the files are read as
      // the download asks for them.
      const connected = connect().catch(() => null);
      return {
        async *[Symbol.asyncIterator]() {
          const client = await connected;
          if (!client) throw new Error("Files could not be read.");
          for (const name of names) {
            const { data, error } = await client.storage
              .from("community")
              .download(name);
            if (!error) {
              yield { name, file: data };
              continue;
            }
            // Gone (404) is a missing file; anything else is a failure.
            const status = (error as { status?: number; statusCode?: string })
              .status;
            if (status === 404 || status === 400) yield { name, file: null };
            else throw new Error("A file could not be read.");
          }
        },
      };
    },
    async fileInUse(name) {
      const client = await connect();
      if (!client) return null;
      const { data, error } = await client.rpc("community_file_in_use", {
        file_name: name,
      });
      return error || typeof data !== "boolean" ? null : data;
    },
    async listOptions() {
      const client = await connect();
      if (!client) return { options: [], unavailable: true };
      const { data, error } = await client
        .from("list_options")
        .select(optionColumns)
        .order("position");
      if (error) return { options: [], unavailable: true };
      const parsed = z
        .array(listOptionSchema.extend({ updated_at: z.string() }))
        .safeParse(data ?? []);
      return parsed.success
        ? { options: parsed.data, unavailable: false }
        : { options: [], unavailable: true };
    },
    async saveListOption(option, version) {
      const client = await connect();
      if (!client) return unavailable;
      const refusals = { [uniqueViolation]: "name_taken" as const };
      return outcome(
        await (version
          ? client
              .from("list_options")
              .update({ name: option.name })
              .eq("id", option.id)
              .eq("updated_at", version)
              .select("id")
          : client.from("list_options").insert(option).select("id")),
        refusals,
      );
    },
    async deleteListOption(id, version) {
      const client = await connect();
      if (!client) return unavailable;
      return outcome(
        await client
          .from("list_options")
          .delete()
          .eq("id", id)
          .eq("updated_at", version)
          .select("id"),
        { [foreignKeyViolation]: "in_use" as const },
      );
    },
  };
}

/** Names per storage list call (its most). */
const FILE_PAGE = 1000;
/** Rows per PostgREST read (its default most). */
const ROW_PAGE = 1000;

/** Signed in with a session and an active row in `public.admins`; otherwise null. */
async function current() {
  const client = await adminClient();
  if (!client) return null;
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  // Board accounts are email and password only (owner guide).
  if (error || !user?.email) return null;
  const [{ data }, pages] = await Promise.all([
    client
      .from("admins")
      .select("can_manage_people, can_manage_money")
      .eq("user_id", user.id)
      .is("deactivated_at", null)
      .maybeSingle(),
    // The Executive board edits Pages (review 3 B); the database decides.
    client.rpc("can_edit_pages"),
  ]);
  return data
    ? {
        userId: user.id,
        email: user.email,
        canManagePeople: data.can_manage_people === true,
        canManageMoney: data.can_manage_money === true,
        canEditPages: pages.data === true,
      }
    : null;
}

export const supabaseAdminAuth: AdminAuth = {
  current,
  async signIn(input) {
    // Board accounts are email addresses; the sandbox username never reaches Supabase.
    if (!z.email().safeParse(input.email).success) return "invalid";
    const client = await adminClient();
    if (!client) return "invalid";
    const { error } = await client.auth.signInWithPassword(input);
    if (error) return "invalid";
    if (!(await current())) {
      await client.auth.signOut();
      return "not-admin";
    }
    return "ok";
  },
  async signOut() {
    const client = await adminClient();
    await client?.auth.signOut();
  },
  async requestPasswordReset(email, redirectTo) {
    const client = await adminClient();
    if (!client) return unavailable;
    // Supabase succeeds for an unknown email without sending anything; a
    // real account's send can fail (rate limit, email not set up), so the
    // forgot-password page shows the same answer either way (`resetRequested`).
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return error ? unavailable : { ok: true, delivery: "email" };
  },
  async verifyEmailLink(tokenHash, type) {
    const client = await adminClient();
    if (!client) return "expired";
    const { error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    return error ? "expired" : "ok";
  },
  async setPassword(password) {
    if (!passwordSchema.safeParse(password).success) return "weak";
    const client = await adminClient();
    if (!client) return "unavailable";
    const {
      data: { user },
      error: sessionError,
    } = await client.auth.getUser();
    // Only a missing or rejected session means "sign in again"; a network or
    // server failure is an outage.
    if (
      sessionError &&
      !isAuthSessionMissingError(sessionError) &&
      !(
        isAuthApiError(sessionError) &&
        (sessionError.status === 401 || sessionError.status === 403)
      )
    )
      return "unavailable";
    if (!user) return "no-session";
    // The password goes only to Supabase Auth, which keeps a one-way hash.
    const { error } = await client.auth.updateUser({ password });
    // Choosing the current password again leaves the same password in place.
    if (error && error.code !== "same_password")
      return error.code === "weak_password" ? "weak" : "unavailable";
    // D-15: a new password ends every other session of this person.
    const signedOut = await client.auth.signOut({ scope: "others" });
    return signedOut.error ? "unavailable" : "ok";
  },
};
