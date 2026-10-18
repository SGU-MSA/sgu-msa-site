import { placedReminder } from "@/lib/content";
import { loadDonatePage } from "@/lib/integrations/payments";
import { requestNow } from "@/lib/runtime/public-cache";
import { DonateLetter } from "@/features/donate/DonateLetter";
import { TasbihThread, tasbihThreadHost } from "@/shared/ui/TasbihThread";

export const metadata = {
  alternates: { canonical: "/donate" },
  title: "Donate",
  description:
    "Support the SGU MSA community through an organization-approved giving destination.",
};

/** Funds open and close by Grenada day, so the page is worked out on each visit (PR6). */
export default async function DonatePage() {
  const [data, verse] = await Promise.all([
    requestNow().then(loadDonatePage),
    placedReminder("donate"),
  ]);
  return (
    <div className={tasbihThreadHost}>
      <TasbihThread />
      <DonateLetter data={data} verse={verse} />
    </div>
  );
}
