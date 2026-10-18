import { executiveTiers, type TeamSection } from "@/lib/community/people";
import { SafeImage } from "@/shared/ui/SafeImage";

import s from "./about.module.css";
import { TeamMore } from "./TeamMore";

type Member = TeamSection["people"][number];

/** One Executive board member: a portrait photo when uploaded, the role, the name. */
function BoardSeat({ person }: { person: Member }) {
  return (
    <li className={s.seat}>
      {/* No photo, no image (an exec without one still shows). */}
      {person.photoPath ? (
        <span className={s.portrait}>
          <SafeImage
            image={{
              src: `/media/${person.photoPath}`,
              // The name is printed right below: screen readers hear it once.
              alt: "",
              historical: false,
            }}
            fill
            sizes="(max-width: 40rem) 90vw, 15rem"
            fit="portrait"
          />
        </span>
      ) : null}
      <span className={s.seatText}>
        {person.roleTitle ? (
          <span className={s.role}>{person.roleTitle}</span>
        ) : null}
        <span className={s.name}>{person.fullName}</span>
      </span>
    </li>
  );
}

/** The other groups, in the dashboard's order: names and roles only, no photos. */
function OtherGroups({ sections }: { sections: readonly TeamSection[] }) {
  return sections.map((section) => (
    <div key={section.id} className={s.teamSection}>
      <h3 className={s.sectionName}>{section.name}</h3>
      <ul className={s.roster}>
        {section.people.map((person) => (
          <li key={person.id}>
            <span className={s.rosterName}>{person.fullName}</span>
            {person.roleTitle ? (
              <span className={s.rosterRole}>{person.roleTitle}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  ));
}

/**
 * The public team list from People (PR3 WP-G; review fixes P4, user
 * 2026-10-07). The Executive board is always listed, in tiers (President;
 * the two Vice Presidents; the Treasurer and the Secretary) with a portrait
 * photo when one is uploaded. "View all" under it opens the other groups
 * right below, by name and role only, in the dashboard's order; nobody from
 * the Executive board is repeated there.
 */
export function TeamSeats({ sections }: { sections: TeamSection[] }) {
  // Nobody listed yet, or the list could not be loaded: nothing, never a
  // "to be confirmed" line (review fixes P3).
  if (!sections.length) return null;
  const executive = sections.find((section) => section.kind === "executive");
  const others = sections.filter((section) => section !== executive);
  if (!executive)
    return (
      <div className={s.team}>
        <OtherGroups sections={others} />
      </div>
    );
  return (
    <div className={s.team}>
      <div className={s.teamSection}>
        <h3 className={s.sectionName}>{executive.name}</h3>
        <div className={s.tiers}>
          {executiveTiers(executive.people).map((tier) => (
            <ul key={tier[0].id} className={s.tier}>
              {tier.map((person) => (
                <BoardSeat key={person.id} person={person} />
              ))}
            </ul>
          ))}
        </div>
      </div>
      {others.length ? (
        <TeamMore>
          <OtherGroups sections={others} />
        </TeamMore>
      ) : null}
    </div>
  );
}
