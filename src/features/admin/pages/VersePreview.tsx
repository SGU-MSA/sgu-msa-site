import { verseReminder } from "@/lib/content/reminders";
import type { QuranVerse } from "@/lib/quran/verse";
import { MarginNote } from "@/shared/ui/MarginNote";

/**
 * A verse as a margin note at the narrowest place it shows (18rem, the
 * margin note beside a page heading, `MARGIN_NOTE`), for the "Verse on each
 * page" preview. Every library verse fits one line there (Review 3 E).
 */
export function VersePreview({ verse }: { verse: QuranVerse }) {
  return (
    <div className="verse-preview-note">
      <MarginNote reminder={verseReminder(verse)} />
    </div>
  );
}
