"use client";
import {
  Ellipsis,
  FileText,
  House,
  Moon,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Seal } from "@/shared/ui/Seal";
import { AccountMenu } from "./AccountMenu";
import { SectionList } from "./SectionList";
import { isIn, isPlainPage, type NavGroup, type NavItem } from "./sections";
import s from "./frame.module.css";

type Tab = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  /** Sheet tabs list these sections. */
  ids?: string[];
};

const tabs: Tab[] = [
  { key: "home", label: "Home", icon: House, href: "/admin/dashboard" },
  {
    key: "content",
    label: "Content",
    icon: FileText,
    ids: ["events", "announcements", "news_posts", "newsletters"],
  },
  { key: "prayer", label: "Prayer", icon: Moon, href: "/admin/prayer-times" },
  { key: "money", label: "Money", icon: Wallet, ids: ["payments", "merch"] },
  { key: "more", label: "More", icon: Ellipsis },
];

/**
 * Option 1: the dashboard's own frame. No public header or footer: a slim top
 * bar, a left sidebar on a desktop and a bottom tab bar on a phone. The
 * pages inside keep their own title and breadcrumb.
 */
export function AdminFrame({
  groups,
  bell,
  signOut,
  children,
}: {
  groups: NavGroup[];
  bell: ReactNode;
  signOut: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<string | null>(null);
  if (isPlainPage(pathname)) {
    return (
      <div className={s.plain}>
        <Brand />
        {children}
      </div>
    );
  }
  const all = groups.flatMap((g) => g.items);
  const named = new Set(tabs.flatMap((t) => t.ids ?? []));
  const itemsOf = (tab: Tab): NavItem[] =>
    tab.key === "more"
      ? all.filter((i) => !named.has(i.id) && i.id !== "prayer")
      : all.filter((i) => tab.ids?.includes(i.id));
  const currentTab = (tab: Tab) =>
    tab.key === "home"
      ? pathname === "/admin/dashboard"
      : tab.key === "prayer"
        ? pathname.startsWith("/admin/prayer-times")
        : itemsOf(tab).some((i) => isIn(pathname, i));
  const open = tabs.find((t) => t.key === sheet);
  return (
    <div className={s.frame} data-admin-tabs="">
      <header className={s.top}>
        <Brand />
        <div className={s.topActions}>
          {bell}
          <AccountMenu signOut={signOut} />
        </div>
      </header>
      <nav className={s.sidebar} aria-label="Dashboard sections">
        <SectionList groups={groups} grouped={false} home />
      </nav>
      <div className={s.content}>{children}</div>
      <nav className={s.tabs} aria-label="Dashboard">
        <ul>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const body = (
              <>
                <Icon aria-hidden="true" size={22} strokeWidth={1.75} />
                <span>{tab.label}</span>
              </>
            );
            return (
              <li key={tab.key}>
                {tab.href ? (
                  <Link
                    href={tab.href}
                    className={s.tab}
                    aria-current={currentTab(tab) ? "page" : undefined}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={s.tab}
                    aria-haspopup="dialog"
                    data-current={currentTab(tab) ? "" : undefined}
                    onClick={() => setSheet(tab.key)}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <Sheet
        title={open?.label ?? ""}
        open={Boolean(open)}
        onClose={() => setSheet(null)}
      >
        {open ? (
          <SectionList
            groups={[{ id: open.key, title: open.label, items: itemsOf(open) }]}
            grouped={false}
            onNavigate={() => setSheet(null)}
          />
        ) : null}
      </Sheet>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/admin/dashboard" className={s.brand}>
      <Seal size={36} />
      <span>Board dashboard</span>
    </Link>
  );
}

/** A bottom sheet: the browser's own dialog, so Escape and focus work. */
function Sheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className={s.sheet}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className={s.sheetBody}>
        <div className={s.sheetHead}>
          <h2>{title}</h2>
          <button type="button" className="button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
