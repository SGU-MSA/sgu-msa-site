import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Seal } from "./Seal";

const meta = {
  title: "Brand/Seal",
  component: Seal,
  args: { size: 120, label: "SGU Muslim Students Association crest" },
} satisfies Meta<typeof Seal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
export const Decorative: Story = { args: { size: 52, label: undefined } };
