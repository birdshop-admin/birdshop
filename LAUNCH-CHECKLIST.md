# BirdShop launch checklist

> **Use the www address everywhere.** `birdshop.store` forwards to
> `https://www.birdshop.store`. Stripe webhooks and the background job do not follow that
> forward, so every setting below that asks for the site address must be
> `https://www.birdshop.store`.

These steps need your own logins (Stripe, Vercel, Supabase, Resend, GitHub,
Cloudflare), so they can't be done from the code. Do part A any time, and
part B in one sitting on launch day.

---

## A. Before launch day

### 1. Review the policy pages
- Open `/terms`, `/privacy` and `/refunds` on the site and read them.
- They describe how the store works today, but they are a starting point, not
  legal advice.
- They name no business entity or governing law. If you have a registered
  business, add its name. A lawyer can tell you whether you need a
  governing-law clause where you live.
- To edit them, change `app/terms/page.tsx`, `app/privacy/page.tsx` and
  `app/refunds/page.tsx`. Update the "Last updated" date when you do.
- Optional: the Refund Policy says to report a broken code "as soon as you
  can". If you want a fixed window, such as 7 days, add it there.

### 2. Stripe account
- [ ] **Activate payments:** add your business details, identity and bank account. Stripe shows
  what is missing on the Home page.
- [ ] **Check Stripe's rules for your products.** Read Stripe's *Prohibited and restricted
  businesses* list for:
  - resold game keys and codes;
  - in-game currency or items;
  - game services that use a customer's account.

  Stripe can pause payouts for businesses on that list, so check before taking real money. If
  you are unsure, ask Stripe support.
- [ ] **Statement descriptor:** set it to something customers recognise, like `BIRDSHOP`
  (Settings → Business → Public details). This cuts down on "I don't recognise this charge"
  disputes.

### 3. Email (Resend)
- [ ] In Resend → Domains, `birdshop.store` (or your sending domain) shows **Verified**.
- [ ] In Vercel, set `BIRDSHOP_EMAIL_FROM` to an address on that domain, such as
  `BirdShop <orders@birdshop.store>`.
- [ ] In Vercel, set `BIRDSHOP_ADMIN_EMAIL` to the inbox you actually read.

### 4. Supabase
- [ ] **Migrations:** run any you haven't run yet, in order. The newest are:
  - 20: `20261009030000_paid_chat_first_reply.sql`
  - 21: `20261009040000_shorter_checkout_hold.sql`

  Then run `supabase/verify-production-readiness.sql`. Every row should say PASS.
- [ ] **Turn off public sign-ups:** Authentication → Sign In / Providers, turn off "Allow new
  users to sign up". Only your staff accounts should exist.
- [ ] **Plan:** free projects pause after about a week without activity, and their backups are
  limited. For a live store, the Pro plan is worth considering.

### 5. Background job (GitHub Actions)
- [ ] Open the repository on GitHub, then Settings → Secrets and variables → Actions.
- [ ] Add these two repository secrets:
  - `BIRDSHOP_SITE_URL` = `https://www.birdshop.store` (with www)
  - `CRON_SECRET` = the same value as in Vercel
- [ ] Open Actions → **BirdShop background maintenance** → Run workflow, and check that it
  succeeds.

This job releases expired checkouts, retries emails and closes completed chats. GitHub turns
scheduled jobs off after 60 days with no repository activity, so check it now and then.

### 6. Optional: bot check on checkout (Cloudflare Turnstile)
This stops scripts from holding your stock with fake checkouts.
1. Make a free Cloudflare account, then open Turnstile → Add widget.
2. Add both `www.birdshop.store` and `birdshop.store` as hostnames and choose the **Managed** mode.
3. In Vercel → Production, add two variables:
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the site key
   - `TURNSTILE_SECRET_KEY` = the secret key
4. Redeploy.

The check only turns on when both variables are set.

### 7. Store content
- [ ] Add your real products, with platform, region, price, images and codes.
- [ ] Hide or delete test products.
- [ ] Check each service's description, packages and prices.
- [ ] Delete test reviews in Admin → Reviews.
- [ ] Optional: set `NEXT_PUBLIC_DISCORD_INVITE_URL` to your real invite link.

---

## B. Launch day (in this order)

1. **Finish any test checkouts.** Don't leave one half-paid.

2. **Get your live Stripe keys.** Switch the Stripe dashboard out of test mode, then:
   - Copy the live **secret key** (starts `sk_live_`) from Developers → API keys.
   - Open Developers → Webhooks → Add destination. Use the URL
     `https://www.birdshop.store/api/stripe/webhook` (with www; Stripe does not follow redirects) and select these 8 events:
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `charge.refunded`
     - `refund.created`
     - `refund.updated`
     - `refund.failed`
   - Copy that endpoint's **signing secret** (starts `whsec_`).

3. **Vercel → Settings → Environment Variables (Production):**
   - Replace `STRIPE_SECRET_KEY` with the live secret key.
   - Replace `STRIPE_WEBHOOK_SECRET` with the live signing secret.
   - Check that `BIRDSHOP_SITE_URL` is exactly `https://www.birdshop.store`.
   - **Do not change** `INVENTORY_ENCRYPTION_KEY` or `BIRDSHOP_ORDER_TOKEN_SECRET`. Changing
     them makes stored codes and order links unreadable.

4. **Redeploy:** Deployments → latest production deployment → ⋯ → Redeploy.

5. **Clear the test data** in Supabase → SQL Editor:
   1. Run `supabase/launch/1-preview-test-data.sql`. It is read-only and lists everything that
      will be removed. Every "LIVE CHECK" number must be 0.
   2. Open `supabase/launch/2-reset-test-data.sql`. On the `confirm text` line, type
      `DELETE TEST DATA` between the quotes, then paste the whole file and click Run.
   3. Put the confirm line back to `''` afterwards.

   This removes test orders, chats, checkouts, emails and Stripe events. Products, services,
   images, codes, staff accounts and settings stay. Reviews stay unless you switch that choice
   on.

   Codes that were emailed in test orders become **disabled**. You can turn any of them back on
   in Admin → Inventory if nobody used them.

   The script refuses to run if it finds any live Stripe payment.

6. **Turn off the old test webhook** for birdshop.store in Stripe test mode. It would only fail
   from now on.

7. **Do one real purchase.** Buy your cheapest product with your own card, then check that:
   - the codes email arrives;
   - the order shows in Admin → Analytics.

   Then refund it in Stripe and check that both refund emails arrive. Stripe usually keeps its
   processing fee on a refund, so this test costs a little.

8. **Check the admin:** in Admin → Settings → Server configuration checks:
   - everything should show Present;
   - `STRIPE_SECRET_KEY` should say **LIVE mode**.

   Digital deliveries needing attention should be empty.

You're live.

---

## Will my test purchases disappear?

- **In Stripe:** test-mode payments stay in Stripe's *test mode* forever, completely separate
  from live mode. They never mix with real money and never pay out.
- **On the website:** test orders and chats stay in the database until you run step B5. After
  that, the admin starts from zero.
