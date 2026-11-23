# Bird’s Ecosystem — marketplace integration phase 2

## Ownership and separation
BirdShop (birdshop.store) and Bird’s Marketplace (market.birdshop.store) share one Discord guild but **not** commerce databases, seller roles, order data, or announcements. The BirdShop repository does not contain the marketplace seller onboarding application. Never treat BirdShop customer/referral records as marketplace sellers.

## Verified Discord targets
- Guild: `1496704311038709801`
- Bird’s Marketplace category: `1574456093059448973`
- Existing BirdShop category THE SHOP: `1539217259170627584`
- Existing BirdShop referral channel: `1571542791010648134`
- Existing BirdShop #vouches: `1499807999252762754` (integration deferred)
- Bot: Bird’s Ecosystem, token in GitHub Actions secret `BIRDSHOP_DISCORD_BOT_TOKEN`

## Channel management
The eight marketplace channels were created read-only. Keep `@everyone` send/thread permissions denied until explicit launch approval. Do not alter preexisting BirdShop roles, channels or webhooks. Any future permission changes require an audit of effective role/channel permissions and separate approval. Never grant bot Administrator or privileged intents just to publish announcements.

## Marketplace announcements
`.github/workflows/birds-ecosystem-marketplace-announcement.yml` supports an owner-approved manual title/message. It validates the expected guild, category and #marketplace-updates channel, defaults to preview-only and only sends when `publish=true`. Uses the existing bot token, disables mentions and never reads private seller records. This is an announcement tool, **not** a signal that a GitHub merge equals a live deployment.

Future automatic GitHub release announcements should trigger only on explicitly approved marketplace release metadata after the separate marketplace repository is identified. Avoid using BirdShop's `major-update` label for marketplace releases.

## Seller onboarding website integration contract (not live)
Implement in the actual marketplace application repository, not in BirdShop:
1. Seller submits application on `market.birdshop.store`; website stores application in its own database. Discord does not collect KYC, bank details, personal addresses or verification documents.
2. Server-side authenticated state transitions (submitted, under_review, more_information_needed, approved, rejected, suspended) append an idempotent event to a durable marketplace outbox. Do not trust browser callbacks or direct client calls.
3. Background worker delivers minimal **private** event to staff-only destination after server-side authorization. Include internal opaque application ID, event type, timestamp, and staff dashboard URL only; no email, names, PII, payment credentials, documents or rejection evidence.
4. Public `#seller-onboarding` stays a static instructions channel. Never announce individual applications or approval decisions there.
5. Seller status updates should appear inside the authenticated seller dashboard; optional direct Discord notifications require verified account linking and opt-in. Do not infer Discord identity from usernames.
6. Use per-event idempotency key, retry/backoff, delivery logs and a disable switch; monitor failures and enforce role-based staff permissions.
7. Seller role assignment requires explicit verified Discord account linking, marketplace-side seller approval, revocation on suspension, and a separate permission audit.
8. Do not claim payouts, wallets or Stripe Connect are enabled until their own production gates pass.

## Acceptance checks
- Marketplace announcements cannot target BirdShop channels.
- Dry-run posts nothing.
- Live announcement requires explicit `publish=true`.
- No seller PII or KYC enters public Discord.
- Website integration remains blocked until the marketplace repository and its auth/event schema are reviewed.
- Review-to-vouches remains deferred as requested.
