"use client";
import { ChevronDown, User } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import s from "./parts.module.css";

/**
 * "Account": holds Show me how (drawn here by the page, see TourInMenu) and
 * Sign out. Escape or a click outside closes it and focus returns to the button.
 */
export function AccountMenu({ signOut }: { signOut: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      ref={wrap}
      className={s.account}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className={`button-secondary ${s.accountButton}`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((was) => !was)}
      >
        <User aria-hidden="true" size={20} strokeWidth={1.75} />
        <span>Account</span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      <div
        id={`${id}-panel`}
        className={s.accountPanel}
        hidden={!open}
        onClick={(event) => {
          // Choosing an item closes the menu; the tour button stays mounted.
          if ((event.target as HTMLElement).closest("button")) setOpen(false);
        }}
      >
        <div id="account-tour-slot" className={s.tourSlot} />
        {signOut}
      </div>
    </div>
  );
}
