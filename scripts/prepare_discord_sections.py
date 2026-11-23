#!/usr/bin/env python3
"""Idempotent, additive BirdShop / Bird's Marketplace Discord channel preparation.

Dry run (no network): python3 scripts/prepare_discord_sections.py
Apply (requires a bot with Manage Channels and permission to set overwrites):
  DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... python3 scripts/prepare_discord_sections.py --apply

No existing category/channel is moved, renamed, deleted or modified.
All new channels start read-only for @everyone; this is preparation, not launch.
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

API = "https://discord.com/api/v10"
MARKETPLACE = "BIRD’S MARKETPLACE"
# Announcements, help, and seller information stay read-only until launch.
MARKET_CHANNELS = (
    ("marketplace-start-here", "Bird’s Marketplace is the separate multi-seller marketplace at market.birdshop.store. Preparation only; selling is not open."),
    ("marketplace-updates", "Marketplace-only roadmap and launch announcements. BirdShop storefront updates remain in their existing channels."),
    ("marketplace-how-it-works", "Information for buyers and sellers. Processes and policies are being prepared."),
    ("seller-onboarding", "Seller eligibility, applications, verification and setup details will be posted here when approved. Never upload identity documents publicly."),
    ("seller-resources", "Future seller storefront, listing, fee, wallet and payout explanations. No live payment functionality is implied."),
    ("marketplace-support", "How to request private marketplace help and report issues. Do not expose orders, payment or identity information in public."),
    ("marketplace-feedback", "Marketplace feedback and review information; only approved content will be featured."),
    ("marketplace-community", "A future community space for Bird’s Marketplace; read-only until the marketplace is opened."),
)
REFERRAL = (
    "referrals",
    "BirdShop only: earn $0.50 USD per eligible first-time buyer who completes a qualifying paid and fulfilled purchase. Subject to review; see birdshop.store/referrals.",
)
DENY_POST = (1 << 11) | (1 << 35) | (1 << 36) | (1 << 38)
ALLOW_VIEW = (1 << 10) | (1 << 16)


def api(token, method, path, payload=None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API + path,
        data=body,
        method=method,
        headers={
            "Authorization": "Bot " + token,
            "Content-Type": "application/json",
            "User-Agent": "BirdShop-Channel-Setup/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            f"Discord API {method} {path} rejected with HTTP {exc.code} "
            "(verify bot permissions, server ID, and rate limits)."
        ) from None


def readonly(guild_id):
    return [{
        "id": guild_id,  # the @everyone role ID equals the guild ID
        "type": 0,
        "allow": str(ALLOW_VIEW),
        "deny": str(DENY_POST),
    }]


def run():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--apply", action="store_true", help="Create missing channels (requires bot credentials)")
    args = p.parse_args()
    print("Existing BirdShop categories, channels, webhooks and roles will not be changed.")
    print(f"NEW CATEGORY: {MARKETPLACE}")
    for name, _ in MARKET_CHANNELS:
        print(f"  + #{name} (read-only until launch)")
    print("BIRDSHOP EXISTING CATEGORY: + #referrals, if one category is unambiguously identified.")
    if not args.apply:
        print("DRY RUN ONLY. No Discord API call was made.")
        return

    token = os.getenv("DISCORD_BOT_TOKEN", "").strip()
    guild_id = os.getenv("DISCORD_GUILD_ID", "").strip()
    existing_birdshop_id = os.getenv("BIRDSHOP_CATEGORY_ID", "").strip()
    if not token or not re.fullmatch(r"[0-9]{15,25}", guild_id):
        raise RuntimeError("DISCORD_BOT_TOKEN and a numeric DISCORD_GUILD_ID must be provided.")
    current = api(token, "GET", f"/guilds/{guild_id}/channels")

    categories = [c for c in current if c.get("type") == 4]
    matches = [c for c in categories if c.get("name", "").casefold() == MARKETPLACE.casefold()]
    if len(matches) > 1:
        raise RuntimeError("Multiple marketplace categories exist. Resolve manually; no changes made.")
    if matches:
        marketplace_id = matches[0]["id"]
        print(f"Reuse existing marketplace category {marketplace_id}")
    else:
        created = api(token, "POST", f"/guilds/{guild_id}/channels", {
            "name": MARKETPLACE,
            "type": 4,
            "permission_overwrites": readonly(guild_id),
        })
        marketplace_id = created["id"]
        print(f"Created marketplace category {marketplace_id}")

    # Re-read after creation for stable, idempotent matching.
    current = api(token, "GET", f"/guilds/{guild_id}/channels")
    for name, topic in MARKET_CHANNELS:
        matches = [c for c in current if c.get("parent_id") == marketplace_id and c.get("name") == name]
        if matches:
            print(f"EXISTS: #{name}; not modified")
            continue
        created = api(token, "POST", f"/guilds/{guild_id}/channels", {
            "name": name,
            "type": 0,
            "parent_id": marketplace_id,
            "topic": topic,
            "permission_overwrites": readonly(guild_id),
        })
        current.append(created)
        print(f"CREATED: #{name}")

    if existing_birdshop_id:
        match = next((c for c in categories if c.get("id") == existing_birdshop_id), None)
        if not match:
            print("SKIPPED #referrals: BIRDSHOP_CATEGORY_ID does not identify an existing category.")
            return
        birdshop_id = match["id"]
    else:
        matches = [c for c in categories if "birdshop" in c.get("name", "").lower().replace(" ", "")]
        if len(matches) != 1:
            print("SKIPPED #referrals: provide BIRDSHOP_CATEGORY_ID to select the existing BirdShop category.")
            return
        birdshop_id = matches[0]["id"]

    name, topic = REFERRAL
    if any(c.get("parent_id") == birdshop_id and c.get("name") == name for c in current):
        print("EXISTS: BirdShop #referrals; not modified")
    else:
        api(token, "POST", f"/guilds/{guild_id}/channels", {
            "name": name, "type": 0, "parent_id": birdshop_id,
            "topic": topic, "permission_overwrites": readonly(guild_id),
        })
        print("CREATED: BirdShop #referrals (read-only)")


if __name__ == "__main__":
    try:
        run()
    except RuntimeError as exc:
        print("SETUP STOPPED:", exc, file=sys.stderr)
        sys.exit(1)
