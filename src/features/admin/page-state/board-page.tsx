import type { ReactNode } from "react";
import { FreshOnLink } from "./FreshOnLink";

/**
 * Every board page's default export: the page, started over when it is
 * opened by a link (`FreshOnLink`). It must wrap the page itself, not the
 * dashboard layout: the key Next gives a layout stays the same while moving
 * between its pages.
 */
export function boardPage<Props extends object>(
  Page: (props: Props) => ReactNode | Promise<ReactNode>,
) {
  function BoardPage(props: Props) {
    return (
      <FreshOnLink>
        <Page {...props} />
      </FreshOnLink>
    );
  }
  return BoardPage;
}
