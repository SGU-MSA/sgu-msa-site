import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, deploymentProfile } from "@/lib/runtime/providers";
import { backendConfig, sessionCookieOptions } from "./config";

export async function adminClient() {
  if (deploymentProfile().adminPortal !== "ready") return null;
  const config = backendConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server components cannot write; proxy refreshes cookies. */
        }
      },
    },
  });
}

export function publicClient() {
  const config = backendConfig();
  return config
    ? createClient(config.url, config.key, {
        // Public pages show an unavailable state promptly; background page
        // refresh is the retry. SDK backoff must not hold the whole route open.
        db: { retry: false },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              cache: "no-store",
              signal: init?.signal
                ? AbortSignal.any([init.signal, AbortSignal.timeout(3000)])
                : AbortSignal.timeout(3000),
            }),
        },
      })
    : null;
}

/** The signed-in board member, or null. Every action calls this first; RLS stays the authority. */
export async function currentAdmin() {
  return adminAuth().current();
}

export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin");
  return admin;
}

/**
 * The Pages screens (review 3 B): only the Executive board edits pages; any
 * other board member is sent to the dashboard, which has no Pages for them.
 */
export async function requirePageEditor() {
  const admin = await requireAdmin();
  if (!admin.canEditPages) redirect("/admin/dashboard");
  return admin;
}
