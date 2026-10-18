import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ButtonLink } from "./ButtonLink";

const meta = {
  title: "Primitives/ButtonLink",
  component: ButtonLink,
  args: { href: "/prayer", children: "Find the Musallah" },
} satisfies Meta<typeof ButtonLink>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const PrimaryDark: Story = { globals: { theme: "dark" } };
export const Outline: Story = {
  args: { variant: "outline", children: "Explore events" },
};
export const OutlineDark: Story = {
  args: { variant: "outline", children: "Explore events" },
  globals: { theme: "dark" },
};
export const Text: Story = {
  args: { variant: "text", children: "All events" },
};
export const External: Story = {
  args: { href: "https://www.sgu.edu", children: "SGU" },
};
