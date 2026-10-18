import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { openFreeMapHost } from "@/lib/maps/style";

import { PinMap, type PinMapProps } from "./PinMap";

/**
 * The musallah map (PR7, "3 + campus names"): real OpenFreeMap tiles in the
 * paper colours, the small dot with its tag, light and dark. Campus building
 * names come from the site's own route, so Storybook shows the map without
 * them. Needs a network connection.
 */
const pin = { latitude: 12.0025521, longitude: -61.7723834 };

/** The map in a box of the public height, with the caller's failure line. */
function Framed(props: PinMapProps) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{ height: "18rem", maxWidth: "40rem" }}>
      {failed ? (
        <p>The map can’t be shown right now.</p>
      ) : (
        <PinMap {...props} onUnavailable={() => setFailed(true)} />
      )}
    </div>
  );
}

const meta = {
  title: "Shared/PinMap",
  component: PinMap,
  args: { center: pin, label: "SGU Musallah", names: null },
  render: (args) => <Framed {...args} />,
} satisfies Meta<typeof PinMap>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Public: Story = {};
export const PublicDark: Story = { globals: { theme: "dark" } };
/** The dashboard's editor: the dot can be dragged or moved with the arrow keys. */
export const Draggable: Story = {
  args: {
    draggable: true,
    dotLabel: "Musallah pin. Use the arrow keys to move it.",
    movedMessage: "Pin moved, not saved yet.",
  },
};
export const DraggableDark: Story = {
  ...Draggable,
  globals: { theme: "dark" },
};
/** The map service is down or blocked: the caller shows its line instead. */
export const ServiceDown: Story = {
  beforeEach() {
    const original = window.fetch;
    window.fetch = (input, init) =>
      String(input instanceof Request ? input.url : input).startsWith(
        openFreeMapHost,
      )
        ? Promise.reject(new TypeError("blocked"))
        : original(input, init);
    return () => {
      window.fetch = original;
    };
  },
};
export const ServiceDownDark: Story = {
  ...ServiceDown,
  globals: { theme: "dark" },
};
