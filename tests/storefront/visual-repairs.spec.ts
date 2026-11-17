import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function expectCartAlignment(button: Locator) {
  await button.scrollIntoViewIfNeeded();
  await button.page().mouse.move(0, 0);
  await expect(button).toHaveCSS("background-color", "rgb(146, 16, 39)");
  const boxes = await button.evaluate(element => {
    const button = element.getBoundingClientRect();
    const icon = element.querySelector("svg")!.getBoundingClientRect();
    const label = element.querySelector("span")!.getBoundingClientRect();
    const parent = element.parentElement!.getBoundingClientRect();
    return {
      height: button.height, width: button.width, parentWidth: parent.width,
      buttonCenter: button.x + button.width / 2,
      groupCenter: (icon.left + label.right) / 2,
      verticalDifference: Math.abs(icon.y + icon.height / 2 - label.y - label.height / 2),
      gap: label.left - icon.right,
      contained: label.top >= button.top && label.bottom <= button.bottom && icon.left >= button.left && label.right <= button.right,
      background: getComputedStyle(element).backgroundColor,
    };
  });
  expect(boxes.height).toBeGreaterThanOrEqual(48);
  expect(boxes.height).toBeLessThanOrEqual(52);
  expect(Math.abs(boxes.width - boxes.parentWidth)).toBeLessThan(2);
  expect(boxes.verticalDifference).toBeLessThan(1.5);
  expect(Math.abs(boxes.buttonCenter - boxes.groupCenter)).toBeLessThan(2);
  expect(boxes.gap).toBeGreaterThanOrEqual(6);
  expect(boxes.gap).toBeLessThanOrEqual(12);
  expect(boxes.contained).toBe(true);
  expect(boxes.background).toBe("rgb(146, 16, 39)");
}

for (const width of [320, 390, 768, 1440]) {
  test(`catalog and detail cart controls remain centered at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/products");
    const catalogAdd = page.getByRole("button", { name: "Add Digital key to cart", exact: true });
    await expect(catalogAdd).toBeEnabled();
    await expectCartAlignment(catalogAdd);
    await expect(page.getByRole("button", { name: "Sold-out key is out of stock", exact: true })).toBeDisabled();
    await expectNoOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`products-${width}.png`), fullPage: true, animations: "disabled", caret: "initial" });
    await catalogAdd.click();
    await expect(catalogAdd).toHaveText("Added");
    await expect(page.getByRole("link", { name: "Open cart with 1 item", exact: true })).toBeVisible();
    await expect(catalogAdd).toHaveText("Add to Cart");

    await page.goto("/products/qa-key-1");
    const detailAdd = page.getByRole("button", { name: "Add to Cart", exact: true });
    await expect(detailAdd).toBeEnabled();
    await expectCartAlignment(detailAdd);
    await page.getByLabel("Quantity", { exact: true }).selectOption("2");
    await detailAdd.click();
    await expect(page.getByRole("button", { name: "Added to Cart", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open cart with 3 items", exact: true })).toBeVisible();
    await expectNoOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`product-detail-${width}.png`), fullPage: true, animations: "disabled", caret: "initial" });
    await page.goto("/products/qa-key-2");
    await expect(page.getByRole("button", { name: "Out of Stock", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Buy Now", exact: true })).toBeDisabled();
  });
}

for (const theme of ["light", "dark"]) {
  test(`referrals use a black page canvas and working sign-in in ${theme} mode`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem("birdshop-theme", value), theme);
    await page.emulateMedia({ colorScheme: theme as "light" | "dark" });
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto("/referrals");
    await expect(page.locator("main.referrals-page.bs-editorial-page")).toBeVisible();
    expect(await page.locator("html, body").evaluateAll(elements => elements.map(element => ({
      color: getComputedStyle(element).backgroundColor,
      image: getComputedStyle(element).backgroundImage,
    })))).toEqual([{ color: "rgb(0, 0, 0)", image: "none" }, { color: "rgb(0, 0, 0)", image: "none" }]);
    await expect(page.getByLabel("How referral rewards work").locator("strong")).toHaveText(["01", "02", "03", "04"]);
    const email = page.getByLabel("Your email", { exact: true });
    await expect(email).toBeVisible();
    // No forest-tinted visible surfaces, including shared footer and fields.
    expect(await page.locator("main, header, footer, section, input, select, button").evaluateAll(elements => elements.filter(element => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      const color = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number);
      return color && (color[3] ?? 1) > 0.1 && color[1] > color[0] + 3 && color[1] > color[2] + 3;
    }).map(element => element.className))).toEqual([]);
    await email.fill("qa@example.test");
    await page.getByRole("button", { name: "Send sign-in email", exact: true }).click();
    await expect(page).toHaveURL(/notice=check-email/);
    await expect(page.getByRole("status")).toHaveText("Check your email for a sign-in link or code.");
    await page.getByText("Have a verification code?", { exact: true }).click();
    await expect(page.getByLabel("Email code", { exact: true })).toBeVisible();
    await expectNoOverflow(page);
  });
}

const approvedReviews = [
  { id: "qa-approved-1", type: "Product", reviewer: "QA approved customer", initials: "QA", rating: 5, title: "QA product experience", body: "A browser fixture that proves approved records render in the public feed.", subject: "Digital key", meta: "Digital Product", featured: true, created_at: "2026-11-10T12:00:00Z" },
  { id: "qa-approved-2", type: "Service", reviewer: "QA approved service customer", initials: "QS", rating: 4, title: "QA service experience", body: "A second local fixture used to verify the aggregate comes from approved records.", subject: "Custom build", meta: "Service Experience", featured: false, created_at: "2026-11-11T12:00:00Z" },
];

async function mockReviews(page: Page, body: unknown, status = 200) {
  await page.route("**/rest/v1/rpc/get_approved_reviews", route => route.fulfill({
    status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body),
  }));
}

test("Reviews render only approved RPC records and derived ratings", async ({ page }) => {
  await mockReviews(page, approvedReviews);
  await page.goto("/reviews");
  await expect(page.getByText("QA approved customer", { exact: true }).first()).toBeVisible();
  await expect(page.locator("[data-review-hero-card]").first().getByRole("img", { name: "5 out of 5 stars", exact: true })).toBeVisible();
  await expect(page.getByText("4.5 average · 2 approved reviews", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /VIEW REVIEWS/ })).toHaveAttribute("href", "#reviews");
  await expect(page.getByRole("link", { name: /LEAVE A REVIEW/, exact: false }).first()).toHaveAttribute("href", "/contact?topic=review");
  await page.getByRole("button", { name: "Services 1", exact: true }).click();
  await expect(page.locator("#reviews").getByText("QA service experience", { exact: true })).toBeVisible();
  await expect(page.locator("#reviews").getByText("QA product experience", { exact: true })).toHaveCount(0);
});

test("Reviews preserve honest empty and unavailable states", async ({ page }) => {
  await mockReviews(page, []);
  await page.goto("/reviews");
  await expect(page.locator("#reviews").getByText("No approved reviews yet", { exact: true })).toBeVisible();
  await expect(page.getByText(/1,200|100%|@Vexor|@Kairo|@Syrn/)).toHaveCount(0);
  await expect(page.getByText(/average ·/)).toHaveCount(0);
  await mockReviews(page, { message: "Local QA unavailable" }, 503);
  await page.reload();
  await expect(page.getByRole("heading", { name: "We could not load reviews right now.", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try Again", exact: true })).toBeVisible();
  await mockReviews(page, approvedReviews);
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  await expect(page.getByText("QA approved customer", { exact: true }).first()).toBeVisible();
});

test("Reviews announce loading while an approved-review request is pending", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/rest/v1/rpc/get_approved_reviews", async route => {
    await gate;
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" });
  });
  await page.goto("/reviews", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status").filter({ hasText: "Loading reviews" }).first()).toBeAttached();
  release();
  await expect(page.locator("#reviews").getByText("No approved reviews yet", { exact: true })).toBeVisible();
});

async function layerTransforms(page: Page) {
  return page.locator("[data-christmas-layer]").evaluateAll(elements => elements.map(element => ({
    layer: element.getAttribute("data-christmas-layer"), transform: getComputedStyle(element).transform,
  })));
}

test("Santa flies slowly with a separate sleigh motion and pauses offscreen", async ({ page }) => {
  await page.goto("/reviews");
  await expect(page.locator("[data-christmas-layer='flight']").first()).toBeVisible();
  const duration = await page.locator("[data-christmas-layer='flight']").evaluate(e => parseFloat(getComputedStyle(e).animationDuration));
  expect(duration).toBeGreaterThanOrEqual(60);
  const before = await layerTransforms(page);
  await page.waitForTimeout(1200);
  const after = await layerTransforms(page);
  for (const layer of ["flight", "sleigh"]) {
    const indices = before.flatMap((value, index) => value.layer === layer ? [index] : []);
    expect(indices.length, `${layer} exists`).toBeGreaterThan(0);
    expect(indices.some(index => after[index].transform !== before[index].transform), `${layer} changes transform`).toBe(true);
  }
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect.poll(async () => page.locator("[data-christmas-layer='flight']").first().evaluate(element => getComputedStyle(element).animationPlayState)).toBe("paused");
});

test("reduced motion keeps a sharp static scene without animated layers", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/reviews");
  await expect(page.locator("[data-christmas-scene]")).toBeVisible();
  expect(await page.evaluate(async () => {
    const image = new Image();
    image.src = "/reviews-christmas-reference.webp";
    await image.decode();
    return image.naturalWidth >= 1400;
  })).toBe(true);
  expect(await page.locator("[data-christmas-layer]").evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === "none"))).toBe(true);
  const before = await layerTransforms(page);
  await page.waitForTimeout(300);
  expect(await layerTransforms(page)).toEqual(before);
});

test("Reviews keep a static cinematic fallback when JavaScript is unavailable", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3100/reviews");
  await expect(page.getByRole("heading", { level: 1, name: "Reviews", exact: true })).toBeVisible();
  await expect(page.locator("[data-christmas-scene]")).toBeVisible();
  expect(await page.locator("[data-christmas-layer='flight']").first().evaluate(element => getComputedStyle(element).animationPlayState)).toBe("paused");
  await context.close();
});

async function localReferralSession(page: Page, email: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const id = "00000000-0000-4000-8000-000000000001";
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, email, aud: "authenticated", role: "authenticated", exp: expiresAt, iat: expiresAt - 3600, qa_visual_repair: true })}.cWEtbG9jYWwtb25seQ`;
  const session = { access_token: token, refresh_token: "qa-local-only", token_type: "bearer", expires_in: 3600, expires_at: expiresAt,
    user: { id, email, email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: {}, user_metadata: {} } };
  await page.context().addCookies([{ name: "sb-127-auth-token", value: `base64-${encode(session)}`, domain: "127.0.0.1", path: "/", httpOnly: false, sameSite: "Lax" }]);
}

test("authenticated referral profile, earnings and registration keep black surfaces", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await localReferralSession(page, "qa-dashboard@example.test");
  await page.goto("/referrals");
  await expect(page.getByRole("heading", { name: "QA referral customer's referral profile", exact: true })).toBeVisible();
  await expect(page.getByLabel("Your shareable link", { exact: true })).toHaveValue("http://127.0.0.1:3100/ref/BSQATEST01");
  const earnings = page.locator("section").filter({ has: page.getByRole("heading", { name: "Earnings", exact: true }) });
  await expect(earnings.getByRole("heading", { name: "$0.50", exact: true })).toHaveCount(3);
  await expect(earnings.getByText("Recorded as paid", { exact: true })).toBeVisible();
  const referralPanelColors = await page.locator("main.referrals-page > div > section").evaluateAll(elements => elements.map(element => getComputedStyle(element).backgroundColor));
  expect(referralPanelColors.length).toBeGreaterThanOrEqual(3);
  expect(referralPanelColors.every(color => color === "rgb(0, 0, 0)")).toBe(true);
  await expectNoOverflow(page);
  await page.screenshot({ path: test.info().outputPath("referral-dashboard-390.png"), fullPage: true, animations: "disabled", caret: "initial" });

  await localReferralSession(page, "qa-new-referrer@example.test");
  await page.goto("/referrals");
  await expect(page.getByRole("heading", { name: "Join BirdShop referrals", exact: true })).toBeVisible();
  await expect(page.getByLabel("Display name", { exact: true })).toBeVisible();
  await page.getByLabel("Account type", { exact: true }).selectOption("affiliate");
  await expect(page.getByLabel("Account type", { exact: true })).toHaveValue("affiliate");
  await expect(page.getByRole("button", { name: "Create referral account", exact: true })).toBeVisible();
  await expectNoOverflow(page);
});

test("hero review links reveal and focus a long review hidden by the feed filter", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const longBody = "A long approved fixture review checks that the customer can open the full experience from the cinematic hero after changing the feed filter. ".repeat(3);
  await mockReviews(page, [{ ...approvedReviews[0], body: longBody }, approvedReviews[1]]);
  await page.goto("/reviews");
  await page.getByRole("button", { name: "Services 1", exact: true }).click();
  const selected = page.locator("#review-qa-approved-1");
  await expect(selected).toHaveCount(0);
  await page.locator("[data-review-hero-card]").first().getByRole("link", { name: /Read review/ }).click();
  await expect(page).toHaveURL(/#review-qa-approved-1$/);
  await expect(page.getByRole("button", { name: "All Reviews 2", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(selected).toBeVisible();
  await expect(selected).toBeFocused();
  await expect(selected.getByText(longBody, { exact: true })).toBeVisible();
  await expect(selected.getByRole("button", { name: "Show Less", exact: false })).toHaveAttribute("aria-expanded", "true");
});

test("the cinematic scene pauses and resumes on document visibility changes", async ({ page }) => {
  await page.goto("/reviews");
  const scene = page.locator("[data-christmas-scene]");
  await expect(scene).toHaveAttribute("data-active", "true");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(scene).toHaveAttribute("data-active", "false");
  expect(await page.locator("[data-christmas-layer]").evaluateAll(elements => elements.every(element => getComputedStyle(element).animationPlayState === "paused"))).toBe(true);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(scene).toHaveAttribute("data-active", "true");
});
