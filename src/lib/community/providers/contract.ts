import type { QuranVerse } from "../../quran/verse";
import type { Lists } from "../lists";
import type { TeamSection } from "../people";
import type { Collection, CommunityRecord, PrayerSettings } from "../schema";

/** Where a read result came from. Features branch on this, never on mode (ADR 0012). */
export type Provenance = "live" | "sample";

/** Public reads only. Board writes go through `ContentEditor` (backend/providers). */
export interface ContentProvider {
  getRecords(kind: Collection): Promise<{
    records: CommunityRecord[];
    unavailable: boolean;
    provenance: Provenance;
  }>;
  getPrayerSettings(): Promise<{
    settings: PrayerSettings;
    unavailable: boolean;
    provenance: Provenance;
  }>;
  /**
   * A stored upload for `/media/[name]`, only while a published, currently
   * visible record or a listed team photo references it (the storage
   * policy). Null when not found.
   */
  getMedia(name: string): Promise<{
    file: Blob | null;
    unavailable: boolean;
    provenance: Provenance;
  }>;
  /**
   * The public team list (D-10, D-11): the Executive board always, with a
   * photo when one is uploaded, and the other people marked "Show on public
   * page" (`public_team_list()`, review fixes P4).
   */
  getTeam(): Promise<{
    sections: TeamSection[];
    unavailable: boolean;
    provenance: Provenance;
  }>;
  /**
   * One verse of the fixed verse library by reference ("94:5"; PR5b D-24,
   * Review 3 E), or null when the library has no such verse: the only place
   * public pages read Qur'an text from.
   */
  getVerse(reference: string): Promise<{
    verse: QuranVerse | null;
    unavailable: boolean;
    provenance: Provenance;
  }>;
  /**
   * The space every uploaded photo and PDF takes, in bytes
   * (`community_storage_bytes()`: one number, no names), for the dashboard's
   * and the nightly check's space warning. Null when it cannot be read.
   */
  getStorageUse(): Promise<{ bytes: number | null; provenance: Provenance }>;
  /**
   * The Lists (review fixes P3): every event category, term and resource
   * category, each list in the board's order. Empty lists when unavailable.
   */
  getLists(): Promise<{
    lists: Lists;
    unavailable: boolean;
    provenance: Provenance;
  }>;
  /** The whole fixed verse library in Qur'an order, for the board's verse chooser. */
  getVerseLibrary(): Promise<{
    verses: QuranVerse[];
    unavailable: boolean;
    provenance: Provenance;
  }>;
}
