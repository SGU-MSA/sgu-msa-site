"use client";
import { useActionState, useState, type FormEvent } from "react";
import {
  CATEGORIES,
  CLOSING_SOON_DAYS,
  HEADING_MAX,
  donateGroups,
  donateOrder,
  donateSlip,
  go2payCopyText,
  paymentItemWindow,
  readyDonatePage,
} from "@/lib/community/payment-policy";
import {
  categories,
  type Category,
  type DonateSlip,
  type PaymentItem,
} from "@/lib/community/payments";
import type { SeasonDates } from "@/lib/community/season-policy";
import { addDays } from "@/lib/time/days";
import { CheckedForm } from "./form-check/CheckedForm";
import { FieldError } from "./form-check/FieldError";
import { noProblems } from "./form-check/problems";
import { Go2PayBox } from "./Go2PayBox";
import { initialKeptForm, typedValues } from "./form-state";
import { ArchiveActions } from "./ArchiveActions";
import {
  archivePaymentItemAction,
  restorePaymentItemAction,
  saveFundAction,
} from "./payment-actions";
import { itemFromForm } from "./payment-forms";
import { EditorPreview } from "./preview/EditorPreview";
import { DonateLetter } from "@/features/donate/DonateLetter";
import {
  aboutExamples,
  categoryCardLines,
  copyRows,
  longDay,
  lockWords,
  windowWords,
} from "./payment-words";
import { DateField } from "@/shared/ui/DateField";
import { anyDate, dayRange } from "@/lib/time/field-rules";

/** A fund or ticket as its form starts: every box as text. */
export type EditableItem = {
  id: string;
  /** The Give address part; null until the first save makes it. */
  slug: string | null;
  name: string;
  category: string;
  about: string;
  heading: string;
  position: string;
  /** "on" when "Show" is ticked. */
  listed: string;
  season_id: string;
  shows_from: string;
  shows_until: string;
  /** A merch size (PR5c): its merch item and its label; "" otherwise. */
  merch_item_id: string;
  size_label: string;
  /** The current link as "go2pay.gd/1650", or "". */
  link: string;
  /** The row's `updated_at`; null for a new item. */
  version: string | null;
};

/** A season the fund can follow, with its days as of today. */
export type SeasonChoice = { id: string; name: string; dates: SeasonDates };

/**
 * Another fund shown on the Donate page today, with its slip: the Preview
 * draws the whole page, so where this fund sits is seen in place (D-77 c).
 */
export type OrderedFund = Pick<
  PaymentItem,
  "id" | "name" | "category" | "season_id" | "position"
> & { slip: DonateSlip };

/**
 * Add or edit a fund (PR6 WP-6; mockup `fund-editor`): its name and
 * sentence, an optional heading (D-77), one of the four fixed categories
 * (locked once givers have seen it, D-61), when it shows (a season, its own
 * days, or both; Gregorian days only, D-78), "Running again" for a season
 * fund (D-14), and its Go2Pay page, which the board makes by hand. Its
 * full-page Preview (review fixes P1) draws the Donate page with the fund
 * as typed among the funds shown today.
 */
export function FundEditor({
  item,
  seasonYear,
  lockedSince,
  current,
  earlier,
  seasons,
  zakatLastDay,
  today,
  receiptNote,
  canEditPages,
  others,
  rerunLabel,
}: {
  item: EditableItem;
  /** The saved season occurrence (D-14); null for a new tie. */
  seasonYear: number | null;
  /** The Grenada day the category locked, or null. */
  lockedSince: string | null;
  current: number | null;
  earlier: readonly number[];
  seasons: readonly SeasonChoice[];
  zakatLastDay: string | null;
  today: string;
  receiptNote: string;
  /** Whether this board member edits Pages (review 3 B). */
  canEditPages: boolean;
  others: readonly OrderedFund[];
  /** "Running again in Ramadan 2027" when the fund waits for it, else null. */
  rerunLabel: string | null;
}) {
  const [state, action, pending] = useActionState(
    saveFundAction,
    initialKeptForm,
  );
  const { version, slug, ...saved } = item;
  const start: Record<string, string> = state.values ?? saved;
  const [values, setValues] = useState(start);
  const onChange = (event: FormEvent<HTMLFormElement>) =>
    setValues(typedValues(new FormData(event.currentTarget)));

  // The fund as typed: the form reads it live, Preview when it opens.
  const shape = (typed: Record<string, string>) => {
    const category: Category = lockedSince
      ? (item.category as Category)
      : (categories as readonly string[]).includes(typed.category ?? "")
        ? (typed.category as Category)
        : "general";
    const season = seasons.find((s) => s.id === typed.season_id) ?? null;
    const window = paymentItemWindow(
      {
        category,
        season_id: typed.season_id ?? "",
        season_year:
          typed.season_id === item.season_id && typed.rerun !== "on"
            ? seasonYear
            : null,
        shows_from: typed.shows_from ?? "",
        shows_until: typed.shows_until ?? "",
      },
      season?.dates ?? null,
      zakatLastDay,
    );
    const fields = {
      slug: slug ?? "new",
      name: typed.name ?? "",
      category,
      about: typed.about ?? "",
      heading: typed.heading ?? "",
    };
    return { category, window, fields };
  };
  const { category, window, fields } = shape(values);
  const chosen = Boolean(lockedSince) || Boolean(values.category);
  const rerun = values.rerun === "on";
  const copy = go2payCopyText(fields, receiptNote);
  const when = windowWords(window);
  const soonFrom =
    window.until && !window.blocked
      ? addDays(window.until, 1 - CLOSING_SOON_DAYS)
      : null;
  const listed = values.listed === "on";
  // The save's own rules (`itemFromForm`), as you type.
  const check = (element: HTMLFormElement) => {
    const typed = typedValues(new FormData(element));
    const result = itemFromForm({
      values: typed,
      kind: "fund",
      slug: slug ?? "new",
      before: version
        ? {
            category: item.category as Category,
            position: Number(item.position),
            season_id: item.season_id,
            season_year: seasonYear,
            first_shown_at: lockedSince,
          }
        : null,
      currentLink:
        current === null
          ? null
          : {
              go2pay_product_id: current,
              payment_item_id: item.id,
              added_at: "",
            },
      season: seasons.find((s) => s.id === typed.season_id)?.dates ?? null,
    });
    return result.ok ? noProblems : result.fields;
  };

  const form = (
    <CheckedForm
      action={action}
      state={state}
      check={check}
      className="editor-form"
      key={state.attempt}
      onChange={onChange}
    >
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="version" value={version ?? ""} />
      <fieldset>
        <legend>About</legend>
        <label>
          Name
          <span className="muted">Shown on the slip. Changes are logged.</span>
          <input
            name="name"
            required
            maxLength={80}
            autoComplete="off"
            placeholder="Iftar"
            defaultValue={start.name}
          />
          <FieldError name="name" />
        </label>
        <label>
          About this fund
          <span className="muted">
            One short sentence.
            {CATEGORIES[category].aboutRequired && chosen
              ? " Required for zakat: how the MSA passes it on; for Zakat al-Fitr, the amount per person."
              : ""}
          </span>
          <textarea
            name="about"
            rows={2}
            maxLength={300}
            placeholder={aboutExamples[category]}
            defaultValue={start.about}
          />
          <FieldError name="about" />
        </label>
        <label>
          Heading (optional)
          <span className="muted">Leave empty for no heading.</span>
          <input
            name="heading"
            maxLength={HEADING_MAX}
            autoComplete="off"
            placeholder="Ramadan"
            defaultValue={start.heading}
          />
          <FieldError name="heading" />
        </label>
        <p>
          <strong>Give link</strong>{" "}
          <span className="muted">
            {slug ? "Never changes." : "Made when you first save."}
          </span>
          <br />
          <code>{slug ? `/donate/${slug}/give` : "/donate/…/give"}</code>
        </p>
      </fieldset>

      <fieldset className="giving-categories">
        <legend>
          Category
          {lockedSince ? (
            <span className="admin-badge giving-locked">
              Locked since {longDay(lockedSince)}
            </span>
          ) : null}
        </legend>
        <p className="muted">
          {lockedSince ? lockWords.locked : lockWords.before}
        </p>
        {lockedSince ? (
          <input type="hidden" name="category" value={item.category} />
        ) : null}
        <div className="choice-cards">
          {categories.map((value) => (
            <div className="choice-card" key={value}>
              <label className="check-label">
                <input
                  type="radio"
                  name="category"
                  value={value}
                  required={!lockedSince}
                  disabled={Boolean(lockedSince)}
                  defaultChecked={
                    (lockedSince ? item.category : start.category) === value
                  }
                />
                {CATEGORIES[value].tag}
              </label>
              {categoryCardLines(value).map((line) => (
                <span className="muted" key={line}>
                  {line}
                </span>
              ))}
            </div>
          ))}
        </div>
        <FieldError name="category" />
      </fieldset>

      <fieldset>
        <legend>When it shows</legend>
        <label className="check-label">
          <input
            type="checkbox"
            name="listed"
            defaultChecked={start.listed === "on"}
          />
          Show on the Donate page
        </label>
        <div className="form-grid compact">
          <label>
            Season
            <select name="season_id" defaultValue={start.season_id}>
              <option value="">No season</option>
              {seasons.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
            </select>
            <FieldError name="season_id" />
          </label>
          <label>
            Show from (optional)
            <DateField
              name="shows_from"
              rule={anyDate}
              defaultValue={start.shows_from}
            />
            <FieldError name="shows_from" />
          </label>
          <label>
            Show until (optional)
            <DateField
              name="shows_until"
              rule={dayRange({ from: { box: "shows_from" } })}
              defaultValue={start.shows_until}
            />
            <FieldError name="shows_until" />
          </label>
        </div>
        <input type="hidden" name="position" value={start.position} />
        <p className="muted">
          Leave the days empty to follow the season. A day you type replaces
          only that side of the season.
        </p>
        {rerunLabel ? (
          <div className="giving-rerun">
            <label className="check-label">
              <input
                type="checkbox"
                name="rerun"
                defaultChecked={start.rerun === "on"}
              />
              {rerunLabel}
            </label>
            {rerun ? (
              <fieldset className="choice">
                <legend>Its Go2Pay page this time</legend>
                <label className="check-label">
                  <input
                    type="radio"
                    name="rerun_link"
                    value="same"
                    required
                    defaultChecked={start.rerun_link === "same"}
                  />
                  Keep the same Go2Pay page (reopen it in Go2Pay first)
                </label>
                <label className="check-label">
                  <input
                    type="radio"
                    name="rerun_link"
                    value="new"
                    defaultChecked={start.rerun_link === "new"}
                  />
                  Use a new Go2Pay page (paste its link below)
                </label>
                <FieldError name="rerun_link" />
              </fieldset>
            ) : null}
          </div>
        ) : null}
        <p className="giving-when" aria-live="polite">
          {when ? (
            <>
              <strong>{when}</strong>
              {window.season ? " (with the season)" : ""}.
              {soonFrom && soonFrom > today
                ? ` From ${longDay(soonFrom)} the slip shows “Closes in 2 days”.`
                : ""}
            </>
          ) : window.blocked === "waiting_rerun" ? (
            "Hidden until you tick “Running again”."
          ) : window.blocked ? (
            "Hidden: the season's days are not available."
          ) : null}
          {listed
            ? ""
            : " Not shown until “Show on the Donate page” is ticked."}
        </p>
      </fieldset>

      <Go2PayBox
        steps={
          <ol className="help-steps">
            <li>In Go2Pay, make a new product and copy these into it.</li>
            <li>
              Turn on the donation box. Price: the smallest amount Go2Pay
              accepts (US$1). Preset amounts: your choice.
            </li>
            <li>Save it, copy its page link, and paste it below.</li>
          </ol>
        }
        rows={copyRows.map((row) => ({
          ...row,
          text: copy[row.key],
        }))}
        link={values.link ?? ""}
        current={current}
        earlier={earlier}
        itemName={fields.name}
        receiptMissing={!receiptNote.trim()}
        canEditPages={canEditPages}
      />
      <button className="button-primary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </CheckedForm>
  );

  // The Donate page as it would be with this fund as typed: the funds shown
  // today and this one, in the page's order under its headings (D-77 b, c).
  const preview = (typed: Record<string, string>) => {
    const typedFund = shape(typed);
    const own: OrderedFund = {
      id: item.id,
      name: typedFund.fields.name,
      category: typedFund.category,
      season_id: typed.season_id ?? "",
      position: Number(typed.position) || 0,
      slip: donateSlip(
        { ...typedFund.fields, name: typedFund.fields.name || "(name)" },
        typedFund.window,
        today,
      ),
    };
    const funds = [...others.filter((other) => other.id !== item.id), own];
    return (
      <DonateLetter
        data={readyDonatePage(
          donateGroups(donateOrder(funds).map((fund) => fund.slip)),
        )}
      />
    );
  };

  return (
    <div>
      <EditorPreview
        form={form}
        preview={preview}
        previewControls={
          <p className="muted">
            Price, stock, the donation box and preset amounts live in Go2Pay.
            Any board member with the Go2Pay login changes them there.
          </p>
        }
      />
      {version ? (
        <ArchiveActions
          archived={false}
          fields={{ id: item.id, version, kind: "fund" }}
          archive={{
            action: archivePaymentItemAction,
            summary: "Archive this fund",
            label: "Archive fund",
            explain:
              "It leaves the Donate page and its Give link stops working. Close its product in Go2Pay too. You can restore it later under Archived.",
          }}
          restore={{ action: restorePaymentItemAction }}
        />
      ) : null}
    </div>
  );
}
