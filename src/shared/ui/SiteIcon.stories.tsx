import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Container } from "./Container";
import { SiteIcon } from "./SiteIcon";

const names = [
  "prayer",
  "calendar",
  "community",
  "map",
  "moon",
  "support",
  "volunteer",
  "book",
];

/** The one icon family, inside the shared Container. */
function Icons() {
  return (
    <Container>
      <ul
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem",
          padding: 0,
          listStyle: "none",
          color: "var(--ink)",
        }}
      >
        {names.map((name) => (
          <li
            key={name}
            style={{ display: "grid", justifyItems: "center", gap: "0.5rem" }}
          >
            <SiteIcon name={name} aria-hidden="true" className="size-6" />
            <code style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {name}
            </code>
          </li>
        ))}
      </ul>
    </Container>
  );
}

const meta = {
  title: "Primitives/SiteIcon and Container",
  component: Icons,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Icons>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
