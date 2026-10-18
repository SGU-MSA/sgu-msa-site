import type { Metadata } from "next";

import quiet from "@/shared/ui/page.module.css";
import { LocationMap } from "@/features/prayer/LocationMap";
import { PrayerBody } from "@/features/prayer/PrayerBody";
import { prayerTodayView } from "@/features/prayer/load";
import { managedPrayer } from "@/lib/community/managed";
import { getForms, getMusallah, placedReminder } from "@/lib/content";
import { requestNow } from "@/lib/runtime/public-cache";
import { PaperLayers } from "@/shared/ui/PaperLayers";
import { TasbihThread, tasbihThreadHost } from "@/shared/ui/TasbihThread";

export const metadata: Metadata = {
  alternates: { canonical: "/prayer" },
  title: "Prayer & Musallah",
  description:
    "Daily iqamah times, Jumu’ah information, and everything you need to find the SGU Musallah.",
};

export default async function PrayerPage() {
  const [managed, musallah, forms, verse] = await Promise.all([
    managedPrayer(),
    getMusallah(),
    getForms(),
    placedReminder("prayer"),
  ]);

  return (
    <div className={`${tasbihThreadHost} ${quiet.page}`}>
      <PaperLayers />
      <TasbihThread />
      <PrayerBody
        prayer={managed.prayer}
        jumuah={managed.jumuah}
        musallah={musallah}
        forms={forms}
        today={prayerTodayView(managed, await requestNow())}
        map={<LocationMap />}
        verse={verse}
      />
    </div>
  );
}
