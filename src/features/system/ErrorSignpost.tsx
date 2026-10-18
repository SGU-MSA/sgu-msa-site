"use client";

import { RotateCcw } from "lucide-react";

import { Container } from "@/shared/ui/Container";
import { Seal } from "@/shared/ui/Seal";

import s from "./system.module.css";

/**
 * The error page, "Ledger" signpost (PR8 D-7): the message on the left, the
 * one button on the right with the seal under it on wide screens. The
 * wording is the page's, unchanged. Client-only pieces; nothing server-only.
 */
export function ErrorSignpost({ reset }: { reset: () => void }) {
  return (
    <div className={s.page}>
      <Container className={s.post}>
        <div className={s.postMain}>
          <h1 className={s.h1}>Something could not be loaded</h1>
          <p className={s.body}>
            Please try again. If you were editing content, check whether it
            saved before submitting again.
          </p>
        </div>
        <div className={s.postSide}>
          <button
            type="button"
            onClick={reset}
            className={`design-button design-button-primary inline-flex min-h-11 items-center border font-semibold ${s.retry}`}
          >
            <RotateCcw aria-hidden="true" className={s.retryIcon} />
            Try again
          </button>
          <div className={s.seal}>
            <Seal size={120} />
          </div>
        </div>
      </Container>
    </div>
  );
}
