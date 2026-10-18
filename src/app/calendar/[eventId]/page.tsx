import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventDetail } from "@/features/calendar/EventDetail";
import { managedEvents } from "@/lib/community/managed";
import { getSite, placedReminder } from "@/lib/content";
import { loadEventTicket } from "@/lib/integrations/payments";
import { localDate } from "@/lib/community/schema";
import { deploymentProfile } from "@/lib/runtime/providers";
import { requestNow } from "@/lib/runtime/public-cache";
import { eventJsonLd } from "@/lib/seo/structured-data";
import { siteUrl } from "@/lib/site-config";
import { JsonLd } from "@/shared/ui/JsonLd";

/**
 * One update or event per address: the menu reads the address, which is
 * only known per visit, so this page is built on each visit (Cache
 * Components; review fixes PR-C). Its page text and verse are still cached.
 */
export const instant = false;

type Params = { eventId: string };

async function findEvent(eventId: string) {
  return (
    (await managedEvents()).events.find((event) => event.id === eventId) ?? null
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const event = await findEvent((await params).eventId);
  if (!event) return { title: "Event not found" };
  return {
    title: event.title,
    description: event.description ?? undefined,
    alternates: { canonical: `/calendar/${event.id}` },
    openGraph: {
      title: event.title,
      description: event.description ?? undefined,
    },
  };
}

/** The event on its own page (`EventDetail`, which the editor's Preview draws too). */
export default async function EventPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const [event, verse] = await Promise.all([
    findEvent((await params).eventId),
    placedReminder("events"),
  ]);
  if (!event) notFound();
  const now = await requestNow();
  const ticket = await loadEventTicket(event, now);
  const data = deploymentProfile().indexable
    ? eventJsonLd(event, await getSite(), siteUrl)
    : null;
  return (
    <>
      {data && <JsonLd data={data} />}
      <EventDetail
        event={event}
        ticket={ticket}
        verse={verse}
        today={localDate(now)}
      />
    </>
  );
}
