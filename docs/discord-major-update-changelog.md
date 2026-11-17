# BirdShop — automatic major-update changelog

This GitHub Actions workflow sends a concise Discord update **only after a pull request is merged into `main` and has the `major-update` label**. No notifications are sent for small commits, draft feature pushes, failed/closed-unmerged PRs, or routine CI runs.

## One-time setup (owner)

1. In your BirdShop Discord server, create or choose a text channel (for example, `#website-updates`). Open **Edit Channel → Integrations → Webhooks → New Webhook**. Give the webhook access to that channel and copy its URL.
2. In GitHub, open `birdshop-admin/birdshop → Settings → Secrets and variables → Actions → New repository secret`. Name it `DISCORD_CHANGELOG_WEBHOOK_URL` and paste the full URL. **Never paste the URL into chat, a PR, source code, or `.env.local`.**
3. Create the GitHub PR label `major-update` if it does not already exist. This is the only mark required to enable a major-update announcement.

## Publishing an update

1. Prepare and test the website update on its feature branch.
2. In the PR description, add a public-safe section exactly like this:

   ```markdown
   ## Discord Changelog
   - Improved product and service checkout buttons
   - Added first-purchase referral code verification after checkout
   - Fixed referral page styling on phones
   ```

3. When the owner approves the update for publication, add the `major-update` label to that PR and merge it into `main`.
4. GitHub automatically sends **one Discord embed** containing the PR title, up to six public-facing changelog bullets, a link to the PR, and the merge timestamp.

If there is no `## Discord Changelog` section, only the title and a generic message are posted. This avoids accidentally posting internal PR details. User and role mentions are disabled. The webhook URL stays in GitHub Actions Secrets.

## Operational details

- Workflow: `.github/workflows/discord-major-update.yml`
- Trigger: merged PR into `main` **and** `major-update` label
- No automatic Vercel deployment, Discord channel/role changes, or database edits
- A merged commit is **not proof of deployment**: Discord explicitly describes this as a codebase update
- Missing/invalid webhook: the Actions job fails with a setup message; no notification is sent
- GitHub Actions reruns may resend the announcement; do not rerun successful announcement jobs without a reason
- To test after setup, use a dedicated small PR labeled `major-update` with a clearly marked test note, approve and merge it yourself (or add a separate dry-run mechanism in a future PR)

To notify the Discord server only after **successful production deployments**, change the workflow to listen for your deployment-success event instead of merges. This would prevent announcements before an update reaches `birdshop.store`.
