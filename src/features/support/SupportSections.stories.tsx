import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { starter } from "../../../.storybook/starter";
import { SupportSections } from "./SupportSections";

/** The Support page's sections, shared by the page and the Pages preview (PR5b WP4). */
const meta = {
  title: "Pages/Support",
  component: SupportSections,
  parameters: { layout: "fullscreen" },
  args: { support: starter.support },
} satisfies Meta<typeof SupportSections>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sections: Story = {};
export const SectionsDark: Story = { globals: { theme: "dark" } };
