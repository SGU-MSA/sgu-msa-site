import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArchiveTag, PocBadge } from "./Meta";

function Labels() {
  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      <PocBadge />
      <ArchiveTag year={2024} />
    </div>
  );
}

const meta = {
  title: "Primitives/Meta",
  component: Labels,
} satisfies Meta<typeof Labels>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
