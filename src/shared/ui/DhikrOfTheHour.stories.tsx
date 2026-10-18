import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { dhikr } from "../../../.storybook/reminders";
import { DhikrOfTheHour } from "./DhikrOfTheHour";

const meta = {
  title: "Reminders/DhikrOfTheHour",
  component: DhikrOfTheHour,
  args: { reminder: dhikr("morning") },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "25rem" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DhikrOfTheHour>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Morning: Story = {};
export const MorningDark: Story = { globals: { theme: "dark" } };
export const AfterPrayer: Story = { args: { reminder: dhikr("after-prayer") } };
export const Friday: Story = { args: { reminder: dhikr("friday") } };
export const Evening: Story = { args: { reminder: dhikr("evening") } };
export const Night: Story = { args: { reminder: dhikr("night") } };
