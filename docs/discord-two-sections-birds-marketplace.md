# Discord V3 — BirdShop + Bird’s Marketplace (preparation)

## Canonical names from 21 November 2026

- **BirdShop** is the official storefront at https://birdshop.store.
- **Bird’s Marketplace** is the distinct multi-seller marketplace planned at https://market.birdshop.store.
- **One Discord server** hosts two separate sections. Do not use the prior "BirdMarket" name in new user-facing material.
- The businesses' orders, seller payouts, transaction data and permissions remain distinct, despite shared branding and community membership.

## Existing BirdShop section: preserve

Do not delete, rename, move, or change permissions of existing BirdShop channels:
- Preserve public #updates webhook and the separate private/member changelog webhook.
- Preserve approved review-to-#vouches webhook, source, and moderation rule.
- Preserve existing tickets, roles, bot mappings and customer support history.
- Add read-only #referrals information inside the existing BirdShop category **only when its category ID has been verified**.

### Suggested initial #referrals message

**BirdShop Referral Rewards — $0.50 USD**

Share your unique BirdShop referral link. Earn $0.50 for each eligible new customer who makes their first qualifying paid and fulfilled product purchase through your link. Rewards are subject to review, refund checks and anti-fraud rules. One eligible new buyer qualifies once, not on every repeat order. Visit https://birdshop.store/referrals.

**Launch gate:** Do not announce automatic cash-outs or claim the program is fully operational until production migration, end-to-end tests, manual payout policy and account verification are confirmed.

The repository already includes a staged referral dashboard, attribution cookie, owner review and reward ledger. REFERRAL-SETUP.md documents still-unfinished service-package referrals, automatic payouts and production rollout.

## Bird’s Marketplace section — add without affecting BirdShop

New category: **BIRD’S MARKETPLACE**

| Proposed channel | Purpose |
| --- | --- |
| #marketplace-start-here | One-server/two-section explanation, website link, prelaunch state |
| #marketplace-updates | Marketplace-specific roadmap, policy and launch news |
| #marketplace-how-it-works | Future buyer and seller walkthroughs |
| #seller-onboarding | Seller eligibility and application guidance (no public identity submissions) |
| #seller-resources | Future listings, dashboards, fees, wallets and payout guidance |
| #marketplace-support | How to open a private support or complaint ticket |
| #marketplace-feedback | Moderated marketplace reputation and reviews guidance |
| #marketplace-community | Community discussion after launch readiness |

**Prelaunch safety:** All new channels default to read-only for @everyone, including thread posting. Do not create public channels for seller verification documents, bank account details, transaction records, chargeback evidence, reports of fraud, or moderation cases. Those belong in private tickets or staff-only workflows after roles and access controls are reviewed.

## Website Reviews & Vouches unification

- Keep approved Supabase reviews as the single authoritative website feed.
- Change navigation label to **Reviews & Vouches**; maintain canonical /reviews.
- Redirect /vouches to /reviews, avoiding duplicate content or broken old links.
- Keep existing review-to-Discord vouches pipeline. It publishes only approved reviews after setup, not unreviewed messages.
- No Discord testimony, screenshot, or unmoderated quote is automatically imported into the public website.

## Controlled channel creation

The additive idempotent script is at scripts/prepare_discord_sections.py. It never edits, deletes, renames or moves existing channels, webhooks or roles.

1. Preview without credentials: python3 scripts/prepare_discord_sections.py. Or run the GitHub workflow in preview mode.
2. Confirm actual Discord server ID. Copy the existing BirdShop category ID in Discord Developer Mode.
3. Create a dedicated Discord app/bot (for example, BirdShop Community Manager) with Guild Install and the bot scope. Grant **View Channels**, **Manage Channels**, and **Manage Roles**: the existing preparation script creates category/text channels with read-only permission overwrites; Discord requires Manage Roles to set those overwrites. Do **not** grant Administrator, member-list privileged intents, or message-content intent for this one-time setup. Save the bot token as the GitHub Actions secret BIRDSHOP_DISCORD_BOT_TOKEN. Never commit or paste the token in a chat, PR, or webhook.
4. After review and merge, open GitHub Actions → Prepare Discord storefront + marketplace sections → Run workflow. Set apply=true and enter the server ID and BirdShop category ID to request live additive changes.
5. Inspect actual server permissions. The new marketplace channels should be viewable and read-only until the launch-stage role and support workflows are approved.
6. The script skips #referrals if the correct existing BirdShop category cannot be unambiguously identified. A repeat run creates only still-missing channels.

**Not done by this PR:** creating live Discord channels, migrating/redeploying the site, turning on referral payouts, changing current webhooks, activating the marketplace, or opening public seller applications.

## Owner acceptance checks

- [ ] No existing BirdShop channel, message, role, webhook, or ticket route was changed.
- [ ] New category title is exactly Bird’s Marketplace.
- [ ] Distinct marketplace channels are read-only until approved for launch.
- [ ] #referrals belongs to the existing BirdShop category and honestly describes reward qualification.
- [ ] Existing #vouches automation remains tied to approved reviews.
- [ ] BirdShop site shows Reviews & Vouches in navigation and old /vouches links resolve to /reviews.
- [ ] No production deployment or live payout change happened without a separate release decision.

**Important:** The draft PR workflow is not available as a production GitHub Actions workflow until the changes are reviewed and merged to the default branch; merging may trigger a separate website deployment depending on repository hosting settings. This one-time REST API channel setup does not require a continuously hosted Discord bot, and its bot account may display as offline between runs.
