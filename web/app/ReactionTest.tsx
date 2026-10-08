"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./reaction.module.css";

const TOTAL_TRIES = 3;
type TestPhase = "ready" | "waiting" | "go" | "result" | "finished" | "early";

export function ReactionTestLauncher({ onLaunch }: { onLaunch: () => void }) {
  return <button className={styles.launchButton} type="button" onClick={onLaunch}>Quick reaction test <span>· just for fun</span></button>;
}

export default function ReactionTest({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<TestPhase>("ready");
  const [times, setTimes] = useState<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const startedAt = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);

  const clearTimer = () => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };
  const reset = () => {
    clearTimer();
    setPhase("ready");
    setTimes([]);
    setCurrent(null);
  };
  const startTry = () => {
    clearTimer();
    setCurrent(null);
    setPhase("waiting");
    timeout.current = setTimeout(() => {
      frame.current = requestAnimationFrame((visibleFrameTime) => {
        startedAt.current = visibleFrameTime;
        setPhase("go");
      });
    }, 1200 + Math.random() * 2800);
  };
  const respond = (inputTime = performance.now()) => {
    if (phase === "ready" || phase === "result") {
      startTry();
      return;
    }
    if (phase === "waiting") {
      clearTimer();
      setPhase("early");
      timeout.current = setTimeout(() => setPhase("ready"), 900);
      return;
    }
    if (phase === "go") {
      const elapsed = Math.max(0, inputTime - startedAt.current);
      setCurrent(elapsed);
      setTimes((previous) => [...previous, elapsed]);
      setPhase(times.length + 1 >= TOTAL_TRIES ? "finished" : "result");
    }
  };

  const respondRef = useRef(respond);
  useEffect(() => { respondRef.current = respond; });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearTimer();
        onClose();
      } else if (event.code === "Space" || event.key === "Enter") {
        event.preventDefault();
        respondRef.current(event.timeStamp);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  useEffect(() => () => {
    if (timeout.current) clearTimeout(timeout.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);


  const average = times.length ? times.reduce((sum, time) => sum + time, 0) / times.length : null;
  const best = times.length ? Math.min(...times) : null;
  const prompt = phase === "waiting" ? "WAIT FOR GREEN"
    : phase === "go" ? "CLICK!"
    : phase === "early" ? "TOO SOON — WAIT FOR GREEN"
    : phase === "finished" ? "TEST COMPLETE"
    : phase === "result" ? (current?.toFixed(1) ?? "—") + " ms — CLICK TO CONTINUE"
    : "CLICK TO START";

  return (
    <section className={styles.reactionPanel} aria-label="Just for fun reaction test">
      <header className={styles.panelHeader}>
        <div><span className={styles.panelEyebrow}>BONUS · JUST FOR FUN</span><strong>Reaction check</strong></div>
        <button type="button" className={styles.closeButton} onClick={() => { clearTimer(); onClose(); }} aria-label="Close reaction test">×</button>
      </header>
      <div className={styles.stats} aria-live="polite">
        <div><span>AVERAGE</span><strong>{average === null ? "—" : `${average.toFixed(1)} ms`}</strong></div>
        <div><span>BEST</span><strong>{best === null ? "—" : `${best.toFixed(1)} ms`}</strong></div>
        <div><span>LAST TRY</span><strong>{current === null ? "—" : `${current.toFixed(1)} ms`}</strong></div>
        <div><span>ROUNDS</span><strong>{times.length} / {TOTAL_TRIES}</strong></div>
      </div>
      <button className={styles.light} data-state={phase} type="button" onPointerDown={(event) => respond(event.timeStamp)} aria-live="polite">
        <span className={styles.lamp} aria-hidden="true" />
        <strong>{prompt}</strong>
        <small>{phase === "waiting" ? "Don't click yet" : phase === "go" ? "Click the light as fast as you can" : times.length + " / " + TOTAL_TRIES + " tries"}</small>
      </button>
      <div className={styles.panelFooter}>
        {phase === "finished" && <button type="button" className={styles.retry} onClick={reset}>Again</button>}
        {phase !== "finished" && <span>Click or press Space when the light turns green.</span>}
      </div>
      <p className={styles.disclaimer}>Just for fun; it says nothing about your skill. Browser and display timing affect the result.</p>
    </section>
  );
}
