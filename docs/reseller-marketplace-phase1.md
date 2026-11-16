# BirdShop marketplace — Phase 1 implementation

**Branch:** `feat/reseller-marketplace-phase1`  
**PR:** https://github.com/birdshop-admin/birdshop/pull/5  
**Safety:** No deployment, production migration or live seller checkout is authorized in this branch.

## Functional today (once migration is applied to a review environment)

- Authenticated, email-verified seller applications at `/sell`. A user can have one pending application. Rejected applications may be updated and re-submitted.
- Owner-only approval at `/admin/resellers`. Transactional approval RPC creates a seller profile or rolls back both changes. Owners may suspend accounts and change per-seller commission rates.
- Approved seller dashboard at `/sell/dashboard`. Seller can edit shop display details and create or update listings, submit to moderation, pause published listings, or permanently archive them. Editing a published listing resets it to draft.
- Owner moderation for every seller listing. Only owner-published, in-stock listings belonging to active sellers appear on `/marketplace` and `/shops/[handle]`. No invented shop reviews, sales or metrics.
- Real seller-defined price, available units, category, estimated delivery and optional service options.
- Private buyer-seller inquiries at `/marketplace/inquire/[id]`, `/marketplace/messages/*` and `/sell/inbox`. Participant checks on every read/write; owner conversation review access is audited at `/admin/resellers/inquiries`.
- Real records populate the seller dashboard. Zero counts remain zero until provider-verified transactions are possible.
- Owner audit entries for applications, listing edits, suspensions, commissions, moderation and sensitive conversation access.
- Existing first-party Stripe checkout, products, inventory, order emails, services and chat remain independent.

## Database migration

`supabase/migrations/20261116230000_marketplace_phase1_foundation.sql`

This adds tables for applications, profiles, listings, conversations, future marketplace orders, disputes, ledger, payouts and audit entries. Access is **service role only**; public/regular authenticated database roles cannot directly read or mutate these private records. Every server action authenticates with `auth.getUser()` and checks the relevant seller, buyer or owner identity before using a privileged server client.

The `birdshop_review_seller_application` RPC is granted only to `service_role` and checks the existing server guard. It approves sellers atomically. The migration should be reviewed and applied in a staging database before any production rollout. Avoid loading sensitive production customers into a preview branch.

## What is NOT yet working

- Real marketplace checkout, mixed first-party/seller carts, Stripe Connect (or equivalent), seller payment settlement.
- Automatic listing inventory allocation or digital-key fulfillment.
- Provider-confirmed order state changes, chargebacks and refunds.
- Live commission posting, seller withdrawals and manual payout approvals.
- Buyer disputes, supporting evidence upload, automated resolutions.
- Verified purchaser review system or seller performance/sales ratings.
- Seller-owned binary image uploads; currently listings accept an HTTPS image URL only.
- Seller onboarding document verification/identity checks and marketplace tax/KYC compliance.

The financial tables are strictly future scaffolding. They are not connected to any live payment, webhook or order finalizer. It is prohibited to mark a marketplace order paid merely because someone submitted a voucher, sent a screenshot or claimed a transfer.

## Owner acceptance checklist

1. Review the PR code and migration; have a DBA/security review the privileged server access and RLS.
2. Apply the migration to a dedicated staging Supabase project.
3. Confirm Supabase passwordless email callbacks allow the staging domain and correct `BIRDSHOP_SITE_URL`.
4. Use two verified non-owner test accounts and one owner account. Confirm sellers cannot approve themselves, edit another seller's listing, read another conversation or see private applicant data.
5. Test pending/rejected/reapplied/approved seller transitions; active/suspended seller visibility and moderation states.
6. Test duplicate login messages, listing slugs, repeated submissions, IDOR attempts, mobile layouts and price/quantity bounds.
7. Keep payment acceptance disabled until a supported marketplace processor, payouts compliance, reconciliation, refunds and disputed-order holds have been implemented and separately approved.
8. Do not merge PR or deploy without owner approval.

## Milestone plan

**A. Seller onboarding and catalog** — implementation in PR #5.  
**B. Marketplace transaction engine** — payment partner, fee snapshots, idempotent order transitions, fulfillment locks, reviews.  
**C. Dispute and money ledger** — refunds/chargebacks, withdrawals after settlement, owner queue, audited payout approval.  
**D. Release quality** — integration tests, compliance review and owner-approved deployment.
