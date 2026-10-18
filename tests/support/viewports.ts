/**
 * The device sizes every public page must lay out on (home-centering D-4).
 * The one list for the layout gate (`tests/e2e/layout.spec.ts`); CSS pixels.
 * Phones and tablets are touch devices; laptops and larger are not.
 */
export type LayoutViewport = {
  name: string;
  width: number;
  height: number;
  touch: boolean;
};

const phoneOrTablet = (width: number, height: number): LayoutViewport => ({
  name: `${width}x${height}`,
  width,
  height,
  touch: true,
});
const desktop = (width: number, height: number): LayoutViewport => ({
  name: `${width}x${height}`,
  width,
  height,
  touch: false,
});

export const layoutViewports: readonly LayoutViewport[] = [
  // Phones (844x390 is a phone held sideways)
  phoneOrTablet(320, 568),
  phoneOrTablet(360, 800),
  phoneOrTablet(390, 844),
  phoneOrTablet(412, 915),
  phoneOrTablet(430, 932),
  phoneOrTablet(844, 390),
  // Tablets
  phoneOrTablet(768, 1024),
  phoneOrTablet(800, 1280),
  phoneOrTablet(820, 1180),
  phoneOrTablet(1024, 768),
  phoneOrTablet(1024, 1366),
  // Laptops
  desktop(1280, 800),
  desktop(1366, 768),
  desktop(1440, 900),
  desktop(1536, 864),
  // Desktop and projector, wide, 4K
  desktop(1920, 1080),
  desktop(2560, 1440),
  desktop(3840, 2160),
];

/** Sizes that also get a screenshot baseline for `/` and `/admin/login`, in both themes. */
export const screenshotViewports: readonly string[] = [
  "390x844",
  "768x1024",
  "1366x768",
  "1920x1080",
  "2560x1440",
  "3840x2160",
];

/** Every page linked from the header and footer, plus the sign-in page. */
export const layoutPages = [
  "/",
  "/about",
  "/calendar",
  "/community",
  "/contact",
  "/donate",
  "/faq",
  "/get-involved",
  "/merch",
  "/prayer",
  "/privacy",
  "/ramadan",
  "/resources",
  "/admin/login",
] as const;
