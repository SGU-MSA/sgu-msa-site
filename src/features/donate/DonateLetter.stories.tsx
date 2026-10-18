import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { verse } from "../../../.storybook/reminders";
import {
  donateGroups,
  donateSlip,
  FEE_LINE,
  GIVING_FINE_PRINT,
  INTENTION_LINE,
} from "@/lib/community/payment-policy";
import type { PaymentItem } from "@/lib/community/payments";
import { DonateLetter } from "./DonateLetter";

/**
 * The Donate page's states (PR6 `DonatePageData`): slips while funds are
 * open (no heading by default, the board's "Ramadan" heading over Iftar, a
 * closing clock line), "no open appeals" when none are, and the
 * could-not-load line. Slips are built by the policy, as on the page.
 */
const today = "2026-10-05";
const open = {
  from: null,
  until: null,
  blocked: null,
  ownDateIgnored: false,
  seasonYear: null,
  season: null,
};
const fund = (
  fields: Pick<PaymentItem, "slug" | "name" | "category" | "about"> &
    Partial<Pick<PaymentItem, "heading">>,
  until: string | null = null,
) => donateSlip({ heading: "", ...fields }, { ...open, until }, today);
const finePrint = [GIVING_FINE_PRINT];

const meta = {
  title: "Pages/Donate letter",
  component: DonateLetter,
  parameters: { layout: "fullscreen" },
  args: {
    verse: verse("donate"),
    data: {
      state: "ready",
      notice: FEE_LINE,
      intentionLine: INTENTION_LINE,
      finePrint,
      groups: donateGroups([
        fund({
          slug: "zakat-al-fitr",
          name: "Zakat al-Fitr",
          category: "zakat_al_fitr",
          about: "US$10 per person in your household.",
        }),
        fund({
          slug: "zakat-al-mal",
          name: "Zakat al-Mal",
          category: "zakat_al_mal",
          about: "Passed on to people in need.",
        }),
        fund(
          {
            slug: "iftar",
            name: "Iftar",
            category: "sadaqah",
            about: "Helps pay for iftar at the Musallah.",
            heading: "Ramadan",
          },
          "2026-10-07",
        ),
        fund({
          slug: "sadaqah",
          name: "Sadaqah",
          category: "sadaqah",
          about: "Used where it helps most.",
        }),
        fund({
          slug: "msa-musallah",
          name: "MSA & Musallah",
          category: "general",
          about: "Keeps the Musallah and the MSA running.",
        }),
      ]),
    },
  },
} satisfies Meta<typeof DonateLetter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Slips: Story = {};
export const SlipsDark: Story = { globals: { theme: "dark" } };
export const NoOpenAppeals: Story = {
  args: { data: { state: "empty", finePrint } },
};
export const NoOpenAppealsDark: Story = {
  ...NoOpenAppeals,
  globals: { theme: "dark" },
};
export const CouldNotLoad: Story = { args: { data: { state: "unavailable" } } };
