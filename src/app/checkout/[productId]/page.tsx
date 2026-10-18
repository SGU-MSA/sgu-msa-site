import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SampleCheckoutForm } from "@/features/donate/SampleCheckout";
import { fakeCheckout } from "@/lib/runtime/providers";
import { Container } from "@/shared/ui/Container";
import quiet from "@/shared/ui/page.module.css";

/** Worked out on each visit from its address (Cache Components; review fixes PR-C). */
export const instant = false;

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

/**
 * The sandbox's stand-in for a Go2Pay page (PR6 `FakeCheckout`; sample data
 * only, a 404 everywhere else): Give lands here instead of go2pay.gd, and
 * "Pay" records an order for Payments. No card, no Go2Pay. Its words carry
 * no "sample" label, so the sandbox looks like the live site.
 */
export default async function SampleCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const checkout = fakeCheckout();
  if (!checkout) notFound();
  const [{ productId }, { paid }] = await Promise.all([params, searchParams]);
  const id = Number(productId);
  const product =
    Number.isInteger(id) && id > 0 ? await checkout.product(id) : null;
  if (!product) notFound();
  return (
    <div className={quiet.page}>
      <Container className="admin-shell narrow">
        <p className={quiet.eyebrow}>Checkout</p>
        <h1 className={quiet.display}>{product.title}</h1>
        <p>No card is asked for here and no money moves.</p>
        {paid ? (
          <p role="status" className="success-message">
            Paid. It shows in Payments.
          </p>
        ) : null}
        <SampleCheckoutForm productId={id} />
      </Container>
    </div>
  );
}
