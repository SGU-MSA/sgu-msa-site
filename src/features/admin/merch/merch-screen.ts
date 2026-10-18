import "server-only";
import { nextPosition } from "@/lib/community/order";
import { getMerch } from "@/lib/content";
import { loadMerchPage } from "@/lib/integrations/payments";
import { merchEditor } from "@/lib/runtime/providers";
import { requestNow } from "@/lib/runtime/public-cache";
import { givingScreen } from "../payment-pages";

/**
 * What the Merch screens show (PR5c), read on the server: every collection
 * and item (current and archived), every size (priced items with a merch
 * item, with their links and windows), the public Merch page's data for the
 * Previews and its opening (page text `merch`).
 */
export async function merchScreen() {
  // Read on each visit, never while building.
  const now = await requestNow();
  const editor = merchEditor();
  const [current, archived, items, archivedItems, giving, page, preview] =
    await Promise.all([
      editor.listCollections(),
      editor.listCollections("archived"),
      editor.listItems(),
      editor.listItems("archived"),
      givingScreen(),
      getMerch(),
      loadMerchPage(now),
    ]);
  const allItems = [...items.items, ...archivedItems.items];
  return {
    unavailable:
      current.unavailable ||
      archived.unavailable ||
      items.unavailable ||
      archivedItems.unavailable ||
      giving.unavailable,
    collections: current.collections,
    archivedCollections: archived.collections,
    items: items.items,
    archivedItems: archivedItems.items,
    giving,
    page,
    preview,
    /** An item's sizes, current or archived, in order. */
    sizesOf: (itemId: string) =>
      giving.items
        .filter((row) => row.merch_item_id === itemId)
        .sort(
          (a, b) => a.position - b.position || a.name.localeCompare(b.name),
        ),
    /** The next order number for a new collection, or a new item in a collection. */
    nextCollectionPosition: () =>
      nextPosition([...current.collections, ...archived.collections]),
    nextItemPosition: (collectionId: string) =>
      nextPosition(
        allItems.filter((row) => row.collection_id === collectionId),
      ),
    /** A collection as the Merch page draws it (for the Previews), or a bare one. */
    viewOf: (collectionId: string) => {
      const views =
        preview.state === "ready"
          ? [preview.lead, ...preview.others].filter((view) => view !== null)
          : [];
      return views.find((view) => view.id === collectionId) ?? null;
    },
  };
}
