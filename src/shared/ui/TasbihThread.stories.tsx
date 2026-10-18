import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { reminders } from "../../../.storybook/reminders";
import { TasbihThreadView } from "./TasbihThreadView";
import styles from "./reminders.module.css";

/** The page-level thread; stories use the client view with the YAML phrases. */
const meta = {
  title: "Reminders/TasbihThread",
  component: TasbihThreadView,
  args: { phrases: reminders.tasbih?.phrases ?? null },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className={styles.threadHost} style={{ minHeight: "260vh" }}>
        <Story />
        <p style={{ padding: "8rem 4rem", color: "var(--muted)" }}>
          Scroll: the thread draws and the beads fill.
        </p>
      </div>
    ),
  ],
} satisfies Meta<typeof TasbihThreadView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
