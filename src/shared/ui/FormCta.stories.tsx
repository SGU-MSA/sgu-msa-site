import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FormCtaView } from "./FormCtaView";

/** `FormCta` resolves a form key on the server; this is how each result looks. */
const meta = {
  title: "Primitives/FormCta",
  component: FormCtaView,
  args: {
    destination: {
      state: "ready",
      label: "Volunteer",
      href: "https://forms.example.org/volunteer",
      external: true,
      placeholder: false,
    },
  },
} satisfies Meta<typeof FormCtaView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const ReadyDark: Story = { globals: { theme: "dark" } };
export const Outline: Story = { args: { variant: "outline" } };
