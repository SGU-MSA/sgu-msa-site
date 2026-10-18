"use client";
import type { RefObject } from "react";

import { typedValues } from "../form-state";

/**
 * The form's typed text right now (file inputs left out), read when called:
 * the one "typed values now" read every editor's Preview uses (PR5a).
 */
export function useTypedValues(form: RefObject<HTMLFormElement | null>) {
  return () => (form.current ? typedValues(new FormData(form.current)) : {});
}
