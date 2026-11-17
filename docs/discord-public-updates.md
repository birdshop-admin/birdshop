# BirdShop public Discord updates

BirdShop has **two separate update channels**:

- **Private / members:** detailed release notes using the existing `DISCORD_CHANGELOG_WEBHOOK_URL` secret and `.github/workflows/discord-major-update.yml`. Keep this webhook and channel private.
- **Public:** at most three short customer-facing lines using `DISCORD_PUBLIC_UPDATES_WEBHOOK_URL` and `.github/workflows/discord-public-updates.yml`.

## Owner setup: public channel

1. In Discord, create a text channel named `#updates` or `#public-updates` in your public category.
2. Allow `@everyone` to **View Channel** and **Read Message History**. Turn off `Send Messages` for `@everyone` if you want an announcements-only feed. Keep member/private update channels restricted to the intended roles; **do not** reveal the private webhook.
3. Open the public channel's **Edit Channel → Integrations → Webhooks → New Webhook**. Name it `BirdShop Updates`, assign it specifically to the **public** updates channel, and copy the webhook URL.
4. In GitHub, visit `birdshop-admin/birdshop → Settings → Secrets and variables → Actions → New repository secret`. Save the URL as `DISCORD_PUBLIC_UPDATES_WEBHOOK_URL`. **Do not reuse `DISCORD_CHANGELOG_WEBHOOK_URL` or paste either URL into chat or code.**

The automation cannot create a Discord channel or secret itself. The owner performs those steps in Discord and GitHub.

## How public announcements work

The public workflow listens only when a pull request labeled `major-update` is **merged into `main`**. It also requires an explicit `## Public Update` section in the approved PR description.

Example:

```markdown
## Discord Changelog
- Reworked all public product cards, their disabled stock states and mobile sizing
- Fixed black/burgundy colors on the cart and service pages
- Verified no browser overflows in the supported viewports

## Public Update
- Refreshed BirdShop's black-and-burgundy look
- Improved shopping and mobile browsing
- Updated the Reviews page design
```

The private webhook keeps the detailed six-bullet changelog. The public webhook sends only the first **three** `Public Update` bullets, capped at 170 characters each. **No `## Public Update` means no public announcement**, even if the private update posts.

Do **not** include secrets, private customer data, unfinished features, or claims that something is live without deployment verification. A merge does not necessarily mean `birdshop.store` has deployed. The public message footer therefore says availability may vary by rollout.

## Safety and testing

- No `@everyone`, role or user pings: Discord mentions are disabled
- Does not publish PR titles, hidden development notes or internal checklists in public
- Does not change existing Discord channel permissions, payments, databases or production deployment
- If the public webhook secret is missing or invalid, the public job fails with a setup instruction; the private workflow runs independently
- GitHub Actions runs can be retried; retries may duplicate messages
- For a safe test, make a dedicated PR with an explicitly approved test public note, label it `major-update`, merge it with owner approval and verify both channels receive different messages
