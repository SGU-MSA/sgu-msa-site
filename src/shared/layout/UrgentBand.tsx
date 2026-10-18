"use client";
import { usePathname } from "next/navigation";

import {
  UrgentNoticeRotator,
  type UrgentNotice,
} from "@/shared/ui/UrgentNoticeRotator";

/**
 * The urgent band on every public page (PR5a D-1), not on the dashboard.
 * Keyed by the page: each page starts at the newest notice and moves by
 * itself again until the visitor takes control on that page (D-30).
 */
export function UrgentBand({ notices }: { notices: readonly UrgentNotice[] }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <UrgentNoticeRotator key={pathname} notices={notices} />;
}
