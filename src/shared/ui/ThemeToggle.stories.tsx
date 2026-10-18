import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ThemeToggle } from "./ThemeToggle";

const meta = {
  title: "Chrome/ThemeToggle",
  component: ThemeToggle,
} satisfies Meta<typeof ThemeToggle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
