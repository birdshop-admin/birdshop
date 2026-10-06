# BirdShop storefront and admin design update

Apply on top of Service Packages Update (your pushed commit 71c1314). Copy the ZIP contents into your website root beside package.json, merging folders and replacing matching files. These are complete files. Keep all other project files.

## What changes

- Cart uses the actual product gallery image, matching your product page, with initials only when no image is present or it fails to load.
- How to Order has its own complete responsive cream/olive design: hero, navigation, numbered guides, checkout/chat details and help section.
- Service detail shows Basic, Standard and Premium side by side on wide screens, stacked on smaller screens. Custom is a separate option below.
- Enabled packages show a Buy button leading directly to checkout. The existing payment flow returns to the private chat. Customers do not need to open a ticket first.
- Unpublished tiers stay visible as Coming soon, without exposing your draft prices or scope. Their purchase buttons are disabled.
- Admin Services has cream catalog panels, status counts, search, visibility/setup filters, styled expandable service rows and three package editors.

## Installation

1. Copy every file in this ZIP to its matching project path. Keep these DESIGN-UPDATE documents at the project root.
2. No new SQL migration, dependency install or environment variables are needed for THIS update. The previous service catalog migration must already be installed (you reported all checks passed).
3. In VS Code Terminal, run:

```powershell
npm.cmd run check
npm.cmd run build
git --literal-pathspecs add --pathspec-from-file=DESIGN-UPDATE-FILES.txt
git --no-pager diff --cached --stat
git commit -m "Polish storefront guides, service tiers, and admin catalog"
git push origin main
git status
```

4. Wait for the matching Vercel deployment to show Ready. Open the live site and refresh it.
5. Admin > Services: find a service, expand it, and fill in Basic, Standard and Premium. Each needs its own price in USD, scope, and included work (one item per line). Check Enable purchase for all three, then Save service. Keep the service visible and accepting requests.

## Why Coming soon may still appear

The preceding update deliberately did not invent prices or service promises. This update also does not publish prices without your input. All three tier cards now appear, but each becomes buyable only after you configure and enable it. These admin saves update the database directly; no extra code push is needed for price changes.

## Check after deployment

- Cart: a product with a gallery image displays that image instead of initials.
- How to Order: designed hero, guide cards and footer; check phone width too.
- Admin Services: search, expand a service, save all three packages, and confirm settings persist.
- Service page: all three tiers show their configured prices and included work. Buy each tier leads to the corresponding purchase form, without a Contact ticket.
- Use your existing safe payment-testing process to verify a completed Stripe checkout opens its private chat and one paid order appears after webhook confirmation. A cancellation should not create a paid order.
- Custom still opens the custom-request flow separately.

Your existing product detail page already supports gallery images; this update fixes the initials-only CART thumbnail visible in your first screenshot. If a product has no gallery image, add one through the product editor.
