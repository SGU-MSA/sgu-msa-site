"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isIn, type NavGroup } from "./sections";
import s from "./parts.module.css";

/** Every section as links, the current one marked; optionally under group headings. */
export function SectionList({
  groups,
  grouped = true,
  onNavigate,
  home = false,
}: {
  groups: NavGroup[];
  grouped?: boolean;
  onNavigate?: () => void;
  home?: boolean;
}) {
  const pathname = usePathname();
  const link = (href: string, label: string, current: boolean) => (
    <li key={href}>
      <Link
        href={href}
        className={s.link}
        aria-current={current ? "page" : undefined}
        onClick={onNavigate}
      >
        {label}
      </Link>
    </li>
  );
  const homeLink = home
    ? link("/admin/dashboard", "Home", pathname === "/admin/dashboard")
    : null;
  if (!grouped) {
    return (
      <ul className={s.list}>
        {homeLink}
        {groups.flatMap((g) =>
          g.items.map((i) => link(i.href, i.label, isIn(pathname, i))),
        )}
      </ul>
    );
  }
  return (
    <div className={s.groups}>
      {homeLink ? <ul className={s.list}>{homeLink}</ul> : null}
      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`nav-${g.id}`}>
          <h2 id={`nav-${g.id}`} className={s.groupTitle}>
            {g.title}
          </h2>
          <ul className={s.list}>
            {g.items.map((i) => link(i.href, i.label, isIn(pathname, i)))}
          </ul>
        </section>
      ))}
    </div>
  );
}
