import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SocialIcon } from "./SocialIcon";

const kinds = ["instagram", "facebook", "whatsapp", "email", "other"];

/** Every social link kind, as the footer's Connect links show them. */
function SocialIcons() {
  return (
    <ul
      style={{
        display: "flex",
        gap: "0.5rem",
        padding: 0,
        listStyle: "none",
      }}
    >
      {kinds.map((kind) => (
        <li key={kind}>
          <a
            href={`#${kind}`}
            aria-label={`MSA ${kind}`}
            className="nav-icon-button inline-grid"
          >
            <SocialIcon kind={kind} />
          </a>
        </li>
      ))}
    </ul>
  );
}

const meta = {
  title: "Primitives/SocialIcon",
  component: SocialIcons,
} satisfies Meta<typeof SocialIcons>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
