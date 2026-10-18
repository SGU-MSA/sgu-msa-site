import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import quiet from "@/shared/ui/page.module.css";
import { MusallahMap } from "@/features/prayer/MusallahMap";
import { directionsLinks } from "@/lib/maps/location";
import { PaperLayers } from "@/shared/ui/PaperLayers";

import { starter } from "../../../.storybook/starter";
import { ContactCallingCard } from "./ContactCallingCard";

/**
 * The /contact calling card in each state the page can show: with or without
 * a published email, and the "Find us on campus" box with the pin (the map
 * loads from OpenFreeMap as it scrolls into view) or when the pin cannot be
 * read. Links are example addresses only.
 */
const social = [
  {
    id: "instagram",
    label: "MSA on Instagram",
    url: "https://www.instagram.com/",
    kind: "instagram" as const,
  },
  {
    id: "facebook",
    label: "MSA on Facebook",
    url: "https://www.facebook.com/",
    kind: "facebook" as const,
  },
  {
    id: "email",
    label: "Email the MSA",
    url: "mailto:msa@example.org",
    kind: "email" as const,
  },
];
/** The starting pin (PR7 D-3), as the sandbox has it. */
const pin = { latitude: 12.0025521, longitude: -61.7723834 };
const pinnedMap = <MusallahMap place={pin} links={directionsLinks(pin)} />;
/** The pin could not be read (the database is unavailable). */
const unavailableMap = <MusallahMap place={null} links={null} />;

const meta = {
  title: "Pages/Contact calling card",
  component: ContactCallingCard,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className={quiet.page}>
        <PaperLayers />
        <Story />
      </div>
    ),
  ],
  args: {
    content: starter.contact,
    email: "msa@example.org",
    social,
    map: pinnedMap,
  },
} satisfies Meta<typeof ContactCallingCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithMap: Story = {};
export const WithMapDark: Story = { globals: { theme: "dark" } };
export const MapUnavailable: Story = { args: { map: unavailableMap } };
export const MapUnavailableDark: Story = {
  ...MapUnavailable,
  globals: { theme: "dark" },
};
export const NoEmailYet: Story = { args: { email: null } };
export const NoEmailYetDark: Story = {
  ...NoEmailYet,
  globals: { theme: "dark" },
};
