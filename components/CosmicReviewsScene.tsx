"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import styles from "./CosmicReviewsScene.module.css";

const fragments = [
  [44, 13, 63, 25, -7, 1], [71, 20, 35, 34, -13, -1],
  [82, 34, 75, 29, -4, 1], [39, 43, 56, 23, -17, -1],
  [63, 48, 88, 31, -10, 1], [51, 53, 26, 22, -5, -1],
  [92, 15, 28, 37, -20, 1], [23, 24, 24, 27, -9, -1],
  [76, 52, 34, 21, -3, 1], [48, 7, 18, 33, -14, -1],
  [88, 45, 18, 26, -11, 1], [33, 53, 24, 35, -24, -1],
] as const;

/**
 * A decorative scene made of individually composited, high-resolution sprites
 * over a sharp landscape. No WebGL runtime, timers or animation frames.
 * Without JavaScript (or with reduced motion) it remains a complete still scene.
 */
export default function CosmicReviewsScene() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let inView = true;
    const syncPlayback = () => {
      scene.dataset.active = String(inView && !document.hidden);
    };
    const observer = typeof IntersectionObserver === "undefined" ? null :
      new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        syncPlayback();
      }, { threshold: 0 });
    observer?.observe(scene);
    document.addEventListener("visibilitychange", syncPlayback);
    syncPlayback();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      scene.dataset.active = "false";
    };
  }, []);

  return (
    <div ref={sceneRef} className={styles.scene} data-active="false" data-cosmic-scene aria-hidden="true">
      <div className={styles.camera} data-cosmic-layer="camera">
        <div className={styles.landscape} />
        <div className={styles.stars} data-cosmic-layer="stars" />
        <div className={styles.horizonLight} data-cosmic-layer="light" />
        <div className={styles.portal}>
          <div className={styles.portalHalo} />
          <div className={styles.vortex} data-cosmic-layer="vortex" />
          <div className={styles.innerVortex} data-cosmic-layer="inner-vortex" />
          <div className={styles.core} />
          <div className={styles.lens} data-cosmic-layer="lens" />
        </div>
        {fragments.map(([left, top, size, duration, delay, direction], index) => (
          <div key={index} className={styles.rockOrbit} style={{
            left: `${left}%`, top: `${top}%`, "--size": `${size}px`,
            "--duration": `${duration}s`, "--delay": `${delay}s`,
            "--drift": `${direction * (18 + index * 2)}px`,
          } as CSSProperties} data-cosmic-layer="rock">
            <div className={styles.rock} style={{ "--angle": `${index * 43}deg` } as CSSProperties} />
          </div>
        ))}
        {[0, 1, 2, 3, 4, 5].map(index => (
          <div key={index}
            className={`${styles.cloud} ${index % 2 ? styles.cloudRight : styles.cloudLeft}`}
            style={{
              "--duration": `${25 + (index % 3) * 7}s`,
              "--delay": `${-index * 8 - 3}s`,
              "--level": `${64 + (index % 3) * 12}%`,
              "--cloud-scale": `${1 + (index % 3) * .22}`,
            } as CSSProperties}
            data-cosmic-layer="cloud" />
        ))}
        <div className={styles.dust} data-cosmic-layer="dust" />
      </div>
      <div className={styles.readability} />
    </div>
  );
}
