import type { Metadata } from "next";

import { NotFoundSignpost } from "@/features/system/NotFoundSignpost";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return <NotFoundSignpost />;
}
