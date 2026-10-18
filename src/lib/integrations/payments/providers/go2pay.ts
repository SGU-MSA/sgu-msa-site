import "server-only";
import { z } from "../../../validation/zod";
import {
  GATEWAY_TIME_BUDGET_MS,
  go2payPageUrl,
} from "../../../community/payment-policy";
import { go2payOrderSchema } from "../../../community/payments";
import type { GatewayProblem, PaymentGateway } from "./contract";

/** Go2Pay's API (https://go2pay.gd/api-docs). */
const API = "https://go2pay.gd/api/v1";

const ordersPage = z.object({
  data: z.array(z.unknown()),
  pagination: z
    .object({ page: z.coerce.number(), total_pages: z.coerce.number() })
    .partial()
    .optional(),
});

type Options = {
  /** The key from `GO2PAY_API_KEY` (only the composition point has it). */
  key: string;
  mode: "live" | "test";
  /** The live site refuses a key that can do more than take payments (D-74); elsewhere it only warns. */
  refuseBroadKey: boolean;
  /** For tests: a stand-in for `fetch`. */
  fetch?: typeof fetch;
};

/**
 * The only code that calls go2pay.gd (PR6 D-58, D-74; ADR 0019). It reads,
 * never writes: `GET /auth/me` and the `GET /products?page=1` scope probe
 * (`checkKey`), and `GET /orders` per product (`listOrders`). The key is sent
 * only in the Authorization header; errors and results never carry it or a
 * response body, and orders are parsed down to the fields Payments needs.
 */
export function createGo2PayGateway(options: Options): PaymentGateway {
  const send = options.fetch ?? fetch;
  const get = async (path: string) => {
    try {
      const response = await send(`${API}${path}`, {
        headers: {
          Authorization: `Bearer ${options.key}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(GATEWAY_TIME_BUDGET_MS),
      });
      return response;
    } catch {
      return null;
    }
  };

  let scope: ReturnType<PaymentGateway["checkKey"]> | undefined;
  const checkKey: PaymentGateway["checkKey"] = () =>
    (scope ??= (async () => {
      const me = await get("/auth/me");
      if (!me) return { ok: false, reason: "unreachable" } as const;
      if (me.status === 401 || me.status === 403)
        return { ok: false, reason: "unauthorized" } as const;
      if (!me.ok) return { ok: false, reason: "unreachable" } as const;
      // A "Take payments only" key is refused here (403); a broader key is not.
      const probe = await get("/products?page=1");
      if (!probe) return { ok: false, reason: "unreachable" } as const;
      if (probe.status === 403)
        return { ok: true, scope: "payments_only" } as const;
      if (probe.status === 401)
        return { ok: false, reason: "unauthorized" } as const;
      if (probe.ok) return { ok: true, scope: "too_broad" } as const;
      return { ok: false, reason: "unreachable" } as const;
    })());

  return {
    mode: options.mode,
    checkKey,
    async listOrders(productId, page) {
      const fail = (reason: GatewayProblem) => ({ ok: false, reason }) as const;
      if (!Number.isSafeInteger(productId) || productId <= 0)
        return fail("unreadable");
      if (options.refuseBroadKey) {
        const key = await checkKey();
        if (!key.ok) return fail(key.reason);
        if (key.scope === "too_broad") return fail("too_broad");
      }
      const query = new URLSearchParams({
        product_id: String(productId),
        page: String(Math.max(1, Math.trunc(page))),
      });
      const response = await get(`/orders?${query}`);
      if (!response) return fail("unreachable");
      if (response.status === 401 || response.status === 403)
        return fail("unauthorized");
      if (!response.ok) return fail("unreachable");
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return fail("unreadable");
      }
      const parsed = ordersPage.safeParse(body);
      if (!parsed.success) return fail("unreadable");
      const orders = [];
      for (const row of parsed.data.data) {
        const order = go2payOrderSchema.safeParse(row);
        // A missing order would hide money: the whole page counts as unreadable.
        if (!order.success || order.data.product_id !== productId)
          return fail("unreadable");
        orders.push(order.data);
      }
      const { page: current, total_pages: pages } =
        parsed.data.pagination ?? {};
      return {
        ok: true,
        orders,
        more:
          current !== undefined && pages !== undefined
            ? current < pages
            : orders.length >= 20,
      };
    },
    checkoutUrl: go2payPageUrl,
  };
}
