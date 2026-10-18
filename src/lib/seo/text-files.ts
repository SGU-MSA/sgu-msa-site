/**
 * The two plain-text files for machines (site-essentials contract): the
 * security contact (RFC 9116) and the llms.txt summary (llmstxt.org). Pure
 * builders, so routes stay thin and tests need no server.
 */
import type { SiteContent } from "@/lib/content/schemas";

const day = 86_400_000;
/** How far ahead security.txt's Expires is set; the file is rebuilt per request. */
const expiresInDays = 180;

/** security.txt: the board's email (when set), the Contact page, and a rolling Expires. */
export function securityTxt(input: {
  email?: string | null;
  origin: string;
  now: Date;
}): string {
  const today = Date.UTC(
    input.now.getUTCFullYear(),
    input.now.getUTCMonth(),
    input.now.getUTCDate(),
  );
  const email = input.email?.trim();
  return [
    ...(email ? [`Contact: mailto:${email}`] : []),
    `Contact: ${input.origin}/contact`,
    `Expires: ${new Date(today + expiresInDays * day).toISOString()}`,
    "Preferred-Languages: en",
    `Canonical: ${input.origin}/.well-known/security.txt`,
    "",
  ].join("\n");
}

/** Board text on one line: no newline can start a new Markdown or file line. */
const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/** Paths a summary for machines never lists. */
const hidden = /^\/(admin|media|checkout|api)(\/|$)/;

/** llms.txt from the site's page text: name, description, and the menu and footer links. */
export function llmsTxt(site: SiteContent, origin: string): string {
  const seen = new Set<string>();
  const pages: string[] = [];
  for (const item of [...site.navigation, ...site.footer.quick_links]) {
    const href = item.href.trim();
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const path = href.split(/[?#]/)[0] || "/";
    if (hidden.test(path) || seen.has(path)) continue;
    seen.add(path);
    pages.push(`- [${oneLine(item.label)}](${origin}${href})`);
  }
  const email = site.brand.email?.trim();
  return [
    `# ${oneLine(site.brand.name)}`,
    "",
    ...(site.meta?.description
      ? [`> ${oneLine(site.meta.description)}`, ""]
      : []),
    `${oneLine(site.brand.university)}.${email ? ` Contact: ${oneLine(email)}` : ""}`,
    "",
    "## Pages",
    "",
    ...pages,
    "",
  ].join("\n");
}
