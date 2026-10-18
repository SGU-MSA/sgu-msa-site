import { runtimeConfig } from "@/lib/runtime/config";

/** Fail fast at server start when the configuration is missing or invalid (ADR 0012). */
export function register() {
  runtimeConfig();
}
