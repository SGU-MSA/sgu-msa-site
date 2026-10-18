import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Rubric } from "./Rubric";

/** The rubric at the margin note's size, in the ring colour. */
function RubricMark() {
  return (
    <div style={{ width: "1rem", height: "1rem", fill: "var(--ring)" }}>
      <Rubric />
    </div>
  );
}

const meta = {
  title: "Paper/Rubric",
  component: RubricMark,
} satisfies Meta<typeof RubricMark>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
