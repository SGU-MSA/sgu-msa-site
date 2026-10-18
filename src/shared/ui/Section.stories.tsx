import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ButtonLink } from "./ButtonLink";
import { Section } from "./Section";

const meta = {
  title: "Primitives/Section",
  component: Section,
  parameters: { layout: "fullscreen" },
  args: {
    kicker: "This week",
    title: "Upcoming at MSA",
    intro: "Prayer, learning and time together, open to every student.",
    action: (
      <ButtonLink href="/calendar" variant="outline">
        All events
      </ButtonLink>
    ),
    children: <p>Section content.</p>,
  },
} satisfies Meta<typeof Section>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Paper: Story = {};
export const PaperDark: Story = { globals: { theme: "dark" } };
export const Elevated: Story = { args: { tone: "elevated" } };
export const LightBand: Story = { args: { tone: "light", bordered: true } };
export const LightBandDark: Story = {
  args: { tone: "light", bordered: true },
  globals: { theme: "dark" },
};
