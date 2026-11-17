import { execFileSync } from "node:child_process";
import { affectsApp } from "./deployment-scope.mjs";
const app = process.argv[2];
// Vercel semantics: 0 skips deployment, 1 proceeds. Preserve official preview policy.
const branch = process.env.VERCEL_GIT_COMMIT_REF;
if (
  branch === "feat/reseller-marketplace-phase1" ||
  (app === "marketplace" && branch !== "main")
) {
  console.log("Skip: marketplace review deployment is disabled.");
  process.exit(0);
}
if (!["official", "marketplace"].includes(app)) {
  console.error("Unknown application.");
  process.exit(0);
}
const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
if (!previous || !/^\w{40}$/.test(previous)) {
  console.log("First main build: run normal build.");
  process.exit(1);
}
try {
  const paths = execFileSync("git", ["diff", "--name-only", previous, "HEAD"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  const affected = affectsApp(paths, app);
  console.log(
    affected ? "Application changed: build." : "Other application only: skip.",
  );
  process.exit(affected ? 1 : 0);
} catch {
  console.log("Comparison unavailable: build main for safety.");
  process.exit(1);
}
