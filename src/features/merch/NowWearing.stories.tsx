import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { MerchCollectionView } from "@/lib/community/merch";
import { merchSchema } from "@/lib/content/schemas";

import { NowWearing } from "./NowWearing";

/**
 * The /merch page body in each state it can show (PR5c). Photos show the
 * placeholder; size buttons are in-page Give addresses, never a Go2Pay page.
 */
const content = merchSchema.parse({
  hero: {
    eyebrow: "Three collections",
    title: "Merch",
    description: "What the MSA has made, and what students wear now.",
  },
  garment_note: "All MSA shirts are long-sleeve.",
});

const photo = (name: string) => ({
  src: `/images/merch/${name}.webp`,
  alt: `The ${name} photo`,
});
const shirt = (
  id: string,
  name: string,
  sizes: string[],
  photos: string[],
): MerchCollectionView["items"][number] => ({
  id,
  name,
  description: "A long-sleeve with a print across the back.",
  garment: "Long-sleeve",
  colorway: "Navy",
  photos: photos.map(photo),
  sizes: sizes.map((label) => ({
    label,
    giveHref: `/donate/shirt-${label.toLowerCase()}/give`,
  })),
});

const lead: MerchCollectionView = {
  id: "shukr",
  name: "Shukr",
  arabic: "شكر",
  quote: "Give thanks in ease and in hardship.",
  year: "2026",
  description: "The current MSA collection.",
  era: "current",
  items: [
    shirt("a", "Shukr long-sleeve", ["S", "M", "L", "XL"], ["front", "back"]),
  ],
};
const past: MerchCollectionView[] = [
  {
    id: "green",
    name: "Green Collection",
    arabic: "قلب سليم",
    quote: "",
    year: "",
    description: "The first MSA collection.",
    era: "past",
    items: [shirt("b", "Green long-sleeve", [], ["green"])],
  },
  {
    id: "maroon",
    name: "Maroon Collection",
    arabic: "حيث تطمئن القلوب",
    quote: "In remembrance, hearts find ease.",
    year: "",
    description: "",
    era: "past",
    items: [shirt("c", "Maroon long-sleeve", [], ["full", "back", "detail"])],
  },
];

const meta = {
  title: "Pages/Merch",
  component: NowWearing,
  parameters: { layout: "fullscreen" },
  args: { content, data: { state: "ready", lead, others: past } },
} satisfies Meta<typeof NowWearing>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OnSale: Story = {};
export const OnSaleDark: Story = { globals: { theme: "dark" } };
export const NothingOnSale: Story = {
  args: { data: { state: "ready", lead: null, others: past } },
};
export const Empty: Story = {
  args: { data: { state: "ready", lead: null, others: [] } },
};
export const Unavailable: Story = { args: { data: { state: "unavailable" } } };
