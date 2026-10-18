import Link from "next/link";

import type { Reminder } from "@/lib/content/schemas";
import { Container } from "@/shared/ui/Container";
import { MarginNote } from "@/shared/ui/MarginNote";

import h from "./home.module.css";
import s from "@/shared/ui/page.module.css";

/**
 * The Donate band on Home (inverted ink), with its verse. The button always opens
 * /donate, whose slips open Go2Pay (PR6 D-41); while the Donate page shows no
 * funds, the band says giving details are being finalized.
 */
export function GiveBand({
  givingOpen,
  verse,
}: {
  /** The Donate page shows funds now. */
  givingOpen: boolean;
  verse?: Reminder | null;
}) {
  return (
    <section
      id="give"
      className={`${s.ink} ${h.give}`}
      aria-labelledby="give-title"
    >
      <Container className={h.giveInner}>
        <div className={h.giveCopy}>
          <h2 id="give-title" className={s.h2}>
            Support our community
          </h2>
          <p className={h.giveText}>
            Thank you for wanting to support Muslim student life at SGU.
            {givingOpen ? "" : " Giving details are being finalized."}
          </p>
          {verse ? <MarginNote reminder={verse} /> : null}
        </div>
        <Link href="/donate" className={h.button}>
          Donate
        </Link>
      </Container>
    </section>
  );
}
