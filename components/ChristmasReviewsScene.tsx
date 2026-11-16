"use client";
import { useEffect, useRef } from "react";
import styles from "./ChristmasReviewsScene.module.css";

/** Separate reference-matched scene and transparent sleigh layers. */
export default function ChristmasReviewsScene() {
  const sceneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let inView = true;
    const sync = () => { scene.dataset.active = String(inView && !document.hidden); };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    observer?.observe(scene);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return (
    <div ref={sceneRef} className={styles.scene} data-christmas-scene data-active="false" aria-hidden="true">
      <div className={styles.composition}>
        <div className={styles.plate} />
        <div className={styles.stars} data-christmas-layer="stars" />
        <div className={styles.flight} data-christmas-layer="flight">
          <div className={styles.sleigh} data-christmas-layer="sleigh" />
        </div>
      </div>
      <div className={styles.readability} />
    </div>
  );
}
