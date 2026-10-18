import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PrivacyLedger } from "./PrivacyLedger";

/** The Privacy page, "Ledger" (PR8 D-7), in light and dark. */
const meta = {
  title: "Pages/Privacy",
  component: PrivacyLedger,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PrivacyLedger>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Notice: Story = {};
export const NoticeDark: Story = { globals: { theme: "dark" } };
