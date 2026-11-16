# Latest reference revision — verification

- Lint: passed, exit 0.
- Typecheck: passed, exit 0.
- Production build: passed, exit 0.
- Full Playwright suite: 25/25 passed, exit 0. Repeated after preserving remote branch commit d6e91ab, including its checkout assertions.
- Browser captures: 390, 768 and 1440px, with no horizontal overflow or console/page errors.
- Recording: 12 seconds, with independently changing flight and sleigh transforms. The full crossing takes 100 seconds and starts mid-flight. Stars use a restrained opacity animation.
- Existing cart, stock, referral, review data/filters/loading/error/empty, focus and navigation checks passed. Reduced motion, JavaScript-free static fallback, offscreen pause and visibility pause/resume passed.

An intermediate component replacement caused a parser error. Lint and the compiler caught it; it was corrected before the successful final build and browser checks. The earlier pine/SVG preview is superseded by this reference-matched cloud-and-moon treatment.

All data uses loopback fixtures. Captures show the honest empty review state. The unrelated analytics endpoint is stubbed only for screenshot/video capture. No actual customers, payment information, private conversations, real earnings or production credentials appear in the evidence. Live email delivery, Stripe payments, Discord delivery and payouts were not exercised. Their handlers/settings were not changed.

The shared build log omits the route inventory. The shared browser log contains only the command, final pass count and timing. This revision remains a draft for owner visual review. No merge or deployment was performed.

Publication also preserves remote commit 36e2025, an unrelated SQL migration quoting fix. That file is unchanged by this revision and no migration was run. Browser/build validation above was performed before that SQL-only update; the frontend source tested here is unchanged.
