import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { reminders } from "../../../.storybook/reminders";

/**
 * The Quiet Paper tokens (src/styles/tokens.css). Switch Theme in the
 * toolbar to compare light (Green Ink) and dark (Dusk).
 */
const colours = [
  ["--paper", "Page"],
  ["--paper-light", "Raised sheet, cards, tips"],
  ["--paper-deep", "Back sheet, light bands"],
  ["--band", "Verse band"],
  ["--ink", "Text, filled buttons"],
  ["--muted", "Secondary text"],
  ["--rule", "Hairlines"],
  ["--ring", "Ink ring, focus, accents"],
  ["--thread", "Tasbih thread"],
  ["--on-ink-muted", "Muted text on ink"],
  ["--on-ink-rule", "Rules on ink"],
  ["--seal-ink", "Seal ink"],
  ["--seal-mint", "Seal mint"],
  ["--seal-cream", "Seal cream"],
  ["--status-danger", "Errors"],
  ["--status-success", "Success"],
  ["--category-msa", "Category: MSA"],
  ["--category-academic", "Category: academic"],
  ["--category-informational", "Category: informational"],
  ["--category-faith", "Category: faith"],
  ["--category-social", "Category: social"],
] as const;

const fonts = [
  ["--font-display", "Instrument Serif", "A little closer."],
  ["--font-body", "Instrument Sans", "Prayer, events and community at SGU."],
  ["--font-lux", "Cormorant Garamond", "FAITH · KNOWLEDGE · COMMUNITY"],
] as const;

function Tokens() {
  return (
    <div style={{ display: "grid", gap: "2.5rem", color: "var(--ink)" }}>
      <section>
        <h2 style={{ fontSize: "var(--type-h3)" }}>Colour</h2>
        <ul
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))",
            gap: "1rem",
            padding: 0,
            listStyle: "none",
          }}
        >
          {colours.map(([token, use]) => (
            <li key={token}>
              <span
                style={{
                  display: "block",
                  height: "3.5rem",
                  border: "1px solid var(--rule)",
                  background: `var(${token})`,
                }}
              />
              <code style={{ fontSize: "0.8rem" }}>{token}</code>
              <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{use}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 style={{ fontSize: "var(--type-h3)" }}>Type</h2>
        {fonts.map(([token, name, sample]) => (
          <p key={token} style={{ marginTop: "1rem" }}>
            <code style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              {token} · {name}
            </code>
            <span
              style={{
                display: "block",
                fontFamily: `var(${token})`,
                fontSize: "2rem",
              }}
            >
              {sample}
            </span>
          </p>
        ))}
        <p style={{ marginTop: "1rem" }}>
          <code style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            --font-arabic · Amiri Quran (reminders only)
          </code>
          <span
            lang="ar"
            dir="rtl"
            style={{
              display: "block",
              fontFamily: "var(--font-arabic)",
              fontSize: "2rem",
            }}
          >
            {reminders.tasbih?.phrases[0]}
          </span>
        </p>
      </section>
      <section>
        <h2 style={{ fontSize: "var(--type-h3)" }}>Scale</h2>
        {["--type-h1", "--type-h2", "--type-h3", "--type-body"].map((token) => (
          <p
            key={token}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: `var(${token})`,
              lineHeight: 1.1,
              marginTop: "0.75rem",
            }}
          >
            {token}
          </p>
        ))}
        <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
          {[
            "--space-xs",
            "--space-sm",
            "--space-md",
            "--space-lg",
            "--space-xl",
            "--space-2xl",
          ].map((token) => (
            <div key={token} style={{ textAlign: "center" }}>
              <span
                style={{
                  display: "block",
                  width: `var(${token})`,
                  height: `var(${token})`,
                  background: "var(--ring)",
                }}
              />
              <code style={{ fontSize: "0.7rem" }}>{token}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const meta = {
  title: "Foundations/Tokens",
  component: Tokens,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Tokens>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
