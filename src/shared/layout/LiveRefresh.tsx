"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
export function LiveRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (
      ![
        "/",
        "/prayer",
        "/calendar",
        "/community",
        "/ramadan",
        "/resources",
      ].includes(pathname)
    )
      return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname, router]);
  return null;
}
