import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import quiet from "@/shared/ui/page.module.css";
import { PaperLayers } from "@/shared/ui/PaperLayers";

import { verse } from "../../../.storybook/reminders";
import { starter } from "../../../.storybook/starter";
import { AboutChapters } from "./AboutChapters";

/**
 * The About page's body (PR8 D-7), moved out of the page unchanged so the
 * Pages preview draws it too (PR5b WP4). Starter text; example team.
 */
const meta = {
  title: "Pages/About chapters",
  component: AboutChapters,
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
    about: starter.about,
    verse: verse("community"),
    team: [
      {
        id: "00000000-0000-4000-8000-000000000101",
        name: "Executive board",
        kind: "executive",
        people: [
          {
            id: "00000000-0000-4000-8000-000000000201",
            fullName: "Omar Haddad",
            roleTitle: "President",
            photoPath: null,
          },
        ],
      },
    ],
  },
} satisfies Meta<typeof AboutChapters>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Chapters: Story = {};
export const ChaptersDark: Story = { globals: { theme: "dark" } };
