import "server-only";
import type { OrderedList } from "../../community/order";
import {
  nextVersion,
  recordActivity,
  sandboxActor,
  sandboxStore,
  type SandboxStore,
} from "../../demo/store";
import type { OrderEditor } from "./contract";

type OrderedRow = {
  id: string;
  position: number;
  updated_at: string;
  archived_at: string | null;
};

/** The store's map for each list `public.save_order` accepts. */
const tables = (
  store: SandboxStore,
): Record<OrderedList, Map<string, OrderedRow>> => ({
  people: store.people,
  people_sections: store.sections,
  payment_items: store.paymentItems,
  handover_steps: store.handoverSteps,
  merch_collections: store.merchCollections,
  merch_items: store.merchItems,
  list_options: store.listOptions,
});

/**
 * Sandbox "Save order" over the in-memory store: the declared mirror of
 * `public.save_order` (every row current with the version shown, or nothing
 * changes; rows already in place keep their version) and of the log
 * triggers.
 */
export function createSampleOrderEditor(seed: Date): OrderEditor {
  const instant = new Date(seed);
  return {
    async saveOrder(list, order) {
      const sandbox = sandboxStore(instant);
      const conflict = { ok: false, reason: "conflict" } as const;
      if (!sandboxActor(sandbox)) return conflict;
      const table = tables(sandbox)[list];
      const rows = order.map(({ id, version }) => {
        const row = table.get(id);
        return row && !row.archived_at && row.updated_at === version
          ? row
          : null;
      });
      if (rows.some((row) => row === null)) return conflict;
      rows.forEach((row, index) => {
        if (!row || row.position === index + 1) return;
        const saved = {
          ...row,
          position: index + 1,
          updated_at: nextVersion(),
        };
        table.set(row.id, saved);
        recordActivity(sandbox, instant, list, row, saved);
      });
      return { ok: true };
    },
  };
}
