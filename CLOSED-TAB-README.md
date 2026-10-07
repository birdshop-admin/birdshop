# BirdShop: one Closed tab

Apply after the previous BirdShop Owner Chat Cleanup update, including its 20261006030000_owner_chat_cleanup.sql migration. No NEW SQL is needed for this follow-up.

Copy these files into the matching website paths, replacing the two existing files. Keep the README and file list beside package.json.

Changes:
- Removed Deleted from the owner chat tabs.
- Previously soft-deleted chats are grouped into Closed. No database records are automatically restored or erased.
- Old ?view=deleted links render Closed.
- Removed the redundant move-to-Deleted action from Closed.
- Closed chats offer Reopen and owner-only Permanent Delete.
- Previously deleted entries offer Restore to Closed, then Reopen, or Permanent Delete directly.
- Permanent Delete/Restore preserve the Closed tab, category, and page.
- Prior permanent-deletion authorization and payment retention behavior stays intact.

Run in VS Code Terminal:

```powershell
npm.cmd run check
npm.cmd run build
git --literal-pathspecs add --pathspec-from-file=CLOSED-TAB-FILES.txt
git --no-pager diff --cached --stat
git commit -m "Consolidate deleted chats into Closed"
git push origin main
```

After Vercel is Ready, confirm only New, In Progress, Completed and Closed are shown. Confirm older deleted chats appear in Closed, permanently remove a disposable chat, and check that the selected tab remains Closed.

Validation: focused routing/grouping/server-action checks passed. This small update was prepared from the last delivered cleanup files; the complete project dependencies were unavailable, so a full Next.js build was not run here. Run check/build above before pushing.

Remaining rollout work: verify product images and unused inventory removal from the previous update; verify a configured service package purchase opens its private chat, payment creates one paid order, messages work both ways, and mobile layout fits. Check owner-only cleanup with a service-agent account. These are live acceptance checks, not additional feature requirements.
