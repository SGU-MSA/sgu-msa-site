import { runtimeConfig } from "@/lib/runtime/config";

export function backendConfig() {
  const supabase = runtimeConfig().supabase;
  return supabase ? { url: supabase.url, key: supabase.publishableKey } : null;
}

/** The one session cookie policy, shared by `adminClient` and `src/proxy.ts`. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: runtimeConfig().secureCookies,
    path: "/",
  } as const;
}
