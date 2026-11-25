"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { AccountMenu } from "./AccountMenu";
import { isIn, isPlainPage, type NavGroup } from "./sections";
import s from "./frame.module.css";

/**
 * Option 3: the public header stays; the public footer is not drawn under
 * /admin. A strip under the header holds every section as a chip (scrolls
 * sideways on a phone), the bell and the account menu.
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
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    // Bring the current chip into view in the sideways list.
    const chip = list.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    const box = list.current;
    if (chip && box)
      box.scrollLeft =
        chip.offsetLeft - (box.clientWidth - chip.clientWidth) / 2;
  }, [pathname]);
  if (isPlainPage(pathname)) return <>{children}</>;
  const items = [
    { id: "home", label: "Home", href: "/admin/dashboard", prefix: "" },
    ...groups.flatMap((g) => g.items),
  ];
  return (
    <div className={s.frame}>
      <div className={s.strip}>
        <nav className={s.chips} aria-label="Dashboard sections">
          <ul ref={list}>
            {items.map((item) => {
              const current =
                item.id === "home"
                  ? pathname === "/admin/dashboard"
                  : isIn(pathname, item);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={s.chip}
                    aria-current={current ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className={s.actions}>
          {bell}
          <AccountMenu signOut={signOut} />
        </div>
      </div>
      <div className={s.content}>{children}</div>
    </div>
  );
}
