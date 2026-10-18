"use client";
import { useRouter } from "next/navigation";
import { Fragment, type ReactNode } from "react";

/**
 * Next keeps the last 3 visited pages in the browser, hidden, so **Back**
 * shows them as they were (Cache Components). A board page opened by a link
 * or a redirect starts over from the saved text instead: typed text that was
 * discarded in "Leave without saving?" never comes back, and no dialog is
 * left open (review 2 PR-C; ADR 0024). `bfcacheId` changes on a link or
 * redirect to this page and stays the same for Back, Forward, a refresh after
 * Save and a change of filters in the address only.
 */
export function FreshOnLink({ children }: { children: ReactNode }) {
  const { bfcacheId } = useRouter();
  return <Fragment key={bfcacheId}>{children}</Fragment>;
}
