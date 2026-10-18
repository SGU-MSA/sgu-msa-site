import type { MusallahContent } from "@/lib/content/schemas";

import p from "./prayer.module.css";

/**
 * Musallah information under a short ink rule each. Entries marked
 * `details_pending`, or without details, are not shown (review fixes P3: no
 * "to be confirmed" lines); nothing is invented here.
 */
export function MusallahFacilities({
  facilities,
}: {
  facilities: MusallahContent["facilities"];
}) {
  const shown = facilities.items.filter(
    (item) => item.status !== "details_pending" && item.detail,
  );
  if (!shown.length) return null;

  return (
    <ul className={p.facilities}>
      {shown.map((item) => (
        <li key={item.id}>
          <h3>{item.label}</h3>
          <p>{item.detail}</p>
        </li>
      ))}
    </ul>
  );
}
