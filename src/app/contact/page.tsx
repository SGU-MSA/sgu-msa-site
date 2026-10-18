import { ContactCallingCard } from "@/features/contact/ContactCallingCard";
import quiet from "@/shared/ui/page.module.css";
import { LocationMap } from "@/features/prayer/LocationMap";
import { getContact, getSite } from "@/lib/content";
import { PaperLayers } from "@/shared/ui/PaperLayers";
import { TasbihThread, tasbihThreadHost } from "@/shared/ui/TasbihThread";

export const metadata = {
  alternates: { canonical: "/contact" },
  title: "Contact & visit",
  description: "Contact the SGU MSA and find directions to the Musallah.",
};
export default async function ContactPage() {
  const [content, site] = await Promise.all([getContact(), getSite()]);
  return (
    <div className={`${tasbihThreadHost} ${quiet.page}`}>
      <PaperLayers />
      <TasbihThread />
      <ContactCallingCard
        content={content}
        email={site.brand.email}
        social={site.social}
        map={<LocationMap />}
      />
    </div>
  );
}
