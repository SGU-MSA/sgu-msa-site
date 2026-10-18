import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/backend/server";
import { PaymentItemPage } from "@/features/admin/PaymentItemPage";
import { merchScreen } from "@/features/admin/merch/merch-screen";
import { boardPage } from "@/features/admin/page-state/board-page";

/**
 * One size of a merch item (PR5c, D-27 a; any board member): a priced item
 * with its own Go2Pay product, reached from the item's screen
 * (`?item=<id>`).
 */
async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query, admin, screen] = await Promise.all([
    params,
    searchParams,
    requireAdmin(),
    merchScreen(),
  ]);
  const item = screen.items.find((row) => row.id === query.item);
  if (!item) notFound();
  return (
    <PaymentItemPage
      kind="priced"
      id={id}
      canEditPages={admin.canEditPages}
      merch={{ itemId: item.id, itemName: item.name }}
    />
  );
}

export default boardPage(Page);
