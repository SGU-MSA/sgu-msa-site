import { go2payPageUrl } from "../../../community/payment-policy";
import type { PaymentGateway } from "./contract";

/**
 * No Go2Pay key on this deployment (the key setting is "off": the live site until
 * launch): Payments says the key is off; Give still sends visitors to the
 * Go2Pay page, which needs no key (D-74).
 */
export const offPaymentGateway: PaymentGateway = {
  mode: "off",
  async checkKey() {
    return { ok: false, reason: "off" };
  },
  async listOrders() {
    return { ok: false, reason: "off" };
  },
  checkoutUrl: go2payPageUrl,
};
