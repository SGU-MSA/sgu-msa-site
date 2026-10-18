import type { Reminder } from "@/lib/content/schemas";
import { ArabicLine } from "@/shared/ui/ArabicLine";
import { MeaningTip } from "@/shared/ui/MeaningTip";

import h from "./home.module.css";

/** The one large verse on Home (the board's pick), set level and centred, with its "?" meaning. */
export function VerseBand({ verse }: { verse: Reminder }) {
  return (
    <section aria-label="Verse" className={h.verse}>
      <ArabicLine as="p" text={verse.arabic} className={h.verseArabic} />
      <div className={h.verseTip}>
        <MeaningTip reminder={verse} />
      </div>
    </section>
  );
}
