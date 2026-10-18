import type { Metadata } from "next";

import { GetInvolvedBody } from "@/features/involve/GetInvolvedBody";
import quiet from "@/shared/ui/page.module.css";
import { getForms, getGetInvolved, placedReminder } from "@/lib/content";
import { PaperLayers } from "@/shared/ui/PaperLayers";
import { TasbihThread, tasbihThreadHost } from "@/shared/ui/TasbihThread";

export const metadata: Metadata = {
  alternates: { canonical: "/get-involved" },
  title: "Get Involved",
  description:
    "Every part of the MSA is run by students. These are the ways in.",
};

export default async function GetInvolvedPage() {
  const [content, forms, verse] = await Promise.all([
    getGetInvolved(),
    getForms(),
    placedReminder("get_involved"),
  ]);

  return (
    <div className={`${tasbihThreadHost} ${quiet.page}`}>
      <PaperLayers />
      <TasbihThread />
      <GetInvolvedBody content={content} forms={forms} verse={verse} />
    </div>
  );
}
