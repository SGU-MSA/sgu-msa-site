import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { verse } from "../../../.storybook/reminders";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

/** Sample chrome props in the shape SiteChrome reads from content/site.yaml. */
const items = [
  { id: "home", label: "Home", href: "/" },
  { id: "calendar", label: "Events", href: "/calendar" },
  { id: "prayer", label: "Prayer & Musallah", href: "/prayer" },
  { id: "resources", label: "Resources", href: "/resources" },
  { id: "about", label: "About", href: "/about" },
];

function Chrome({ withVerse = true }: { withVerse?: boolean }) {
  return (
    <>
      <Navbar
        items={items}
        cta={{ label: "Donate", href: "/donate" }}
        logoLabel="SGU Muslim Students Association crest"
        shortName="SGU MSA"
        tagline="Faith. Knowledge. Community."
      />
      <main style={{ minHeight: "20rem" }} />
      <Footer
        name="SGU Muslim Students Association"
        shortName="SGU MSA"
        university="St. George’s University Muslim Students Association"
        tagline="Faith. Knowledge. Community."
        quickLinks={[
          { label: "Calendar", href: "/calendar" },
          { label: "Prayer & Musallah", href: "/prayer" },
          { label: "Donate", href: "/donate" },
          { label: "Privacy", href: "/privacy" },
        ]}
        socialLinks={[
          {
            id: "instagram",
            label: "MSA on Instagram",
            url: "https://www.instagram.com/sgumsa",
            kind: "instagram",
          },
          {
            id: "facebook",
            label: "MSA on Facebook",
            url: "https://www.facebook.com/sgumsa",
            kind: "facebook",
          },
          {
            id: "email",
            label: "Email the MSA",
            url: "mailto:so-msa@sgu.edu",
            kind: "email",
          },
        ]}
        email="so-msa@sgu.edu"
        verse={withVerse ? verse("footer") : null}
        year={2026}
        adminLink={{ label: "Board / Admin Sign In", href: "/admin" }}
      />
    </>
  );
}

const meta = {
  title: "Chrome/Header and footer",
  component: Chrome,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/prayer" } },
  },
} satisfies Meta<typeof Chrome>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};
export const DesktopDark: Story = { globals: { theme: "dark" } };
export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
export const PhoneDark: Story = {
  globals: { theme: "dark", viewport: { value: "mobile1", isRotated: false } },
};
/** Reminders unavailable: the footer shows no verse and nothing else moves. */
export const WithoutReminder: Story = { args: { withVerse: false } };
