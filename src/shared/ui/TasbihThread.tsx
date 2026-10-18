import { loadReminders } from "@/lib/content";

import { TasbihThreadView } from "./TasbihThreadView";
import styles from "./reminders.module.css";

/** The class a page puts on the positioned element the thread runs down. */
export const tasbihThreadHost = styles.threadHost;

/**
 * The tasbih thread with its phrases from content/reminders.yaml. A server
 * component, so the reminder text arrives as props (no client fetch).
 */
export async function TasbihThread() {
  const { tasbih } = await loadReminders();
  return <TasbihThreadView phrases={tasbih?.phrases ?? null} />;
}
