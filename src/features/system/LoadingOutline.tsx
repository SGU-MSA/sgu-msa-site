import { Container } from "@/shared/ui/Container";

import s from "./system.module.css";

/**
 * The loading page, "Ledger" (PR8 D-7): the status line, then the outline
 * of a Quiet Paper page (title, italic line, ruled rows) in quiet bars that
 * breathe, still with reduced motion. Server-rendered CSS only, no client
 * JavaScript. The wording is the page's, unchanged.
 */
export function LoadingOutline() {
  return (
    <div className={s.page}>
      <Container className={s.skeleton}>
        <div role="status" className={s.status}>
          <p className={s.eyebrow}>SGU MSA</p>
          <p className={s.body}>Loading the latest information…</p>
        </div>
        <div aria-hidden="true" className={s.outline}>
          <span className={`${s.bar} ${s.barDisplay}`} />
          <span className={`${s.bar} ${s.barSub}`} />
          <div className={s.rows}>
            {[0, 1, 2].map((row) => (
              <div key={row} className={s.row}>
                <span className={`${s.bar} ${s.barTitle}`} />
                <div>
                  <span className={`${s.bar} ${s.barLine}`} />
                  <span className={`${s.bar} ${s.barLine}`} />
                  <span className={`${s.bar} ${s.barShort}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
