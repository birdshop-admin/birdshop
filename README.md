# BirdShop

BirdShop is a custom Next.js 16 storefront for digital products and game-related services. The current build uses the App Router, TypeScript, Supabase authentication/data, encrypted digital-key inventory, a service-first admin order queue, review/support moderation, and first-party anonymous traffic counters.

## Local development

```bash
npm install
npm run dev
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`:

```powershell
npm.cmd run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and fill in your own values. Never commit `.env.local`, the Supabase service-role key, or the inventory encryption key.

Required values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `INVENTORY_ENCRYPTION_KEY` (server-only)

## Supabase SQL

The `supabase/` folder contains the database pieces used by the current codebase. For an existing BirdShop database, only run migrations you have not already applied.

Typical order for a fresh BirdShop database after the products/admin setup:

1. `supabase/support-reviews.sql`
2. `supabase/support-assignment-migration.sql`
3. `supabase/inventory.sql`
4. `supabase/orders.sql`
5. `supabase/admin-v2-analytics-orders.sql`

The final migration adds the service-first order fields, test-order deletion/archive helpers, anonymous site activity tracking, and the verified public products-delivered counter.

## Quality checks

```bash
npm run check
npm run build
```

`npm run check` runs ESLint and TypeScript validation.

## Main structure

- `app/` — storefront and admin routes
- `components/` — shared storefront/admin UI
- `lib/` — product/service data, Supabase helpers, encryption, and support context
- `public/` — BirdShop logo and forest imagery
- `supabase/` — database migrations used by the current build

## Admin routes

- `/admin` — overview, site activity, product-delivery count
- `/admin/products` — product catalog management
- `/admin/inventory` — encrypted digital-key vault and key-managed stock
- `/admin/orders` — service work queue, digital sales history, archives, testing
- `/admin/requests` — support/service/product-help requests
- `/admin/reviews` — review moderation

The admin design uses a warm cream sidebar with a deep forest-green workspace and larger typography for readability.

## Product fulfillment model

Digital products are designed to be automatic once payment integration is connected:

`payment verified -> inventory reserved -> order fulfilled -> key sold -> public stock updates`

The current admin controls remain useful for testing and recovery. Service work stays human-managed through the service queue.

## Analytics model

BirdShop's built-in traffic counters store a random browser identifier, current/last path, and timestamps. They do not intentionally store names, emails, or IP addresses. `/admin` shows approximate online visitors plus 7-day, 30-day, and all-time page-view/visitor counts.
