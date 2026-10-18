"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { parseGo2PayLink, productLabel } from "@/lib/community/payment-policy";
import { FieldError } from "./form-check/FieldError";
import { linkWords, tooLong } from "./payment-words";

/** One text the board copies into Go2Pay's product form, with its length. */
export type CopyRow = {
  key: string;
  label: string;
  text: string;
  limit: number;
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button-secondary giving-copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        Copy<span className="sr-only"> {label}</span>
      </button>
      <span role="status" className="muted">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}

/**
 * The Go2Pay page box (PR6 WP-6, D-58, D-71; mockup `fund-editor`): the
 * steps to make the product by hand, the texts to copy into it (worked out
 * from the form by `go2payCopyText`, so a zakat rule line is written once),
 * and the link box with what it opens and the item's earlier links. Go2Pay
 * is never called: the board makes, edits and closes the product there.
 */
export function Go2PayBox({
  steps,
  rows,
  link,
  current,
  earlier,
  itemName,
  receiptMissing = false,
  canEditPages,
}: {
  steps: ReactNode;
  rows: readonly CopyRow[];
  /** What is typed in the link box now. */
  link: string;
  current: number | null;
  /** Earlier products of this item, newest first. */
  earlier: readonly number[];
  itemName: string;
  /** No receipt note in Pages yet (PR6 D-32). */
  receiptMissing?: boolean;
  /** Whether this board member edits Pages (the Executive board, review 3 B). */
  canEditPages: boolean;
}) {
  const typed = link.trim();
  const parsed = typed ? parseGo2PayLink(typed) : null;
  return (
    <fieldset>
      <legend>Go2Pay page (you make it by hand)</legend>
      {steps}
      {receiptMissing && !canEditPages ? (
        <p className="muted">
          The receipt note has no text yet. Ask a member of the Executive board
          to add it in Pages → Go2Pay receipt note, then copy it from here.
        </p>
      ) : receiptMissing ? (
        <p className="muted">
          The receipt note has no text yet. Add it in{" "}
          <Link className="text-link" href="/admin/pages/integrations">
            Pages → Go2Pay receipt note
          </Link>
          , then copy it from here.
        </p>
      ) : null}
      <dl className="giving-copy-box">
        {rows.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd>
              <span className="giving-copy-text">{row.text || "—"}</span>
              <span
                className={row.text.length > row.limit ? "form-error" : "muted"}
              >
                {row.text.length} / {row.limit} characters
                {row.text.length > row.limit ? `. ${tooLong(row.limit)}` : ""}
              </span>
            </dd>
            <dd className="giving-copy-action">
              <CopyButton text={row.text} label={row.label} />
            </dd>
          </div>
        ))}
      </dl>
      <label>
        {linkWords.label}
        <span className="muted">{linkWords.example}</span>
        <input
          name="link"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="go2pay.gd/557"
          defaultValue={link}
          aria-describedby="go2pay-link-help"
        />
        <FieldError name="link" />
      </label>
      <div id="go2pay-link-help" aria-live="polite">
        {parsed?.ok ? (
          <p className="success-message giving-link-check">
            ✓ Opens {productLabel(parsed.id)}
            {current !== null && parsed.id !== current
              ? `. Replaces ${productLabel(current)}; the change is highlighted in Recent changes.`
              : ""}
          </p>
        ) : parsed ? null : current === null ? (
          <p className="muted">No Go2Pay page linked yet.</p>
        ) : null}
        {earlier.length ? (
          <p className="muted">
            Earlier {earlier.length === 1 ? "link" : "links"}:{" "}
            {earlier.map(productLabel).join(", ")} (
            {earlier.length === 1 ? "its" : "their"} payments still count for{" "}
            {itemName || "this"}).
          </p>
        ) : null}
        <p className="muted">{linkWords.once}</p>
      </div>
    </fieldset>
  );
}
