"use client";

import Link from "next/link";
import {
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import {
  ArrowIcon,
  CartIcon,
  CheckIcon,
  ClockIcon,
  LightningIcon,
  MessageIcon,
} from "@/components/SiteIcons";

import { DEFAULT_PATH, ORDER_PATHS, isPathId, type PathId } from "./content";
import s from "./how-to-order.module.css";

/* ---------------------------------------------------------
   The selected path lives in the URL hash (#products,
   #services, #custom), read through useSyncExternalStore so
   no state is set inside an effect. history.replaceState does
   not fire "hashchange", so select() dispatches EVENT itself.
--------------------------------------------------------- */

const EVENT = "birdshop-order-path";

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener(EVENT, callback);

  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener(EVENT, callback);
  };
}

function getSnapshot(): PathId {
  const hash = window.location.hash.slice(1);
  return isPathId(hash) ? hash : DEFAULT_PATH;
}

function getServerSnapshot(): PathId {
  return DEFAULT_PATH;
}

const TAB_ICONS = {
  products: CartIcon,
  services: LightningIcon,
  custom: MessageIcon,
} as const;

const AFTER_ICONS = [CheckIcon, ClockIcon, MessageIcon] as const;

export default function OrderPaths() {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Set only from event handlers, so the first paint never animates.
  const [animate, setAnimate] = useState(false);

  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  function select(id: PathId, focus = false) {
    setAnimate(true);

    if (id !== active) {
      // replaceState: switching tabs should not pile up history entries.
      window.history.replaceState(null, "", `#${id}`);
      window.dispatchEvent(new Event(EVENT));
    }

    if (focus) {
      const index = ORDER_PATHS.findIndex((path) => path.id === id);
      tabsRef.current[index]?.focus();
    }
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = ORDER_PATHS.length - 1;
    let next: number | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = index === last ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = index === 0 ? last : index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }

    event.preventDefault();
    select(ORDER_PATHS[next].id, true);
  }

  return (
    <section className={s.paths} aria-labelledby="paths-label">
      <p id="paths-label" className={`${s.eyebrow} ${s.pathsLabel}`}>
        What are you ordering?
      </p>

      <div
        role="tablist"
        aria-labelledby="paths-label"
        className={s.tablist}
        data-hto-tablist=""
      >
        {ORDER_PATHS.map((path, index) => {
          const on = path.id === active;
          const Icon = TAB_ICONS[path.id];

          return (
            <button
              key={path.id}
              ref={(element) => {
                tabsRef.current[index] = element;
              }}
              type="button"
              role="tab"
              id={path.id}
              aria-selected={on}
              aria-controls={`${path.id}-panel`}
              aria-labelledby={`${path.id}-label`}
              aria-describedby={`${path.id}-sub`}
              tabIndex={on ? 0 : -1}
              className={s.tab}
              onClick={() => select(path.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              <span className={s.tabIcon} aria-hidden="true">
                <Icon />
              </span>
              <span id={`${path.id}-label`} className={s.tabLabel}>
                {path.label}
              </span>
              <span id={`${path.id}-sub`} className={s.tabSub}>
                {path.sub}
              </span>
              <CheckIcon className={s.tabCheck} />
            </button>
          );
        })}
      </div>

      {ORDER_PATHS.map((path) => {
        const on = path.id === active;
        const note = path.note;

        return (
          <section
            key={path.id}
            role="tabpanel"
            id={`${path.id}-panel`}
            aria-labelledby={`${path.id}-title`}
            tabIndex={0}
            hidden={!on}
            data-hto-panel=""
            className={`${s.panel} ${animate ? s.animate : ""}`}
          >
            <header className={s.panelHead}>
              <div className={s.panelIntro}>
                <span className={s.eyebrow}>{path.eyebrow}</span>
                <h2 id={`${path.id}-title`}>{path.title}</h2>
                <p>{path.intro}</p>
              </div>

              <div className={s.actions}>
                <Link className={s.primary} href={path.primary.href}>
                  {path.primary.label}
                  <ArrowIcon />
                </Link>
                <Link className={s.secondary} href={path.secondary.href}>
                  {path.secondary.label}
                </Link>
              </div>
            </header>

            <ol
              role="list"
              className={s.steps}
              style={{ "--steps": path.steps.length } as CSSProperties}
            >
              {path.steps.map((step, index) => (
                <li
                  key={step.title}
                  className={s.step}
                  style={{ "--i": index } as CSSProperties}
                >
                  <span className={s.stepNo} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className={s.stepBody}>
                    <span className={s.stepWhere}>{step.where}</span>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className={s.after}>
              <h3 className={s.afterTitle}>{path.afterTitle}</h3>
              <dl>
                {path.after.map((item, index) => {
                  const Icon = AFTER_ICONS[index] ?? CheckIcon;

                  return (
                    <div key={item.term}>
                      <dt>
                        <Icon />
                        {item.term}
                      </dt>
                      <dd>{item.detail}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>

            {note && (
              <p className={s.note}>
                <span>{note.text}</span>
                {/* A button, not a link: focus moves to the new tab
                    instead of being lost inside this hidden panel. */}
                <button type="button" onClick={() => select(note.target, true)}>
                  {note.action}
                  <ArrowIcon />
                </button>
              </p>
            )}
          </section>
        );
      })}
    </section>
  );
}
