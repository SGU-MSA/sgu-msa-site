import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PhotoPlaceholder } from "./PhotoPlaceholder";
import { SafeImage } from "./SafeImage";

/** SafeImage shows a shot brief (PhotoPlaceholder) until an approved photo exists. */
function Photos() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
        gap: "1.5rem",
      }}
    >
      <div style={{ position: "relative", height: "14rem" }}>
        <PhotoPlaceholder
          brief="A wide, well-lit view of your prayer space"
          fill
        />
      </div>
      <div style={{ position: "relative", height: "14rem" }}>
        <SafeImage
          image={{
            src: "/images/placeholder/editorial.svg",
            alt: "",
          }}
          fill
        />
      </div>
    </div>
  );
}

const meta = {
  title: "Primitives/SafeImage and PhotoPlaceholder",
  component: Photos,
} satisfies Meta<typeof Photos>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
