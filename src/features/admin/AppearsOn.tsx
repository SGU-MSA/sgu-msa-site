import { Fragment } from "react";
import { systemText } from "@/lib/system-text";
import {
  appearsOn,
  type AppearsOnArea,
  type PublicPageLink,
} from "./appears-on";
import type { PageTextKey } from "@/lib/content/documents";

const words = systemText.fields;

/**
 * "Appears on: Events page and Home" at the top of an editor (review fixes
 * P1, item 4), from the one registry (`appearsOnPages`). Each page opens on
 * the website in a new tab, so the editor and anything typed in it stay; a
 * place with no one address ("every page", "Go2Pay receipts") is plain
 * words. Nothing is drawn when the area shows on no public page.
 */
export function AppearsOn({
  area,
  extra,
}: {
  area: AppearsOnArea | `page:${PageTextKey}`;
  extra?: readonly PublicPageLink[];
}) {
  const links = appearsOn(area, extra);
  if (!links.length) return null;
  return (
    <p className="appears-on">
      {words.appearsOn}:{" "}
      {links.map((link, index) => (
        <Fragment key={link.href ?? link.label}>
          {index === 0 ? null : index === links.length - 1 ? " and " : ", "}
          {link.href ? (
            <a
              className="text-link"
              href={link.href}
              target="_blank"
              rel="noopener"
            >
              {link.label}
              <span aria-hidden="true"> ↗</span>
              <span className="sr-only"> {words.newTab}</span>
            </a>
          ) : (
            link.label
          )}
        </Fragment>
      ))}
    </p>
  );
}
