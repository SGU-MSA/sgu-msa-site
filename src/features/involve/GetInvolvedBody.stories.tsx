import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import quiet from "@/shared/ui/page.module.css";
import { PaperLayers } from "@/shared/ui/PaperLayers";

import { verse } from "../../../.storybook/reminders";
import { starter } from "../../../.storybook/starter";
import { GetInvolvedBody } from "./GetInvolvedBody";

/**
 * The Get Involved page's body (PR8 D-4), shared by the page and the Pages
 * preview (PR5b WP4). The starter forms are closed, so each pathway shows
 * its form's closed line; "One form open" shows the button.
 */
const meta = {
  title: "Pages/Get involved chooser",
  component: GetInvolvedBody,
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
    content: starter["get-involved"],
    forms: starter.forms,
    verse: verse("events"),
  },
} satisfies Meta<typeof GetInvolvedBody>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FormsClosed: Story = {};
export const FormsClosedDark: Story = { globals: { theme: "dark" } };
export const OneFormOpen: Story = {
  args: {
    forms: {
      forms: Object.fromEntries(
        Object.entries(starter.forms.forms).map(([key, entry]) => [
          key,
          { ...entry, open: true },
        ]),
      ),
    },
  },
};
export const OneFormOpenDark: Story = {
  ...OneFormOpen,
  globals: { theme: "dark" },
};
