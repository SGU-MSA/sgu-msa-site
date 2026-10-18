import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { InkHeading } from "./InkHeading";
import s from "./page.module.css";

/** The Quiet Paper headline: ink first line, italic muted second line. */
function InkHeadings() {
  return (
    <div style={{ display: "grid", gap: "2.5rem" }}>
      <InkHeading text="Our community, built by students" />
      <InkHeading text="Prayer & Musallah" className={s.h2Small} inline />
      <InkHeading as="h1" text="Upcoming at MSA" className={s.display} />
    </div>
  );
}

const meta = {
  title: "Primitives/InkHeading",
  component: InkHeadings,
} satisfies Meta<typeof InkHeadings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
