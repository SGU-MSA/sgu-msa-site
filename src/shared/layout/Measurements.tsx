"use client";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
export function Measurements() {
  const path = usePathname();
  if (path.startsWith("/admin")) return null;
  const clean = (url: string) => {
    const value = new URL(url);
    return value.origin + value.pathname;
  };
  return (
    <>
      <Analytics
        beforeSend={(event) => ({ ...event, url: clean(event.url) })}
      />
      <SpeedInsights
        beforeSend={(event) => ({ ...event, url: clean(event.url) })}
      />
    </>
  );
}
