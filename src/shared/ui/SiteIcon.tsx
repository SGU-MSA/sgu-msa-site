import {
  BookOpen,
  Building2,
  CalendarDays,
  CircleHelp,
  Clock3,
  Coffee,
  Compass,
  Droplets,
  Footprints,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  HelpingHand,
  Home,
  Lightbulb,
  Mail,
  MapPin,
  MessageCircleHeart,
  Mic2,
  Moon,
  Package,
  Phone,
  Search,
  Shirt,
  Sparkles,
  Sun,
  SunDim,
  Sunrise,
  Sunset,
  Users,
  Utensils,
  Video,
  type LucideProps,
} from "lucide-react";

/**
 * One icon family for the whole site.
 *
 * Content refers to icons by name, so an editor can change an icon without a
 * code change, and no route can introduce a second illustration style.
 * All are thin-line at a consistent stroke weight (see `DEFAULT_STROKE`).
 */
const icons = {
  book: BookOpen,
  building: Building2,
  calendar: CalendarDays,
  coffee: Coffee,
  community: Users,
  compass: Compass,
  droplets: Droplets,
  faith: Moon,
  faq: CircleHelp,
  footsteps: Footprints,
  graduation: GraduationCap,
  halaqa: BookOpen,
  help: HelpingHand,
  home: Home,
  idea: Lightbulb,
  mail: Mail,
  map: MapPin,
  mentor: HeartHandshake,
  merch: Shirt,
  message: MessageCircleHeart,
  mic: Mic2,
  moon: Moon,
  package: Package,
  phone: Phone,
  prayer: Sunrise,
  ramadan: Moon,
  search: Search,
  sparkles: Sparkles,
  sun: Sun,
  "sun-dim": SunDim,
  sunrise: Sunrise,
  sunset: Sunset,
  support: HandHeart,
  time: Clock3,
  users: Users,
  utensils: Utensils,
  video: Video,
  volunteer: HandHeart,
} as const;

export type SiteIconName = keyof typeof icons;

/** Shared stroke weight — keeps the icon set visually consistent. */
export const DEFAULT_STROKE = 1.35;

type SiteIconProps = Omit<LucideProps, "name"> & { name?: string | null };

export function SiteIcon({ name, strokeWidth, ...props }: SiteIconProps) {
  const Icon = icons[(name ?? "sparkles") as SiteIconName] ?? Sparkles;
  return <Icon strokeWidth={strokeWidth ?? DEFAULT_STROKE} {...props} />;
}
