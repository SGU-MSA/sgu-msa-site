import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { SortableList } from "./SortableList";

const team = [
  { id: "1", name: "Yusuf Ibrahim", role: "Musallah coordinator" },
  { id: "2", name: "Zainab Hussain", role: "Social media manager" },
  { id: "3", name: "Idris Bello", role: "Brothers coordinator" },
  { id: "4", name: "Huda Karim", role: "Sisters coordinator" },
];

function Team({ look }: { look: "rows" | "cards" }) {
  const [items, setItems] = useState(team);
  return (
    <SortableList
      items={items}
      itemKey={(item) => item.id}
      itemName={(item) => item.name}
      onReorder={setItems}
      label="General board"
      look={look}
    >
      {(item) => (
        <div>
          <strong>{item.name}</strong>
          <p style={{ color: "var(--muted)" }}>{item.role}</p>
        </div>
      )}
    </SortableList>
  );
}

const meta = {
  title: "Primitives/SortableList",
  component: Team,
  args: { look: "rows" },
} satisfies Meta<typeof Team>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rows: Story = {};
export const RowsDark: Story = { globals: { theme: "dark" } };
export const Cards: Story = { args: { look: "cards" } };
export const CardsDark: Story = {
  args: { look: "cards" },
  globals: { theme: "dark" },
};
