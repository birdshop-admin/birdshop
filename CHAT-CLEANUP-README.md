# BirdShop product images and owner cleanup

Apply on top of BirdShop-Storefront-Design-Update.zip. All files are complete replacements. Keep other project files.

## Install in this order

1. Extract the ZIP into your website root (beside package.json), merging folders and replacing matching files. Keep the CHAT-CLEANUP documents there too.
2. Open supabase/migrations/20261006030000_owner_chat_cleanup.sql in VS Code. Copy its entire SQL content to a NEW Supabase SQL Editor query and run it. This installs functions/triggers; it does not delete existing chats or inventory.
3. Run supabase/verify-owner-chat-cleanup.sql in another SQL Editor query. Expect 6 PASS rows. Keep both SQL files in your VS Code project.
4. Run the commands below in the VS Code terminal. The migration must be installed before the new code is deployed because the admin list filters its new purged_at column.

```powershell
npm.cmd run check
npm.cmd run build
git --literal-pathspecs add --pathspec-from-file=CHAT-CLEANUP-FILES.txt
git --no-pager diff --cached --stat
git commit -m "Fix product images, inventory removal, and owner chat cleanup"
git push origin main
git status
```

5. Wait for that Vercel deployment to show Ready, then refresh the website.

## What changes

- Products catalog cards show the product's saved gallery image instead of only its initials. A missing/broken image falls back to initials. No re-upload is needed if the product already has a valid gallery image.
- Available/disabled inventory removal uses an owner-authorized RPC instead of relying on browser inventory permissions. It returns specific not-found/reservation errors. Stock continues to use the existing database stock-sync trigger.
- Synthetic test-sale cleanup uses the authenticated owner session required by its existing RPC permissions. Real sold codes and active checkout reservations are retained.
- BS reference numbers are bigger and on their own line in owner chat lists, headers and archives.
- Delete, Restore and Permanent Delete preserve the current tab, category and page. Deleting from Closed leaves you on Closed. Deleting from Deleted leaves you on Deleted.
- The owner has a permanent deletion control for open, in-progress, completed, closed and deleted chats. Expand it, check the reference and confirm. Service agents have no control and the database rejects their calls too.

## Permanent removal and payment records

Unlinked chats are physically deleted. For chats linked to payments or orders, their messages and original request text are erased, device access is removed, and the chat disappears permanently from the app. An inaccessible conversation record remains for payment/order relationships. Existing receipts, billing details, refunds and payment processing are retained. A late payment webhook cannot reopen the chat or recreate its messages. Removed chats cannot be restored.

The remaining billing record is intentional: deleting a chat must not break payment reconciliation or erase a paid order. Permanent removal does not cancel an already-open Stripe checkout or refund a payment. If needed, cancel the payment request through the existing payment controls first.

## After deployment

- Products: check the Aeon Hub image in the catalog.
- Inventory: remove one unused available/disabled key you genuinely want removed; check the resulting stock count. Reserved/sold codes should remain protected.
- Closed chats: delete one and confirm the Closed tab remains selected.
- Permanent deletion: use a disposable chat, check its reference, confirm deletion, then refresh. It should not reappear or be recoverable through its private link.
- Confirm the owner reference numbers are readable. The live admin UI and phone layout still need your visual check.

No new environment variables or package dependencies are required.
