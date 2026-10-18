import "server-only";
import {
  currentLinks,
  paymentItemSchema,
  type PaymentItemLink,
} from "../../community/payments";
import {
  nextVersion,
  recordActivity,
  sandboxActor,
  sandboxStore,
} from "../../demo/store";
import type {
  ListView,
  PaymentItemEditor,
  VersionedPaymentItem,
  WriteResult,
} from "./contract";

/**
 * Sandbox funds, priced items and Go2Pay links over the in-memory store (PR6
 * WP-4). It applies the declared mirrors of the database rules: admins only,
 * the `updated_at` check, archived rows read-only until restored, slugs that
 * never change or repeat, the category lock (`fund_category_lock`), one item
 * per product ever, add-only links, no delete; and appends activity as the
 * trigger does.
 */
const conflict = { ok: false, reason: "conflict" } as const;
const ok: WriteResult = { ok: true };

const inView = (row: { archived_at: string | null }, view: ListView) =>
  Boolean(row.archived_at) === (view === "archived");
const byOrder = (a: VersionedPaymentItem, b: VersionedPaymentItem) =>
  a.position - b.position || a.name.localeCompare(b.name);

export function createSamplePaymentItemEditor(seed: Date): PaymentItemEditor {
  const instant = new Date(seed);
  const store = () => sandboxStore(instant);
  const linksOf = (ids: ReadonlySet<string>) =>
    store()
      .paymentLinks.filter((link) => ids.has(link.payment_item_id))
      .map((link) => ({ ...link }))
      .sort((a, b) => Date.parse(b.added_at) - Date.parse(a.added_at));

  const setArchived = (id: string, version: string, archive: boolean) => {
    const sandbox = store();
    const existing = sandbox.paymentItems.get(id);
    if (
      !sandboxActor(sandbox) ||
      existing?.updated_at !== version ||
      Boolean(existing.archived_at) === archive
    )
      return conflict;
    const saved = {
      ...existing,
      archived_at: archive ? instant.toISOString() : null,
      updated_at: nextVersion(),
    };
    sandbox.paymentItems.set(id, saved);
    recordActivity(sandbox, instant, "payment_items", existing, saved);
    return ok;
  };

  return {
    async listItems(view = "current") {
      const items = [...store().paymentItems.values()]
        .filter((row) => inView(row, view))
        .sort(byOrder)
        .map((row) => structuredClone(row));
      return {
        items,
        links: linksOf(new Set(items.map((item) => item.id))),
        unavailable: false,
      };
    },
    async readItem(id) {
      const item = store().paymentItems.get(id);
      return {
        item: item ? structuredClone(item) : null,
        links: item ? linksOf(new Set([id])) : [],
        unavailable: false,
      };
    },
    async saveItem(row, version, link) {
      const sandbox = store();
      if (!sandboxActor(sandbox))
        return version === null ? { ok: false, reason: "forbidden" } : conflict;
      // The database checks.
      const parsed = paymentItemSchema.safeParse(row);
      if (!parsed.success) return { ok: false, reason: "unavailable" };
      const existing = sandbox.paymentItems.get(row.id);
      if (
        version === null
          ? existing
          : existing?.updated_at !== version || existing.archived_at
      )
        return conflict;
      // D-17: one item per Go2Pay product, ever; re-pasting the current link is no change.
      const owner =
        link === null
          ? undefined
          : sandbox.paymentLinks.find((l) => l.go2pay_product_id === link);
      const current = currentLinks(sandbox.paymentLinks).get(row.id);
      if (owner && owner.payment_item_id !== row.id)
        return { ok: false, reason: "link_taken" };
      if (owner && current?.go2pay_product_id !== link)
        return { ok: false, reason: "link_used_before" };
      if (existing) {
        // `fund_category_lock`: the slug never changes; a shown fund's category and kind are locked.
        if (parsed.data.slug !== existing.slug)
          return { ok: false, reason: "fund_locked" };
        if (
          existing.first_shown_at &&
          (parsed.data.category !== existing.category ||
            parsed.data.kind !== existing.kind)
        )
          return { ok: false, reason: "fund_locked" };
      } else if (
        [...sandbox.paymentItems.values()].some(
          (item) => item.slug === parsed.data.slug,
        )
      )
        return { ok: false, reason: "slug_taken" };
      const lockedAt = existing?.first_shown_at ?? null;
      const saved: VersionedPaymentItem = {
        ...structuredClone(parsed.data),
        first_shown_at:
          lockedAt ??
          (parsed.data.kind === "fund" && parsed.data.listed
            ? instant.toISOString()
            : null),
        archived_at: null,
        updated_at: nextVersion(),
      };
      sandbox.paymentItems.set(row.id, saved);
      recordActivity(
        sandbox,
        instant,
        "payment_items",
        existing ?? null,
        saved,
      );
      if (link !== null && !owner) {
        // The sandbox clock is frozen: each new link is a millisecond after the item's newest.
        const newest = Math.max(
          instant.getTime(),
          ...sandbox.paymentLinks
            .filter((l) => l.payment_item_id === row.id)
            .map((l) => Date.parse(l.added_at) + 1),
        );
        const added: PaymentItemLink = {
          go2pay_product_id: link,
          payment_item_id: row.id,
          added_at: new Date(newest).toISOString(),
        };
        sandbox.paymentLinks.push(added);
        recordActivity(sandbox, instant, "payment_item_links", null, added);
      }
      return ok;
    },
    archiveItem: async (id, version) => setArchived(id, version, true),
    restoreItem: async (id, version) => setArchived(id, version, false),
  };
}
