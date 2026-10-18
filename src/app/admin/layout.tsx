import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsavedChangesGuard } from "@/features/admin/form-check/UnsavedChangesGuard";
import { SavedToast } from "@/features/admin/save-state/SavedToast";
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
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
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
