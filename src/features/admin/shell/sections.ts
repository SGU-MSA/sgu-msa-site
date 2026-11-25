import type { AdminIdentity } from "@/lib/backend/providers/contract";
import { collectionLabels } from "@/features/admin/fields";
import { systemText } from "@/lib/system-text";

/**
 * Prototype: the dashboard's sections for the menu, applying the same
 * permission rules as the dashboard home (Pages: Executive board; Payments:
 * money managers go to the report, others to Funds; Term export: people
 * managers).
 */
export type NavItem = {
  id: string;
  label: string;
  href: string;
  /** The current page is in this section when its path starts with this. */
  prefix: string;
};
export type NavGroup = { id: string; title: string; items: NavItem[] };

export function adminNavGroups(admin: AdminIdentity): NavGroup[] {
  const content = (key: keyof typeof collectionLabels): NavItem => ({
    id: key,
    label: collectionLabels[key],
    href: `/admin/content/${key}`,
    prefix: `/admin/content/${key}`,
  });
  const item = (
    id: string,
    label: string,
    href: string,
    prefix = href,
  ): NavItem => ({ id, label, href, prefix });
  const often = [
    content("events"),
    content("announcements"),
    content("news_posts"),
    item("prayer", "Prayer & iqamah", "/admin/prayer-times"),
  ];
  const sometimes = [
    ...(admin.canEditPages ? [item("pages", "Pages", "/admin/pages")] : []),
    item("photos", "Photos", "/admin/photos"),
    item("lists", "Lists", "/admin/lists"),
    item("seasons", "Seasons", "/admin/seasons"),
    item(
      "payments",
      "Payments",
      admin.canManageMoney ? "/admin/payments" : "/admin/payments/funds",
      "/admin/payments",
    ),
    item("merch", "Merch", "/admin/merch"),
    content("newsletters"),
  ];
  const term = [
    item("people", "People", "/admin/people"),
    item("handover", "New board term", "/admin/handover"),
    ...(admin.canManagePeople
      ? [item("term-export", systemText.termExport.title, "/admin/term-export")]
      : []),
    item("activity", "Recent changes", "/admin/activity"),
    item("help", "Help", "/admin/help"),
  ];
  return [
    { id: "often", title: "Often", items: often },
    { id: "sometimes", title: "Sometimes", items: sometimes },
    { id: "term", title: "Once a term", items: term },
  ];
}

export const isIn = (pathname: string, item: NavItem) =>
  pathname === item.prefix || pathname.startsWith(`${item.prefix}/`);

/** Pages with no menu: sign-in, forgot password, set password, email links. */
export const isPlainPage = (pathname: string) =>
  pathname === "/admin" ||
  pathname.startsWith("/admin/forgot-password") ||
  pathname.startsWith("/admin/set-password") ||
  pathname.startsWith("/admin/auth");
