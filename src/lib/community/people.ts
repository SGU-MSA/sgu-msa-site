import { z } from "../validation/zod";
import { outOfDate } from "../system-text";

/**
 * People, team groups (`people_sections`) and access: shapes and the declared mirrors of the
 * database rules (PR3 contract; `supabase/migrations/202610150001_schema.sql`
 * is the authority). Pure: no clock, no I/O.
 */

// Postgres `integer`, lower first (D-11). The board sets the order by dragging
// (review fixes PR-2, `order.ts`); nobody types it.
const order = z
  .number({ message: "Enter an order number." })
  .int("Use a whole number for the order.")
  .min(-2147483648)
  .max(2147483647);

/**
 * The two groups that always exist (review 2, 2026-10-05): they cannot be
 * renamed, archived or deleted (the database's `people_sections_permanent`
 * trigger). Every other group is the board's own (`kind` null).
 */
export const permanentGroups = ["executive", "general"] as const;
export type PermanentGroup = (typeof permanentGroups)[number];

export const sectionSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "Group name is required.").max(80),
  position: order,
  /**
   * Whether "Show on public page" starts ticked for a new person in this
   * group (review fixes P4: ticked unless the board changes it on Edit
   * groups); the board still ticks or unticks it per person. Unused for the
   * Executive board, which is always listed.
   */
  shown_by_default: z.boolean().default(true),
  /** Which permanent group this is; null for the board's own groups. */
  kind: z.enum(permanentGroups).nullable().default(null),
});
export type Section = z.infer<typeof sectionSchema>;

/**
 * The Executive board's roles, in the order the board and the public page
 * list its people (review 2, 2026-10-05). Everyone in the Executive board
 * holds one of them (the database's `people_executive_role` trigger and
 * `executive_role_rank`, which repeat this list).
 */
export const EXECUTIVE_ROLES = [
  "President",
  "Vice President (Brothers)",
  "Vice President (Sisters)",
  "Treasurer",
  "Secretary",
] as const;

/**
 * The founder's role titles (user, 2026-10-05), offered as suggestions under
 * "Role title" in the other groups. Only suggestions: any title can be typed
 * there, and every title already used in People is offered too, so the
 * board's own titles are suggested without a code change.
 */
export const STARTER_ROLE_TITLES = [
  ...EXECUTIVE_ROLES,
  "Musallah coordinator",
  "Social media manager",
  "Brothers coordinator",
  "Sisters coordinator",
  "T1 rep",
  "T2 rep",
  "T3 rep",
  "T4 rep",
  "T5 rep",
  "Pre-med term rep",
] as const;

/** "Role title" suggestions: the starter titles, then the others in use, each once. */
export function roleTitleSuggestions(
  people: readonly { role_title: string }[],
): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const title of [
    ...STARTER_ROLE_TITLES,
    ...people
      .map((person) => person.role_title.trim())
      .sort((a, b) => a.localeCompare(b)),
  ]) {
    const key = title.toLowerCase();
    if (title && !seen.has(key)) {
      seen.add(key);
      titles.push(title);
    }
  }
  return titles;
}

/** Where `role` is in `EXECUTIVE_ROLES` (President 0), or -1. */
const executiveIndex = (role: string) =>
  (EXECUTIVE_ROLES as readonly string[]).indexOf(role);

/** Whether `role` is one of the Executive board's roles. */
export const isExecutiveRole = (role: string) => executiveIndex(role) >= 0;

/**
 * A People entry. "Show on public page" is a box, ticked for a new person
 * when their group says so (`shown_by_default`); the Executive board is
 * always listed (`listedPublicly`). Only the Executive board has photos
 * (`photoAllowed`, review fixes P4). In the Executive board the role is one
 * of `EXECUTIVE_ROLES` (`personFormSchema`; the database checks it too).
 */
export const personSchema = z.object({
  id: z.uuid(),
  full_name: z.string().trim().min(1, "Name is required.").max(120),
  role_title: z.string().trim().max(120).default(""),
  section_id: z.uuid({ message: "Choose a group." }),
  position: order,
  show_on_public: z.boolean({
    message: "Answer “Show on public page?” with Yes or No.",
  }),
  photo_path: z
    .string()
    .regex(/^[a-f0-9-]{36}\.webp$/, outOfDate)
    .or(z.literal(""))
    .default(""),
});
export type Person = z.infer<typeof personSchema>;

/**
 * The one edit an archived People entry accepts (D-26, ADR 0014): its photo
 * cleared, nothing else changed. Declared mirror of `archived_read_only`;
 * Restore is separate.
 */
export function clearsOnlyPhoto(before: Person, after: Person): boolean {
  return (Object.keys(personSchema.shape) as (keyof Person)[]).every((key) =>
    key === "photo_path" ? after[key] === "" : after[key] === before[key],
  );
}

/**
 * `personSchema` for a board form: in the Executive board (`executiveGroupId`,
 * null when it cannot be read) the role must be one of `EXECUTIVE_ROLES`.
 */
export function personFormSchema(executiveGroupId: string | null) {
  return personSchema.superRefine((value, ctx) => {
    if (
      executiveGroupId &&
      value.section_id === executiveGroupId &&
      !isExecutiveRole(value.role_title)
    )
      ctx.addIssue({
        code: "custom",
        message: "Choose one of the Executive board roles.",
        path: ["role_title"],
      });
  });
}

/**
 * Who holds `person`'s Executive board role now (user, 2026-10-06: one
 * current person per role): another current entry in the Executive board
 * with the same role, or undefined. Declared mirror of the database's
 * `people_one_role_holder` trigger (SGU17), the authority.
 */
export function roleHolder<
  T extends Pick<Person, "id" | "section_id" | "role_title"> & {
    archived_at?: string | null;
  },
>(
  people: readonly T[],
  person: Pick<Person, "id" | "section_id" | "role_title">,
  executiveGroupId: string | null,
): T | undefined {
  if (
    !executiveGroupId ||
    person.section_id !== executiveGroupId ||
    !isExecutiveRole(person.role_title)
  )
    return undefined;
  return people.find(
    (other) =>
      other.id !== person.id &&
      !other.archived_at &&
      other.section_id === executiveGroupId &&
      other.role_title === person.role_title,
  );
}

/** Results of the `save_person_taking_role` database function (2026-10-06). */
export const takeRoleResults = [
  "ok",
  "conflict",
  "invalid",
  "role_taken",
  "forbidden",
  "self",
  "last_manager",
] as const;

/**
 * A current Executive board member, as the person form asks "Make <name>
 * President instead?" (user, 2026-10-06).
 */
export type RoleHolder = {
  id: string;
  name: string;
  role: string;
  /** Their entry's `updated_at`: Yes moves exactly the entry the form showed. */
  version: string;
  /**
   * Why they cannot be moved out of the Executive board, which turns off
   * their "manage people" (the access guard): it is you, or they are the
   * last holder. Null when they can.
   */
  stays: "self" | "last_manager" | null;
};

/** The Executive board's current role holders, for the person form. */
export function roleHolders(
  people: readonly (Pick<Person, "id" | "full_name" | "section_id"> &
    Pick<Person, "role_title"> & {
      archived_at: string | null;
      updated_at: string;
      access: Access;
    })[],
  executiveGroupId: string | null,
  actorUserId: string,
): RoleHolder[] {
  return people
    .filter(
      (person) =>
        !person.archived_at &&
        person.section_id === executiveGroupId &&
        isExecutiveRole(person.role_title),
    )
    .map((person) => {
      // Holders are in the Executive board.
      const stays = accessLocks(person, people, actorUserId, true).managePeople;
      return {
        id: person.id,
        name: person.full_name,
        role: person.role_title,
        version: person.updated_at,
        stays: stays === "self" || stays === "last_manager" ? stays : null,
      };
    });
}

/** One row of `public.admin_accounts()`: the login linked to a People entry. */
export const adminAccountSchema = z.object({
  person_id: z.uuid(),
  user_id: z.uuid(),
  email: z.string().nullable(),
  can_manage_people: z.boolean(),
  can_manage_money: z.boolean(),
  deactivated_at: z.string().nullable(),
  last_sign_in_at: z.string().nullable(),
  updated_at: z.string(),
});
export type AdminAccount = z.infer<typeof adminAccountSchema>;

/**
 * A person's login. "invited" until the first sign-in. `version` is the
 * access row's `updated_at`, passed back unchanged to refuse stale screens.
 */
export type Access =
  | { state: "none" }
  | {
      state: "invited" | "active" | "deactivated";
      userId: string;
      email: string | null;
      canManagePeople: boolean;
      canManageMoney: boolean;
      version: string;
    };

export function accessFrom(account: AdminAccount | undefined): Access {
  if (!account) return { state: "none" };
  return {
    state: account.deactivated_at
      ? "deactivated"
      : account.last_sign_in_at
        ? "active"
        : "invited",
    userId: account.user_id,
    email: account.email,
    canManagePeople: account.can_manage_people,
    canManageMoney: account.can_manage_money,
    version: account.updated_at,
  };
}

/** A permission or (de)activation change for `set_access`. */
export const accessChangeSchema = z.object({
  personId: z.uuid(),
  canManagePeople: z.boolean(),
  canManageMoney: z.boolean(),
  active: z.boolean(),
  version: z.string().min(1),
});
export type AccessChange = z.infer<typeof accessChangeSchema>;

/** Results of the `grant_access` database function (PR3 migrations). */
export const grantAccessResults = [
  "ok",
  "forbidden",
  "no_account",
  "already_linked",
  "person_has_login",
  "person_archived",
  // Hand-in plan (2026-10-06): the two permissions are for the Executive board only.
  "not_executive",
] as const;
/**
 * Results of the `set_access` database function (PR3 migrations).
 * `person_archived`: an archived person's login stays off until they are
 * restored (D-19).
 */
export const setAccessResults = [
  "ok",
  "forbidden",
  "conflict",
  "self",
  "last_manager",
  "person_archived",
  // PR6 D-18 (SGU09): nobody turns on their own "manage money".
  "self_money",
  // SGU14 (2026-10-06): the two permissions are for the Executive board only.
  "not_executive",
] as const;

/** A current access row, as the guard sees it. */
export type AccessHolder = {
  personId: string;
  userId: string;
  canManagePeople: boolean;
  canManageMoney: boolean;
  active: boolean;
};

/**
 * Declared mirror of the `admins_guard` trigger (the authority): nobody
 * removes their own access or own "manage people", nobody turns on their own
 * "manage money" (PR6 D-18), and the last active "manage people" holder
 * keeps it. Used by the sandbox and to disable buttons.
 */
export function accessChangeProblem(
  holders: readonly AccessHolder[],
  change: Pick<AccessChange, "personId" | "canManagePeople" | "active"> &
    Partial<Pick<AccessChange, "canManageMoney">>,
  actorUserId: string,
): "self" | "self_money" | "last_manager" | null {
  const target = holders.find((holder) => holder.personId === change.personId);
  if (!target) return null;
  const losesAccess = target.active && !change.active;
  if (
    target.userId === actorUserId &&
    (losesAccess || (target.canManagePeople && !change.canManagePeople))
  )
    return "self";
  if (
    target.userId === actorUserId &&
    change.canManageMoney &&
    !target.canManageMoney
  )
    return "self_money";
  const wasManager = target.canManagePeople && target.active;
  const staysManager = change.canManagePeople && change.active;
  if (
    wasManager &&
    !staysManager &&
    !holders.some(
      (holder) =>
        holder.userId !== target.userId &&
        holder.canManagePeople &&
        holder.active,
    )
  )
    return "last_manager";
  return null;
}

/**
 * How many active people should hold "manage people" (PR5a D-27): fewer
 * shows a warning, never a lock. The database only blocks zero (PR3 guard).
 */
export const MIN_MANAGERS = 2;

/**
 * Active "manage people" holders among current People entries, counted as
 * the guard counts them (a login not turned off, invited or signed in), and
 * whether that is fewer than `MIN_MANAGERS`.
 */
export function managerContinuity(
  people: readonly { archived_at: string | null; access: Access }[],
): { active: number; short: boolean } {
  const active = people.filter(
    ({ archived_at, access }) =>
      !archived_at &&
      access.state !== "none" &&
      access.state !== "deactivated" &&
      access.canManagePeople,
  ).length;
  return { active, short: active < MIN_MANAGERS };
}

/**
 * Who edits Pages (review 3 B, user 2026-10-05): a current People entry in
 * the Executive board whose login is not turned off (invited or signed in).
 * No tick-box: it follows the group. Declared mirror of the database's
 * `can_edit_pages()` (the authority), for the sandbox and the dashboard.
 */
export function editsPages(
  person: { archived_at: string | null; section_id: string; access: Access },
  executiveGroupId: string | null,
): boolean {
  return (
    !person.archived_at &&
    person.section_id === executiveGroupId &&
    person.access.state !== "none" &&
    person.access.state !== "deactivated"
  );
}

/**
 * Whether nobody can edit Pages (review 3 B): no Executive board member has
 * a login. The dashboard then says "Nobody can edit pages: add an
 * executive".
 */
export function nobodyEditsPages(
  people: readonly {
    archived_at: string | null;
    section_id: string;
    access: Access;
  }[],
  sections: readonly Pick<Section, "id" | "kind">[],
): boolean {
  const executive =
    sections.find((section) => section.kind === "executive")?.id ?? null;
  return !people.some((person) => editsPages(person, executive));
}

/**
 * Whether a person may hold "manage people" or "manage money" (user,
 * 2026-10-06): only in the Executive board. Declared mirror of the
 * database's `admins_executive_only` trigger (SGU14), the authority.
 */
export function permissionsProblem(
  executive: boolean,
  change: { canManagePeople: boolean; canManageMoney: boolean },
): "not_executive" | null {
  return !executive && (change.canManagePeople || change.canManageMoney)
    ? "not_executive"
    : null;
}

type GroupAndRole = { section_id: string; role_title: string };

/**
 * Whether saving `after` over `before` (null: a new person) moves someone
 * into or out of the Executive board or changes an executive's role, which
 * needs "manage people" (user, 2026-10-06). Declared mirror of the
 * database's `people_executive_moves` trigger (SGU15), the authority.
 */
export function touchesExecutive(
  before: GroupAndRole | null,
  after: GroupAndRole,
  executiveGroupId: string | null,
): boolean {
  if (!executiveGroupId) return false;
  const inAfter = after.section_id === executiveGroupId;
  if (!before) return inAfter;
  const inBefore = before.section_id === executiveGroupId;
  return (
    inBefore !== inAfter || (inAfter && before.role_title !== after.role_title)
  );
}

/**
 * Whether saving `after` over `before` moves the person out of the
 * Executive board: their "manage people" and "manage money" are then turned
 * off in the same step (the database's `people_leave_executive`), under the
 * access guard.
 */
export const leavesExecutive = (
  before: Pick<GroupAndRole, "section_id">,
  after: Pick<GroupAndRole, "section_id">,
  executiveGroupId: string | null,
) =>
  Boolean(executiveGroupId) &&
  before.section_id === executiveGroupId &&
  after.section_id !== executiveGroupId;

/** A People entry with its login, as the admin screens read it. */
type PersonWithAccess = { id: string; access: Access };

/** Why a control is locked (an `accessChangeProblem` or `permissionsProblem` answer), or null. */
export type AccessLock =
  | ReturnType<typeof accessChangeProblem>
  | ReturnType<typeof permissionsProblem>;
export type AccessLocks = {
  managePeople: AccessLock;
  manageMoney: AccessLock;
  deactivate: AccessLock;
};

/**
 * Which access controls the guard would refuse for `person`, so the access
 * panel can disable them with the reason (a UX mirror of `admins_guard` and
 * `admins_executive_only`; the database decides). `people` are the current
 * entries: archiving a person deactivates their login (D-12), so archived
 * entries never hold access. `executive`: the person is in the Executive
 * board, the only group whose people may hold the two permissions.
 */
export function accessLocks(
  person: PersonWithAccess,
  people: readonly PersonWithAccess[],
  actorUserId: string,
  executive: boolean,
): AccessLocks {
  const { access } = person;
  const outside = executive ? null : ("not_executive" as const);
  if (access.state === "none")
    return { managePeople: outside, manageMoney: outside, deactivate: null };
  const holders: AccessHolder[] = people.flatMap(({ id, access: login }) =>
    login.state === "none"
      ? []
      : [
          {
            personId: id,
            userId: login.userId,
            canManagePeople: login.canManagePeople,
            canManageMoney: login.canManageMoney,
            active: login.state !== "deactivated",
          },
        ],
  );
  const active = access.state !== "deactivated";
  return {
    managePeople: access.canManagePeople
      ? accessChangeProblem(
          holders,
          { personId: person.id, canManagePeople: false, active },
          actorUserId,
        )
      : outside,
    manageMoney: access.canManageMoney
      ? null
      : (outside ??
        accessChangeProblem(
          holders,
          {
            personId: person.id,
            canManagePeople: access.canManagePeople,
            canManageMoney: true,
            active,
          },
          actorUserId,
        )),
    deactivate: active
      ? accessChangeProblem(
          holders,
          {
            personId: person.id,
            canManagePeople: access.canManagePeople,
            active: false,
          },
          actorUserId,
        )
      : null,
  };
}

type Archivable = { archived_at?: string | null };

/** The public team list (D-10, D-11): groups in order, each with its listed people. */
export type TeamSection = {
  id: string;
  name: string;
  /** The Executive board (drawn in tiers, with photos), the General board, or the board's own (null). */
  kind: Section["kind"];
  people: {
    id: string;
    fullName: string;
    roleTitle: string;
    photoPath: string | null;
  }[];
};

/** One row of `public.public_team_list()`. */
export const teamRowSchema = z.object({
  section_id: z.uuid(),
  section_name: z.string(),
  section_kind: z.enum(permanentGroups).nullable(),
  section_position: z.number().int(),
  person_id: z.uuid(),
  full_name: z.string(),
  role_title: z.string(),
  position: z.number().int(),
  photo_path: z.string().nullable(),
});
export type TeamRow = z.infer<typeof teamRowSchema>;

/** Gathers ordered `public_team_list()` rows by group, keeping their order. */
export function groupTeam(rows: readonly TeamRow[]): TeamSection[] {
  const sections: TeamSection[] = [];
  for (const row of rows) {
    let section = sections.find((entry) => entry.id === row.section_id);
    if (!section) {
      section = {
        id: row.section_id,
        name: row.section_name,
        kind: row.section_kind,
        people: [],
      };
      sections.push(section);
    }
    section.people.push({
      id: row.person_id,
      fullName: row.full_name,
      roleTitle: row.role_title,
      photoPath: row.photo_path,
    });
  }
  return sections;
}

/**
 * The Executive board on About in tiers (user, 2026-10-07): the President;
 * then the two Vice Presidents; then the Treasurer and the Secretary. Every
 * role of `EXECUTIVE_ROLES` is in exactly one tier (a test checks).
 */
export const EXECUTIVE_TIERS = [
  ["President"],
  ["Vice President (Brothers)", "Vice President (Sisters)"],
  ["Treasurer", "Secretary"],
] as const satisfies readonly (readonly (typeof EXECUTIVE_ROLES)[number][])[];

/** The Executive board's listed people by tier, empty tiers left out; anyone else last. */
export function executiveTiers<T extends { roleTitle: string }>(
  people: readonly T[],
): T[][] {
  const tiers: T[][] = EXECUTIVE_TIERS.map((roles) =>
    people.filter((person) =>
      (roles as readonly string[]).includes(person.roleTitle),
    ),
  );
  const placed = new Set(tiers.flat());
  tiers.push(people.filter((person) => !placed.has(person)));
  return tiers.filter((tier) => tier.length > 0);
}

/**
 * Whether a person is on the public team list (user, 2026-10-07): the
 * Executive board always, anyone else when "Show on public page" is ticked;
 * never while archived. Declared mirror of `public_team_list()`.
 */
export function listedPublicly(
  person: Pick<Person, "section_id" | "show_on_public"> & Archivable,
  executiveGroupId: string | null,
): boolean {
  return (
    !person.archived_at &&
    (person.section_id === executiveGroupId || person.show_on_public)
  );
}

/**
 * Whether a person in `sectionId` may have a photo (user, 2026-10-07): only
 * the Executive board. Declared mirror of the database's
 * `people_photo_executive_only` trigger (SGU40).
 */
export const photoAllowed = (
  sectionId: string,
  executiveGroupId: string | null,
) => executiveGroupId !== null && sectionId === executiveGroupId;

/**
 * The photo shown for a person, on About and in the dashboard: their own
 * while they are in the Executive board, else "" (user, 2026-10-07: someone
 * moved out keeps their photo hidden, not deleted, and it is back when they
 * return). Declared mirror of `public_team_list()`.
 */
export const shownPhoto = (
  person: Pick<Person, "section_id" | "photo_path">,
  executiveGroupId: string | null,
): string =>
  photoAllowed(person.section_id, executiveGroupId) ? person.photo_path : "";

/**
 * The current Executive board members with no photo, in role order: the
 * dashboard asks for one (user, 2026-10-07).
 */
export function executivesWithoutPhoto<
  T extends Pick<
    Person,
    "id" | "full_name" | "role_title" | "section_id" | "photo_path"
  > &
    Archivable,
>(people: readonly T[], executiveGroupId: string | null): T[] {
  return people
    .filter(
      (person) =>
        !person.archived_at &&
        photoAllowed(person.section_id, executiveGroupId) &&
        !person.photo_path,
    )
    .sort(
      (a, b) =>
        roleRank("executive", a.role_title) -
          roleRank("executive", b.role_title) ||
        a.full_name.localeCompare(b.full_name),
    );
}

/** The database order of groups: order number, then name (D-11). */
export function byOrder<T extends { position: number }>(
  name: (item: T) => string,
) {
  return (a: T, b: T) =>
    a.position - b.position || name(a).localeCompare(name(b));
}

/** Where `role` sorts in a group of `kind`: by role in the Executive board. */
function roleRank(kind: Section["kind"], role: string) {
  if (kind !== "executive") return 0;
  const rank = executiveIndex(role);
  return rank < 0 ? EXECUTIVE_ROLES.length : rank;
}

/**
 * The people of one group in the order the dashboard and the public page
 * list them: the Executive board by role (President first, review 2), every
 * other group by the order the board dragged it into; then by name.
 * Declared mirror of the `public_team()` order.
 */
export function inGroupOrder<
  T extends { position: number; role_title: string; full_name: string },
>(kind: Section["kind"], people: readonly T[]): T[] {
  return [...people].sort(
    (a, b) =>
      roleRank(kind, a.role_title) - roleRank(kind, b.role_title) ||
      a.position - b.position ||
      a.full_name.localeCompare(b.full_name),
  );
}

/**
 * Declared mirror of `public.public_team_list()`: the Executive board
 * always, everyone else only when marked "Show on public page", in current
 * groups, each group in `inGroupOrder`; a photo only for the Executive board.
 */
export function publicTeamRows(
  sections: readonly (Section & Archivable)[],
  people: readonly (Person & Archivable)[],
): TeamRow[] {
  const current = [...sections]
    .filter((section) => !section.archived_at)
    .sort(byOrder((section) => section.name));
  return current.flatMap((section) => {
    const executive = section.kind === "executive";
    return inGroupOrder(
      section.kind,
      people.filter(
        (person) =>
          person.section_id === section.id &&
          listedPublicly(person, executive ? section.id : null),
      ),
    ).map((person) => ({
      section_id: section.id,
      section_name: section.name,
      section_kind: section.kind,
      section_position: section.position,
      person_id: person.id,
      full_name: person.full_name,
      role_title: person.role_title,
      position: person.position,
      photo_path: shownPhoto(person, executive ? section.id : null) || null,
    }));
  });
}
