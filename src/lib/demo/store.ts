import "server-only";
import type {
  VersionedCollection,
  VersionedLogin,
  VersionedMerchItem,
  VersionedPaymentItem,
  VersionedRecord,
  VersionedSeason,
  VersionedSection,
  VersionedStep,
} from "../backend/providers/contract";
import type { Go2PayOrder, PaymentItemLink } from "../community/payments";
import type { ActivityRow } from "../community/activity";
import type { VersionedListOption } from "../community/lists";
import type { EmailStep } from "../community/attention";
import { privateValue } from "../community/activity";
import { accessFrom, editsPages, type Person } from "../community/people";
import type { PageTextKey } from "../content/documents";
import {
  collections,
  type Collection,
  type MusallahPin,
  type PrayerSettings,
} from "../community/schema";
import {
  demoAdmin,
  demoHandoverSteps,
  demoListOptions,
  demoMerch,
  demoMusallahPin,
  demoOrders,
  demoPaymentItems,
  demoSeasons,
  demoPeople,
  demoPrayer,
  demoRecords,
  demoSections,
  demoSharedLogins,
} from "./fixtures";

/** A sandbox People row (the `people` table). */
export type SandboxPerson = Person & {
  updated_at: string;
  archived_at: string | null;
};
/** A sandbox access row (the `admins` table). */
export type SandboxAdmin = {
  user_id: string;
  person_id: string;
  can_manage_people: boolean;
  can_manage_money: boolean;
  deactivated_at: string | null;
  updated_at: string;
};
/** A sandbox login account (Supabase Auth's `auth.users`; never a password). */
export type SandboxAccount = {
  email: string;
  last_sign_in_at: string | null;
};

/**
 * The local sandbox's data (D-6): one in-memory store per server process,
 * shared by server actions, pages and `/media/[name]`. Edits survive
 * navigation and refresh; a restart starts again from the fixtures. Never
 * written to disk. Only the sample adapters import it (ADR 0012); it is the
 * one sanctioned global mutable state.
 */
export type SandboxStore = {
  records: Record<Collection, Map<string, VersionedRecord>>;
  /**
   * `restoredFrom`: the `restored_from` column (review 3 D). The starting
   * version is dated by the seed, as the database's row is by its migration.
   */
  prayer: {
    settings: PrayerSettings;
    version: string;
    restoredFrom: string | null;
  };
  /** The musallah pin (PR7, the `musallah_location` row). */
  musallah: { pin: MusallahPin; version: string };
  /** Uploads by name, oldest first; `uploadedAt` is an ISO time. */
  media: Map<
    string,
    {
      bytes: Uint8Array<ArrayBuffer>;
      contentType: string;
      uploadedAt: string;
    }
  >;
  /** Per-process demo session token: a restart also signs the demo admin out. */
  session: string;
  sections: Map<string, VersionedSection>;
  people: Map<string, SandboxPerson>;
  /** Keyed by account id. */
  admins: Map<string, SandboxAdmin>;
  /** Keyed by account id. */
  accounts: Map<string, SandboxAccount>;
  /** New board term (PR5a): the hand-over steps and the shared-login holders. */
  handoverSteps: Map<string, VersionedStep>;
  sharedLogins: Map<string, VersionedLogin>;
  /**
   * Page text the sandbox has saved (PR5b), by key, with `restored_from`
   * (review 3 D). A document not here is still the starter text from
   * `content/*.yaml`, at version `starterVersion(seed)`.
   */
  pageTexts: Map<
    PageTextKey,
    { document: unknown; updated_at: string; restored_from: string | null }
  >;
  /** PR6: seasons, funds and priced items, and their Go2Pay links (add-only). */
  seasons: Map<string, VersionedSeason>;
  paymentItems: Map<string, VersionedPaymentItem>;
  paymentLinks: PaymentItemLink[];
  /** PR5c: merch collections and items (sizes are payment items). */
  merchCollections: Map<string, VersionedCollection>;
  merchItems: Map<string, VersionedMerchItem>;
  /** Review fixes P3: the Lists (`list_options`); `archived_at` is always null. */
  listOptions: Map<
    string,
    VersionedListOption & { archived_at: string | null }
  >;
  /** The fake gateway's Go2Pay orders (sample only; never real people). */
  orders: Go2PayOrder[];
  /** Add-only, oldest first: appended by `recordActivity`, never changed. */
  activity: ActivityRow[];
  /** Daily-check emails the sandbox recorded instead of sending, oldest first. */
  sentWarnings: { subject: string; text: string }[];
  /** The `warning_emails_sent` table: warning key → step → date. */
  warningLedger: Map<string, Partial<Record<EmailStep, string>>>;
};

/**
 * The version of a starting row the sandbox has not saved yet (a page's
 * starter text, the prayer settings): the seed's time, as the database's
 * starting rows carry their migration's time, so History can date them.
 */
export const starterVersion = (seed: Date) => seed.toISOString();

/** A new opaque version token for the optimistic concurrency check. */
export const nextVersion = () => crypto.randomUUID();

function seedStore(seed: Date): SandboxStore {
  const paymentFixtures = demoPaymentItems(seed);
  const merch = demoMerch();
  const records = Object.fromEntries(
    collections.map((kind) => [
      kind,
      new Map(
        demoRecords(kind, seed).map((row) => [
          row.id,
          { ...row, updated_at: nextVersion(), archived_at: null },
        ]),
      ),
    ]),
  ) as SandboxStore["records"];
  const versioned = <T extends { id: string }>(rows: T[]) =>
    new Map(
      rows.map((row) => [
        row.id,
        { ...row, updated_at: nextVersion(), archived_at: null },
      ]),
    );
  return {
    records,
    prayer: {
      settings: demoPrayer(seed),
      version: starterVersion(seed),
      restoredFrom: null,
    },
    musallah: { pin: { ...demoMusallahPin }, version: nextVersion() },
    media: new Map(),
    session: nextVersion(),
    sections: versioned(demoSections()),
    people: versioned(demoPeople()),
    admins: new Map([
      [
        demoAdmin.userId,
        {
          user_id: demoAdmin.userId,
          person_id: demoAdmin.personId,
          can_manage_people: true,
          can_manage_money: true,
          deactivated_at: null,
          updated_at: nextVersion(),
        },
      ],
    ]),
    accounts: new Map([
      [
        demoAdmin.userId,
        { email: demoAdmin.email, last_sign_in_at: seed.toISOString() },
      ],
    ]),
    handoverSteps: versioned(demoHandoverSteps(seed)),
    sharedLogins: versioned(demoSharedLogins(seed)),
    pageTexts: new Map(),
    seasons: versioned(demoSeasons(seed)),
    paymentItems: new Map(
      paymentFixtures.map(({ item, archived }) => [
        item.id,
        {
          ...item,
          updated_at: nextVersion(),
          archived_at: archived ? seed.toISOString() : null,
        },
      ]),
    ),
    paymentLinks: paymentFixtures.map(({ item, product }) => ({
      go2pay_product_id: product,
      payment_item_id: item.id,
      added_at: seed.toISOString(),
    })),
    merchCollections: versioned(merch.collections),
    merchItems: versioned(merch.items),
    listOptions: versioned(demoListOptions()),
    orders: demoOrders(seed),
    activity: [],
    sentWarnings: [],
    warningLedger: new Map(),
  };
}

// On globalThis, not module scope, so every module graph Next builds in one
// process (pages, actions, route handlers, dev reloads) sees the same store.
// Keyed by seed so a store always matches the clock it was seeded on; a server
// process has one seed (configuration is parsed once), so it has one store.
const holder = globalThis as typeof globalThis & {
  __sguMsaSandboxStores?: Map<number, SandboxStore>;
};

/** The process-wide store for `seed` (the sample clock), seeded once from the fixtures. */
export function sandboxStore(seed: Date): SandboxStore {
  const stores = (holder.__sguMsaSandboxStores ??= new Map());
  let store = stores.get(seed.getTime());
  if (!store) {
    store = seedStore(seed);
    stores.set(seed.getTime(), store);
  }
  return store;
}

// The `record_activity()` trigger arguments per table: the key column, and
// for People and access only the changed columns, with personal values hidden (D-5).
const changesOnly: Record<string, readonly string[]> = {
  people: ["full_name", "photo_path"],
  admins: [],
};

type Row = Record<string, unknown>;

/**
 * Declared mirror of the `record_activity()` trigger: appends one entry for a
 * sandbox write. `before` null = created, `after` null = deleted. The actor is
 * the sandbox admin, the sandbox's only account (D-6).
 */
export function recordActivity(
  store: SandboxStore,
  at: Date,
  area: string,
  before: Row | null,
  after: Row | null,
) {
  const same = (key: string) =>
    JSON.stringify(before?.[key]) === JSON.stringify(after?.[key]);
  if (
    before &&
    after &&
    Object.keys({ ...before, ...after }).every(
      (key) => key === "updated_at" || same(key),
    )
  )
    return;
  const archivedBefore = Boolean(before?.archived_at);
  const archivedAfter = Boolean(after?.archived_at);
  const action: ActivityRow["action"] =
    !before && area === "admins"
      ? "access_granted"
      : !before
        ? "created"
        : !after
          ? "deleted"
          : area === "admins"
            ? "access_changed"
            : !archivedBefore && archivedAfter
              ? "archived"
              : archivedBefore && !archivedAfter
                ? "restored"
                : "updated";
  const hidden = changesOnly[area];
  // On create or delete, empty personal fields are not listed (D-27, D-29).
  const emptyPersonal = (key: string, value: unknown) =>
    hidden?.includes(key) && (value === null || value === "");
  const trim = (row: Row | null, other: Row | null): Row | null => {
    if (!row || !hidden) return row && structuredClone(row);
    const kept: Row = {};
    for (const [key, value] of Object.entries(row))
      if (
        key !== "updated_at" &&
        (other ? !same(key) : !emptyPersonal(key, value))
      )
        kept[key] = hidden.includes(key)
          ? privateValue
          : structuredClone(value);
    return kept;
  };
  const key =
    area === "admins"
      ? "person_id"
      : area === "page_texts"
        ? "key"
        : area === "payment_item_links"
          ? "go2pay_product_id"
          : "id";
  store.activity.push({
    id: store.activity.length + 1,
    occurred_at: at.toISOString(),
    actor: demoAdmin.userId,
    area,
    record_id: String((after ?? before)?.[key]),
    action,
    before: trim(before, after),
    after: trim(after, before),
    // Prayer changes, (PR5a D-17) an announcement urgent before or after,
    // and (PR6 D-18) a new Go2Pay link, a fund's category lock, a season's days.
    highlight:
      area === "prayer_settings" ||
      (area === "announcements" &&
        Boolean(before?.urgent_until || after?.urgent_until)) ||
      (area === "payment_item_links" && !before) ||
      (area === "payment_items" &&
        (before?.first_shown_at ?? null) !== (after?.first_shown_at ?? null)) ||
      (area === "seasons" && seasonDaysChanged(before, after)),
  });
}

const seasonDayColumns = [
  "hijri_month",
  "hijri_first_day",
  "hijri_last_day",
  "board_starts_on",
  "board_ends_on",
] as const;
/** As the trigger compares them: a missing, null or "" value is no day. */
function seasonDaysChanged(before: Row | null, after: Row | null) {
  const day = (row: Row | null, key: string) =>
    row?.[key] === undefined || row[key] === null || row[key] === ""
      ? null
      : String(row[key]);
  return seasonDayColumns.some((key) => day(before, key) !== day(after, key));
}

/**
 * The acting account in the sandbox: its only account, the sandbox admin
 * (D-6). Null once its access is off, as `is_admin()` would be false.
 */
export function sandboxActor(store: SandboxStore) {
  const row = store.admins.get(demoAdmin.userId);
  return row && !row.deactivated_at ? row : null;
}

/**
 * Whether the sandbox account edits Pages, as `can_edit_pages()` decides
 * (review 3 B), by the shared rule (`editsPages`).
 */
export function sandboxEditsPages(store: SandboxStore) {
  const admin = store.admins.get(demoAdmin.userId);
  const person = admin ? store.people.get(admin.person_id) : undefined;
  if (!admin || !person) return false;
  const account = store.accounts.get(admin.user_id);
  const executive =
    [...store.sections.values()].find((group) => group.kind === "executive")
      ?.id ?? null;
  return editsPages(
    {
      ...person,
      access: accessFrom({
        ...admin,
        email: account?.email ?? null,
        last_sign_in_at: account?.last_sign_in_at ?? null,
      }),
    },
    executive,
  );
}
