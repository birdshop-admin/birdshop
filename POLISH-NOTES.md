# BirdShop polish handoff

## What changed

- Unified the protected admin area around one shared visual system: warm-cream sidebar, deep forest workspace, cream management cards, and larger readable type.
- Restyled Products, Inventory, Orders, Service Requests, Reviews, the dashboard, and admin login for consistent spacing, controls, labels, and responsive behavior.
- Kept the existing Supabase admin authentication and encrypted inventory flow intact.
- Reworked Orders into a service-first operations view. Digital purchases are shown as sales history; service orders use a human workflow.
- Added safe test-order deletion and archive/restore behavior for real orders.
- Added first-party anonymous website activity tracking for online-now, 7-day, 30-day, and all-time views/visitors.
- Added a public verified Products Delivered counter based only on completed, paid, non-test digital orders.
- Kept real checkout/payment integration intentionally unconfigured. The current cart still needs a payment provider before launch.

## Required database migration

For an existing BirdShop database that already has products, inventory, reviews/support, and the original Orders foundation, run:

`supabase/admin-v2-analytics-orders.sql`

This adds service-order fields/workflow, archive/delete helpers, analytics tables/RPCs, and the public sales counter.

For a fresh database, use the SQL files in this order:

1. `supabase/support-reviews.sql`
2. `supabase/support-assignment-migration.sql`
3. `supabase/inventory.sql`
4. `supabase/orders.sql`
5. `supabase/admin-v2-analytics-orders.sql`

Do not blindly rerun old migrations against a production database without reviewing its current schema first.

## Environment variables

Keep your existing local `.env.local`. It is intentionally NOT included in this package.

Use `.env.example` only as a variable-name reference. Never prefix `INVENTORY_ENCRYPTION_KEY` with `NEXT_PUBLIC_`.

## Install / start

```bash
npm install
npm run check
npm run dev
```

Then open `http://localhost:3000`.

## Important behavior

### Digital products

The secure inventory/order core supports server-side key reservation and fulfillment. Once a real payment provider/webhook is connected, normal digital purchases should be confirmed and fulfilled automatically. Admin Orders then acts primarily as history/recovery rather than a manual approval queue.

### Services

Service orders remain human-operated. The admin queue supports New, Assigned, In Progress, Waiting on Customer, Completed, and Cancelled states.

### Analytics

Public pages create an anonymous random browser ID in localStorage. Admin pages are excluded from tracking. "Online now" means a browser seen within roughly the last two minutes; visitor counts are approximate browser/session counts, not identified people.

## Validation

`npm run check` (ESLint + TypeScript) passes on the polished source.

## Admin security + test inventory cleanup

- Admin sessions now expire after 3 minutes of inactivity. Activity is refreshed only while the protected admin UI is actively used; closing or leaving the admin page causes the server-side activity timestamp to become stale and the next admin request signs out.
- Manual Sign Out now uses the same server-side logout route.
- Run `supabase/admin-test-inventory-cleanup.sql` to enable the Inventory Vault test-sale cleanup controls.
- Sold/reserved keys tied to real orders remain locked fulfillment history.
- Sold/reserved keys tied to `admin_test` orders show two admin-only options:
  - Reset Test Sale: deletes the test order and restores all of that order's keys to Available.
  - Delete Test Key: deletes the test order, permanently deletes the selected key, and restores any other keys from that test order.
