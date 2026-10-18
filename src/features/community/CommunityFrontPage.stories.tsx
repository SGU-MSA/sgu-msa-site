import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { recordSchema } from "@/lib/community/schema";

import { verse } from "../../../.storybook/reminders";
import { starter } from "../../../.storybook/starter";
import { CommunityFrontPage } from "./CommunityFrontPage";
import { buildFeed, type RecordsResult } from "./feed";

/**
 * The /community front page in each state the page can show. The feed is
 * built by the page's own rules (`buildFeed`) from story rows (no photos).
 */
const row = (n: number, title: string, summary: string, date: string) =>
  recordSchema.parse({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    title,
    summary,
    date,
    published: true,
  });
const read = (
  records: ReturnType<typeof row>[],
  extra: Partial<RecordsResult> = {},
): RecordsResult => ({
  records,
  unavailable: false,
  provenance: "sample",
  ...extra,
});

const announcements = [
  row(
    1,
    "A warm welcome to new students",
    "Drop by the Musallah after Dhuhr to meet the board.",
    "2026-10-03",
  ),
];
const news = [
  row(
    2,
    "Small moments. Stronger connections.",
    "Highlights from welcome week.",
    "2026-10-01",
  ),
  row(
    3,
    "Meet the people who make it possible",
    "The volunteers who keep the Musallah running.",
    "2026-09-28",
  ),
];

const meta = {
  title: "Pages/Community front page",
  component: CommunityFrontPage,
  parameters: { layout: "fullscreen" },
  args: {
    content: starter.community,
    verse: verse("community"),
    feed: buildFeed(read(announcements), read(news)),
  },
} satisfies Meta<typeof CommunityFrontPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Updates: Story = {};
export const UpdatesDark: Story = { globals: { theme: "dark" } };

/** Announcements failed to load; news still shows under the alert. */
export const PartlyUnavailable: Story = {
  args: {
    feed: buildFeed(read([], { unavailable: true }), read(news)),
  },
};
export const PartlyUnavailableDark: Story = {
  ...PartlyUnavailable,
  globals: { theme: "dark" },
};

export const Empty: Story = {
  args: { feed: buildFeed(read([]), read([])) },
};
export const EmptyDark: Story = { ...Empty, globals: { theme: "dark" } };
