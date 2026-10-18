"use client";

import { ErrorSignpost } from "@/features/system/ErrorSignpost";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <ErrorSignpost reset={reset} />;
}
