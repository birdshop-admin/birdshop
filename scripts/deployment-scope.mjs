// Shared by Vercel's Ignored Build Step and executable isolation tests.
export function affectsApp(paths, app) {
  const shared =
    /^(package(-lock)?\.json|scripts\/(deployment-scope|vercel-ignore)\.mjs)$/;
  return paths.some(
    (path) =>
      shared.test(path) ||
      (app === "marketplace"
        ? path.startsWith("apps/marketplace/")
        : !/^(apps\/|docs\/|tests\/|supabase\/|\.github\/)/.test(path)),
  );
}
