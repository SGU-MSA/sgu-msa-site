import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsavedChangesGuard } from "@/features/admin/form-check/UnsavedChangesGuard";
import { SavedToast } from "@/features/admin/save-state/SavedToast";
import { signOutAction } from "@/features/admin/actions";
import { NotificationBell } from "@/features/admin/notifications/NotificationBell";
import { AdminFrame } from "@/features/admin/shell/AdminFrame";
import { adminNavGroups } from "@/features/admin/shell/sections";
import { currentAdmin } from "@/lib/backend/server";
export const metadata: Metadata = {
  title: "Board portal",
  robots: { index: false, follow: false },
};
/**
 * The dashboard reads the signed-in board member and fresh data on every
 * request, so its pages may wait for the server (Cache Components: no
 * static shell is required here). Nothing under /admin is cached.
 */
export const instant = false;
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await currentAdmin();
  return (
    <>
      {admin ? (
        <AdminFrame
          groups={adminNavGroups(admin)}
          bell={
            <Suspense fallback={null}>
              <NotificationBell />
            </Suspense>
          }
          signOut={
            <form action={signOutAction}>
              <button className="button-secondary">Sign out</button>
            </form>
          }
        >
          {children}
        </AdminFrame>
      ) : (
        children
      )}
      {/* Asks before a page with unsaved changes is left (review 2). */}
      <Suspense fallback={null}>
        <UnsavedChangesGuard />
      </Suspense>
      {/* "Saved", for a few seconds after every save (review fixes P1). */}
      <Suspense fallback={null}>
        <SavedToast />
      </Suspense>
    </>
  );
}
