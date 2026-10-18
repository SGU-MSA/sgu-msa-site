import "server-only";
import { currentAdmin } from "@/lib/backend/server";
import type { PageTextKey } from "@/lib/content/documents";
import { showingPages, type LayoutKey } from "@/lib/content/page-layouts";
import { contentEditor } from "@/lib/runtime/providers";
import { sessionExpired, systemText } from "@/lib/system-text";

/**
 * Why the signed-in person cannot change pages, or null when they can
 * (review 3 B): only the Executive board edits Pages. Every Pages action
 * asks first; the database (`can_edit_pages()`) stays the authority.
 */
export async function pageEditorRefusal(): Promise<string | null> {
  const admin = await currentAdmin();
  if (!admin) return sessionExpired;
  return admin.canEditPages ? null : systemText.pageSections.executiveOnly;
}

/**
 * The stored text of the other pages that show, hide and move sections of
 * `key` (Prayer & Musallah for Musallah directions; Home for the FAQ), by
 * document. A page that cannot be read is left out: its sections count as
 * shown.
 */
export async function layoutOwners(
  key: PageTextKey,
): Promise<Partial<Record<LayoutKey, unknown>>> {
  const read = await Promise.all(
    showingPages(key).map(
      async (owner) =>
        [owner, (await contentEditor().readPageText(owner))?.document] as const,
    ),
  );
  return Object.fromEntries(
    read.filter(([, document]) => document !== undefined),
  );
}
