"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

/**
 * A password input with a show/hide button at its right edge. Each field
 * toggles on its own; the one owner of every password field (home-centering).
 */
export function PasswordInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  const Icon = shown ? EyeOff : Eye;
  return (
    <span className="password-input">
      <input
        {...props}
        type={shown ? "text" : "password"}
        className={className}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        onClick={() => setShown((value) => !value)}
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
      </button>
    </span>
  );
}
