import { getRecords } from "@/lib/community/queries";

import { NoticeStrip } from "./NoticeStrip";

/** The featured announcement on Home, as a hairline strip under the hero. */
export async function HomeNotice() {
  const { records } = await getRecords("announcements");
  const notice = records.find((record) => record.featured);
  return notice ? <NoticeStrip notice={notice} /> : null;
}
