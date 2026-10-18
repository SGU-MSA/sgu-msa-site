import { Mail, MessageCircle } from "lucide-react";

import { BrandIcon, isBrandIconName } from "./BrandIcon";

/** Line icons for the kinds without a brand mark (BrandIcon covers the rest). */
const lineIcons = {
  whatsapp: MessageCircle,
  email: Mail,
  other: Mail,
};

/**
 * The icon for one social or contact link, by its `kind` from the site
 * content: the official mark for Instagram and Facebook, a line icon for the
 * rest. Decorative: the link around it carries the accessible name.
 */
export function SocialIcon({
  kind = "other",
  className,
}: {
  kind?: string;
  className?: string;
}) {
  if (isBrandIconName(kind))
    return <BrandIcon name={kind} className={className} />;
  const Icon = lineIcons[kind as keyof typeof lineIcons] ?? Mail;
  return <Icon aria-hidden="true" strokeWidth={1.6} className={className} />;
}
