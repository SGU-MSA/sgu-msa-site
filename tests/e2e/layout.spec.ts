import { demoSeed } from "../support/demo-seed";
import { expect, test, type Page } from "@playwright/test";

import {
  layoutPages,
  layoutViewports,
  screenshotViewports,
  viewportSize,
} from "../support/viewports";

/**
 * The cross-device layout gate (home-centering D-4). Every public page is
 * checked at every device size in light and dark: nothing overflows
 * sideways, the menu stays above the content, and the Home hero sits in the
 * middle of the first screen. A few pages also keep a screenshot baseline.
 * Only `npm run test:layout` runs this: it renders in the Playwright image.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "layout",
    "Run this suite with npm run test:layout.",
  );
});

const themes = ["light", "dark"] as const;
/** Pages and sizes that keep a screenshot (viewport only, not the full page). */
const extraShots = new Map<string, string[]>([
  ["/resources", ["390x844", "1440x900"]],
  ["/prayer", ["390x844", "1440x900"]],
]);

const slug = (path: string) =>
  path === "/" ? "home" : path.slice(1).replace(/\//g, "-");

/** Waits until fonts and the streamed urgent band are in, so geometry is final. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

type Geometry = {
  innerWidth: number;
  innerHeight: number;
  scrollWidth: number;
  nav: { top: number; bottom: number } | null;
  mainTop: number | null;
  chromeBottom: number;
  /** The urgent band: its height and the height its own CSS promises. */
  band: { height: number; promised: number } | null;
  hero: {
    contentTop: number;
    contentBottom: number;
    eyebrowTop: number;
  } | null;
};

function measure(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const box = (el: Element | null) => el?.getBoundingClientRect() ?? null;
    const nav = box(
      document.querySelector('nav[aria-label="Primary navigation"]'),
    );
    const bandEl = document.querySelector("[data-urgent-band]");
    const band = box(bandEl);
    let promised = 0;
    if (bandEl) {
      const probe = document.createElement("div");
      probe.style.height = "var(--urgent-band-h)";
      document.body.append(probe);
      promised = probe.getBoundingClientRect().height;
      probe.remove();
    }
    const main = box(document.querySelector("main"));
    const hero = document.querySelector("[data-hero]");
    let heroBox: Geometry["hero"] = null;
    if (hero) {
      const parts = [...hero.children].map((child) =>
        child.getBoundingClientRect(),
      );
      const eyebrow = hero.querySelector("p");
      heroBox = {
        contentTop: Math.min(...parts.map((r) => r.top)),
        contentBottom: Math.max(...parts.map((r) => r.bottom)),
        eyebrowTop: eyebrow?.getBoundingClientRect().top ?? 0,
      };
    }
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      nav: nav && { top: nav.top, bottom: nav.bottom },
      mainTop: main?.top ?? null,
      chromeBottom: Math.max(nav?.bottom ?? 0, band?.bottom ?? 0),
      band: band && { height: band.height, promised },
      hero: heroBox,
    };
  });
}

for (const viewport of layoutViewports) {
  for (const theme of themes) {
    test.describe(`${viewport.name} ${theme}`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.touch,
        hasTouch: viewport.touch,
        colorScheme: theme,
      });

      for (const path of layoutPages) {
        test(`${path} lays out`, async ({ page }) => {
          await page.clock.setFixedTime(new Date(demoSeed));
          await page.goto(path);
          await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            theme,
          );
          await settle(page);
          const g = await measure(page);

          // Nothing pushes the page sideways.
          expect(g.scrollWidth, "horizontal overflow").toBeLessThanOrEqual(
            g.innerWidth,
          );

          // The band never grows past the height its CSS promises (the hero relies on it).
          if (g.band)
            expect(g.band.height, "urgent band height").toBeLessThanOrEqual(
              g.band.promised + 1,
            );

          // The menu is in view and the page content starts below it.
          if (path !== "/admin/login") {
            expect(g.nav, "menu present").not.toBeNull();
            expect(g.nav!.top).toBeLessThanOrEqual(1);
            expect(g.nav!.bottom).toBeGreaterThan(40);
            expect(g.mainTop!).toBeGreaterThanOrEqual(g.nav!.bottom - 1);
          }

          // Home: the hero is centred in the first screen, or keeps a fixed gap.
          if (path === "/") {
            expect(g.hero, "hero present").not.toBeNull();
            const hero = g.hero!;
            const available = g.innerHeight - g.chromeBottom;
            const contentHeight = hero.contentBottom - hero.contentTop;
            const fits = contentHeight + 2 * 48 <= available;
            if (fits) {
              const centre = (hero.contentTop + hero.contentBottom) / 2;
              const target = g.chromeBottom + available / 2;
              expect(
                Math.abs(centre - target) / available,
                `hero centre ${centre} vs first-screen centre ${target}`,
              ).toBeLessThanOrEqual(0.06);
            } else {
              const gap = hero.eyebrowTop - g.chromeBottom;
              expect(gap, "gap under the menu").toBeGreaterThanOrEqual(40);
              expect(gap, "gap under the menu").toBeLessThanOrEqual(56);
            }
          }

          // Screenshot baselines (viewport only).
          const wanted =
            ((path === "/" || path === "/admin/login") &&
              screenshotViewports.includes(viewport.name)) ||
            (theme === "light" &&
              extraShots.get(path)?.includes(viewport.name));
          if (wanted)
            await expect(page).toHaveScreenshot(
              `${slug(path)}-${viewport.name}-${theme}.png`,
            );
        });
      }
    });
  }
}

// The sign-in page uses the shared form styles: its main button looks exactly
// like the forgot-password page's (no styles of its own).
for (const theme of themes) {
  test.describe(`sign-in buttons ${theme}`, () => {
    test.use({ colorScheme: theme });
    test("match the forgot-password button", async ({ page }) => {
      const look = async (path: string) => {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        return page.locator("form button.button-primary").evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            radius: style.borderRadius,
            height: el.getBoundingClientRect().height,
            background: style.backgroundColor,
            color: style.color,
            border: style.borderTopColor,
          };
        });
      };
      const signIn = await look("/admin");
      const forgot = await look("/admin/forgot-password");
      expect(signIn).toEqual(forgot);
      expect(signIn.radius).not.toBe("0px");
    });
  });
}

// A long password never runs under the eye button: the box keeps room for it.
test.describe("password box on a phone", () => {
  test.use({
    viewport: viewportSize("390x844"),
    isMobile: true,
    hasTouch: true,
  });
  test("a long password ends before the eye button", async ({ page }) => {
    await page.goto("/admin");
    const field = page.getByLabel("Password", { exact: true });
    await field.fill("x".repeat(120));
    const button = page.getByRole("button", { name: "Show password" });
    const [input, eye] = await Promise.all([
      field.evaluate((el) => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return {
          textRight: box.right - parseFloat(style.paddingRight),
        };
      }),
      button.boundingBox(),
    ]);
    expect(input.textRight).toBeLessThanOrEqual(eye!.x + 1);
  });
});
