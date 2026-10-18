import type { Metadata } from "next";

import {
  CLOSED_GIVING_SIGNPOST,
  NotFoundSignpost,
} from "@/features/system/NotFoundSignpost";

export const metadata: Metadata = { title: CLOSED_GIVING_SIGNPOST.title };

/** An old or unknown Give link (PR6 D-53): "This has closed", with Donate and Home. */
export default function GiveNotFound() {
  return <NotFoundSignpost {...CLOSED_GIVING_SIGNPOST} />;
}
