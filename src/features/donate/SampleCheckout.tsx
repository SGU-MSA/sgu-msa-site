"use client";
import { useActionState } from "react";

import { payOnSampleCheckout } from "./checkout-action";

/** The sandbox checkout's form (sample data only): an amount, a note, Pay. */
export function SampleCheckoutForm({ productId }: { productId: number }) {
  const [state, action, pending] = useActionState(payOnSampleCheckout, {
    error: null,
  });
  return (
    <form action={action} className="editor-form">
      {state.error ? (
        <p role="alert" className="error-message">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="productId" value={productId} />
      <label>
        Amount (US$)
        <input
          name="amount"
          type="number"
          min="0.01"
          max="2500"
          step="0.01"
          required
          defaultValue="10"
        />
      </label>
      <label>
        Note for Vendor (optional)
        <textarea name="note" maxLength={500} rows={2} />
      </label>
      <div>
        <button className="button-primary" disabled={pending}>
          {pending ? "Paying…" : "Pay"}
        </button>
      </div>
    </form>
  );
}
