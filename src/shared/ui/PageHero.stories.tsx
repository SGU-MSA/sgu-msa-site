import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PageHero } from "./PageHero";

const meta = {
  title: "Primitives/PageHero",
  component: PageHero,
  parameters: { layout: "fullscreen" },
  args: {
    eyebrow: "Prayer",
    title: "Prayer & Musallah",
    description:
      "Prayer times, Jumu’ah and how to find the Musallah on campus.",
  },
} satisfies Meta<typeof PageHero>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
export const WithImage: Story = {
  args: {
    image: {
      src: "/images/prayer/musallah-interior.webp",
      alt: "",
      historical: false,
    },
  },
};
export const Compact: Story = { args: { compact: true } };
