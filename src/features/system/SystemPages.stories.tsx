import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ErrorSignpost } from "./ErrorSignpost";
import { LoadingOutline } from "./LoadingOutline";
import {
  CLOSED_GIVING_SIGNPOST,
  GIVING_UNAVAILABLE_SIGNPOST,
  NotFoundSignpost,
} from "./NotFoundSignpost";

/**
 * The system pages, "Ledger" (PR8 D-7): page not found, the error page and
 * the loading page, in light and dark. "Try again" does nothing here.
 */
const meta = {
  title: "Pages/System pages",
  component: NotFoundSignpost,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NotFoundSignpost>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

export const NotFound: Story = {};
export const NotFoundDark: Story = { globals: { theme: "dark" } };
/** A route's own wording: an old Give link to a closed fund (PR6). */
export const ClosedFund: Story = { args: CLOSED_GIVING_SIGNPOST };
export const ClosedFundDark: Story = {
  args: CLOSED_GIVING_SIGNPOST,
  globals: { theme: "dark" },
};
/** Give when the database cannot be read: no redirect, try again later. */
export const GivingUnavailable: Story = { args: GIVING_UNAVAILABLE_SIGNPOST };
export const ErrorPage: Story = {
  render: () => <ErrorSignpost reset={noop} />,
};
export const ErrorPageDark: Story = {
  ...ErrorPage,
  globals: { theme: "dark" },
};
export const LoadingPage: Story = { render: () => <LoadingOutline /> };
export const LoadingPageDark: Story = {
  ...LoadingPage,
  globals: { theme: "dark" },
};
