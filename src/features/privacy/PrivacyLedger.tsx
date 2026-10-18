import Link from "next/link";
import { Check } from "lucide-react";

import { Container } from "@/shared/ui/Container";
import { InkRing } from "@/shared/ui/InkRing";
import quiet from "@/shared/ui/page.module.css";

import p from "./privacy.module.css";

/** The notice in one sentence: the page's meta description and its italic second line. */
export const privacySummary =
  "How this website handles public visits, the team list and board sign-in.";

/* The notice itself. The wording is the Privacy page's, unchanged. */
const sections = [
  {
    id: "public-visits",
    title: "Public visits",
    body: "You do not need an account to browse. This site does not collect payment information. External forms and social sites have their own privacy practices.",
  },
  {
    id: "giving",
    title: "Giving and tickets",
    body: "Give and ticket buttons open Go2Pay, an independent payment service not affiliated with the SGU MSA, which has its own privacy practices. Go2Pay asks for your name, email and phone for your receipt. Board members who can manage money see each payment's amount, the giver's name and any note on their screen; names are never published, and this website does not store them.",
  },
  {
    id: "map",
    title: "Map",
    body: "When you scroll to the “Find us on campus” box, your browser loads map pictures from OpenFreeMap (tiles.openfreemap.org). Like any website, OpenFreeMap sees your internet address. We send it nothing else, and it sets no cookies. The written directions work without the map.",
  },
  {
    id: "board-access",
    title: "Board access",
    body: "Invited board members sign in through Supabase. Essential, secure cookies maintain that session. Board members who can manage people, and the site owner, manage logins and their removal. Passwords are stored by Supabase only as a one-way bcrypt hash that nobody at the MSA can see.",
  },
  {
    id: "team-list",
    title: "Team list and board records",
    body: "The board keeps a People list in Supabase: each person’s name, role, team group, an optional photo, and the login email of anyone with dashboard access. The board chooses who appears on the About page, with their photo when one has been added. Anyone listed can ask at any time, by contacting the MSA, to come off the page or to have their photo removed; the board then takes the person or the photo off the page. The dashboard records which board member holds each shared account, by name only.",
  },
  {
    id: "basic-measurement",
    title: "Basic measurement",
    body: "When the site owner switches it on, the live website uses Vercel Web Analytics and Speed Insights to count page visits and measure website performance. Otherwise nothing is measured. Admin pages are never measured, and query strings are removed from measured addresses. No advertising or custom profiling is added.",
  },
];

/* Three sentences of the notice above, repeated beside the title. */
const promises = [
  "You do not need an account to browse.",
  "This site does not collect payment information.",
  "No advertising or custom profiling is added.",
];

/**
 * /privacy, "Ledger" (PR8 D-7): the title with the notice's summary in
 * italics, three plain promises beside it, each part of the notice as a
 * ruled row (title left, text right), and Questions in a band with the
 * Contact link circled in ink. No verse (ADR 0018).
 */
export function PrivacyLedger() {
  return (
    <div className={p.page}>
      <Container>
        <header className={`${p.hero} ${quiet.enter}`}>
          <div className={p.heroMain}>
            <h1 className={`${quiet.display} ${p.title}`}>Privacy</h1>
            <p className={p.standfirst}>{privacySummary}</p>
          </div>
          <ul className={p.promises}>
            {promises.map((line) => (
              <li key={line}>
                <Check aria-hidden="true" className={p.tick} />
                {line}
              </li>
            ))}
          </ul>
        </header>

        <ul className={p.ledger}>
          {sections.map((section) => (
            <li key={section.id} id={section.id} className={p.row}>
              <h2 className={p.rowTitle}>{section.title}</h2>
              <p className={p.body}>{section.body}</p>
            </li>
          ))}
        </ul>
      </Container>

      <section
        id="questions"
        aria-labelledby="questions-heading"
        className={`${quiet.band} ${p.questions}`}
      >
        <Container>
          <h2 id="questions-heading" className={p.h2}>
            Questions
          </h2>
          <p className={p.body}>
            Contact the MSA through the Contact &amp; Visit page.
          </p>
          {/* The ink ring circles the page's one action. */}
          <span className={p.ringed}>
            <InkRing />
            <Link className={p.ringLink} href="/contact">
              Contact &amp; Visit
            </Link>
          </span>
          <p className={p.note}>
            The organization should review this notice and confirm its account
            retention and operational policies before launch.
          </p>
        </Container>
      </section>
    </div>
  );
}
