import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { verse } from "../../../.storybook/reminders";
import { MeaningTip } from "./MeaningTip";

const meta = {
  title: "Reminders/MeaningTip",
  component: MeaningTip,
  args: { reminder: verse("home") },
} satisfies Meta<typeof MeaningTip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
/**
 * Opens by keyboard and closes with Escape. The bubble shows the meaning and
 * the reference only, never the source line (PR8 D-6).
 */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Show the meaning" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const body = within(canvasElement.ownerDocument.body);
    const tip = await body.findByRole("dialog");
    await expect(tip).toBeVisible();
    await expect(tip).toHaveTextContent(args.reminder.meaning);
    await expect(tip).toHaveTextContent(args.reminder.reference);
    await expect(tip).not.toHaveTextContent(args.reminder.source);
    await userEvent.keyboard("{Escape}");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  },
};
