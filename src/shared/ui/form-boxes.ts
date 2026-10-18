"use client";
import { useEffect, useState, type RefObject } from "react";

/** A box's posted value in a form, by its `name` ("" when there is none). */
function valueIn(form: HTMLFormElement, name: string): string {
  const box = form.elements.namedItem(name);
  if (!box) return "";
  if (box instanceof RadioNodeList) return box.value;
  return "value" in box && typeof box.value === "string" ? box.value : "";
}

/**
 * The live values of other boxes of the form an element sits in, by name
 * (`DateField` and `TimeField` follow them, such as "End date" after
 * "Start date"). Read again after every change in the form, once React has
 * drawn it: a time box posts from a hidden input that it fills itself.
 */
export function useFormBoxes(
  ref: RefObject<HTMLElement | null>,
  names: readonly string[],
): Record<string, string> {
  const key = names.join("\n");
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form || !key) return;
    const list = key.split("\n");
    let timer: number | undefined;
    const read = () =>
      setValues((before) => {
        const after = Object.fromEntries(
          list.map((name) => [name, valueIn(form, name)]),
        );
        return list.every((name) => before[name] === after[name])
          ? before
          : after;
      });
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(read, 0);
    };
    read();
    form.addEventListener("input", later);
    form.addEventListener("change", later);
    return () => {
      window.clearTimeout(timer);
      form.removeEventListener("input", later);
      form.removeEventListener("change", later);
    };
  }, [ref, key]);
  return values;
}
