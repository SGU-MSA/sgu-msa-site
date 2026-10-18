"use server";
import { redirect } from "next/navigation";
import { z } from "@/lib/validation/zod";
import { currentAdmin } from "@/lib/backend/server";
import {
  listNames,
  listWords,
  nameTaken,
  slugFor,
  typedListName,
} from "@/lib/community/lists";
import { nextPosition } from "@/lib/community/order";
import { contentEditor } from "@/lib/runtime/providers";
import {
  sessionExpired,
  staleScreen,
  unavailableMessage,
} from "@/lib/system-text";
import type { EditorState } from "./actions";
import { refuse } from "./fields";
import { keepTyped, typedValues, type KeptFormState } from "./form-state";
import { publicDataChanged } from "./public-refresh";
import { redirectSaved } from "./save-state/saved-flash";

/**
 * The Lists screen's saves (review fixes P3; any board member): add an
 * option at the end of its list, or rename one (its slug and place stay).
 * The order is set by dragging ("Save order", `saveOrderAction`). The
 * database is the authority (one name per list, RLS, the version).
 */
export async function saveListOptionAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  const id = z.uuid().safeParse(values.id);
  const list = z.enum(listNames).safeParse(values.list);
  if (!id.success || !list.success) return refuseKeeping(staleScreen);
  const name = typedListName(values.name);
  if (!name.success)
    return refuseKeeping(null, { name: name.error.issues[0].message });
  const { options, unavailable } = await contentEditor().listOptions();
  if (unavailable) return refuseKeeping(unavailableMessage("save"));
  const own = options.filter((option) => option.list === list.data);
  const version = values.version || null;
  const stored = own.find((option) => option.id === id.data);
  if (version && !stored) return refuseKeeping(staleScreen);
  if (nameTaken(own, name.data, id.data))
    return refuseKeeping(null, { name: listWords.nameTaken });
  const saved = await contentEditor().saveListOption(
    stored
      ? { ...stored, name: name.data }
      : {
          id: id.data,
          list: list.data,
          name: name.data,
          slug: slugFor(
            name.data,
            own.map((option) => option.slug),
          ),
          position: nextPosition(own),
        },
    version,
  );
  if (!saved.ok)
    return saved.reason === "name_taken"
      ? refuseKeeping(null, { name: listWords.nameTaken })
      : refuseKeeping(
          saved.reason === "conflict"
            ? staleScreen
            : unavailableMessage("save"),
        );
  publicDataChanged();
  return redirectSaved(`/admin/lists#list-${list.data}`);
}

/**
 * Deletes an option nothing uses (review fixes P3; any board member). An
 * option in use is refused: the screen hides Delete for it and says what
 * uses it; the database refuses too (`list_options_guard`).
 */
export async function deleteListOptionAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const id = z.uuid().safeParse(form.get("id"));
  const version = z.string().min(1).safeParse(form.get("version"));
  const list = z.enum(listNames).safeParse(form.get("list"));
  if (!id.success || !version.success || !list.success)
    return refuse(staleScreen);
  const deleted = await contentEditor().deleteListOption(id.data, version.data);
  if (!deleted.ok)
    return refuse(
      deleted.reason === "in_use"
        ? listWords.inUse
        : deleted.reason === "conflict"
          ? staleScreen
          : unavailableMessage("delete"),
    );
  publicDataChanged();
  redirect(`/admin/lists?deleted=1#list-${list.data}`);
}
