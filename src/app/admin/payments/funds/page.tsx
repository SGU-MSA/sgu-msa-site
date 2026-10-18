import { PaymentItemsList } from "@/features/admin/PaymentItemsList";
import { listView } from "@/features/admin/fields";
import { boardPage } from "@/features/admin/page-state/board-page";

/** Funds (PR6 WP-6): any board member. */
async function FundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <PaymentItemsList kind="fund" view={listView(query.view)} query={query} />
  );
}

export default boardPage(FundsPage);
