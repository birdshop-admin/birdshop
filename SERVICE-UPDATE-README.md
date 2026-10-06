# BirdShop — reviews, service packages, and Overview

Apply this update on top of the finalization update you just pushed. Merge these complete files into the existing project root. Keep unrelated files. No environment variables or Stripe event types are added.

## What changed

- Restored the Review choice in Contact. A visible Leave a review button is also near the top of Reviews. Reviews still go through moderation.
- Cart name/email fields now have cream backgrounds, dark text, and a clear focus outline.
- Added owner-only **Admin → Services**. Add and edit services, their descriptions, highlights, availability and home-page featuring. Remove a service from the public catalog without deleting existing paid orders or private chats.
- Added Basic, Standard and Premium fixed-price packages alongside Custom. Configure the exact price, scope and included work in Admin. **All seeded fixed packages start disabled**: no unapproved prices or deliverables are published. The existing service listings remain available for Custom requests until you enable their packages.
- Published fixed packages have Buy Package → name/email → Stripe → private chat. Custom still goes to Contact for a quote. An abandoned checkout creates no order. Verified payment creates one linked service order through the existing Stripe finalizer.
- The catalog, home featured services, service details, Contact and service-review validation now use the same database-backed services. Removed listings are no longer offered through the old static list.
- Included the operations Overview files again, with quick links for services/products/review moderation. The screenshot you sent showed the earlier Traffic & revenue screen. The correct Overview says **Your store, in focus.** and includes Quick actions, Needs attention, Conversations & work, Recent paid orders, Inventory and Recent activity. Analytics remains the detailed date-range reporting page.
- Updated How to Order for both fixed packages and custom work.

## Install in order

1. Extract the ZIP outside the project. Copy all its contents into your existing BirdShop root, beside `package.json`, merging folders and replacing matching files. These are full files, not snippets. There are no files to delete for this update.
2. In the existing Supabase project's SQL Editor, run the complete contents of:

   `supabase/migrations/20261005230000_service_catalog.sql`

   Run it once. It creates the catalog, seeds the existing service descriptions, protects the private purchase mapping, and adds the server-only package-purchase function. It preserves existing orders/chats/payments. The earlier finalization migrations, including `20261005220000_owner_reporting.sql`, must already be installed. Do not replay earlier migrations.
3. Run the contents of `supabase/verify-service-catalog.sql` in SQL Editor. All six checks should say PASS. Keep both SQL files in VS Code/Git. Pushing them does not execute them in Supabase.
4. In the VS Code terminal at the project root, run each command separately:

```powershell
npm.cmd run check
npm.cmd run build
```

5. After both pass, stage and review the update:

```powershell
git --literal-pathspecs add --pathspec-from-file=SERVICE-UPDATE-FILES.txt
git --no-pager diff --cached --stat
git --no-pager diff --cached --name-only
```

Check that no secret files or unrelated already-staged files are included. The staging list deliberately includes the Overview/Analytics files again so you have the intended page wiring.

6. Commit and push:

```powershell
git commit -m "Add managed service packages and restore review access"
git push origin main
git status
git log -1 --oneline
```

7. Wait for that exact commit to show Ready in your existing Vercel production project. Open your production domain. If Overview still says **Your store today.** and mainly displays Traffic & revenue, you are seeing the earlier code: check the deployment commit and production domain mapping, then refresh. The intended heading is **Your store, in focus.**
8. Open **Admin → Services**. Expand a service, set Basic/Standard/Premium prices in USD, describe the exact scope and included work, check Enable purchase for each desired tier, then Save service. A package must have a price of at least $0.50, a scope, and included work before it can be enabled. Save each service you want to sell. No new redeployment is needed for these catalog edits.

## How purchases and removal behave

A package selection is recorded as a private chat and a pending payment request using the server's stored price. Stripe return URLs point back to that chat. If checkout cannot open, the customer gets a link to the same chat and can retry there. Device remembering and recovery email use the existing system.

A changed browser amount cannot set the charged price. If the displayed price differs from the current stored price, the purchase is rejected so the customer can refresh. Repeated purchase submissions use the same request identifier. Verified duplicate payment events reuse the linked order.

Purchased scope, title and amount are copied into the conversation/payment records. Changing or removing the catalog listing does not rewrite those snapshots. Removing a listing blocks new purchases; an already-created payment request remains valid unless canceled in Admin Chat. Existing paid work must still be handled through its chat/order.

The Remove action archives the service listing internally to protect references and history. Its slug stays reserved. Hide it with Visible in catalog unchecked if you only want a temporary pause. Uncheck Accepting requests to show the listing as unavailable.

## Final checks on your site

- Reviews: use the new top button and Contact's Review option; submit a review; confirm it is pending in Admin Reviews and public only after approval.
- Cart: check labels, cream fields, focus state and phone layout.
- Admin Services: add a test listing, edit it, enable the three packages, hide/show it, and remove it. Confirm new/changed services appear in the public catalog and Contact.
- Service purchase: choose a published tier, pay using an appropriate Stripe test environment, return directly to the chat, and verify exactly one service order and the correct package/amount.
- Retry/expiry: retry a failed checkout from the same chat; confirm no duplicate conversation or order. Cancel an unpaid request from Admin Chat and confirm it cannot be paid again.
- Edit the catalog after a test purchase: the original purchase amount and scope stay intact. Verify refunds still appear through the existing payment handling.
- Owner can access Services. Service agents and signed-out visitors cannot manage the catalog or invoke the private purchase RPC directly.
- Overview: confirm operational panels and quick actions. Analytics should show date ranges and historical charts instead.
- Test phone widths, the checkout form and keyboard, service tier buttons, and admin editors.

## Validation and limits

ESLint, TypeScript and production build were checked locally. PostgreSQL-compatible fixtures exercised the existing payment/inventory/security suite plus disabled/stale-price rejection, retry binding, snapshots, package payment finalization and role checks. Local HTTP rendering used a mock service-catalog backend and checked public pages, the review form entry point, purchase form and authorization guards.

No real Stripe charge, external webhook delivery, actual email delivery, live Supabase migration, authenticated browser session or physical-phone visual test was performed here. See `SERVICE-UPDATE-TESTS.txt` for the recorded results. Complete the live checks above after deployment.
