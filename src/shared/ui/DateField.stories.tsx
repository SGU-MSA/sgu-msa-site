import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { anyDate, dayRange, todayOrLater } from "@/lib/time/field-rules";
import { DateField } from "./DateField";

/** The dashboard's date boxes, as an editor shows them. */
function DateBoxes({ invalid = false }: { invalid?: boolean }) {
  return (
    <form className="editor-form" style={{ maxWidth: "40rem" }}>
      <div className="form-grid compact">
        <label>
          Start date
          <DateField name="date" rule={anyDate} defaultValue="2026-10-16" />
        </label>
        <label>
          End date (not before the start)
          <DateField
            name="end_date"
            rule={dayRange({ from: { box: "date" } })}
            aria-invalid={invalid || undefined}
          />
          {invalid ? (
            <span className="field-error">
              Choose the start date or a later one.
            </span>
          ) : null}
        </label>
        <label>
          Hide at (today or later)
          <DateField name="urgent_on" rule={todayOrLater("2026-10-07")} />
        </label>
        <label>
          Disabled
          <DateField
            name="locked"
            rule={anyDate}
            defaultValue="2026-10-07"
            disabled
          />
        </label>
      </div>
    </form>
  );
}

const meta = {
  title: "Primitives/DateField",
  component: DateBoxes,
  args: { invalid: false },
} satisfies Meta<typeof DateBoxes>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const DefaultDark: Story = { globals: { theme: "dark" } };
export const NeedsFixing: Story = { args: { invalid: true } };
export const NeedsFixingDark: Story = {
  args: { invalid: true },
  globals: { theme: "dark" },
};
