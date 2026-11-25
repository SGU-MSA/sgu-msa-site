"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Shows the public site's header or footer everywhere except under /admin. */
export function PublicOnly({ children }: { children: ReactNode }) {
  return usePathname().startsWith("/admin") ? null : children;
}
