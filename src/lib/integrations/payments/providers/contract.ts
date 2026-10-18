import type { Provenance } from "../../../community/providers/contract";
import type {
  Go2PayOrder,
  PaymentItem,
  PaymentItemLink,
} from "../../../community/payments";
import type { Season } from "../../../community/seasons";
import type { MerchCollection, MerchItem } from "../../../community/merch";

/**
 * Public reads of the giving rows (PR6): current funds and priced items,
 * the links of current items, current seasons, and (PR5c) current merch
 * collections with their current items. Adapters only read;
 * windows, visibility and wording are `payment-policy.ts`'s. No Go2Pay call.
 */
export interface PaymentsProvider {
  items(): Promise<{
    items: PaymentItem[];
    links: PaymentItemLink[];
    unavailable: boolean;
    provenance: Provenance;
  }>;
  /** A current item by its Give address, with its current link; `found` null when there is none. */
  itemBySlug(slug: string): Promise<{
    found: { item: PaymentItem; link: PaymentItemLink | null } | null;
    unavailable: boolean;
  }>;
  seasons(): Promise<{
    seasons: Season[];
    unavailable: boolean;
    provenance: Provenance;
  }>;
  /** Current collections and the current items of current collections (PR5c). */
  merch(): Promise<{
    collections: MerchCollection[];
    items: MerchItem[];
    unavailable: boolean;
  }>;
}

/** Why a Go2Pay read did not happen. Never carries the key or a response body. */
export type GatewayProblem =
  /** No Go2Pay key on this deployment (the key setting is "off"). */
  | "off"
  /** Go2Pay refused the key (wrong or revoked). */
  | "unauthorized"
  /** Go2Pay did not answer in time, or answered with an error. */
  | "unreachable"
  /** The key can do more than take payments, refused on the live site (D-74). */
  | "too_broad"
  /** Go2Pay's answer was not in the expected shape. */
  | "unreadable";

/**
 * The Go2Pay API (PR6, D-58, D-74; ADR 0019), server-only. The live site
 * uses a "Take payments only" key: it reads orders and nothing else. Only
 * the `go2pay` adapter calls go2pay.gd, and only `/auth/me`, `/orders` and
 * the `/products?page=1` scope probe. Orders are read live for money holders
 * and never stored, cached or logged (D-2).
 */
export interface PaymentGateway {
  /** Which payments this gateway reads: Go2Pay's test or live mode, the sandbox's fake orders, or none. */
  readonly mode: "live" | "test" | "sample" | "off";
  /** Whether the key works, and whether it can do more than take payments. */
  checkKey(): Promise<
    | { ok: true; scope: "payments_only" | "too_broad" }
    | { ok: false; reason: "off" | "unauthorized" | "unreachable" }
  >;
  /** One page (20, newest first) of a product's orders. */
  listOrders(
    productId: number,
    page: number,
  ): Promise<
    | { ok: true; orders: Go2PayOrder[]; more: boolean }
    | { ok: false; reason: GatewayProblem }
  >;
  /**
   * Where Give sends a visitor for a product: its Go2Pay page, or the
   * sandbox checkout. A plain address; no call is made (D-74).
   */
  checkoutUrl(productId: number): string;
}

/**
 * The sandbox's stand-in for paying on Go2Pay (sample data only, never in
 * production): records a fake paid order the fake gateway then reads.
 */
export interface FakeCheckout {
  /** The item a sample product belongs to, for the sandbox checkout page. */
  product(
    productId: number,
  ): Promise<{ title: string; kind: PaymentItem["kind"] } | null>;
  /** `amount` in cents (the gift, or price × quantity); false for an unknown product. */
  pay(input: {
    productId: number;
    amount: number;
    note: string;
  }): Promise<boolean>;
}
