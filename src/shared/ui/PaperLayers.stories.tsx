import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PaperLayers } from "./PaperLayers";

function Layered() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: "60rem",
        background: "var(--paper)",
      }}
    >
      <PaperLayers />
      <div
        style={{
          position: "relative",
          padding: "8rem 3rem",
          maxWidth: "36rem",
        }}
      >
        <h2 style={{ fontSize: "var(--type-h2)" }}>
          Paper sheets behind a section
        </h2>
        <p style={{ color: "var(--muted)", marginTop: "1rem" }}>
          Two sheets sit under the content; text stays on plain paper tones.
        </p>
      </div>
    </div>
  );
}

const meta = {
  title: "Paper/PaperLayers",
  component: PaperLayers,
  render: () => <Layered />,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PaperLayers>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
