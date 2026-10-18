import "server-only";
import { z } from "../../validation/zod";
import { publicClient } from "@/lib/backend/server";
import { emptyLists, groupLists, listOptionSchema } from "../lists";
import { groupTeam, teamRowSchema, type TeamSection } from "../people";
import {
  dateAscending,
  emptyPrayer,
  prayerSettingsSchema,
  recordFromRow,
  type Collection,
  type CommunityRecord,
} from "../schema";
import type { QuranVerse } from "../../quran/verse";
import type { ContentProvider, Provenance } from "./contract";

const provenance: Provenance = "live";

// Deduplicate within a render. Operational records use runtime reads so
// publication, revocation, and prayer changes never reuse a stale shared result.
// No client counts as unavailable, never as an empty but healthy source.
async function getRecords(kind: Collection) {
  const client = publicClient();
  if (!client)
    return { records: [] as CommunityRecord[], unavailable: true, provenance };
  try {
    const { data, error } = await client
      .from(kind)
      .select("*")
      .eq("published", true)
      .order("date", { ascending: dateAscending(kind, "public") })
      .limit(500);
    if (error) throw error;
    return {
      records: (data ?? []).map(recordFromRow),
      unavailable: false,
      provenance,
    };
  } catch {
    return { records: [] as CommunityRecord[], unavailable: true, provenance };
  }
}

async function getPrayerSettings() {
  const client = publicClient();
  if (!client) return { settings: emptyPrayer, unavailable: true, provenance };
  try {
    const { data, error } = await client
      .from("prayer_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (error) throw error;
    return {
      settings: prayerSettingsSchema.parse(data),
      unavailable: false,
      provenance,
    };
  } catch {
    return { settings: emptyPrayer, unavailable: true, provenance };
  }
}

// Anonymous storage RLS only allows files referenced by currently published records.
async function getMedia(name: string) {
  const client = publicClient();
  if (!client) return { file: null, unavailable: true, provenance };
  const { data, error } = await client.storage.from("community").download(name);
  return { file: error ? null : data, unavailable: false, provenance };
}

// `public_team_list()` is granted to anonymous visitors and returns the Executive board and the people
// marked "Show on public page", with each group's kind (review fixes P4).
async function getTeam() {
  const client = publicClient();
  if (!client)
    return { sections: [] as TeamSection[], unavailable: true, provenance };
  try {
    const { data, error } = await client.rpc("public_team_list");
    if (error) throw error;
    return {
      sections: groupTeam(z.array(teamRowSchema).parse(data ?? [])),
      unavailable: false,
      provenance,
    };
  } catch {
    return { sections: [] as TeamSection[], unavailable: true, provenance };
  }
}

const verseRowSchema = z.object({
  reference: z.string(),
  surah_name: z.string(),
  arabic: z.string(),
  meaning: z.string(),
});
const verseColumns = "reference, surah_name, arabic, meaning";
const verseOf = ({
  surah_name,
  ...verse
}: z.infer<typeof verseRowSchema>): QuranVerse => ({
  ...verse,
  surahName: surah_name,
});

async function getVerse(reference: string) {
  const client = publicClient();
  if (!client) return { verse: null, unavailable: true, provenance };
  try {
    const { data, error } = await client
      .from("quran_verses")
      .select(verseColumns)
      .eq("reference", reference)
      .maybeSingle();
    if (error) throw error;
    return {
      verse: data ? verseOf(verseRowSchema.parse(data)) : null,
      unavailable: false,
      provenance,
    };
  } catch {
    return { verse: null, unavailable: true, provenance };
  }
}

/** Rows per request: the Supabase API answers at most 1000 rows at a time. */
export const VERSE_PAGE = 1000;

/** The whole library, a page of rows at a time, in Qur'an order (`client` is a parameter for tests). */
export async function readVerseLibrary(
  client: ReturnType<typeof publicClient>,
) {
  if (!client)
    return { verses: [] as QuranVerse[], unavailable: true, provenance };
  try {
    const verses: QuranVerse[] = [];
    for (let from = 0; ; from += VERSE_PAGE) {
      const { data, error } = await client
        .from("quran_verses")
        .select(verseColumns)
        .order("surah")
        .order("ayah")
        .range(from, from + VERSE_PAGE - 1);
      if (error) throw error;
      const page = z.array(verseRowSchema).parse(data ?? []);
      verses.push(...page.map(verseOf));
      if (page.length < VERSE_PAGE) break;
    }
    return { verses, unavailable: false, provenance };
  } catch {
    return { verses: [] as QuranVerse[], unavailable: true, provenance };
  }
}

const getVerseLibrary = () => readVerseLibrary(publicClient());

// One number, granted to visitors: the nightly check reads it without a session.
async function getStorageUse() {
  const client = publicClient();
  if (!client) return { bytes: null, provenance };
  const { data, error } = await client.rpc("community_storage_bytes");
  const bytes = z.coerce.number().int().min(0).safeParse(data);
  return { bytes: error || !bytes.success ? null : bytes.data, provenance };
}

// The Lists are public (the filters); one read of every list.
async function getLists() {
  const client = publicClient();
  if (!client) return { lists: emptyLists(), unavailable: true, provenance };
  try {
    const { data, error } = await client
      .from("list_options")
      .select("id, list, name, slug, position")
      .order("position");
    if (error) throw error;
    return {
      lists: groupLists(z.array(listOptionSchema).parse(data ?? [])),
      unavailable: false,
      provenance,
    };
  } catch {
    return { lists: emptyLists(), unavailable: true, provenance };
  }
}

export const supabaseContentProvider = {
  getLists,
  getRecords,
  getPrayerSettings,
  getMedia,
  getTeam,
  getVerse,
  getVerseLibrary,
  getStorageUse,
} satisfies ContentProvider;
