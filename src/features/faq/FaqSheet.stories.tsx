import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import quiet from "@/shared/ui/page.module.css";

import { starter } from "../../../.storybook/starter";
import { FaqSheet } from "./FaqSheet";

/** The FAQ page's body (PR8 D-7), shared by the page and the Pages preview (PR5b WP4). */
const meta = {
  title: "Pages/FAQ folded notes",
  component: FaqSheet,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className={quiet.page}>
        <Story />
      </div>
    ),
  ],
  args: { faq: starter.faq },
} satisfies Meta<typeof FaqSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Questions: Story = {};
export const QuestionsDark: Story = { globals: { theme: "dark" } };
export const Empty: Story = { args: { faq: { ...starter.faq, items: [] } } };
export const EmptyDark: Story = { ...Empty, globals: { theme: "dark" } };
