import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PasswordInput } from "./PasswordInput";

const meta = {
  title: "Primitives/PasswordInput",
  component: PasswordInput,
  args: { name: "password", defaultValue: "correct horse battery" },
  decorators: [
    (Story) => (
      <label style={{ display: "block", maxWidth: "22rem" }}>
        Password
        <Story />
      </label>
    ),
  ],
} satisfies Meta<typeof PasswordInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
