# BirdShop — production readiness and premium redesign (2026-10-08)

This folder contains the complete website: the original BirdShop site plus a security and
production-readiness pass and a premium redesign. Checks that were run locally:

- `npm run typecheck`
- `npm run lint`
- `next build` (production build)
- `node scripts/verify-finalization.mjs`
- Full-page screenshots of 18 public pages at 1440, 768, 375 and 320 px wide, in light and dark
  mode, through headless Chrome against the dev server. No page scrolls sideways and no page
  throws a script error.
- Every new or changed SQL file passes the PostgreSQL parser, including the function bodies.

**Not tested:** anything against live Supabase/Stripe/Resend (real payments, webhooks, emails,
migrations) and the logged-in admin screens. The checklist at the end covers these.

## 1. Deploy order

1. **Back up the Supabase database.**
2. **Apply every file in `supabase/migrations/` in filename order** (the list is in
   START-HERE.txt), up to the two new ones:
   - `20261008120000_production_readiness.sql`: security, order completion, checkout recovery,
     the Overview work queues, refund labels in chat.
   - `20261009010000_service_custom_only_backfill.sql`: marks `custom-build-request`,
     `custom-game-service` and `roblox-custom-task` as "Custom quote only", but only where you
     have never chosen a pricing type for them yourself.

   Both files are additive and safe to run twice. They delete no customer, order, payment or
   inventory rows.
3. **Run `supabase/verify-production-readiness.sql` (read-only).**
   - Every row should say PASS.
   - Then review its second result: every function a signed-in user can call must check
     `is_birdshop_owner()` or active staff assignment.
4. **Deploy the app.** It still works if a migration has not run yet:
   - Overview shows its older figures.
   - Orders complete without the completion email until 17 is in.

## 2. What changed

### Security, payments, data
- **Order status function**
  - Owner-only.
  - Uses explicit transitions: completed and fully refunded orders can't be reopened.
  - Keeps the chat status in sync with the order.
  - Posts one "order completed" chat message and queues one deduplicated completion email,
    which states the order is completed and shows the amount paid.
  - Receipt emails now say "Payment confirmed" instead of "Purchase complete".
- **Other owner-only functions:** legacy functions that any staff member could call are now
  owner-only. Deactivated staff lose access.
- **Products table:** RLS on; anyone can read visible products; only the owner can write.
  Product images can only be uploaded, replaced or deleted by the owner.
- **Checkout**
  - At most 10 codes per order and 2 unpaid checkouts per email.
  - Stuck or expired checkouts release their reserved codes automatically.
  - The return page checks Stripe directly if the webhook is slow.
  - The Stripe redirect is never treated as proof of payment; the chat shows "Confirming your
    payment…" until the server confirms.
- **Customer chat**
  - Closed chats can't start a payment.
  - Refunds show as refunded.
  - The chat API no longer sends the customer's email or contact, or internal IDs, to the browser.
  - Removed chats stop polling.
- **Admin sign-in**
  - Opening an admin link from an email no longer logs you out.
  - A revoked session can't loop between /admin and the login page.
  - Brute-force limits can't lock the owner out.
  - There is no inactivity timeout.
- **Error handling**
  - Branded error pages.
  - Real 404s for unknown pages, products and services.
  - Friendly messages instead of raw errors on payment pages.

### Design
- **Theme**
  - One shared token system for light and dark (`app/theme.css`), with a much richer layered
    forest-green dark mode.
  - The theme switch sits in the header on desktop, the menu on phones and the sidebar in admin.
- **Home:** real product and service images, layouts that look intentional with 1, 2 or 3 items,
  a "How it works" band, and the cart button works immediately.
- **Services:** "Custom quote only" services show no packages anywhere. Services with no
  published packages also show as "Custom quote" automatically.
- **Pages**
  - **My Service:** redesigned inbox, conversation view and payment receipt cards.
  - **How to Order:** rebuilt as three clear paths (Digital product, Ready-made service, Custom
    request), each with numbered steps.
  - **Header, footer, products, cart, FAQs, reviews and contact:** a polish pass.
  - **404 page:** premium, with quick links.
- **Performance**
  - Hero images converted to WebP (2.2 MB → ~100 KB).
  - Lighter catalog refreshing.
  - Prices consistently formatted ("$1,250.00").

## 2b. Follow-up changes (after first live testing)

- **New migrations:**
  - **19** `20261009020000_explicit_owner_checks.sql`: both order-delete functions now carry their own owner check.
  - **20** `20261009030000_paid_chat_first_reply.sql`: a paid package chat moves to In Progress on the first staff reply.
- **Admin Chat:** paid package chats that no one has replied to or been assigned to now appear under **New**. The duplicate-key console error on the chat page is fixed.
- **Refund emails:** every refund recorded from Stripe emails you (BIRDSHOP_ADMIN_EMAIL) and the customer. A second partial refund sends a new email; repeated Stripe events do not.
- **Theme:** the site always opens in light mode (a visitor's own choice is remembered). On a visitor's first three visits, until they try it, the dark-mode switch glows with a "Try dark mode" label; on phones the Menu button glows instead.

- **Complete orders from the chat:** service chats now have a **Complete Order** button in the chat footer, for the owner and for the provider assigned to that chat. You tick a confirmation box, then:
  - the customer gets the completion email and a chat message;
  - the chat closes automatically 1 hour later, through the 5-minute maintenance job;
  - it stays listed under **Completed**.

- **Orders page removed:** the admin Orders tab is gone.
  - Service work runs entirely in **Chat**: replying starts the work, payment requests are sent from the chat, and **Complete Order** finishes it.
  - Digital orders whose codes weren't delivered are listed in **Settings → Digital deliveries needing attention**, with the retry button.
  - Sales history is in **Analytics**.
  - Old `/admin/orders` links, including those in earlier admin emails, redirect automatically.

## 3. Owner how-tos (Admin)

- **Make a service custom-quote only**
  1. Open Admin → Services, then the service.
  2. Under **Pricing type**, choose **Custom quote only**.
  3. Click **Save Service**.

  Switching back to **Fixed packages** restores the saved prices.
- **Show packages for a service:** set Pricing type to **Fixed packages**, enable each package
  with a price and its included work, then save.
- **Service image**
  1. In the service editor, open **Service image**.
  2. Upload a PNG, JPG or WEBP up to 8 MB (landscape, 1600×900 or larger looks best).
  3. Click **Save**.

  To remove it, tick the remove option and save.
- **Product images:** Admin → Products → gallery images. Products and services without an image
  show the BirdShop monogram seal.
- **Rehearse an order:** use Stripe test mode with a fixed-price package, then complete it from
  the chat.
- **Discord:** set `NEXT_PUBLIC_DISCORD_INVITE_URL` to your real invite. Until then, Discord
  buttons fall back to the Contact page or are hidden, and the footer shows no Discord icon.

## 4. Configuration checklist

- **Products RLS:** the live products policies were never in the repo; this migration replaces the
  write policies. After migrating, check that the storefront, cart and Admin → Products still load
  and save.
- **`is_birdshop_owner()` / `birdshop_get_my_staff_profile()`** live only in your database.
  Confirm they check `admin_users.is_active`. The verify script flags it.
- **Supabase Auth**
  - Turn off public sign-ups if only staff need accounts.
  - Check the session time-box and inactivity settings so the admin stays signed in.
- **Stripe**
  - The webhook `/api/stripe/webhook` needs these events:
    - `checkout.session.completed`
    - `checkout.session.expired`
    - `checkout.session.async_payment_succeeded`
    - `checkout.session.async_payment_failed`
    - `charge.refunded`
    - `refund.created`
    - `refund.updated`
    - `refund.failed`
  - Use live keys only in production.
- **`BIRDSHOP_SITE_URL`** must be the exact public origin (www vs apex matters). Every POST
  checks it. In `.env.local` it is currently localhost, which is right for local development
  only.
- **Hosting**
  - IP rate limits rely on Vercel's `x-vercel-forwarded-for` header.
  - Vercel caps request bodies at about 4.5 MB, so keep product/service image uploads under that
    per save.
- **Email retries** run from the GitHub Actions schedule (`.github/workflows/birdshop-maintenance.yml`):
  - GitHub can delay scheduled runs and pauses them after 60 days without repo activity.
  - Consider a second scheduler calling `GET /api/maintenance` with
    `Authorization: Bearer $CRON_SECRET`.
  - Completion emails also send immediately when you complete an order.
- **Resend** keeps message bodies, which include delivered codes. Limit who can access the Resend
  dashboard.

## 5. Manual launch tests (cannot be automated here)

Use Stripe **test mode** against a copy of the database first:

1. **Product:** add to cart → checkout → pay → the return page shows the order → the codes email
   arrives → the private order page loads.
2. **Fixed package:** buy → the chat opens only after payment → the receipt email arrives.
3. **Custom request**
   1. Contact → chat.
   2. Admin sends a payment request.
   3. Pay → "Confirming your payment…" changes to confirmed.
   4. Admin completes the order → the completion email arrives once.
4. Cancel a checkout and confirm stock is released. Refund a payment in Stripe and check the
   chat/order show it as refunded.
5. Admin, light and dark, desktop and phone: Overview, Chat (including Complete Order),
   Products, Inventory, Services (pricing type and image upload), Reviews, Settings.

## 6. Known remaining risks (deliberately not changed)

- **Inbox email planting:** someone can start a chat using another person's email; it then appears
  in that person's verified inbox. Closing this needs a product decision: verify the email when the
  chat is created, or rotate the chat link on first verified open.
- **Stock holds:** unpaid checkouts hold codes for up to an hour (capped as above). A determined
  attacker with many IPs and emails could still hold stock; bot protection on checkout would be
  the next step.
- **Private chat links live in URLs** (browser history, hosting logs, Stripe return URLs). Referrer
  leakage is blocked.
- **Local QA analytics:** during local QA, the anonymous analytics tracker recorded a small number
  of test page views into the Supabase project that `.env.local` points to. No orders, chats,
  checkouts or emails were created.
