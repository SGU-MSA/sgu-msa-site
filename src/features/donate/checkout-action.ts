"use server";
import { redirect } from "next/navigation";
import { z } from "@/lib/validation/zod";
import { fakeCheckout } from "@/lib/runtime/providers";

export type SampleCheckoutState = { error: string | null };

const payment = z.object({
  productId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive().max(2500),
  note: z.string().max(500).default(""),
});

/**
 * "Pay" on the sandbox checkout (sample data only; `fakeCheckout()` is null
 * everywhere else): records a paid order that Payments then shows. Never reaches Go2Pay.
 */
export async function payOnSampleCheckout(
  _previous: SampleCheckoutState,
  form: FormData,
): Promise<SampleCheckoutState> {
  const checkout = fakeCheckout();
  if (!checkout) return { error: "This checkout is off here." };
  const parsed = payment.safeParse({
    productId: form.get("productId"),
    amount: form.get("amount"),
    note: form.get("note") ?? "",
  });
  if (!parsed.success)
    return { error: "Amount: type an amount from 0.01 to 2500." };
  const { productId, amount, note } = parsed.data;
  const paid = await checkout.pay({
    productId,
    amount: Math.round(amount * 100),
    note,
  });
  if (!paid) return { error: "This product no longer takes payments." };
  redirect(`/checkout/${productId}?paid=1`);
}
