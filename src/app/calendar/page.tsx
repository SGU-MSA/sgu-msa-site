import type { Metadata } from "next";

import { CalendarBody } from "@/features/calendar/CalendarBody";
import { calendarEntries } from "@/features/calendar/entries";
import quiet from "@/shared/ui/page.module.css";
import { managedEvents } from "@/lib/community/managed";
import { placedReminder } from "@/lib/content";

export const metadata: Metadata = {
  alternates: { canonical: "/calendar" },
  title: "Calendar",
  description:
    "MSA programming alongside the SGU dates students ask about most.",
};

export default async function CalendarPage() {
  const [content, verse] = await Promise.all([
    managedEvents(),
    placedReminder("events"),
  ]);

  return (
    <div className={quiet.page}>
      <CalendarBody
        content={content}
        entries={calendarEntries(content.events)}
        lists={content.lists}
        today={content.today}
        unavailable={content.unavailable}
        verse={verse}
      />
    </div>
  );
}
