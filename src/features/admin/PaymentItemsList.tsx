import Link from "next/link";
import {
  CATEGORIES,
  donateOrder,
  donateRank,
  productLabel,
} from "@/lib/community/payment-policy";
import type { Kind } from "@/lib/community/payments";
import { systemText } from "@/lib/system-text";
import { ItemFlags, PaymentsNav } from "./GivingParts";
import { AdminHeader } from "./AdminHeader";
import { OrderedList } from "./OrderedList";
import { ArchivedRow } from "./ArchiveActions";
import { ViewTabs } from "./ViewTabs";
import type { ListView } from "./fields";
import { ticketUsers } from "./event-tickets";
import { givingScreen } from "./payment-pages";
import { restorePaymentItemAction } from "./payment-actions";
import {
  donateGroupName,
  donateStatusText,
  kindWords,
  windowWords,
} from "./payment-words";

const notices: Record<string, string> = {
  archived:
    "Archived. Find it under Archived. Close its product in Go2Pay too.",
  restored: "Restored.",
};

const pathOf: Record<Kind, string> = {
  fund: "/admin/payments/funds",
  priced: "/admin/payments/tickets",
};

type Screen = Awaited<ReturnType<typeof givingScreen>>;
type VersionedPaymentItem = Screen["items"][number];

/**
 * The dragged lists of the current Funds or Tickets: tickets in one list;
 * funds in one list per Donate-page group (`donateRank`), because the board
 * orders funds only within their group. A heading shows only when there is
 * more than one group.
 */
function groupsOf(kind: Kind, items: readonly VersionedPaymentItem[]) {
  const groups: {
    rank: number;
    name: string;
    heading: boolean;
    items: VersionedPaymentItem[];
  }[] = [];
  for (const item of items) {
    const rank = kind === "fund" ? donateRank(item) : 0;
    const group = groups.find((entry) => entry.rank === rank);
    if (group) group.items.push(item);
    else
      groups.push({
        rank,
        name: kind === "fund" ? donateGroupName(item) : kindWords[kind].list,
        heading: false,
        items: [item],
      });
  }
  for (const group of groups) group.heading = groups.length > 1;
  return groups;
}

/** A fund's or ticket's labels and when it runs, under its name. */
function ItemDetails({
  item,
  kind,
  archived,
  screen,
  usedBy,
}: {
  item: VersionedPaymentItem;
  kind: Kind;
  archived: boolean;
  screen: Screen;
  /** The event that sells this ticket ("Used by …", PR6 WP-9). */
  usedBy?: string;
}) {
  const link = screen.linkOf(item.id);
  const when = windowWords(screen.windowOf(item));
  // A fund says whether it is on the Donate page today, or why not
  // (review fixes P4), from the rule that builds the page.
  const flags = screen.flagsOf(item);
  const closed = kind === "fund" ? screen.closedReasonsOf(item) : [];
  return (
    <>
      <p className="admin-badges">
        {kind === "fund" ? (
          <span className="admin-badge">{CATEGORIES[item.category].tag}</span>
        ) : null}
        {kind === "fund" && !archived ? null : (
          <span className="admin-badge">
            {archived ? "Archived" : item.listed ? "On sale" : "Not shown"}
          </span>
        )}
        {item.heading ? (
          <span className="admin-badge">Heading: {item.heading}</span>
        ) : null}
      </p>
      <p className="muted">
        {[
          when,
          link ? `Opens ${productLabel(link.go2pay_product_id)}` : "",
          usedBy ? `Used by ${usedBy}` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {kind === "fund" && !archived ? (
        <p
          className={
            closed.length ? "giving-status giving-status-off" : "giving-status"
          }
        >
          {donateStatusText(closed)}
        </p>
      ) : null}
      {archived ? null : (
        <ItemFlags
          endDateShown={kind === "fund"}
          flags={
            kind === "fund"
              ? flags.filter((flag) => flag.code !== "no_link")
              : flags
          }
        />
      )}
    </>
  );
}

/** One current fund or ticket in the dragged list: its details and Edit. */
function ItemRow({
  item,
  kind,
  screen,
  usedBy,
}: {
  item: VersionedPaymentItem;
  kind: Kind;
  screen: Screen;
  usedBy?: string;
}) {
  return (
    <div className="order-row">
      <div>
        <h3>{item.name}</h3>
        <ItemDetails
          item={item}
          kind={kind}
          archived={false}
          screen={screen}
          usedBy={usedBy}
        />
      </div>
      <Link className="button-secondary" href={`${pathOf[kind]}/${item.id}`}>
        Edit<span className="sr-only"> {item.name}</span>
      </Link>
    </div>
  );
}

/**
 * The Funds or Tickets list (PR6 WP-6; any board member, D-65): each item
 * with its category, whether it shows, when, its Go2Pay page and the board
 * flags ("Ended … · close it in Go2Pay", D-72). Funds are in the Donate
 * page's order (D-77 c); the board drags them into order within their group
 * (review fixes PR-2). Archived items can be restored.
 */
export async function PaymentItemsList({
  kind,
  view,
  query,
}: {
  kind: Kind;
  view: ListView;
  query: Record<string, string | string[] | undefined>;
}) {
  const [screen, users] = await Promise.all([
    givingScreen(),
    // "Used by (event)" on the Tickets list (PR6 WP-9).
    kind === "priced" ? ticketUsers() : new Map<string, string>(),
  ]);
  const archived = view === "archived";
  const words = kindWords[kind];
  // Merch sizes are listed on their merch item (PR5c), not as tickets.
  const rows = screen.items.filter(
    (item) =>
      item.kind === kind &&
      !item.merch_item_id &&
      Boolean(item.archived_at) === archived,
  );
  const ordered: typeof rows =
    kind === "fund"
      ? donateOrder(rows)
      : [...rows].sort(
          (a, b) => a.position - b.position || a.name.localeCompare(b.name),
        );
  const notice = Object.keys(notices).find((key) => query[key]);
  const add = kind === "fund" ? "Add a fund" : "Add a ticket";
  return (
    <div className="admin-shell">
      <AdminHeader
        title={words.list}
        parents={[{ label: "Payments", href: "/admin/payments" }]}
      />
      <PaymentsNav current={kind === "fund" ? "funds" : "tickets"} />
      {notice ? (
        <p role="status" className="success-message">
          {notices[notice]}
        </p>
      ) : null}
      <ViewTabs href={pathOf[kind]} view={view} label={words.list} />
      {archived ? (
        <p className="muted">
          Archived {words.list.toLowerCase()} are off the website and their Give
          link is closed.
        </p>
      ) : (
        <>
          <p className="muted">
            {kind === "fund"
              ? "Every fund links to its own Go2Pay page, which you make by hand in Go2Pay. Any board member can add and edit funds."
              : "Every ticket links to its own Go2Pay page, which holds its price and stock. Any board member can add and edit tickets."}
          </p>
          <div className="admin-actions">
            <Link className="button-primary" href={`${pathOf[kind]}/new`}>
              {add}
            </Link>
            {kind === "fund" ? (
              <Link className="button-secondary" href="/admin/seasons">
                Seasons
              </Link>
            ) : null}
          </div>
        </>
      )}
      {screen.unavailable ? (
        <p role="alert" className="content-card">
          {words.list} could not be loaded. Check your connection and reload.
        </p>
      ) : ordered.length && archived ? (
        <ul className="admin-list">
          {ordered.map((item) => (
            <ArchivedRow
              key={item.id}
              name={item.name}
              heading="h3"
              view={`${pathOf[kind]}/${item.id}`}
              fields={{ id: item.id, version: item.updated_at, kind }}
              restore={{ action: restorePaymentItemAction }}
            >
              <ItemDetails
                item={item}
                kind={kind}
                archived
                screen={screen}
                usedBy={users.get(item.id)}
              />
            </ArchivedRow>
          ))}
        </ul>
      ) : ordered.length ? (
        <div>
          <p className="muted">{systemText.order.hint}</p>
          {groupsOf(kind, ordered).map((group) => (
            <section
              key={group.name}
              aria-label={group.heading ? undefined : group.name}
              aria-labelledby={
                group.heading ? `group-${group.rank}` : undefined
              }
            >
              {group.heading ? (
                <h2 className="order-group-title" id={`group-${group.rank}`}>
                  {group.name}
                </h2>
              ) : null}
              <OrderedList
                list="payment_items"
                label={group.name}
                rows={group.items.map((item) => ({
                  id: item.id,
                  version: item.updated_at,
                  name: item.name,
                  content: (
                    <ItemRow
                      item={item}
                      kind={kind}
                      screen={screen}
                      usedBy={users.get(item.id)}
                    />
                  ),
                }))}
              />
            </section>
          ))}
        </div>
      ) : archived ? (
        <p className="content-card">Nothing is archived.</p>
      ) : kind === "fund" ? (
        <section className="content-card" aria-labelledby="first-fund">
          <h2 id="first-fund">No funds yet</h2>
          <p>
            Start with the general fund: the name and category are filled in,
            and you add its Go2Pay page.
          </p>
          <p>
            <Link
              className="button-primary"
              href={`${pathOf.fund}/new?start=general`}
            >
              Start with the general fund
            </Link>
          </p>
        </section>
      ) : (
        <p className="content-card">No tickets yet.</p>
      )}
    </div>
  );
}
