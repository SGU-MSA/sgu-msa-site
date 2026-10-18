import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { backendConfig, sessionCookieOptions } from "@/lib/backend/config";
import { runtimeConfig } from "@/lib/runtime/config";
import { deploymentProfileFor } from "@/lib/runtime/wiring";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = backendConfig();
  // The pure policy, not the server-only composition point: the proxy is not a render.
  if (config && deploymentProfileFor(runtimeConfig()).adminPortal === "ready") {
    const client = createServerClient(config.url, config.key, {
      cookieOptions: sessionCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    await client.auth.getUser();
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
