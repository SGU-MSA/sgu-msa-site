import { FEE_LINE, INTENTION_LINE } from "@/lib/community/payment-policy";
import type { DonateGroup } from "@/lib/community/payments";
import { Container } from "@/shared/ui/Container";

import { DonateSlips } from "../donate/DonateSlips";
import s from "./season.module.css";

/**
 * The funds tied to the season that are open now (PR6 `season_id`, never
 * copied), as the Donate page's slips: the intention line and the Go2Pay
 * notice above them (review fixes P4). Nothing is drawn while none is open.
 */
export function SeasonFunds({
  name,
  groups,
  className,
}: {
  name: string;
  groups: readonly DonateGroup[];
  className?: string;
}) {
  if (!groups.length) return null;
  return (
    <Container
      as="section"
      id="support"
      className={className ? `${s.month} ${className}` : s.month}
      aria-labelledby="season-support"
    >
      <h2 id="season-support" className={s.h2}>
        Support {name}
      </h2>
      <p className={s.body}>{INTENTION_LINE}</p>
      <p className={s.fine}>{FEE_LINE}</p>
      <div className={s.funds}>
        <DonateSlips groups={groups} />
      </div>
    </Container>
  );
}
