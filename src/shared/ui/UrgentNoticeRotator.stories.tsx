import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MotionConfig } from "motion/react";

import { UrgentNoticeRotator } from "./UrgentNoticeRotator";

// The three notices of the approved mockup (variant D), newest first.
const three = [
  {
    id: "jumuah",
    title: "No Jumu’ah at the Musallah this Friday (16 Oct)",
    href: "/community/announcements/jumuah",
  },
  {
    id: "eid",
    title: "Eid al-Adha prayer: Tue 8:00 AM, Main Hall",
    href: "/community/announcements/eid",
  },
  {
    id: "iftar",
    title: "Iftar sign-up closes tonight",
    href: "/community/announcements/iftar",
  },
];

const meta = {
  title: "Chrome/UrgentNoticeRotator",
  component: UrgentNoticeRotator,
  args: { notices: three },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof UrgentNoticeRotator>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Three: Story = {};
export const ThreeDark: Story = { globals: { theme: "dark" } };
export const One: Story = { args: { notices: three.slice(0, 1) } };
export const OneDark: Story = {
  args: { notices: three.slice(0, 1) },
  globals: { theme: "dark" },
};
/** As with "Reduce motion" on: never moves by itself; arrows and dots swap with no slide. */
export const ReducedMotion: Story = {
  decorators: [
    (Story) => (
      <MotionConfig reducedMotion="always">
        <Story />
      </MotionConfig>
    ),
  ],
};
export const ReducedMotionDark: Story = {
  ...ReducedMotion,
  globals: { theme: "dark" },
};
