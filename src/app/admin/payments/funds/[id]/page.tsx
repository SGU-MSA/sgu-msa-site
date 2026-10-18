import { requireAdmin } from "@/lib/backend/server";
import { PaymentItemPage } from "@/features/admin/PaymentItemPage";
import { boardPage } from "@/features/admin/page-state/board-page";

/** One fund (PR6 WP-6): any board member. */
async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query, admin] = await Promise.all([
    params,
    searchParams,
    requireAdmin(),
  ]);
  return (
    <PaymentItemPage
      kind="fund"
      id={id}
      canEditPages={admin.canEditPages}
      start={typeof query.start === "string" ? query.start : undefined}
    />
  );
}

export default boardPage(Page);
