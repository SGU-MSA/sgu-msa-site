import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { hijriDate } from "@/lib/time/hijri";
import quiet from "@/shared/ui/page.module.css";
import { PaperLayers } from "@/shared/ui/PaperLayers";

import { verse } from "../../../.storybook/reminders";
import { starter } from "../../../.storybook/starter";
import { MusallahMap } from "./MusallahMap";
import { PrayerBody } from "./PrayerBody";

// A fixed instant, so the story never changes with the day it is viewed.
const now = new Date("2026-10-03T14:00:00Z");

/**
 * The Prayer & Musallah page's body, shared by the page and the Pages
 * preview (PR5b WP4). Example iqamah times without calculated starts (the
 * pin is set on the live site); starter page text.
 */
const meta = {
  title: "Pages/Prayer and Musallah",
  component: PrayerBody,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className={quiet.page}>
        <PaperLayers />
        <Story />
      </div>
    ),
  ],
  args: {
    prayer: {
      ...starter.prayer,
      notice: starter.prayer.schedule_note,
      last_updated_label: null,
    },
    jumuah: {
      ...starter.jumuah,
      gatherings: [
        {
          id: "primary",
          khutbah: "1:15 PM",
          iqamah: "1:30 PM",
        },
      ],
      change: null,
    },
    musallah: starter.musallah,
    forms: starter.forms,
    today: {
      dateLabel: "Saturday, October 3",
      hijri: hijriDate(now, 0),
      rows: [
        { id: "fajr", label: "Fajr", begins: null, iqamah: "05:15" },
        { id: "dhuhr", label: "Dhuhr", begins: null, iqamah: "12:30" },
      ],
      startsUnavailable: false,
      nextId: "dhuhr",
      method: "Example calculation",
    },
    // The pin-unavailable box: stories load no map pictures.
    map: <MusallahMap place={null} links={null} />,
    verse: verse("prayer"),
  },
} satisfies Meta<typeof PrayerBody>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Today: Story = {};
export const TodayDark: Story = { globals: { theme: "dark" } };
