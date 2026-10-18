import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { verse } from "../../../.storybook/reminders";
import { MarginNote } from "./MarginNote";

const meta = {
  title: "Reminders/MarginNote",
  component: MarginNote,
  args: { reminder: verse("events") },
} satisfies Meta<typeof MarginNote>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
export const Donate: Story = { args: { reminder: verse("donate") } };
