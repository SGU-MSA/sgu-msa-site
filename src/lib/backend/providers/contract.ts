import type {
  Collection,
  CommunityRecord,
  MusallahPin,
  PrayerSettings,
} from "../../community/schema";
import type {
  ActivityEntry,
  ActivityQuery,
  LoginOwner,
} from "../../community/activity";
import type { HandoverStep, SharedLogin } from "../../community/handover";
import type { EditorialDocuments, PageTextKey } from "../../content/documents";
import type { EmailStep, SentSteps } from "../../community/attention";
import type { PaymentItem, PaymentItemLink } from "../../community/payments";
import type { Season } from "../../community/seasons";
import type { MerchCollection, MerchItem } from "../../community/merch";
import type { OrderedList, SavedOrder } from "../../community/order";
import type { ListOption, VersionedListOption } from "../../community/lists";
import type {
  Access,
  AccessChange,
  grantAccessResults,
  Person,
  Section,
  setAccessResults,
} from "../../community/people";

/** One page text to save with the version the screen read (`savePageTexts`). */
export type PageTextChange = {
  [K in PageTextKey]: {
    key: K;
    document: EditorialDocuments[K];
    version: string;
  };
}[PageTextKey];

/** Current items, or the Archived tab (ADR 0013). */
export type ListView = "current" | "archived";

/** A board record with its version (`updated_at`) for the optimistic concurrency check. */
export type VersionedRecord = CommunityRecord & {
  updated_at: string;
  archived_at: string | null;
};

/**
 * The result of a board write. `conflict`: the version no longer matches
 * (another editor saved first, or the item is gone or in the other tab);
 * `unavailable`: the write did not reach the database. `R` adds the refusals
 * a database rule can give for that write.
 */
export type Outcome<R extends string = never> =
  { ok: true } | { ok: false; reason: R | "conflict" | "unavailable" };
export type WriteResult = Outcome;

export type UploadField = "image" | "file";

/** Days from `from` to `until`, both included (`YYYY-MM-DD`, Grenada days; term export). */
export type DayRange = { from: string; until: string };

/** A stored upload, as the Photos screen lists it (photo library, 2026-10-06). */
export type StoredFile = {
  /** `<uuid>.webp` or `<uuid>.pdf`. */
  name: string;
  bytes: number;
  /** When it was uploaded (ISO time), or null when storage does not say. */
  uploadedAt: string | null;
};

/**
 * Board writes and protected board reads (ADR 0012 rule 6). Actions keep
 * validation, `currentAdmin()`, revalidation and redirects; adapters only
 * store. On Supabase, RLS stays the authority.
 */
export interface ContentEditor {
  /** `view` defaults to current items. */
  listRecords(
    kind: Collection,
    view?: ListView,
  ): Promise<{ records: VersionedRecord[]; unavailable: boolean }>;
  readRecord(
    kind: Collection,
    id: string,
  ): Promise<{ record: VersionedRecord | null; unavailable: boolean }>;
  /** Null when the settings could not be loaded. */
  readPrayer(): Promise<{ settings: PrayerSettings; version: string } | null>;
  /**
   * `version` null inserts; otherwise the write applies only if it matches
   * `updated_at`. `ticket_taken`: another event already sells this ticket
   * (`events_one_per_ticket_item`, PR6 WP-9).
   */
  saveRecord(
    kind: Collection,
    row: CommunityRecord,
    version: string | null,
  ): Promise<Outcome<"ticket_taken">>;
  /** Moves a current item to Archived: hidden publicly with its files. */
  archiveRecord(
    kind: Collection,
    id: string,
    version: string,
  ): Promise<WriteResult>;
  /** Brings an archived item back as an unpublished draft (D-13). */
  restoreRecord(
    kind: Collection,
    id: string,
    version: string,
  ): Promise<WriteResult>;
  /** Permanent delete: archived items only, "manage people" holders only (D-6). */
  purgeRecord(
    kind: Collection,
    id: string,
    version: string,
  ): Promise<WriteResult>;
  /**
   * `restoredFrom`: a History restore (review 3 D) names the time of the
   * version it puts back (`restored_from`, so the log can say "Restored to
   * the version of …"); every other save leaves it out, which clears it.
   */
  savePrayerSettings(
    settings: PrayerSettings,
    version: string,
    restoredFrom?: string,
  ): Promise<WriteResult>;
  /** The musallah pin (PR7) with its version, or null when it cannot be read. */
  readMusallahPin(): Promise<{ pin: MusallahPin; version: string } | null>;
  /**
   * Moves the pin; applies only if `version` matches `updated_at`. Its own
   * row and version, so a prayer save and a pin save never block each other.
   */
  saveMusallahPin(pin: MusallahPin, version: string): Promise<WriteResult>;
  /**
   * One page's text with its version (`updated_at`), as stored (PR5b). Null
   * when it could not be read: no connection, no row (the migration is not
   * applied), or a stored document its schema refuses.
   */
  readPageText<K extends PageTextKey>(
    key: K,
  ): Promise<{ document: EditorialDocuments[K]; version: string } | null>;
  /**
   * Replaces one page's text; applies only if `version` still matches.
   * `restoredFrom` as for `savePrayerSettings` (review 3 D).
   */
  savePageText<K extends PageTextKey>(
    key: K,
    document: EditorialDocuments[K],
    version: string,
    restoredFrom?: string,
  ): Promise<WriteResult>;
  /**
   * Replaces several page texts in one step, or none (Save page with the
   * sections of other page texts the page shows; dashboard polish): applies
   * only if every `version` still matches, else changes nothing
   * (`conflict`). Each text is logged as its own change.
   */
  savePageTexts(changes: readonly PageTextChange[]): Promise<WriteResult>;
  /**
   * Stores a file after `normalizeUpload` and returns its stored name, or
   * null for an empty file input. Throws an Error with a board-facing message.
   */
  upload(field: UploadField, file: File): Promise<string | null>;
  /**
   * Deletes a stored file that no item or person names any more (any admin,
   * D-23). A file still in use is kept and still counts as ok.
   */
  removeFile(
    name: string,
  ): Promise<{ ok: true } | { ok: false; reason: "unavailable" }>;
  /**
   * Every item of `kind` dated within `range` (its `date`), current and
   * archived, oldest first (term export, review fixes P5; any admin reads).
   */
  listRecordsDated(
    kind: Collection,
    range: DayRange,
  ): Promise<{ records: VersionedRecord[]; unavailable: boolean }>;
  /**
   * "Free up space" (term export): clears the photo and PDF of every
   * archived event, news post and newsletter dated within `range`, in one
   * step (`release_archived_files()`; each change is logged), and returns the
   * cleared files nothing names any more, for `removeFile`. "Manage people"
   * holders only (`forbidden`).
   */
  releaseArchivedFiles(
    range: DayRange,
  ): Promise<
    | { ok: true; files: string[] }
    | { ok: false; reason: "forbidden" | "unavailable" }
  >;
  /** Every stored upload, newest first (photo library; any admin). */
  listFiles(): Promise<{ files: StoredFile[]; unavailable: boolean }>;
  /** Any stored upload, published or not, for the board's own previews (any admin). */
  readFile(name: string): Promise<{ file: Blob | null; unavailable: boolean }>;
  /**
   * Stored files one at a time, in order, for a download that streams (term
   * export): signed in once, when called, so the files can still be read
   * after the response has started. `file` is null for a file that is gone;
   * a file that cannot be read throws, which ends the download as failed.
   */
  readFiles(
    names: readonly string[],
  ): AsyncIterable<{ name: string; file: Blob | null }>;
  /**
   * Whether any row names the file (`community_file_in_use()`, the rule the
   * storage policy deletes by); null when it cannot be checked.
   */
  fileInUse(name: string): Promise<boolean | null>;
  /** Every option of every list with its version (review fixes P3, Lists; any admin). */
  listOptions(): Promise<{
    options: VersionedListOption[];
    unavailable: boolean;
  }>;
  /**
   * Adds an option (`version` null) or renames one: only its name changes
   * (its list, slug and place stay). `name_taken`: the list has that name
   * already (`list_options_one_name`).
   */
  saveListOption(
    option: ListOption,
    version: string | null,
  ): Promise<Outcome<"name_taken">>;
  /**
   * Deletes an option nothing uses. `in_use`: an event (archived or not)
   * or a resource still uses it (`list_options_guard`).
   */
  deleteListOption(id: string, version: string): Promise<Outcome<"in_use">>;
}

/** A People entry with its versions and its login. */
export type VersionedPerson = Person & {
  updated_at: string;
  archived_at: string | null;
  access: Access;
};
export type VersionedSection = Section & {
  updated_at: string;
  archived_at: string | null;
};

/** Refusals of the access guard (`admins_guard`) and the access functions. */
export type AccessResult = Outcome<
  Exclude<(typeof setAccessResults)[number], "ok" | "conflict">
>;
/** `grant_access` results, or unavailable. */
export type GrantResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        Exclude<(typeof grantAccessResults)[number], "ok"> | "unavailable";
    };

/**
 * People, team groups (`people_sections`) and access, under RLS (ADR 0007).
 * Any admin edits People entries and groups (D-7, D-8); access, permissions
 * and permanent delete need "manage people" (the database decides). The
 * Executive board and the General board are permanent (review 2).
 */
export interface PeopleEditor {
  /** People in order-number order (gather them with `listSections`); `view` defaults to current. */
  listPeople(
    view?: ListView,
  ): Promise<{ people: VersionedPerson[]; unavailable: boolean }>;
  readPerson(
    id: string,
  ): Promise<{ person: VersionedPerson | null; unavailable: boolean }>;
  /**
   * `version` null inserts. `invalid`: the database refused the row (an
   * unknown group, or a role outside `EXECUTIVE_ROLES` in the Executive
   * board). An archived entry is read-only until restored (`conflict`,
   * D-20), except that its photo may be cleared with nothing else changed:
   * the remove-photo path (D-26). Moving someone into or out of the
   * Executive board, or changing an executive's role, needs "manage people"
   * (`forbidden`, 2026-10-06); moving someone out turns off their two
   * permissions under the access guard (`self`, `last_manager`). `role_taken`: another current person holds
   * this Executive board role (2026-10-06; `savePersonTakingRole`).
   */
  savePerson(
    row: Person,
    version: string | null,
  ): Promise<
    Outcome<"invalid" | "forbidden" | "self" | "last_manager" | "role_taken">
  >;
  /**
   * "Make <name> President instead?" (2026-10-06): saves `row` into the
   * Executive board role `holder` holds now and moves the holder to the end
   * of the General board with no role title, in one step (both or neither,
   * both logged). "Manage people" holders only (`forbidden`). `conflict`:
   * the entry or the holder changed since the screen was read. Moving the
   * holder out of the Executive board may change their access, under the
   * access guard (`self`, `last_manager`).
   */
  savePersonTakingRole(
    row: Person,
    version: string | null,
    holder: { id: string; version: string },
  ): Promise<
    Outcome<"invalid" | "role_taken" | "forbidden" | "self" | "last_manager">
  >;
  /** Archiving also turns the person's login off in the same step (D-12; guards apply). */
  archivePerson(id: string, version: string): Promise<AccessResult>;
  /**
   * Restores the entry; the login stays off until reactivated. `role_taken`:
   * someone else holds their Executive board role now.
   */
  restorePerson(id: string, version: string): Promise<Outcome<"role_taken">>;
  /** Permanent delete: archived people only, "manage people" holders only (D-6). */
  purgePerson(id: string, version: string): Promise<WriteResult>;
  listSections(
    view?: ListView,
  ): Promise<{ sections: VersionedSection[]; unavailable: boolean }>;
  /**
   * `name_taken`: another current group has this name. Archived groups are
   * read-only (`conflict`, D-20). A new group is always the board's own
   * (`kind` is never written); `permanent`: a permanent group was renamed.
   */
  saveSection(
    row: Section,
    version: string | null,
  ): Promise<Outcome<"name_taken" | "permanent">>;
  /** Refused while the group holds current people, and for a permanent group. */
  archiveSection(
    id: string,
    version: string,
  ): Promise<Outcome<"section_in_use" | "permanent">>;
  /** Brings an archived group back (D-22). `name_taken`: a current group has its name. */
  restoreSection(id: string, version: string): Promise<Outcome<"name_taken">>;
  /**
   * Permanent delete of an archived group nobody (archived or not) is in
   * (review 2): "manage people" holders only (D-6). `in_use`: someone is
   * still in it.
   */
  deleteSection(id: string, version: string): Promise<Outcome<"in_use">>;
  /** Links an existing account (created by the invite) to a People entry. Retrying is safe. */
  grantAccess(
    personId: string,
    email: string,
    permissions: { canManagePeople: boolean; canManageMoney: boolean },
  ): Promise<GrantResult>;
  /**
   * Changes permissions or (de)activates a login; deactivation ends all their
   * sessions. An archived person's login cannot be turned on (`person_archived`, D-19).
   */
  setAccess(change: AccessChange): Promise<AccessResult>;
}

/**
 * Login accounts in Supabase Auth: the only uses of the secret key (ADR 0007,
 * D-21). Server-only; never reached from the browser.
 */
export interface AccountInviter {
  /** Sends the invite email. An existing account is `already-registered`, not an error for the invite flow. */
  invite(
    email: string,
    redirectTo: string,
    details: { fullName: string; invitedBy: string },
  ): Promise<
    | { ok: true; delivery: "email" | "sandbox" }
    | {
        ok: false;
        reason:
          "already-registered" | "email-unavailable" | "unavailable" | "off";
      }
  >;
  /**
   * Deletes the login account of a person who was permanently deleted, after
   * `purgePerson` succeeded (D-21). An account that is already gone counts as
   * ok. The database guard still protects the last active manager.
   */
  deleteAccount(
    userId: string,
  ): Promise<{ ok: true } | { ok: false; reason: "unavailable" | "off" }>;
  /**
   * Changes a login's email (review fixes P4, "Change email"): the person
   * signs in with the new address, their password unchanged. `taken`:
   * another account already has it.
   */
  changeEmail(
    userId: string,
    email: string,
  ): Promise<
    { ok: true } | { ok: false; reason: "taken" | "unavailable" | "off" }
  >;
}

/**
 * The daily check's warning email (daily-check contract D-15): one plain-text
 * email from the MSA Gmail to itself. `sandbox`: recorded, not sent; `off`:
 * this deployment never sends (anywhere but Vercel Production).
 */
export interface WarningMailer {
  send(email: {
    subject: string;
    text: string;
  }): Promise<
    | { ok: true; delivery: "email" | "sandbox" }
    | { ok: false; reason: "rejected" | "unavailable" | "off" }
  >;
}

/**
 * What the daily check already emailed (`warning_emails_sent`): warning keys,
 * steps and dates only, never personal data (D-12, D-13).
 */
export interface WarningLedger {
  alreadySent(
    keys: readonly string[],
  ): Promise<{ sent: SentSteps } | { unavailable: true }>;
  /** Adds rows for `on` (a Grenada date); a step already recorded stays as it was. */
  record(
    rows: readonly { key: string; step: EmailStep }[],
    on: string,
  ): Promise<{ ok: boolean }>;
}

/** A hand-over step with its version (`updated_at`) and archive stamp. */
export type VersionedStep = HandoverStep & {
  updated_at: string;
  archived_at: string | null;
};
/** A shared login with its version (`updated_at`) and archive stamp. */
export type VersionedLogin = SharedLogin & {
  updated_at: string;
  archived_at: string | null;
};

/**
 * New board term (PR5a D-5, D-27 d): the hand-over steps and who holds each
 * shared login, under RLS. Any admin reads and writes; nothing is deleted
 * (archive instead); every change is logged by the database. `conflict`: the
 * version no longer matches, the row is archived (read-only until restored),
 * or a chosen holder is no longer in People.
 */
export interface HandoverEditor {
  /** Steps in order (order number, then title); `view` defaults to current. */
  listSteps(
    view?: ListView,
  ): Promise<{ steps: VersionedStep[]; unavailable: boolean }>;
  /** `version` null inserts; otherwise the write applies only if it matches `updated_at`. */
  saveStep(row: HandoverStep, version: string | null): Promise<WriteResult>;
  archiveStep(id: string, version: string): Promise<WriteResult>;
  restoreStep(id: string, version: string): Promise<WriteResult>;
  /** Clears every current step's tick, one logged change per ticked step. */
  startNewTerm(): Promise<WriteResult>;
  /** Shared logins by account name; `view` defaults to current. */
  listLogins(
    view?: ListView,
  ): Promise<{ logins: VersionedLogin[]; unavailable: boolean }>;
  saveLogin(row: SharedLogin, version: string | null): Promise<WriteResult>;
  archiveLogin(id: string, version: string): Promise<WriteResult>;
  restoreLogin(id: string, version: string): Promise<WriteResult>;
}

/** A fund or priced item with its version (`updated_at`) and archive stamp (PR6). */
export type VersionedPaymentItem = PaymentItem & {
  updated_at: string;
  archived_at: string | null;
};
/** A season with its version and archive stamp (PR6). */
export type VersionedSeason = Season & {
  updated_at: string;
  archived_at: string | null;
};

/**
 * Funds, priced items and their Go2Pay links (PR6, D-58, D-61, D-65), under
 * RLS: any admin reads and writes; nothing is deleted (archive instead);
 * links are add-only; the database stamps the category lock and logs every
 * change. Nothing here calls Go2Pay.
 */
export interface PaymentItemEditor {
  /** Items in order (order number, then name), with every link of those items; `view` defaults to current. */
  listItems(view?: ListView): Promise<{
    items: VersionedPaymentItem[];
    links: PaymentItemLink[];
    unavailable: boolean;
  }>;
  readItem(id: string): Promise<{
    item: VersionedPaymentItem | null;
    links: PaymentItemLink[];
    unavailable: boolean;
  }>;
  /**
   * `version` null inserts. `link`: a Go2Pay product id to make the item's
   * current link (null keeps the current one); it is added after the item
   * is saved. `fund_locked`: a shown fund's category or kind, or the slug,
   * changed (SGU10). `slug_taken`: another item has the slug (choose the next
   * with `slugFor` and retry once). `link_taken`: the product is already
   * linked to another item (D-17). `link_used_before`: the product was this
   * item's own earlier link; a product id is linked once, ever, so going back
   * needs a new Go2Pay product. Both are refused before anything is written.
   * `missing_text`: kept for the action's `readyToList` refusal.
   */
  saveItem(
    row: PaymentItem,
    version: string | null,
    link: number | null,
  ): Promise<
    Outcome<
      | "forbidden"
      | "fund_locked"
      | "missing_text"
      | "slug_taken"
      | "link_taken"
      | "link_used_before"
    >
  >;
  archiveItem(id: string, version: string): Promise<WriteResult>;
  restoreItem(id: string, version: string): Promise<WriteResult>;
}

/**
 * Seasons (PR6, D-6, D-12; PR5 extends it), under RLS: any admin reads and
 * writes; nothing is deleted. `name_taken`: another current season has the
 * name. `in_use`: a current fund or item uses the season (SGU08).
 */
export interface SeasonEditor {
  /** Seasons by name; `view` defaults to current. */
  listSeasons(
    view?: ListView,
  ): Promise<{ seasons: VersionedSeason[]; unavailable: boolean }>;
  /** `version` null inserts; otherwise the write applies only if it matches `updated_at`. */
  saveSeason(
    row: Season,
    version: string | null,
  ): Promise<Outcome<"name_taken">>;
  archiveSeason(id: string, version: string): Promise<Outcome<"in_use">>;
  restoreSeason(id: string, version: string): Promise<Outcome<"name_taken">>;
}

/** A merch collection with its version and archive stamp (PR5c). */
export type VersionedCollection = MerchCollection & {
  updated_at: string;
  archived_at: string | null;
};
/** A merch item with its version and archive stamp (PR5c). */
export type VersionedMerchItem = MerchItem & {
  updated_at: string;
  archived_at: string | null;
};

/**
 * Merch collections and items (PR5c, D-9, D-27 b), under RLS: any admin
 * reads and writes; nothing is deleted (archive instead); the database logs
 * every change. A size is a priced item (`PaymentItemEditor`). `conflict`:
 * the version no longer matches, or the row is archived (read-only until
 * restored) or gone. `in_use`: the item still has current sizes (SGU16).
 */
export interface MerchEditor {
  /** Collections in order (order number, then name); `view` defaults to current. */
  listCollections(view?: ListView): Promise<{
    collections: VersionedCollection[];
    unavailable: boolean;
  }>;
  /** `version` null inserts. */
  saveCollection(
    row: MerchCollection,
    version: string | null,
  ): Promise<WriteResult>;
  archiveCollection(id: string, version: string): Promise<WriteResult>;
  restoreCollection(id: string, version: string): Promise<WriteResult>;
  /** Items of every collection in order; `view` defaults to current. */
  listItems(view?: ListView): Promise<{
    items: VersionedMerchItem[];
    unavailable: boolean;
  }>;
  /** `version` null inserts. */
  saveItem(row: MerchItem, version: string | null): Promise<WriteResult>;
  archiveItem(id: string, version: string): Promise<Outcome<"in_use">>;
  restoreItem(id: string, version: string): Promise<WriteResult>;
}

/**
 * "Save order" after dragging (review fixes PR-2), under RLS: the rows of
 * `list` get order numbers 1, 2, 3 … in the given order, all at once or not
 * at all. `conflict`: a row is archived, gone, or no longer has the version
 * the screen showed. Rows whose number is already right are left as they
 * are; every moved row is logged by the database.
 */
export interface OrderEditor {
  saveOrder(list: OrderedList, order: SavedOrder): Promise<WriteResult>;
}

/** Recent changes, newest first (read only; triggers write the log). */
export interface ActivityLog {
  /**
   * `before`: an entry id, for the next older page. `limit`: 1 to 50. Filters
   * (`activityQuerySchema`): `actors`, `areas`, `from` / `to` in Grenada days.
   * An entry's name comes from People through its login, removed ones too.
   */
  list(
    query: ActivityQuery,
  ): Promise<{ entries: ActivityEntry[]; unavailable: boolean }>;
  /**
   * Every login that has or had access, with its People entry: current
   * ones from access, removed ones from the log (`removedLoginsIn`).
   */
  logins(): Promise<{ logins: LoginOwner[]; unavailable: boolean }>;
}

/** The signed-in board member. The flags are a UX mirror; the database decides. */
export type AdminIdentity = {
  userId: string;
  email: string;
  canManagePeople: boolean;
  canManageMoney: boolean;
  /**
   * In the Executive board (review 3 B): only they edit Pages. Follows
   * People, no tick-box (`can_edit_pages()`).
   */
  canEditPages: boolean;
};

/**
 * Board sign-in and passwords. In the local sandbox `email` carries the
 * username: the sample adapter accepts only the sandbox credentials
 * (cleanup-outdated D-3), and the Supabase adapter rejects anything that is
 * not an email address. Passwords go only to Supabase Auth.
 */
export interface AdminAuth {
  /** Null when signed out, not an admin, or deactivated. */
  current(): Promise<AdminIdentity | null>;
  signIn(input: {
    email: string;
    password: string;
  }): Promise<"ok" | "invalid" | "not-admin">;
  signOut(): Promise<void>;
  /**
   * Sends a reset link. Success says nothing about whether the email has an
   * account; a failure can, so the forgot-password page never shows it
   * (`resetRequested`). The invite fallback reports it to the manager.
   */
  requestPasswordReset(
    email: string,
    redirectTo: string,
  ): Promise<
    | { ok: true; delivery: "email" | "sandbox" }
    | { ok: false; reason: "unavailable" }
  >;
  /** Signs in from an email link (sets the session cookie). */
  verifyEmailLink(
    tokenHash: string,
    type: "invite" | "recovery",
  ): Promise<"ok" | "expired">;
  /** Sets the signed-in person's password, then ends their other sessions (D-15). */
  setPassword(
    password: string,
  ): Promise<"ok" | "weak" | "no-session" | "unavailable">;
}
