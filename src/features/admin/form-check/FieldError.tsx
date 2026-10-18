"use client";
import { useContext, useLayoutEffect, useMemo } from "react";
import { FormCheckContext } from "./CheckedForm";
import { boxReason } from "./problems";

/**
 * The one line under a box that says what is wrong with it (review 2,
 * 2026-10-05), inside a `CheckedForm`. `name` is the box's key in the form's
 * problems; `controls` are the inputs it explains (their `name` or `id`;
 * the key itself when left out), which get `aria-invalid` and point to this
 * line with `aria-describedby`. Nothing is drawn while the box is right.
 */
export function FieldError({
  name,
  controls,
}: {
  name: string;
  controls?: readonly string[];
}) {
  const check = useContext(FormCheckContext);
  const key = (controls ?? [name]).join(" ");
  // One array per set of controls, so the registry entry stays the same.
  const list = useMemo(() => key.split(" "), [key]);
  const register = check?.register;
  useLayoutEffect(() => register?.(name, list), [register, name, list]);
  const message = check?.problem(name);
  // Hidden from the reading order (it may sit inside a box's label, whose
  // name must stay the box's own): screen readers hear it with the box,
  // through `aria-describedby`.
  return message ? (
    <span id={check?.errorId(name)} className="field-error" aria-hidden="true">
      {boxReason(message)}
    </span>
  ) : null;
}
