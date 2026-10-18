import type { Metadata } from "next";

import { AboutChapters } from "@/features/about/AboutChapters";
import quiet from "@/shared/ui/page.module.css";
import { getAbout, placedReminder } from "@/lib/content";
import { getTeam } from "@/lib/community/queries";
import { PaperLayers } from "@/shared/ui/PaperLayers";
import { TasbihThread, tasbihThreadHost } from "@/shared/ui/TasbihThread";

export const metadata: Metadata = {
  alternates: { canonical: "/about" },
  title: "About",
  description:
    "Your Muslim home away from home — the SGU Muslim Students Association.",
};

/** About, option C "Chapters" (PR8 D-7): numbered index, team as seats, the About verse under the team. */
export default async function AboutPage() {
  const [about, team, verse] = await Promise.all([
    getAbout(),
    getTeam(),
    placedReminder("about"),
  ]);

  return (
    <div className={`${tasbihThreadHost} ${quiet.page}`}>
      <PaperLayers />
      <TasbihThread />
      <AboutChapters about={about} team={team.sections} verse={verse} />
    </div>
  );
}
