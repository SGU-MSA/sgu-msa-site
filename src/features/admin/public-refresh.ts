import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { publicCacheTags } from "@/lib/runtime/public-cache";

/**
 * After any board save: the public site shows the change on the next page
 * load. Expires every cached public read (`publicCacheTags`; `updateTag`,
 * the read-your-own-writes form of revalidating a tag) and every page built
 * ahead of time. Called by every dashboard server action that changes data;
 * board saves are rare, so finer tags would save nothing.
 */
export function publicDataChanged() {
  for (const tag of Object.values(publicCacheTags)) updateTag(tag);
  revalidatePath("/", "layout");
}
