"use client";

import Image from "next/image";
import { useEffect, useRef, type MouseEvent } from "react";

import { ArrowIcon, DiscordIcon } from "@/components/SiteIcons";
import { hasDiscordInvite, siteConfig } from "@/lib/site-config";

import s from "./DiscordInvite.module.css";

const STORAGE_KEY = "birdshop-discord-invite";
// After "Maybe later" the invite stays away for a few days; after joining, for good.
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 1200;

function shouldShow() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "joined") return false;
    return !saved || Date.now() - Number(saved) > SNOOZE_MS;
  } catch {
    // Storage blocked: show it, closing still works for this visit.
    return true;
  }
}

function remember(value: string) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Works without storage; it may simply show again next visit.
  }
}

// Home page only: a small invite to the BirdShop Discord, styled like the
// site's forest hero. Closes with the X, "Maybe later", Escape, or a click
// anywhere outside the card.
export default function DiscordInvite() {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!hasDiscordInvite || !shouldShow()) return;
    const timer = window.setTimeout(() => {
      const box = dialog.current;
      if (box && !box.open) box.showModal();
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  function close(joined = false) {
    remember(joined ? "joined" : String(Date.now()));
    dialog.current?.close();
  }

  // A click on the dimmed backdrop lands on the <dialog> itself, not the card.
  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) close();
  }

  if (!hasDiscordInvite) return null;

  return (
    <dialog
      ref={dialog}
      className={s.dialog}
      aria-labelledby="discord-invite-title"
      onClick={onBackdropClick}
      onCancel={() => remember(String(Date.now()))}
    >
      <div className={s.card}>
        <div className={s.photo} aria-hidden="true" />
        <div className={s.mist} aria-hidden="true" />

        <button
          type="button"
          className={s.close}
          aria-label="Close"
          onClick={() => close()}
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className={s.body}>
          <span className={s.badge} aria-hidden="true">
            <span className={s.ring} />
            <DiscordIcon />
          </span>

          <span className={s.eyebrow}>BirdShop · Community</span>

          <h2 id="discord-invite-title">
            Join us on <em>Discord.</em>
          </h2>

          <p>
            Meet the community, see what&apos;s new and get quick help from the
            BirdShop team.
          </p>

          <div className={s.actions}>
            <a
              href={siteConfig.discordUrl}
              target="_blank"
              rel="noreferrer"
              className={s.join}
              onClick={() => close(true)}
            >
              <DiscordIcon />
              <span>Join the Discord</span>
              <ArrowIcon />
            </a>

            <button type="button" className={s.later} onClick={() => close()}>
              Maybe later
            </button>
          </div>

          <footer className={s.sign}>
            <Image src="/cremebs.png" alt="" width={26} height={26} />
            <span>Games bring us closer</span>
          </footer>
        </div>
      </div>
    </dialog>
  );
}
