/**
 * Page colours for places CSS cannot reach (the viewport's theme colour, the
 * manifest, the link-preview card). Not a source of truth: the values are
 * `--paper`, `--ink` and `--seal-mint` in src/styles/tokens.css, and
 * tests/site-essentials.test.ts fails when they drift apart.
 */
export const pageColours = {
  /** Green Ink, the light theme. */
  light: { paper: "#f6f3ec", ink: "#1f3d33", sealMint: "#cad6cc" },
  /** Dusk, the dark theme. */
  dark: { paper: "#24221e" },
} as const;
