"use server";
import { publicDataChanged } from "./public-refresh";
import { z } from "@/lib/validation/zod";
import { currentAdmin } from "@/lib/backend/server";
import { orderedLists, savedOrderSchema } from "@/lib/community/order";
import { orderEditor } from "@/lib/runtime/providers";
import {
  outOfDate,
  sessionExpired,
  staleScreen,
  systemText,
  unavailableMessage,
} from "@/lib/system-text";
import type { EditorState } from "./actions";
import { refuse } from "./fields";

/** The posted order: JSON `[{ id, version }, …]`, top to bottom. */
function postedOrder(form: FormData) {
  try {
    return savedOrderSchema.safeParse(
      JSON.parse(String(form.get("order") ?? "")),
    );
  } catch {
    return null;
  }
}

/**
 * "Save order" (review fixes PR-2): any board member saves the order of a
 * dragged list in one step (People in a group and groups, PR3 D-7, D-8;
 * hand-over steps, PR5a D-5; funds and tickets, PR6 D-65; merch
 * collections, items and sizes, PR5c D-27 b). The database
 * decides (RLS, the versions, archived rows) and logs every moved row. The
 * screen stays where it is and shows the new order.
 */
export async function saveOrderAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const list = z.enum(orderedLists).safeParse(form.get("list"));
  const order = postedOrder(form);
  if (!list.success || !order?.success) return refuse(outOfDate);
  const saved = await orderEditor().saveOrder(list.data, order.data);
  if (!saved.ok)
    return refuse(
      saved.reason === "conflict"
        ? staleScreen
        : unavailableMessage("save the order"),
    );
  publicDataChanged();
  return { error: null, notice: systemText.order.saved };
}
