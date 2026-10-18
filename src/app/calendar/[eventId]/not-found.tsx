import type { Metadata } from "next";

import { NotFoundSignpost } from "@/features/system/NotFoundSignpost";

export const metadata: Metadata = { title: "Event not found" };

/** An archived or unknown event's link (PR5a D-20): the signpost, with Events and Home. */
export default function EventNotFound() {
  return (
    <NotFoundSignpost
      title="This event is no longer listed"
      ways={[
        { label: "Events", href: "/calendar" },
        { label: "Home", href: "/" },
      ]}
    />
  );
}
