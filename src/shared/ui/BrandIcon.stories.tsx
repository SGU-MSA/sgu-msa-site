import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BrandIcon, type BrandIconName } from "./BrandIcon";

const names: BrandIconName[] = ["instagram", "facebook"];

/** The official one-colour brand marks, as the footer's social links show them. */
function BrandIcons() {
  return (
    <ul
      style={{
        display: "flex",
        gap: "0.5rem",
        padding: 0,
        listStyle: "none",
      }}
    >
      {names.map((name) => (
        <li key={name}>
          <a
            href={`https://www.${name}.com/sgumsa`}
            aria-label={`MSA on ${name === "instagram" ? "Instagram" : "Facebook"}`}
            className="nav-icon-button inline-grid"
          >
            <BrandIcon name={name} />
          </a>
        </li>
      ))}
    </ul>
  );
}

const meta = {
  title: "Primitives/BrandIcon",
  component: BrandIcons,
} satisfies Meta<typeof BrandIcons>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
