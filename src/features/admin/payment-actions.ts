"use server";
import { redirect } from "next/navigation";
import { redirectSaved } from "./save-state/saved-flash";
import { publicDataChanged } from "./public-refresh";
import { z } from "@/lib/validation/zod";
import { currentAdmin } from "@/lib/backend/server";
import { allAdminPaymentItems } from "@/lib/backend/admin-payments";
import type {
  Outcome,
  VersionedPaymentItem,
} from "@/lib/backend/providers/contract";
import { slugFor } from "@/lib/community/payment-policy";
import {
  currentLinks,
  type Kind,
  type PaymentItem,
} from "@/lib/community/payments";
import { resolveSeason } from "@/lib/community/season-policy";
import { localDate } from "@/lib/community/schema";
import { sizeItemName } from "@/lib/community/merch";
import {
  clock,
  contentEditor,
  merchEditor,
  paymentItemEditor,
  seasonEditor,
} from "@/lib/runtime/providers";
import type { EditorState } from "./actions";
import { keepTyped, typedValues, type KeptFormState } from "./form-state";
import { refuse } from "./fields";
import {
  sessionExpired,
  staleScreen,
  unavailableMessage,
} from "@/lib/system-text";
import { itemFromForm } from "./payment-forms";
import { itemRefusals, linkTaken, notReady, sizeTaken } from "./payment-words";

/**
 * Funds and tickets (PR6 WP-6, D-58, D-61, D-65): any board member saves,
 * archives and restores them and pastes their Go2Pay link. Nothing here
 * calls Go2Pay: the board makes each product by hand. The database decides
 * (RLS, the version check, the category lock SGU10, one item per product)
 * and logs every change.
 */

const listOf: Record<Kind, string> = {
  fund: "/admin/payments/funds",
  priced: "/admin/payments/tickets",
};
/** A merch size's screen goes back to its merch item (PR5c). */
const merchItemPath = (id: string) => `/admin/merch/items/${id}`;

/** The chosen season's days as of today (D-14 "Running again"), or null. */
async function seasonDays(seasonId: string) {
  if (!seasonId) return null;
  const [seasons, prayer] = await Promise.all([
    seasonEditor().listSeasons(),
    contentEditor().readPrayer(),
  ]);
  const season = seasons.seasons.find((row) => row.id === seasonId);
  return season
    ? resolveSeason(
        season,
        localDate(clock().now()),
        prayer ? prayer.settings.hijri_adjustment : null,
      )
    : null;
}

type SaveRefusal = Extract<
  Awaited<ReturnType<ReturnType<typeof paymentItemEditor>["saveItem"]>>,
  { ok: false }
>["reason"];

async function saveItem(
  kind: Kind,
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  if (!z.uuid().safeParse(values.id).success) return refuseKeeping(staleScreen);
  const version = values.version || null;
  const all = await allAdminPaymentItems();
  if (all.unavailable) return refuseKeeping(unavailableMessage("save"));
  const before: VersionedPaymentItem | null =
    all.items.find((item) => item.id === values.id) ?? null;
  // A merch size (PR5c) stays with its merch item; a ticket never becomes one.
  const merchId = kind === "priced" ? (values.merch_item_id ?? "") : "";
  if (
    version
      ? !before ||
        before.archived_at ||
        before.kind !== kind ||
        before.merch_item_id !== merchId
      : Boolean(before)
  )
    return refuseKeeping(staleScreen);
  if (merchId) {
    const merch = await merchEditor().listItems();
    if (merch.unavailable) return refuseKeeping(unavailableMessage("save"));
    const owner = merch.items.find((item) => item.id === merchId);
    if (!owner) return refuseKeeping(staleScreen);
    // The size is saved under the item's name and its label (Payments, Recent changes).
    values.name = sizeItemName(owner.name, values.size_label ?? "");
    const label = (values.size_label ?? "").trim().toLowerCase();
    if (
      label &&
      all.items.some(
        (item) =>
          item.id !== values.id &&
          !item.archived_at &&
          item.merch_item_id === merchId &&
          item.size_label.toLowerCase() === label,
      )
    )
      return refuseKeeping(null, { size_label: sizeTaken });
  }
  const taken = new Set(all.items.map((item) => item.slug));
  const slug = before?.slug ?? slugFor(values.name ?? "", taken);
  const currentLink = currentLinks(all.links).get(values.id) ?? null;
  const parsed = itemFromForm({
    values,
    kind,
    slug,
    before,
    currentLink,
    season: await seasonDays(kind === "fund" ? (values.season_id ?? "") : ""),
  });
  if (!parsed.ok) return refuseKeeping(null, parsed.fields);
  const { row, link } = parsed;

  // D-17: one item per Go2Pay product, ever; said before anything is written.
  const owner =
    link === null
      ? undefined
      : all.links.find((l) => l.go2pay_product_id === link);
  const nameOf = (id: string) =>
    all.items.find((item) => item.id === id)?.name ?? "another fund or ticket";
  if (owner)
    return refuseKeeping(null, {
      link:
        owner.payment_item_id === row.id
          ? itemRefusals.link_used_before
          : linkTaken(nameOf(owner.payment_item_id)),
    });

  const write = (candidate: PaymentItem) =>
    paymentItemEditor().saveItem(candidate, version, link);
  let saved: Outcome<SaveRefusal> = await write(row);
  // Two new items with the same name at once: the next free address, once.
  if (!saved.ok && saved.reason === "slug_taken" && !before)
    saved = await write({ ...row, slug: slugFor(row.name, taken.add(slug)) });
  if (!saved.ok) {
    const reason = saved.reason;
    if (reason === "link_taken")
      return refuseKeeping(null, { link: linkTaken("another fund or ticket") });
    if (reason === "missing_text")
      return refuseKeeping(null, { about: notReady.about });
    return refuseKeeping(
      reason === "slug_taken" ? itemRefusals.unavailable : itemRefusals[reason],
    );
  }
  publicDataChanged();
  return redirectSaved(merchId ? merchItemPath(merchId) : listOf[kind]);
}

export async function saveFundAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  return saveItem("fund", previous, form);
}

export async function saveTicketAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  return saveItem("priced", previous, form);
}

/**
 * The row id, version and kind an archive or restore form posts, and where
 * to go after it: the list, or a merch size's merch item (PR5c).
 */
function postedTarget(form: FormData) {
  const id = z.uuid().safeParse(form.get("id"));
  const version = z.string().min(1).safeParse(form.get("version"));
  const kind = z.enum(["fund", "priced"]).safeParse(form.get("kind"));
  const merch = z.uuid().safeParse(form.get("merch_item_id"));
  return id.success && version.success && kind.success
    ? {
        id: id.data,
        version: version.data,
        kind: kind.data,
        back: merch.success ? merchItemPath(merch.data) : listOf[kind.data],
      }
    : null;
}

const failed = (verb: string, reason: "conflict" | "unavailable") =>
  reason === "conflict" ? staleScreen : unavailableMessage(verb);

/**
 * Archives a fund or ticket: it leaves the site and its Give link closes;
 * an event that uses a ticket loses its Buy button (D-27). The board closes
 * the product in Go2Pay too.
 */
export async function archivePaymentItemAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuse(staleScreen);
  const result = await paymentItemEditor().archiveItem(
    target.id,
    target.version,
  );
  if (!result.ok) return refuse(failed("archive", result.reason));
  publicDataChanged();
  redirect(`${target.back}?archived=1`);
}

/** Brings an archived fund or ticket back as it was (with "Show" as it was ticked). */
export async function restorePaymentItemAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuse(staleScreen);
  const result = await paymentItemEditor().restoreItem(
    target.id,
    target.version,
  );
  if (!result.ok) return refuse(failed("restore", result.reason));
  publicDataChanged();
  redirect(`${target.back}?restored=1`);
}
