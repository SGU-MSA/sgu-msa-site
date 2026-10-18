import type { RuntimeConfig } from "./config";

/** Which adapter each port uses. Pure: decided from configuration only (ADR 0012). */
export type Wiring = {
  clock: "system" | { fixed: Date };
  content: "supabase" | "sample";
  /** Page text (PR5b): Supabase on the live site, the starter YAML plus sandbox edits with sample data. */
  editorial: "supabase" | "sample";
  /** Funds, priced items, their Go2Pay links: public reads and board writes (PR6). */
  payments: "supabase" | "sample";
  /** Seasons: board writes (PR6). */
  seasons: "supabase" | "sample";
  /** The board's musallah pin (PR7): the database, or the sandbox store. */
  places: "supabase" | "sample";
  editor: "supabase" | "sample";
  auth: "supabase" | "sample";
  people: "supabase" | "sample";
  activity: "supabase" | "sample";
  /** New board term: hand-over steps and shared-login holders (PR5a). */
  handover: "supabase" | "sample";
  /** "Save order" on the board's dragged lists (review fixes PR-2). */
  order: "supabase" | "sample";
  /** Production: "supabase" only. "off" only with `SUPABASE_SECRET_KEY=off` on a developer's computer. */
  inviter: "supabase" | "sample" | "off";
  /**
   * The Go2Pay API (PR6). "go2pay" when `go2pay` is "test" or "live", "off"
   * when it is "off"; "fake" (sample orders and the sandbox checkout) with
   * sample data, never in production.
   */
  gateway: "go2pay" | "fake" | "off";
  /**
   * Daily-check warning emails (daily-check contract WP-1). "gmail" only in
   * production with the Gmail settings; "off" in production while both are
   * "off" (D-17); "sample" records them in the sandbox; "off" everywhere
   * else, even with real Gmail values.
   */
  mailer: "gmail" | "sample" | "off";
  /**
   * What the daily check already emailed. "supabase" needs the secret key
   * (production always has it); "off" only with `SUPABASE_SECRET_KEY=off`
   * on a developer's computer, where the mailer is "off" too.
   */
  ledger: "supabase" | "sample" | "off";
};

/** Site-wide policies features read instead of asking "is this the demo?". */
export type DeploymentProfile = {
  indexable: boolean;
  measurements: boolean;
  adminPortal: "ready" | "sample";
  /**
   * The live site runs with both Gmail variables "off" (daily-check contract
   * D-17): the dashboard's Needs attention box says warning emails are off
   * until they are set.
   */
  warningEmailsOff: boolean;
};

/** Sample adapters only with sample data, and never in production (D-3). */
export function planWiring(c: RuntimeConfig): Wiring {
  if (c.data === "live") {
    if (c.production && c.invites === "off")
      throw new Error("Invite emails must be on in production.");
    if (c.production && c.dailyCheck === "off")
      throw new Error("The daily check must be on in production.");
    return {
      clock: "system",
      content: "supabase",
      editorial: "supabase",
      payments: "supabase",
      seasons: "supabase",
      places: "supabase",
      editor: "supabase",
      auth: "supabase",
      people: "supabase",
      activity: "supabase",
      handover: "supabase",
      order: "supabase",
      inviter: c.invites === "on" ? "supabase" : "off",
      gateway: c.go2pay === "off" ? "off" : "go2pay",
      mailer: c.production && c.warningMail !== "off" ? "gmail" : "off",
      ledger: c.invites === "on" ? "supabase" : "off",
    };
  }
  if (c.production)
    throw new Error("Sample data sources are never allowed in production.");
  if (!c.sampleSeed) throw new Error("Sample data needs a seed time.");
  return {
    clock: { fixed: c.sampleSeed },
    content: "sample",
    editorial: "sample",
    payments: "sample",
    seasons: "sample",
    places: "sample",
    editor: "sample",
    auth: "sample",
    people: "sample",
    activity: "sample",
    handover: "sample",
    order: "sample",
    inviter: "sample",
    gateway: "fake",
    mailer: "sample",
    ledger: "sample",
  };
}

export function deploymentProfileFor(c: RuntimeConfig): DeploymentProfile {
  const sample = c.data === "sample";
  return {
    // The sandbox looks exactly like the live site (review fixes PR-1): no
    // banner or label says it holds sample data; it is only kept out of search.
    indexable: !sample,
    // ADR 0011 and D-5: only the live production site, only when the owner chose "true".
    measurements: c.production && !sample && c.measurements,
    adminPortal: sample ? "sample" : "ready",
    warningEmailsOff: c.production && c.warningMail === "off",
  };
}
