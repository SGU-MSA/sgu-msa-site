import "server-only";
import {
  activityLog,
  contentEditor,
  handoverEditor,
  peopleEditor,
} from "@/lib/runtime/providers";
import { requireAdmin } from "./server";
import type { ActivityQuery } from "../community/activity";
import type { Collection } from "../community/schema";
import type { PageTextKey } from "../content/documents";
import type { ListView } from "./providers/contract";

/** Protected board reads through the ports. No query builder or SDK result reaches a page. */
export async function listAdminRecords(kind: Collection, view?: ListView) {
  await requireAdmin();
  return contentEditor().listRecords(kind, view);
}
export async function readAdminRecord(kind: Collection, id: string) {
  await requireAdmin();
  const { record, unavailable } = await contentEditor().readRecord(kind, id);
  if (unavailable) throw new Error("Unable to load this item. Please reload.");
  return record;
}
export async function readAdminPrayer() {
  await requireAdmin();
  return contentEditor().readPrayer();
}
/** The musallah pin (PR7) with its version, or null when it cannot be read. */
export async function readAdminMusallahPin() {
  await requireAdmin();
  return contentEditor().readMusallahPin();
}
export async function listAdminPeople(view?: ListView) {
  await requireAdmin();
  return peopleEditor().listPeople(view);
}
export async function readAdminPerson(id: string) {
  await requireAdmin();
  const { person, unavailable } = await peopleEditor().readPerson(id);
  if (unavailable)
    throw new Error("Unable to load this person. Please reload.");
  return person;
}
export async function listAdminSections(view?: ListView) {
  await requireAdmin();
  return peopleEditor().listSections(view);
}
export async function listActivity(query: ActivityQuery) {
  await requireAdmin();
  return activityLog().list(query);
}
/** Every login that has or had access, with its People entry ("Who"). */
export async function listActivityLogins() {
  await requireAdmin();
  return activityLog().logins();
}
/** New board term (PR5a): the hand-over steps, in order. */
export async function listAdminSteps(view?: ListView) {
  await requireAdmin();
  return handoverEditor().listSteps(view);
}
/** New board term (PR5a): who holds each shared login, by account name. */
export async function listAdminLogins(view?: ListView) {
  await requireAdmin();
  return handoverEditor().listLogins(view);
}
/** One page's text with its version (PR5b); null when it could not be loaded. */
export async function readAdminPageText<K extends PageTextKey>(key: K) {
  await requireAdmin();
  return contentEditor().readPageText(key);
}
/** Every option of the Lists with its version (review fixes P3). */
export async function listAdminListOptions() {
  await requireAdmin();
  return contentEditor().listOptions();
}
/** Every stored photo and PDF, newest first (photo library, 2026-10-06). */
export async function listAdminFiles() {
  await requireAdmin();
  return contentEditor().listFiles();
}
