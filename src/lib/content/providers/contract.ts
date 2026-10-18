import type { Provenance } from "../../community/providers/contract";
import type { EditorialDocuments, EditorialKey } from "../documents";

/**
 * Editorial page copy, one document at a time (ADR 0012). YAML today; PR5
 * moves documents into Supabase one by one behind this same port. Read only.
 */
export interface EditorialSource {
  get<K extends EditorialKey>(
    key: K,
  ): Promise<{
    document: EditorialDocuments[K];
    /** True when the document's fallback stands in for unreadable or invalid content. */
    unavailable: boolean;
    provenance: Provenance;
  }>;
}
