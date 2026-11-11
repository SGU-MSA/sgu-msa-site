// Applies a staging seed plan through a minimal SQL interface, so the same code runs on a real
// `pg` connection (reset.ts) and on PGlite (tests). The caller owns the transaction.
import { RESET_TABLES, type ResetTable, type SeedStep } from "./plan";

export type Sql = {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
};

// The contract says ^[a-z_]+$; go2pay_product_id has digits, so digits are allowed after the first letter.
const identifier = /^[a-z][a-z0-9_]*$/;

function quoted(name: string) {
  if (!identifier.test(name)) throw new Error(`Unsafe name: ${name}`);
  return `"${name}"`;
}

/** Empties every reset table and inserts the plan with constraints and triggers on (E-1, E-2). */
export async function resetDatabase(
  sql: Sql,
  plan: readonly SeedStep[],
): Promise<Record<ResetTable, number>> {
  // Fails fast outside a transaction and fails instead of waiting forever for a lock.
  await sql.query("savepoint staging_reset");
  await sql.query("set local lock_timeout = '15s'");
  const who = await sql.query("select current_user as name");
  if (who.rows[0]?.name !== "postgres")
    throw new Error("The reset must run as the database owner (postgres).");

  // Only the activity trigger of each table and the log's add-only guard are switched off.
  const activity = await sql.query(
    `select c.relname as table_name from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and t.tgname = 'activity' and not t.tgisinternal`,
  );
  const withActivity = new Set(activity.rows.map((r) => String(r.table_name)));
  const disabled: { table: string; trigger: string }[] = [
    { table: "activity_log", trigger: "add_only" },
    ...RESET_TABLES.filter((table) => withActivity.has(table)).map((table) => ({
      table,
      trigger: "activity",
    })),
  ];
  for (const { table, trigger } of disabled)
    await sql.query(
      `alter table public.${quoted(table)} disable trigger ${quoted(trigger)}`,
    );

  await sql.query(
    `truncate table ${RESET_TABLES.map((table) => `public.${quoted(table)}`).join(", ")} restart identity`,
  );

  for (const { table, rows } of plan) {
    if (!RESET_TABLES.includes(table) || rows.length === 0) continue;
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const list = columns.map(quoted).join(", ");
    await sql.query(
      `insert into public.${quoted(table)} (${list}) select ${list} from jsonb_populate_recordset(null::public.${quoted(table)}, $1::jsonb)`,
      [JSON.stringify(rows)],
    );
  }

  for (const { table, trigger } of disabled)
    await sql.query(
      `alter table public.${quoted(table)} enable trigger ${quoted(trigger)}`,
    );
  const check = await sql.query(
    `select c.relname as table_name, t.tgname as trigger_name, t.tgenabled as state from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and not t.tgisinternal and t.tgenabled <> 'O'`,
  );
  const stillOff = check.rows.some((row) =>
    disabled.some(
      ({ table, trigger }) =>
        row.table_name === table && row.trigger_name === trigger,
    ),
  );
  if (stillOff) throw new Error("A trigger is still disabled after the reset.");

  const counts = {} as Record<ResetTable, number>;
  for (const table of RESET_TABLES) {
    const result = await sql.query(
      `select count(*)::int as n from public.${quoted(table)}`,
    );
    counts[table] = Number(result.rows[0].n);
  }
  return counts;
}
