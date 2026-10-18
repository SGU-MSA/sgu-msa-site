"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Container } from "@/shared/ui/Container";
import { Seal } from "@/shared/ui/Seal";
import { ThemeToggle } from "@/shared/ui/ThemeToggle";

export type NavigationItem = {
  id?: string;
  label: string;
  href: string;
};

type NavbarProps = {
  items: NavigationItem[];
  cta?: { label: string; href: string } | null;
  /** The seal's accessible name (site.yaml brand.logo.alt). */
  logoLabel: string;
  shortName: string;
  tagline: string;
};

/**
 * The one navigation for every route (Quiet Paper chrome, ADR 0018).
 *
 * Active state is a thin ink-ring underline, never a pill. The theme switch
 * sits beside Donate. The mobile menu is a full-screen dialog, so it does not
 * need to know the height of anything above it in the header stack.
 */
export function Navbar({
  items,
  cta,
  logoLabel,
  shortName,
  tagline,
}: NavbarProps) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const items = dialog.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        );
        const first = items?.[0];
        const last = items?.[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const isCurrent = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className={`site-nav sticky top-0 border-b ${scrolled ? "is-scrolled" : ""}`}
      >
        <Container className="flex h-[5.25rem] items-center justify-between gap-5">
          <Link
            href="/"
            className="brand-mark shrink-0"
            aria-label={`${shortName} home`}
          >
            <Seal size={52} label={logoLabel} />
            <span className="brand-name" aria-hidden="true">
              {shortName}
            </span>
          </Link>

          <div className="hidden items-center gap-[clamp(1rem,1.6vw,1.75rem)] xl:flex">
            {items.map((item) => (
              <Link
                key={`${item.id ?? item.href}-${item.label}`}
                href={item.href}
                prefetch={false}
                aria-current={isCurrent(item.href) ? "page" : undefined}
                className="nav-link"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            {cta ? (
              <Link
                href={cta.href}
                className="nav-donate hidden sm:inline-flex"
              >
                {cta.label}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="mobile-navigation"
              className="nav-icon-button inline-grid xl:hidden"
            >
              <span className="sr-only">Open menu</span>
              <Menu aria-hidden="true" />
            </button>
          </div>
        </Container>
      </nav>

      <dialog
        ref={dialog}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        aria-label="Navigation menu"
        id="mobile-navigation"
        className={`nav-dialog fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 overflow-y-auto overscroll-contain transition-[opacity,visibility] duration-300 xl:hidden ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <Container className="flex min-h-full flex-col py-6">
          <div className="flex h-[3.75rem] items-center justify-between">
            <div className="brand-mark">
              <Seal size={44} />
              <span className="brand-name">{shortName}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              tabIndex={open ? 0 : -1}
              className="nav-icon-button inline-grid"
            >
              <span className="sr-only">Close menu</span>
              <X aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            {items.map((item, index) => (
              <Link
                key={`${item.id ?? item.href}-${item.label}`}
                href={item.href}
                prefetch={false}
                onClick={() => setOpen(false)}
                tabIndex={open ? 0 : -1}
                aria-current={isCurrent(item.href) ? "page" : undefined}
                className="nav-dialog-link"
              >
                <span>{item.label}</span>
                <span
                  aria-hidden="true"
                  className="font-sans text-[0.68rem] tracking-[0.16em] text-[var(--muted)]"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </Link>
            ))}
          </div>

          {cta ? (
            <Link
              href={cta.href}
              onClick={() => setOpen(false)}
              tabIndex={open ? 0 : -1}
              className="nav-dialog-donate"
            >
              {cta.label}
              <Heart aria-hidden="true" className="size-4" />
            </Link>
          ) : null}

          <p className="mt-auto pt-12 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            {tagline}
          </p>
        </Container>
      </dialog>
    </>
  );
}
