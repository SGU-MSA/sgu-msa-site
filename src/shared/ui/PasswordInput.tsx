"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

/**
 * A password input with a show/hide button at its right edge. Each field
 * toggles on its own; the one owner of every password field (home-centering).
 * The button keeps one name, "Show password", and `aria-pressed` says whether
 * the password is showing (the WAI-ARIA toggle button pattern). A form that is
 * submitted while the password shows puts it back to hidden first, so a
 * password manager sees an ordinary password field.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const Icon = shown ? EyeOff : Eye;

  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const hide = () => {
      if (input.current) input.current.type = "password";
      setShown(false);
    };
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  return (
    <span className="password-input">
      <input
        {...props}
        ref={input}
        type={shown ? "text" : "password"}
        className={className}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label="Show password"
        aria-pressed={shown}
        onClick={() => setShown((value) => !value)}
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
      </button>
    </span>
  );
}
