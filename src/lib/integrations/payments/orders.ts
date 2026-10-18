import {
  GATEWAY_TIME_BUDGET_MS,
  MAX_ORDER_PAGES_PER_PRODUCT,
  orderDay,
} from "../../community/payment-policy";
import type { Go2PayOrder } from "../../community/payments";
import type { GatewayProblem, PaymentGateway } from "./providers/contract";

/**
 * The orders of some Go2Pay products between two Grenada days (PR6 D-74):
 * Go2Pay has no date filter, so each product's orders are paged newest
 * first until a page reaches back before `from`, within one time budget for
 * the whole read and at most `MAX_ORDER_PAGES_PER_PRODUCT` pages each.
 * Products are read side by side. Any refused or unreadable page fails the
 * whole read (a missing order would hide money); running out of time or
 * pages marks it `partial`. Nothing is stored, cached or logged.
 */
export async function collectOrders(input: {
  gateway: Pick<PaymentGateway, "listOrders">;
  productIds: readonly number[];
  from: string;
  until: string;
  /** Milliseconds; the server clock in production code, a stub in tests. */
  elapsed: () => number;
  budgetMs?: number;
}): Promise<
  | { ok: true; orders: Go2PayOrder[]; partial: boolean }
  | { ok: false; reason: GatewayProblem }
> {
  const budget = input.budgetMs ?? GATEWAY_TIME_BUDGET_MS;
  const started = input.elapsed();
  const late = () => input.elapsed() - started > budget;
  const products = [...new Set(input.productIds)];
  const results = await Promise.all(
    products.map(async (productId) => {
      const orders: Go2PayOrder[] = [];
      for (let page = 1; ; page++) {
        if (page > MAX_ORDER_PAGES_PER_PRODUCT || late())
          return { ok: true as const, orders, partial: true };
        const read = await input.gateway.listOrders(productId, page);
        if (!read.ok) return read;
        orders.push(...read.orders);
        const oldest = read.orders.at(-1);
        if (!read.more || !oldest || orderDay(oldest.created) < input.from)
          return { ok: true as const, orders, partial: false };
      }
    }),
  );
  const failed = results.find((result) => !result.ok);
  if (failed && !failed.ok) return failed;
  const orders: Go2PayOrder[] = [];
  let partial = false;
  for (const result of results)
    if (result.ok) {
      partial ||= result.partial;
      orders.push(
        ...result.orders.filter((order) => {
          const day = orderDay(order.created);
          return input.from <= day && day <= input.until;
        }),
      );
    }
  return { ok: true, orders, partial };
}
