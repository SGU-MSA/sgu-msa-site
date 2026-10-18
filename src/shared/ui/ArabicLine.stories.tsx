import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { dhikr, verse } from "../../../.storybook/reminders";
import { DhikrOfTheHour } from "./DhikrOfTheHour";
import { MarginNote } from "./MarginNote";

/**
 * One-line Arabic (PR8 D-6) in a 288px column, the content width of a 320px
 * phone: texts stay on one line and shrink to fit (every library verse is
 * short enough, Review 3 E). Nothing scrolls sideways.
 */
function Narrow() {
  return (
    <div style={{ width: "18rem", outline: "1px dashed var(--rule)" }}>
      <DhikrOfTheHour reminder={dhikr("morning")} />
      <MarginNote reminder={verse("home")} />
      <MarginNote reminder={verse("events")} />
      <MarginNote reminder={verse("prayer")} />
    </div>
  );
}

const meta = {
  title: "Reminders/One-line Arabic",
  component: Narrow,
} satisfies Meta<typeof Narrow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Phone320: Story = {};
export const Phone320Dark: Story = { globals: { theme: "dark" } };
