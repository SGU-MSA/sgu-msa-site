import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { hijriDate } from "@/lib/time/hijri";

import { HijriDate } from "./HijriDate";

// A fixed instant, so the story never changes with the day it is viewed.
const morning = hijriDate(new Date("2026-10-03T14:00:00Z"), 0);

const meta = {
  title: "Reminders/HijriDate",
  component: HijriDate,
  args: { hijri: morning },
} satisfies Meta<typeof HijriDate>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
// After Maghrib the next date shows, with no "from Maghrib" wording (D-11).
// With the normal date first, as on Home and Ramadan's Tonight sheet (D-11).
export const WithDate: Story = { args: { date: "Saturday, October 3" } };
export const WithDateDark: Story = {
  args: { date: "Saturday, October 3" },
  globals: { theme: "dark" },
};
export const FullMoon: Story = { args: { hijri: { ...morning, day: 14 } } };
