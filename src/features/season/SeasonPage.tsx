import quiet from "@/shared/ui/page.module.css";
import { TasbihThread, tasbihThreadHost } from "@/shared/ui/TasbihThread";

import type { SeasonPageData } from "./load";
import { SeasonBody } from "./SeasonBody";

/** A season's page around its body: the paper and the tasbih thread. */
export function SeasonPage({ data }: { data: SeasonPageData }) {
  return (
    <div className={`${tasbihThreadHost} ${quiet.page}`}>
      <TasbihThread />
      <SeasonBody data={data} />
    </div>
  );
}
