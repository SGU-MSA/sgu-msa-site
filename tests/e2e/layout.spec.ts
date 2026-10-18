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
 * sideways, the menu stays above the content, and the Home hero's two columns
 * are centred against each other with the next section right after them. A few pages also keep a screenshot baseline.
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
  hero: {
    contentTop: number;
    contentBottom: number;
    eyebrowTop: number;
    /** Vertical centres of the headline and prayer columns, and whether they sit side by side. */
    mainCentre: number;
    asideCentre: number;
    sideBySide: boolean;
    /** Top of the first thing under the hero, or null when nothing follows. */
    nextTop: number | null;
  } | null;
};

function measure(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const box = (el: Element | null) => el?.getBoundingClientRect() ?? null;
    const nav = box(
      document.querySelector('nav[aria-label="Primary navigation"]'),
    );
    const band = box(
      document.querySelector('section[aria-label="Urgent notices"]'),
    );
    const main = box(document.querySelector("main"));
    const hero = document.querySelector("[data-hero]");
    let heroBox: Geometry["hero"] = null;
    if (hero) {
      const parts = [...hero.children].map((child) =>
        child.getBoundingClientRect(),
      );
      const eyebrow = hero.querySelector("p");
      const [first, second] = parts;
      const rect = hero.getBoundingClientRect();
      let nextTop: number | null = null;
      const walker = document.createTreeWalker(
        document.querySelector("main")!,
        NodeFilter.SHOW_ELEMENT,
      );
      walker.currentNode = hero;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (hero.contains(node)) continue;
        const r = (node as Element).getBoundingClientRect();
        if (r.height > 0 && r.top >= rect.bottom - 1) {
          nextTop = r.top;
          break;
        }
      }
      heroBox = {
        contentTop: Math.min(...parts.map((r) => r.top)),
        contentBottom: Math.max(...parts.map((r) => r.bottom)),
        eyebrowTop: eyebrow?.getBoundingClientRect().top ?? 0,
        mainCentre: (first.top + first.bottom) / 2,
        asideCentre: (second.top + second.bottom) / 2,
        sideBySide: first.right <= second.left + 1,
        nextTop,
      };
    }
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      nav: nav && { top: nav.top, bottom: nav.bottom },
      mainTop: main?.top ?? null,
      chromeBottom: Math.max(nav?.bottom ?? 0, band?.bottom ?? 0),
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
          // The sign-in address redirects to /admin: let that finish first.
          if (path === "/admin/login") await page.waitForURL(/\/admin$/);
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

          // The menu is in view and the page content starts below it.
          if (path !== "/admin/login") {
            expect(g.nav, "menu present").not.toBeNull();
            expect(g.nav!.top).toBeLessThanOrEqual(1);
            expect(g.nav!.bottom).toBeGreaterThan(40);
            expect(g.mainTop!).toBeGreaterThanOrEqual(g.nav!.bottom - 1);
          }

          // Home: the columns are centred against each other, the next section
          // follows without a big empty band, and phones keep a steady gap under the menu.
          if (path === "/") {
            expect(g.hero, "hero present").not.toBeNull();
            const hero = g.hero!;
            if (hero.sideBySide)
              expect(
                Math.abs(hero.mainCentre - hero.asideCentre),
                "hero columns' centres",
              ).toBeLessThanOrEqual(3);
            if (viewport.width < 1024) {
              const gap = hero.eyebrowTop - g.chromeBottom;
              expect(gap, "gap under the menu").toBeGreaterThanOrEqual(40);
              expect(gap, "gap under the menu").toBeLessThanOrEqual(56);
            } else {
              expect(
                hero.contentTop - g.chromeBottom,
                "gap under the menu",
              ).toBeGreaterThanOrEqual(40);
            }
            if (viewport.width >= 1920 && hero.nextTop !== null)
              expect(
                hero.nextTop - hero.contentBottom,
                "gap between the hero and the next section",
              ).toBeLessThanOrEqual(0.15 * g.innerHeight);
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
