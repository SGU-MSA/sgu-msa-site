import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ButtonLink } from "./ButtonLink";
import { InkRing, InkRingAround } from "./InkRing";

function NextPrayer() {
  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        padding: "1.25rem 1.75rem",
      }}
    >
      <InkRing />
      <p
        style={{
          position: "relative",
          color: "var(--muted)",
          fontSize: "0.75rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}
      >
        Next prayer · Asr
      </p>
      <p
        style={{
          position: "relative",
          fontFamily: "var(--font-display)",
          fontSize: "4rem",
          lineHeight: 1,
        }}
      >
        3:15 PM
      </p>
    </div>
  );
}

const meta = {
  title: "Paper/InkRing",
  component: InkRing,
  render: () => <NextPrayer />,
} satisfies Meta<typeof InkRing>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };

/** The ring drawn just outside the page's one most important action. */
export const AroundAnAction: Story = {
  render: () => (
    <div style={{ padding: "2rem" }}>
      <InkRingAround>
        <ButtonLink href="/donate">Continue to donate</ButtonLink>
      </InkRingAround>
    </div>
  ),
};
export const AroundAnActionDark: Story = {
  ...AroundAnAction,
  globals: { theme: "dark" },
};
