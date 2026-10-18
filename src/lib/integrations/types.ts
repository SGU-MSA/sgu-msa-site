/**
 * Provider-neutral shapes returned by every integration adapter.
 *
 * UI → application service → integration adapter → external provider.
 * Page components import from `lib/integrations`, never from a provider SDK,
 * so swapping Google Forms for an SGU-mandated system is an adapter change.
 */

export type LinkDestination =
  | {
      state: "ready";
      label: string;
      href: string;
      external: boolean;
      placeholder: boolean;
    }
  | {
      state: "unconfigured";
      label: string;
      /** `closed`: the board closed the sign-up form (PR5b D-7). */
      reason: "missing" | "unsafe" | "closed";
    };
