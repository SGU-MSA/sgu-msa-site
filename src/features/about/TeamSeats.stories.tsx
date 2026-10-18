import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TeamSeats } from "./TeamSeats";

const person = (id: string, fullName: string, roleTitle: string) => ({
  id: `00000000-0000-4000-8000-000000000${id}`,
  fullName,
  roleTitle,
  photoPath: null,
});

/**
 * The About team list (review fixes P4): the Executive board in tiers, then
 * "View all" for the other groups by name and role. Stories have no uploaded
 * photos, so the portrait is not pictured here.
 */
const meta = {
  title: "Pages/About team seats",
  component: TeamSeats,
  parameters: { layout: "padded" },
  args: {
    sections: [
      {
        id: "00000000-0000-4000-8000-000000000101",
        name: "Executive board",
        kind: "executive",
        people: [
          person("201", "Omar Haddad", "President"),
          person("202", "Bilal Ahmed", "Vice President (Brothers)"),
          person("203", "Aisha Rahman", "Vice President (Sisters)"),
          person("204", "Sara Malik", "Treasurer"),
          person("205", "Hamza Ali", "Secretary"),
        ],
      },
      {
        id: "00000000-0000-4000-8000-000000000102",
        name: "General board",
        kind: "general",
        people: [
          person("206", "Yusuf Ibrahim", "Musallah coordinator"),
          person("207", "Maryam Siddiqui", "Social media manager"),
        ],
      },
    ],
  },
} satisfies Meta<typeof TeamSeats>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Seats: Story = {};
export const SeatsDark: Story = { globals: { theme: "dark" } };
export const NobodyListed: Story = { args: { sections: [] } };
export const NobodyListedDark: Story = {
  args: { sections: [] },
  globals: { theme: "dark" },
};
