import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { recordSchema } from "@/lib/community/schema";

import { verse } from "../../../.storybook/reminders";
import { CommunityPost } from "./CommunityPost";

/**
 * One community update as an article. Stories have no uploaded photos, so
 * the photo sheet (shown only for an uploaded image) is not pictured here.
 */
const meta = {
  title: "Pages/Community post",
  component: CommunityPost,
  parameters: { layout: "fullscreen" },
  args: {
    kind: "Community news",
    verse: verse("community"),
    row: recordSchema.parse({
      id: "00000000-0000-4000-8000-000000000002",
      title: "Small moments. Stronger connections.",
      summary: "Example story about community life.",
      body: "Example first paragraph of the story.\n\nExample second paragraph,\nwith a line break the board typed.",
      date: "2026-10-01",
      url: "https://example.org/",
      published: true,
    }),
  },
} satisfies Meta<typeof CommunityPost>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Article: Story = {};
export const ArticleDark: Story = { globals: { theme: "dark" } };
