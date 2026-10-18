import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { anyTime, laterThan } from "@/lib/time/field-rules";
import { TimeField } from "./TimeField";

/** The dashboard's 12-hour time boxes, as an editor shows them. */
function TimeBoxes({ invalid = false }: { invalid?: boolean }) {
  return (
    <form className="editor-form" style={{ maxWidth: "40rem" }}>
      <div className="form-grid compact">
        <label>
          Start time
          <TimeField
            name="start_time"
            label="Start time"
            rule={anyTime}
            defaultValue="13:30"
          />
        </label>
        <label>
          End time (after the start)
          <TimeField
            name="end_time"
            label="End time"
            rule={laterThan({ box: "start_time" })}
          />
        </label>
        <label>
          Khutbah
          <TimeField
            name="khutbah"
            label="Khutbah"
            rule={anyTime}
            defaultValue="incomplete"
          />
          {invalid ? (
            <span className="field-error">Choose a valid time.</span>
          ) : null}
        </label>
        <label>
          Disabled
          <TimeField
            name="locked"
            label="Disabled"
            rule={anyTime}
            defaultValue="05:15"
            disabled
          />
        </label>
      </div>
    </form>
  );
}

const meta = {
  title: "Primitives/TimeField",
  component: TimeBoxes,
  args: { invalid: false },
} satisfies Meta<typeof TimeBoxes>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const DefaultDark: Story = { globals: { theme: "dark" } };
export const NeedsFixing: Story = { args: { invalid: true } };
export const NeedsFixingDark: Story = {
  args: { invalid: true },
  globals: { theme: "dark" },
};
