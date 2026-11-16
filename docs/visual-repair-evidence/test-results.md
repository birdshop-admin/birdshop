# Verified results

All checks used the actual Next.js production build and system Chromium, with the loopback test service on port 54321. No production data or settings were modified.

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run lint` | PASS, exit 0 | [Log](logs/lint.log) |
| `npm run typecheck` | PASS, exit 0 | [Log](logs/typecheck.log) |
| `npm run build` | PASS, exit 0 | [Log](logs/build.log) |
| Full existing and regression browser suite | PASS, 25/25, exit 0 | [Log](logs/playwright-final.log) |
| Focused Reviews suite after final accessible-rating adjustment | PASS, 8/8, exit 0 | [Log](logs/playwright-focused.log) |
| Page captures at 390, 768 and 1440px | PASS: 12 route/viewport combinations, no overflow, broken images or browser errors | [Measurements](after/capture.json) |
| Recorded animation | PASS: independently changing vortex, inner ring, lens, 12 rocks, six clouds, camera, stars and dust transforms | [Measurements](after/motion.json), [MP4](after/reviews-motion.mp4) |

The full suite verifies catalog and detail cart controls at 320, 390, 768 and 1440px: 48–52px height, full width, one centered icon/text row, contained labels, consistent gap, burgundy color, Added feedback, quantities, persistence and sold-out protection. Existing navigation, services and admin-login checks remain in place.

Referral checks cover the black HTML/body canvas and neutral controls in both light and dark settings, the four onboarding steps, the actual server sign-in action against a local email stub, a verified dashboard with test ledger records, and the affiliate registration form. They do not send real email, register production accounts, or execute payouts.

Reviews checks cover approved RPC records and derived ratings, loading, empty/error/retry states, filters, long-review expansion and hero-link focus, independent animation transforms, offscreen and visibility-event pausing/resuming, reduced motion, and JavaScript-free static rendering. The main evidence captures intentionally show the correct empty state rather than invented testimonials or trust statistics.

## Earlier failure, explicitly reported

The initial run had **22 passes and one failure**: the existing 320px homepage screenshot exceeded its 30-second timeout after navigation and focus assertions passed. [Initial log](logs/playwright-initial.log). Static screenshots now freeze decorative animation and retain caret styles, with a 90-second test budget. The full run then passed all 25 tests. Motion tests and the recorded video retain actual animation.

## Limits

Live Stripe payment processing, external Supabase email delivery/RLS, Discord delivery, checkout attribution and real payout execution were not exercised. Their handlers, settings, migrations and production records were unchanged. The screenshot-only analytics stub is documented in the [evidence README](README.md). The generated landscape is 1672×941; the separate ring/lens textures are each 1200×1200px, with GPU-composited transforms rather than a heavy runtime renderer.
