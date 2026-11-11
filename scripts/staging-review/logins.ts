// The three review logins: created or updated with the Auth Admin API (never by invite email).
import type { SupabaseClient } from "@supabase/supabase-js";
import { reviewLogins, type ResetInput } from "./plan";

export async function ensureLogins(
  client: SupabaseClient,
  users: { id: string; email?: string }[],
  input: ResetInput,
) {
  const ids = {} as Record<"president" | "treasurer" | "board", string>;
  for (const login of reviewLogins(input.loginDomain)) {
    const password = input.passwords[login.role];
    const known = users.find(
      (user) => user.email?.toLowerCase() === login.email.toLowerCase(),
    );
    if (known) {
      const { error } = await client.auth.admin.updateUserById(known.id, {
        password,
        email_confirm: true,
        ban_duration: "none",
      });
      if (error)
        throw new Error(
          `Updating the ${login.role} login failed: ${error.message}`,
        );
      ids[login.role] = known.id;
    } else {
      const { data, error } = await client.auth.admin.createUser({
        email: login.email,
        password,
        email_confirm: true,
      });
      if (error || !data.user)
        throw new Error(
          `Creating the ${login.role} login failed: ${error?.message ?? "no user returned"}`,
        );
      ids[login.role] = data.user.id;
    }
  }
  return ids;
}
