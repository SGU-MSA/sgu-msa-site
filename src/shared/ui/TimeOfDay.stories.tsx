import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TimeOfDay } from "./TimeOfDay";

// Stored 24-hour values, a calculated instant (5:56 PM in Grenada) and
// hand-written text, which shows as written.
function Times() {
  return (
    <dl style={{ display: "grid", gap: "0.5rem", color: "var(--ink)" }}>
      {(
        [
          ["Stored 00:00", "00:00"],
          ["Stored 05:30", "05:30"],
          ["Stored 12:00", "12:00"],
          ["Stored 13:30", "13:30"],
          ["Calculated instant", new Date("2026-10-03T21:56:00Z")],
          ["Written in content", "6:40 PM"],
          ["Not a time", "After Isha"],
        ] as const
      ).map(([label, value]) => (
        <div key={label} style={{ display: "flex", gap: "1rem" }}>
          <dt style={{ minWidth: "11rem" }}>{label}</dt>
          <dd>
            <TimeOfDay value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

const meta = {
  title: "Primitives/TimeOfDay",
  component: Times,
} satisfies Meta<typeof Times>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
