import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "@/features/admin/actions";
import { ShowMeHow } from "@/features/admin/tour/ShowMeHow";
import type { TourId } from "@/features/admin/tour/steps";
import { NotificationBell } from "./notifications/NotificationBell";

/** A page above the current one in the breadcrumb trail. */
export type AdminCrumb = { label: string; href: string };

/**
 * The dashboard page header. Every page below the dashboard shows a breadcrumb
 * trail (Dashboard › section › this page) whose links open the real parent
 * pages, never the browser history, so it is right after a save or an email
 * link too. A page with a tour shows "Show me how" beside Sign out (PR4
 * D-10). Every page has the notifications bell (review fixes P1, item 5),
 * read in its own Suspense so the page never waits for it.
 */
export function AdminHeader({
  title,
  current = title,
  parents = [],
  home = false,
  tour,
}: {
  title: string;
  /** This page's name in the trail, when shorter than the title. */
  current?: string;
  /** Pages between the dashboard and this one, outermost first. */
  parents?: AdminCrumb[];
  /** The dashboard itself: no trail. */
  home?: boolean;
  /** This page's "Show me how" tour. */
  tour?: TourId;
}) {
  const trail = [{ label: "Dashboard", href: "/admin/dashboard" }, ...parents];
  return (
    <header className="admin-header">
      <div>
        {home ? null : (
          <nav aria-label="Breadcrumb">
            <ol className="admin-breadcrumb">
              {trail.map((crumb) => (
                <li key={crumb.href}>
                  <Link href={crumb.href} className="text-link">
                    {crumb.label}
                  </Link>
                </li>
              ))}
              <li aria-current="page">{current}</li>
            </ol>
          </nav>
        )}
        <h1>{title}</h1>
      </div>
      <div className="admin-header-actions">
        <Suspense fallback={null}>
          <NotificationBell />
        </Suspense>
        {tour ? <ShowMeHow tour={tour} /> : null}
        <form action={signOutAction}>
          <button className="button-secondary">Sign out</button>
        </form>
      </div>
    </header>
  );
}
