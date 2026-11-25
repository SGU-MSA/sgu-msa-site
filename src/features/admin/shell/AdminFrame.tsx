"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Seal } from "@/shared/ui/Seal";
import { AccountMenu } from "./AccountMenu";
import { SectionList } from "./SectionList";
import { isPlainPage, type NavGroup } from "./sections";
import s from "./frame.module.css";

/**
 * Option 2: the dashboard's own frame. No public header or footer: a slim top
 * bar with a Menu button that opens every section, grouped by how often they
 * are used; on a wide screen the same grouped list stays beside the page.
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
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  if (isPlainPage(pathname)) {
    return (
      <div className={s.plain}>
        <Brand />
        {children}
      </div>
    );
  }
  return (
    <div className={s.frame}>
      <header className={s.top}>
        <Brand />
        <div className={s.topActions}>
          <button
            type="button"
            className={`button-secondary ${s.menuButton}`}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu aria-hidden="true" size={20} />
            <span>Menu</span>
          </button>
          {bell}
          <AccountMenu signOut={signOut} />
        </div>
      </header>
      <nav className={s.sidebar} aria-label="Dashboard sections">
        <SectionList groups={groups} home />
      </nav>
      <div className={s.content}>{children}</div>
      <dialog
        ref={dialog}
        className={s.menu}
        aria-label="Dashboard menu"
        onClose={() => setOpen(false)}
      >
        <div className={s.menuHead}>
          <h2>Menu</h2>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" size={20} />
            <span>Close</span>
          </button>
        </div>
        <SectionList groups={groups} home onNavigate={() => setOpen(false)} />
      </dialog>
    </div>
  );
}

function Brand() {
  return (
    <Link
      href="/admin/dashboard"
      className={s.brand}
      aria-label="Board dashboard home"
    >
      <Seal size={36} />
      <span className={s.brandName}>Board dashboard</span>
    </Link>
  );
}
