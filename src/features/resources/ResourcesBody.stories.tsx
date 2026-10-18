import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import quiet from "@/shared/ui/page.module.css";
import { PaperLayers } from "@/shared/ui/PaperLayers";

import { verse } from "../../../.storybook/reminders";
import { starter } from "../../../.storybook/starter";
import { ResourcesBody } from "./ResourcesBody";

/**
 * The Resources page's body, shared by the page and the Pages preview (PR5b
 * WP4): the heading, the shelf and the newsletter archive (issues from the
 * newsletter editor; none here).
 */
const meta = {
  title: "Pages/Resources",
  component: ResourcesBody,
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
    content: starter.resources,
    newsletters: { ...starter.newsletters, issues: [], unavailable: false },
    initialCategory: "all",
    categories: [
      { slug: "guide", name: "Guide" },
      { slug: "incoming-students", name: "Incoming students" },
    ],
    verse: verse("resources"),
  },
} satisfies Meta<typeof ResourcesBody>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Shelf: Story = {};
export const ShelfDark: Story = { globals: { theme: "dark" } };
