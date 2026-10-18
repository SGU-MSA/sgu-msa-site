import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import quiet from "@/shared/ui/page.module.css";

import { verse } from "../../../.storybook/reminders";
import { starter } from "../../../.storybook/starter";
import { CalendarBody } from "./CalendarBody";

/**
 * The Calendar page's body, shared by the page and the Pages preview (PR5b
 * WP4): the heading and the explorer. Events come from the dashboard; the
 * stories show the empty and unavailable states.
 */
const meta = {
  title: "Pages/Calendar",
  component: CalendarBody,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className={quiet.page}>
        <Story />
      </div>
    ),
  ],
  args: {
    content: starter.events,
    entries: [],
    lists: { event_categories: [], terms: [] },
    today: null,
    unavailable: false,
    verse: verse("events"),
  },
} satisfies Meta<typeof CalendarBody>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoEvents: Story = {};
export const NoEventsDark: Story = { globals: { theme: "dark" } };
const subscribe = {
  file: "webcal://msa.example/calendar.ics",
  google:
    "https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fmsa.example%2Fcalendar.ics",
  outlook:
    "https://outlook.live.com/calendar/0/addfromweb?url=https%3A%2F%2Fmsa.example%2Fcalendar.ics&name=MSA",
};
export const WithSubscribe: Story = { args: { subscribe } };
export const WithSubscribeDark: Story = {
  ...WithSubscribe,
  globals: { theme: "dark" },
};
export const Unavailable: Story = { args: { unavailable: true } };
export const UnavailableDark: Story = {
  ...Unavailable,
  globals: { theme: "dark" },
};
