import "server-only";
import { z } from "../../validation/zod";
import { adminClient } from "../server";
import type { OrderEditor } from "./contract";
import { unavailable } from "./supabase";

/**
 * "Save order" on Supabase (review fixes PR-2): one call to
 * `public.save_order`, which changes every row or none, under the signed-in
 * board member's RLS. Versions are passed back exactly as they were read.
 */
export function createSupabaseOrderEditor(): OrderEditor {
  return {
    async saveOrder(list, order) {
      const client = await adminClient();
      if (!client) return unavailable;
      const { data, error } = await client.rpc("save_order", {
        list,
        ids: order.map((row) => row.id),
        versions: order.map((row) => row.version),
      });
      const result = z.enum(["ok", "conflict"]).safeParse(data);
      if (error || !result.success) return unavailable;
      return result.data === "ok"
        ? { ok: true }
        : { ok: false, reason: "conflict" };
    },
  };
}
