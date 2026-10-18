import { Clock } from "lucide-react";

import { CATEGORIES, GIVE_BUTTON } from "@/lib/community/payment-policy";
import type { DonateGroup, DonateSlip } from "@/lib/community/payments";

import { GiveButton } from "./GiveButton";
import s from "./donate.module.css";

function Slip({ slip, titleLevel }: { slip: DonateSlip; titleLevel: 3 | 4 }) {
  const Title = titleLevel === 3 ? "h3" : "h4";
  // The tag style only: a double border for the restricted (zakat) categories.
  const restricted = CATEGORIES[slip.category].restricted;
  return (
    <li className={s.slip}>
      <span className={restricted ? `${s.tag} ${s.tagRestricted}` : s.tag}>
        {slip.tag}
      </span>
      <Title className={s.slipTitle}>{slip.title}</Title>
      {slip.ruleLine ? <p className={s.rule}>{slip.ruleLine}</p> : null}
      {slip.about ? <p className={s.about}>{slip.about}</p> : null}
      {slip.closingSoon ? (
        <p className={s.soon}>
          <Clock aria-hidden="true" className={s.clock} />
          {slip.closingSoon}
        </p>
      ) : null}
      <div className={s.give}>
        <GiveButton
          href={slip.giveHref}
          label={GIVE_BUTTON}
          className="w-full"
        />
      </div>
    </li>
  );
}

/**
 * The Donate page's paper slips (PR6 D-49, D-77; `donate-slips.png`): the
 * groups in `donateOrder`, a heading only where the board typed one, each
 * slip with its tag, the zakat rule line, the board's sentence, the closing
 * clock line and Give. A headed group ends with a thin line (D-79); the
 * headings and slips sit on the left and are never centred, a lone slip
 * included (D-80). Renders `DonatePageData` only; computes no wording.
 */
export function DonateSlips({ groups }: { groups: readonly DonateGroup[] }) {
  return (
    <div className={s.groups}>
      {groups.map((group, index) => (
        <div
          key={`${index}-${group.heading ?? ""}`}
          className={group.heading ? s.headed : undefined}
        >
          {group.heading ? <h3 className={s.group}>{group.heading}</h3> : null}
          <ul className={s.slips}>
            {group.slips.map((slip) => (
              <Slip
                key={slip.slug}
                slip={slip}
                titleLevel={group.heading ? 4 : 3}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
