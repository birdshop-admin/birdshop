import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { affectsApp } from "./deployment-scope.mjs";
assert.equal(affectsApp(["apps/marketplace/app/page.tsx"], "official"), false);
assert.equal(
  affectsApp(["apps/marketplace/app/api/stripe/webhook/route.ts"], "official"),
  false,
);
assert.equal(
  affectsApp(["apps/marketplace/app/page.tsx"], "marketplace"),
  true,
);
assert.equal(
  affectsApp(["app/api/stripe/webhook/route.ts"], "marketplace"),
  false,
);
assert.equal(affectsApp(["app/api/stripe/webhook/route.ts"], "official"), true);
assert.equal(affectsApp(["package-lock.json"], "official"), true);
for (const route of [
  "app/sell",
  "app/marketplace",
  "app/shops",
  "app/api/stripe/connect",
  "app/admin/(protected)/resellers",
])
  assert.equal(
    existsSync(route),
    false,
    route + " must only exist in marketplace app",
  );
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
for (const file of walk("apps/marketplace").filter(
  (f) =>
    /\.(ts|tsx)$/.test(f) &&
    !f.includes("/.next/") &&
    !f.includes("/node_modules/") &&
    !f.includes("/tests/"),
)) {
  const source = readFileSync(file, "utf8");
  assert.ok(
    !/\.(?:payouts|transfers)\.create\(/.test(source),
    file + " enables a payout or second transfer",
  );
  assert.ok(
    !/from\s+["'](?:\.\.\/){3,}/.test(source),
    file + " imports official source",
  );
  assert.ok(
    !/from\s+["']@\/(?:lib\/(?:payment-service|order-access|customer-inbox|service-chat)|app\/(?:cart|service-chat))/.test(
      source,
    ),
    file + " imports official payment/customer modules",
  );
  for (const table of source.matchAll(/\.from\(["']([^"']+)["']\)/g))
    assert.ok(
      /^(birdshop_marketplace_|birdshop_seller_)/.test(table[1]) ||
        table[1] === "admin_users",
      file + " accesses official customer table " + table[1],
    );
}
for (const file of [
  "lib/stripe-events.ts",
  "lib/maintenance.ts",
  "app/api/stripe/webhook/route.ts",
])
  assert.ok(
    !readFileSync(file, "utf8").includes("marketplace"),
    file + " must not invoke marketplace code",
  );
assert.equal(
  JSON.parse(readFileSync("vercel.json", "utf8")).git.deploymentEnabled[
    "feat/reseller-marketplace-phase1"
  ],
  false,
);
assert.equal(
  JSON.parse(readFileSync("apps/marketplace/vercel.json", "utf8")).git
    .deploymentEnabled,
  false,
);
assert.ok(
  readFileSync("apps/marketplace/lib/auth-config.ts", "utf8").includes(
    "birdshop-marketplace-auth",
  ),
);
console.log(
  "Application routes, table access, payments, cookies and Vercel deployment scopes are isolated.",
);
