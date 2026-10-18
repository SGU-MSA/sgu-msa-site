import "server-only";
import { currentLinks } from "../../../community/payments";
import { TIMEZONE } from "../../../community/schema";
import { sandboxStore } from "../../../demo/store";
import type { FakeCheckout, PaymentGateway } from "./contract";

/** Go2Pay's page size. */
const PAGE_SIZE = 20;

/**
 * The sandbox's Go2Pay (sample data only; `planWiring` never picks it in
 * production): orders come from the in-memory store, newest first, 20 per
 * page like Go2Pay; Give goes to the sandbox checkout, never to go2pay.gd.
 */
export function createFakeGateway(seed: Date): PaymentGateway {
  const instant = new Date(seed);
  return {
    mode: "sample",
    async checkKey() {
      return { ok: true, scope: "payments_only" };
    },
    async listOrders(productId, page) {
      const orders = sandboxStore(instant)
        .orders.filter((order) => order.product_id === productId)
        .sort((a, b) => b.created.localeCompare(a.created) || b.id - a.id);
      const start = (Math.max(1, page) - 1) * PAGE_SIZE;
      return {
        ok: true,
        orders: orders
          .slice(start, start + PAGE_SIZE)
          .map((order) => ({ ...order })),
        more: start + PAGE_SIZE < orders.length,
      };
    },
    checkoutUrl: (productId) => `/checkout/${productId}`,
  };
}

/**
 * The sandbox checkout (sample data only): "paying" adds a PAID order from
 * "Guest Giver" in Grenada time (shown like a live order), which Payments then shows.
 */
export function createFakeCheckout(seed: Date): FakeCheckout {
  const instant = new Date(seed);
  const store = () => sandboxStore(instant);
  const itemOf = (productId: number) => {
    const link = store().paymentLinks.find(
      (l) => l.go2pay_product_id === productId,
    );
    const item = link && store().paymentItems.get(link.payment_item_id);
    return item ?? null;
  };
  return {
    async product(productId) {
      const item = itemOf(productId);
      return item ? { title: item.name, kind: item.kind } : null;
    },
    async pay({ productId, amount, note }) {
      const item = itemOf(productId);
      if (!item || !Number.isInteger(amount) || amount <= 0) return false;
      // Only a product that is still an item's current link takes payments.
      if (
        currentLinks(store().paymentLinks).get(item.id)?.go2pay_product_id !==
        productId
      )
        return false;
      const orders = store().orders;
      const grenada = new Intl.DateTimeFormat("sv-SE", {
        timeZone: TIMEZONE,
        dateStyle: "short",
        timeStyle: "medium",
      }).format(instant);
      orders.push({
        id: Math.max(7000, ...orders.map((order) => order.id)) + 1,
        product_id: productId,
        first_name: "Guest",
        last_name: "Giver",
        qty: 1,
        subtotal: amount,
        customer_total: Math.round(amount * 1.039 + 30),
        refunded: 0,
        status: "PAID",
        note: note.trim().slice(0, 500),
        created: grenada,
        test_mode: false,
      });
      return true;
    },
  };
}
