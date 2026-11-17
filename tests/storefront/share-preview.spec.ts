import { expect, test } from "@playwright/test";

test("Reviews serves its own canonical and social card without inheriting the legacy forest card", async ({ page }) => {
  await page.goto("/reviews");
  const title = "Reviews | BirdShop";
  const description = "Real feedback from real customers. Read approved customer reviews of BirdShop products and game services.";
  const url = "https://www.birdshop.store/reviews";
  const image = "https://www.birdshop.store/reviews-preview-v1.jpg";
  await expect(page).toHaveTitle(title);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", url);
  for (const [name, content] of Object.entries({
    description,
    "og:url": url,
    "og:title": title,
    "og:description": description,
    "og:image": image,
    "twitter:card": "summary_large_image",
    "twitter:title": title,
    "twitter:description": description,
    "twitter:image": image,
  })) {
    const selector = name.startsWith("og:") ? "property" : "name";
    await expect(page.locator(`meta[${selector}="${name}"]`)).toHaveAttribute("content", content);
  }
  const response = await page.request.get("/reviews-preview-v1.jpg");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/jpeg");

  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og-image\.jpg$/);
});
