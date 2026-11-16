import { test, expect } from "@playwright/test";

async function dismissInvite(page: import("@playwright/test").Page) {
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Maybe later" }).click();
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`storefront fits ${width}px and exposes navigation`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await dismissInvite(page);
    await expect(page.getByRole("heading", { name: "BIRD SHOP" })).toBeVisible();
    await expect(page.getByRole("link", { name: /OUR SERVICES/i }).first()).toBeVisible();
    await expect(page.locator("img[src*='birdshop-approved-christmas-portrait']")).toBeVisible();
    await expect(page.locator("img[src*='birdshop-christmas-bells-reference']")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width <= 1100) {
      const menu = page.getByRole("button", { name: "Open menu", exact: true });
      await menu.click();
      await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Rewards", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
    } else {
      await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Products", exact: true })).toBeVisible();
    }
    await page.screenshot({ path: test.info().outputPath(`home-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("inventory, cart persistence, and sold-out protection survive the redesign", async ({ page }) => {
  await page.goto("/");
  await dismissInvite(page);
  const add = page.getByRole("button", { name: "Add Digital key to cart", exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByRole("link", { name: "Open cart with 1 item", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sold-out key is out of stock", exact: true })).toBeDisabled();
  await page.reload();
  await dismissInvite(page);
  await expect(page.getByRole("link", { name: "Open cart with 1 item", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open cart with 1 item", exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText("Digital key", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Other ways to pay" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pay with a Rewarble voucher" }))
    .toBeVisible();
  await expect(page.getByText(/Secure voucher submissions are being set up/))
    .toBeVisible();
  await expect(page.getByRole("button", { name: "Submit for manual review" }))
    .toHaveCount(0);

  await page.getByText("Rewarble prepaid card").click();
  await expect(page.getByRole("link", { name: /Redeem on Rewarble/i }))
    .toHaveAttribute("href", "https://rewarble.com/redeem");
  await page.getByText("Cryptocurrency").click();
  await expect(page.getByText(/not active yet/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Check Out Securely" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("rewarble-payment-information.png"), fullPage: true });

});

test("referral sign-in, service list, and staff login stay reachable", async ({ page }) => {
  await page.goto("/referrals");
  await expect(page.getByRole("heading", { name: "Refer friends.", exact: true })).toBeVisible();
  await expect(page.getByLabel("Your email", { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("referrals.png"), fullPage: true });
  await page.goto("/services");
  await expect(page.getByRole("heading", { name: "Deepwoken progression", exact: true }).first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("services.png"), fullPage: true });
  await page.goto("/admin/login");
  await expect(page.locator(".storefront-rail")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
});

for (const width of [390, 1440]) {
  test(`approved Christmas subpages render at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const [path, heading, imageName] of [
      ["/products", "Products", ""],
      ["/services", "Services", ""],
      ["/referrals", "Refer friends.", ""],
      ["/reviews", "Reviews", "birdshop-reviews-vortex"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
      if (path !== "/reviews") {
        await expect(page.locator("img[src*='birdshop-christmas-bells-reference']")).toBeVisible();
      }
      if (imageName) {
        const photo = page.locator(`img[src*='${imageName}']`);
        await expect(photo).toBeVisible();
        await expect(page.locator(".bs-editorial-hero--reviews .bs-editorial-bells")).toBeHidden();
        await expect(page.locator(".bs-reviews-vortex")).toHaveCount(1);
        await expect(page.locator(".bs-reviews-stars")).toHaveCount(1);
        const photoAsset = await page.request.get("/birdshop-reviews-vortex.svg");
        expect(photoAsset.ok()).toBe(true);
        expect(await photoAsset.text()).toContain('width="800" height="500"');
        expect(await photoAsset.text()).toContain("data:image/webp;base64,");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({
        path: test.info().outputPath(`${path.slice(1)}-${width}.png`),
        fullPage: true,
      });
    }
  });
}

test("Reviews hero respects reduced-motion preference", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/reviews");
  await expect(page.locator(".bs-reviews-vortex")).toBeVisible();
  const duration = await page.locator(".bs-reviews-vortex").evaluate(element =>
    window.getComputedStyle(element).animationDuration);
  expect(duration).toBe("0s");
});
