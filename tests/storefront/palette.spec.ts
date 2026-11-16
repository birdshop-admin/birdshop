import { expect, test } from "@playwright/test";

const routes = ["/", "/products", "/products/qa-key-0", "/services",
  "/services/deepwoken-progression", "/services/deepwoken-progression/purchase?package=standard",
  "/referrals", "/reviews", "/cart", "/contact", "/faqs", "/how-to-order", "/privacy",
  "/terms", "/refunds", "/service-chat", "/service-chat/verify", "/orders/access",
  "/checkout/return", "/services/checkout", "/rewarble-request", "/missing-palette-qa"];

for (const width of [390, 1440]) {
  test(`public palette reaches nested routes in both saved themes at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.goto("/");
      await page.evaluate(value => localStorage.setItem("birdshop-theme", value), theme);
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator(".site-header")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const result = await page.evaluate(() => {
          const green: string[] = [];
          for (const element of document.querySelectorAll("body *")) {
            const style = getComputedStyle(element);
            if (!element.getClientRects().length || style.visibility === "hidden") continue;
            for (const property of ["color", "background-color", "border-top-color", "outline-color", "background-image"]) {
              const value = style.getPropertyValue(property);
              for (const match of value.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g)) {
                const [, r, g, b, alpha] = match.map(Number);
                if ((Number.isNaN(alpha) || alpha > 0) && g > r && g > b && g - Math.min(r,b) >= 3) {
                  green.push(`${element.tagName}.${element.className}: ${property} ${match[0]}`);
                }
              }
            }
          }
          return { green: green.slice(0, 8), canvas: getComputedStyle(document.body).backgroundColor,
            overflow: document.documentElement.scrollWidth > innerWidth };
        });
        expect(result.green, `${route} (${theme})`).toEqual([]);
        expect(result.canvas, `${route} canvas (${theme})`).toBe("rgb(0, 0, 0)");
        expect(result.overflow, `${route} overflow (${theme})`).toBe(false);
        if (route === "/services/deepwoken-progression") {
          await expect(page.getByRole("button", { name: "View Standard details", exact: true })).toBeVisible();
          await page.screenshot({ path: test.info().outputPath(`service-${width}-${theme}.png`), fullPage: true, animations: "disabled", caret: "initial" });
        }
      }
    }
  });
}
