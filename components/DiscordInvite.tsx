"use client";

import Image from "next/image";
import { useEffect, useRef, type MouseEvent } from "react";

import { ArrowIcon, DiscordIcon } from "@/components/SiteIcons";
import { hasDiscordInvite, siteConfig } from "@/lib/site-config";

import s from "./DiscordInvite.module.css";

const SHOW_DELAY_MS = 1200;

// Home page only: a small invite to the BirdShop Discord, styled like the
// site's forest hero. It opens on every home page visit: a fresh load, a
// refresh, client navigation to Home, and Back/Forward (which can restore the
// page from the browser cache without re-running effects, hence pageshow).
// Closes with the X, "Maybe later", Escape, or a click outside the card.
export default function DiscordInvite() {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!hasDiscordInvite) return;
    let timer = 0;
    const open = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const box = dialog.current;
        if (box && !box.open) box.showModal();
      }, SHOW_DELAY_MS);
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) open();
    };
    open();
    window.addEventListener("pageshow", restored);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", restored);
    };
  }, []);

  function close() {
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
              onClick={() => close()}
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
