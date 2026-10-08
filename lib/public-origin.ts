// Public site origin for absolute URLs in robots.txt and the sitemap. Unlike
// lib/server-config's siteUrl() it never throws, so a missing or invalid
// BIRDSHOP_SITE_URL cannot break the build.
export function publicOrigin(): string {
  try {
    const url = new URL(process.env.BIRDSHOP_SITE_URL?.trim() || "");
    if (url.protocol === "https:") return url.origin;
  } catch {
    // Fall through to the production domain.
  }
  return "https://birdshop.store";
}
