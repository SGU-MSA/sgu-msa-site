import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { NoiseTexture } from "./noise-texture";

const meta = {
  title: "Paper/NoiseTexture",
  component: NoiseTexture,
  decorators: [
    (Story) => (
      <div
        style={{
          position: "relative",
          height: "16rem",
          background: "var(--paper-light)",
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NoiseTexture>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
