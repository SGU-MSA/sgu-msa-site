import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TonightPanel } from "./TonightPanel";

/**
 * A Ramadan-month season page's Tonight sheet (PR5c): Iftar is Maghrib's
 * start and Tarawih is Isha's iqamah, from Prayer & iqamah. It shows only
 * from the evening before the first fast to the last day of the month.
 */
const meta = {
  title: "Pages/Season tonight",
  component: TonightPanel,
  parameters: { layout: "padded" },
  args: {
    night: "Night 12",
    date: "Saturday, February 20",
    rows: [
      { label: "Iftar", value: "18:22" },
      { label: "Tarawih", value: "19:45" },
    ],
  },
} satisfies Meta<typeof TonightPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const InSeason: Story = {};
export const InSeasonDark: Story = { globals: { theme: "dark" } };
export const EidEve: Story = {
  args: { night: null, rows: [{ label: "Iftar", value: "18:24" }] },
};
