import localFont from "next/font/local";

/*
 * Quiet Paper type (ADR 0018), self-hosted from @fontsource packages for the
 * font-src 'self' CSP. Each sets a --font-face-* variable that
 * src/styles/tokens.css turns into --font-display, --font-body, --font-arabic
 * and --font-lux. Shared by the root layout and Storybook.
 */
const displayFont = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-face-display",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
const bodyFont = localFont({
  src: "../../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2",
  variable: "--font-face-body",
  weight: "400 700",
  display: "swap",
  adjustFontFallback: "Arial",
});
const arabicFont = localFont({
  src: "../../node_modules/@fontsource/amiri-quran/files/amiri-quran-arabic-400-normal.woff2",
  variable: "--font-face-arabic",
  weight: "400",
  display: "swap",
  preload: false,
});
const luxFont = localFont({
  src: "../../node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2",
  variable: "--font-face-lux",
  weight: "300 700",
  display: "swap",
  preload: false,
});
export const fontVariables = [displayFont, bodyFont, arabicFont, luxFont]
  .map((font) => font.variable)
  .join(" ");
