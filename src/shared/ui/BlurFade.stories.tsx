import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BlurFade } from "./blur-fade";

const meta = {
  title: "Motion/BlurFade",
  component: BlurFade,
  args: {
    duration: 0.6,
    blur: "4px",
    children: (
      <p style={{ fontFamily: "var(--font-display)", fontSize: "3rem" }}>
        A little closer.
      </p>
    ),
  },
} satisfies Meta<typeof BlurFade>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
