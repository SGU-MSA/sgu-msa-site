import { PaymentItemsList } from "@/features/admin/PaymentItemsList";
import { listView } from "@/features/admin/fields";
import { boardPage } from "@/features/admin/page-state/board-page";

/** Tickets (PR6 WP-6): any board member (D-65). */
async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <PaymentItemsList kind="priced" view={listView(query.view)} query={query} />
  );
}

export default boardPage(TicketsPage);
