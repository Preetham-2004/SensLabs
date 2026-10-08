"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import styles from "./landing.module.css";

export default function PhaseTransition() {
  const prefersReducedMotion = useReducedMotion();
  const [stable, setStable] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setStable(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className={styles.glitchOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
      role="status"
      aria-live="polite"
      aria-label="Loading Phase 1"
    >
      <div className={styles.glitchBox}>
        <div className={styles.glitchLogoContainer}>
          <div className={`${styles.glitchTitle} ${stable ? styles.glitchTitleStable : ""}`} data-text="SENSLABS">
            SENSLABS
          </div>
          <div className={styles.glitchSubtitle}>
            {stable ? "SYSTEM READY - LOADING PHASE 1" : "INITIALIZING CALIBRATION ENGINE..."}
          </div>
        </div>
        <div className={styles.glitchProgressLine} />
      </div>
    </motion.div>
  );
}
