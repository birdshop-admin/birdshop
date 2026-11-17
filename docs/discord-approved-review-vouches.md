# BirdShop approved reviews → Discord #vouches (review-only draft)

This integration **does not** publish on submission. A database trigger enqueues a review only when its status **transitions to approved** (including approval outside the owner UI). Existing approved reviews are not replayed. The cron worker publishes at most five queued reviews per run, normally within roughly five minutes of approval, subject to GitHub Actions scheduling delays. It retries failures with backoff. A given review ID is queued once even if toggled back and forth.

## Visual parity
The public `/reviews` page is the reference design. The public review-card PNG endpoint renders approved reviews only and mirrors its dark charcoal surface, burgundy initials, Georgia hierarchy, warm-gold stars, date, text, and product/details footer. A Discord embed also carries the full written review for accessibility and links to its original review. Discord cannot render website CSS itself, so the PNG is the closest visual match. The image deliberately clips long text; the embed retains it. Never label reviews `verified purchase` unless actual order verification is introduced.

## Safe activation checklist
1. Review this draft PR and run lint, TypeScript, build and staging database tests. Do not merge before approval.
2. Back up staging Supabase, apply `20261117090000_discord_review_vouch_outbox.sql`, verify RLS, trigger, and claim function. Repeat on production only after approval.
3. In Discord #vouches: Edit Channel → Integrations → Webhooks → New Webhook. Keep the URL private.
4. On **Vercel** for the official site (server environment, not `NEXT_PUBLIC_*`):
   - `DISCORD_REVIEWS_WEBHOOK_URL` = private #vouches webhook
   - `DISCORD_VOUCH_CRON_SECRET` = random long secret
   - `DISCORD_REVIEWS_ENABLED=true` **only after approval** (omitted/false disables)
   - `BIRDSHOP_PUBLIC_ORIGIN=https://birdshop.store` (adjust if official domain changes)
5. On **GitHub → Settings → Secrets and variables → Actions**:
   - `DISCORD_VOUCH_CRON_SECRET` = same secret
   - `BIRDSHOP_DISCORD_VOUCH_JOB_URL` = `https://birdshop.store/api/internal/discord-vouches`
6. Activate after deploying the approved code and database change. Verify with a fresh staging test review and the manual workflow trigger. Never send sample vouches into the real channel.
7. Disable by setting `DISCORD_REVIEWS_ENABLED=false` in Vercel; the outbox stays queued.

## Delivery caveats
The worker only posts currently approved reviews, and the image endpoint returns 404 for removed or unapproved reviews. One row per review is protected by an atomic claim lease. If Discord accepts a message but the database update fails, a subsequent retry **can post a duplicate**; true Discord-side exactly-once delivery is unavailable through incoming webhooks. Monitor outbox failures and delete inappropriate Discord posts manually if a review is later revoked. The first five-minute job after approval may run late. Secret or webhook URLs must never be committed or pasted into chat. No existing Discord channels or webhooks are modified by this PR.
