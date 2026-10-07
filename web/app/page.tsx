"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { animate as animeAnimate } from "animejs";
import { useAuth } from "./AuthProvider";
import styles from "./landing.module.css";

export default function Home() {
  const { user, login } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const practiceArtRef = useRef<HTMLDivElement>(null);
  const heroVisualRef = useRef<HTMLDivElement>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!practiceArtRef.current || prefersReducedMotion) return;

    const ranges = [practiceArtRef.current].filter((range): range is HTMLDivElement => Boolean(range));
    const animations = ranges.flatMap((range) => {
      const target = range.querySelector<HTMLElement>(`.${styles.target}`);
      const smallTarget = range.querySelector<HTMLElement>(`.${styles.targetSmall}`);
      const floor = range.querySelector<HTMLElement>(`.${styles.floorGrid}`);
      if (!target || !floor) return [];
      return [
        animeAnimate(target, { scale: [1, 1.08, 1], duration: 3200, ease: "inOutSine", loop: true }),
        ...(smallTarget ? [animeAnimate(smallTarget, { x: [0, 9, 0], duration: 5000, ease: "inOutSine", loop: true })] : []),
        animeAnimate(floor, { backgroundPosition: ["0px 0px", "0px 16px"], duration: 9000, ease: "linear", loop: true }),
      ];
    });
    return () => animations.forEach((animation) => animation.revert());
  }, [prefersReducedMotion]);

  useEffect(() => {
    const visual = heroVisualRef.current;
    if (!visual || prefersReducedMotion) return;
    const marker = visual.querySelector<HTMLElement>(`.${styles.heroMarker}`);
    const sweep = visual.querySelector<HTMLElement>(`.${styles.heroSweep}`);
    const target = visual.querySelector<HTMLElement>(`.${styles.heroTarget}`);
    if (!marker || !sweep || !target) return;
    const trackWidth = marker.parentElement?.clientWidth ?? 0;
    const markerTravel = Math.max(0, trackWidth - marker.offsetWidth);

    const animations = [
      animeAnimate(marker, { x: [0, markerTravel], duration: 4600, ease: "inOutSine", loop: true, alternate: true }),
      animeAnimate(sweep, { scaleX: [0.08, 1], duration: 2300, ease: "inOutSine", loop: true, alternate: true }),
      animeAnimate(target, { scale: [1, 1.08, 1], opacity: [0.72, 1, 0.72], duration: 2400, ease: "inOutSine", loop: true }),
    ];
    return () => animations.forEach((animation) => animation.revert());
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!loginOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLoginOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [loginOpen]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      setLoginOpen(false);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.site}>
      <motion.header className={styles.header} initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
        <Link href="/" className={styles.brand} aria-label="SensLab home">
          <span className={styles.brandLogo} aria-hidden="true">
            <Image className={styles.brandLogoBase} src="/senslab-wordmark.png" alt="" width={58} height={44} priority />
            <Image className={styles.brandLogoTop} src="/senslab-wordmark.png" alt="" width={58} height={44} priority />
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          <a href="#method">How it works</a>
          <a href="#features">Features</a>
          <Link href="/history">History</Link>
        </nav>
        <div className={styles.accountActions}>
          {user ? (
            <>
              <span className={styles.email}>{user.email}</span>
              <Link className={styles.loginButton} href="/history">My history</Link>
            </>
          ) : (
            <>
              <button className={styles.loginButton} type="button" onClick={() => { setError(""); setLoginOpen(true); }}>Log in</button>
              <Link className={styles.signupButton} href="/signup">Create account</Link>
            </>
          )}
        </div>
      </motion.header>

      <motion.section className={styles.hero}>
        <motion.div className={styles.heroCopy} initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .65, delay: .12, ease: "easeOut" }}>
          <p className={styles.kicker}><span /> PERSONAL SENSITIVITY CALIBRATION</p>
          <motion.h1 initial={prefersReducedMotion ? false : { y: 34, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .75, delay: .2, ease: [.2, .75, .2, 1] }}>Find the sens<br />that feels <em>yours.</em></motion.h1>
          <p className={styles.lede}>Measure your natural mouse movement, get a practical starting sensitivity, then test it in a practice range before taking it into VALORANT or CS2.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/calibrate">Find my sensitivity <span aria-hidden="true">↗</span></Link>
            <a className={styles.textLink} href="#method">See how it works <span aria-hidden="true">↓</span></a>
          </div>
          <div className={styles.trustLine}><span>VALORANT / CS2</span><i /><span>No automatic setting changes</span></div>
        </motion.div>
        <motion.div ref={heroVisualRef} className={styles.heroMeasure} aria-label="Animated illustration of mouse movement measurement" role="img" initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .75, delay: .35, ease: "easeOut" }}>
          <div className={styles.heroMeasureHead}><span><b>01</b> MOVEMENT MEASUREMENT</span><span>ONE COMFORTABLE SWIPE</span></div>
          <div className={styles.heroMeasureTrack}>
            <span className={styles.heroEndLabel}>PAD EDGE</span>
            <i className={styles.heroTick} />
            <i className={`${styles.heroTick} ${styles.heroTickMiddle}`} />
            <i className={`${styles.heroTick} ${styles.heroTickEnd}`} />
            <span className={styles.heroSweep} />
            <span className={styles.heroMarker}><i /></span>
            <span className={`${styles.heroEndLabel} ${styles.heroEndRight}`}>PAD EDGE</span>
            <span className={styles.heroTarget}><i /></span>
          </div>
          <div className={styles.heroMeasureFoot}><span>START WHERE YOUR HAND RESTS</span><span>MEASURE THE FULL PAD</span><span>180° TURN REFERENCE</span></div>
        </motion.div>
        <a className={styles.heroScroll} href="#method"><span>SCROLL TO EXPLORE</span><i /></a>
      </motion.section>

      <motion.section className={styles.method} id="method" initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }} whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: .18 }} transition={{ duration: .55, ease: "easeOut" }}>
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>A CLEAR CALIBRATION PATH</p>
          <h2>Measure.<br />Compare.<br />Practice.</h2>
          <p>Three deliberate steps turn your natural movement into a setting you can try for yourself.</p>
        </div>
        <div className={styles.journey}>
          <article className={styles.step}>
            <div className={styles.stepHeading}><span className={styles.stepNo}>01</span><span>SET YOUR INPUT</span></div>
            <div className={styles.miniControls}><span>GAME <b>VALORANT⌄</b></span><span>MOUSE DPI <b>1700</b></span></div>
            <p>Choose your game and enter your mouse DPI.</p>
          </article>
          <span className={styles.journeyLink} aria-hidden="true"><i /></span>
          <article className={styles.step}>
            <div className={styles.stepHeading}><span className={styles.stepNo}>02</span><span>MEASURE YOUR SWIPE</span></div>
            <div className={styles.swipeViz} aria-hidden="true"><i /><span /><i /></div>
            <p>Swipe end to end across your mousepad three times.</p>
          </article>
          <span className={styles.journeyLink} aria-hidden="true"><i /></span>
          <article className={styles.step}>
            <div className={styles.stepHeading}><span className={styles.stepNo}>03</span><span>TEST YOUR SETTING</span></div>
            <div className={styles.miniRange} aria-hidden="true"><i /><b /></div>
            <p>Take your starting point into focused practice drills.</p>
          </article>
        </div>
        <div className={styles.processRail}><span>INPUT</span><i /><span>MOVEMENT</span><i /><span>PRACTICE</span><i /><span>REFINE</span></div>
      </motion.section>

      <motion.section className={styles.resultSection} id="features" initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }} whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: .18 }} transition={{ duration: .55, ease: "easeOut" }}>
        <div className={styles.resultIntro}>
          <p className={styles.kicker}>THE RESULT</p>
          <h2>Not a magic number.<br /><em>A better starting point.</em></h2>
          <p>SensLab gives you nearby options based on your movement. No single sensitivity is perfect for everyone; try the range and decide what feels right.</p>
        </div>
        <div className={styles.sensScale}>
          <div className={styles.scaleEnds}><span>MORE CONTROL</span><span>FASTER TURNS</span></div>
          <div className={styles.scaleTrack}>
            <button type="button" className={styles.scaleOption}><span>LOWER</span><strong>0.138</strong></button>
            <button type="button" className={`${styles.scaleOption} ${styles.scaleRecommended}`}><span>RECOMMENDED</span><strong>0.157</strong><small>YOUR START</small></button>
            <button type="button" className={styles.scaleOption}><span>HIGHER</span><strong>0.176</strong></button>
          </div>
          <div className={styles.scaleLine}><i /><i /><i /></div>
          <p>Three close options. One informed choice.</p>
        </div>
      </motion.section>

      <motion.section className={styles.practiceSection} id="practice" initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }} whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: .18 }} transition={{ duration: .55, ease: "easeOut" }}>
        <div className={styles.practiceCopy}>
          <p className={styles.kicker}>AFTER CALIBRATION</p>
          <h2>Test it.<br /><em>Don’t just trust it.</em></h2>
          <p>Your starting sensitivity is a recommendation. Take it into focused drills and decide what actually feels right.</p>
          <div className={styles.drillList}><span><b>01</b> Flick</span><span><b>02</b> Tracking</span><span><b>03</b> Precision</span></div>
          <Link className={styles.textLink} href="/practice">Explore practice <span aria-hidden="true">↗</span></Link>
        </div>
        <motion.div ref={practiceArtRef} className={`${styles.heroArt} ${styles.practiceArt}`} aria-label="Illustrated SensLab aim practice range" role="img">
          <div className={styles.artCaption}><span>AIM PRACTICE</span><span>READY / 02</span></div>
          <div className={styles.rangeRoom}>
            <div className={styles.backWall}><div className={styles.wallPanel} /><div className={styles.target}><span /></div><div className={styles.targetSmall} /></div>
            <div className={styles.floorGrid} />
            <div className={styles.aimPoint}><b /><b /></div>
            <span className={styles.roomLabel}>FLICK <i /> TRACK <i /> RESET</span>
          </div>
          <div className={styles.artFoot}><span>FOCUSED DRILLS</span><span>YOUR SENSITIVITY</span></div>
        </motion.div>
      </motion.section>

      <motion.section className={styles.principle} initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }} whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: .3 }} transition={{ duration: .55, ease: "easeOut" }}>
        <p className={styles.kicker}>THE SENSLAB PRINCIPLE</p>
        <h2>Your hand makes<br />the final call.</h2>
        <p>SensLab gives you a measured place to start.<br />Practice tells you whether it belongs there.</p>
      </motion.section>

      <motion.section className={styles.bottomCallout} initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }} transition={{ duration: .5, ease: "easeOut" }}>
        <div><p className={styles.kicker}>YOUR MOVEMENT IS THE STARTING POINT</p><h2>Stop copying someone else’s sens.</h2><p>Find a starting point built around your movement.</p></div>
        <Link className={styles.primaryButton} href="/calibrate">Find my sensitivity <span aria-hidden="true">↗</span></Link>
      </motion.section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.brand} aria-label="SensLab home"><span className={styles.brandLogo} aria-hidden="true"><Image className={styles.brandLogoBase} src="/senslab-wordmark.png" alt="" width={58} height={44} /><Image className={styles.brandLogoTop} src="/senslab-wordmark.png" alt="" width={58} height={44} /></span></Link>
        <span className={styles.footerTagline}>Find your starting point.<br />Make the final call yourself.</span>
        <nav className={styles.footerLinks} aria-label="Footer navigation"><Link href="/calibrate">Calibration</Link><Link href="/practice">Practice</Link><Link href="/history">History</Link></nav>
        <span className={styles.footerGames}>VALORANT / CS2</span>
      </footer>

      <AnimatePresence>
      {loginOpen && (
        <motion.div className={styles.modalBackdrop} initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: prefersReducedMotion ? 0 : .18 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setLoginOpen(false); }}>
          <motion.section className={styles.loginModal} role="dialog" aria-modal="true" aria-labelledby="login-title" initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .99 }} transition={{ duration: prefersReducedMotion ? 0 : .22, ease: "easeOut" }}>
            <button className={styles.closeButton} type="button" aria-label="Close login" onClick={() => setLoginOpen(false)}>×</button>
            <p className={styles.kicker}>YOUR SENSLAB ACCOUNT</p>
            <h2 id="login-title">Welcome back.</h2>
            <p className={styles.modalText}>Log in to pick up where your calibration and practice history left off.</p>
            <form onSubmit={submitLogin}>
              <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label>Password<input type="password" autoComplete="current-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              {error && <p className={styles.formError} role="alert">{error}</p>}
              <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Signing in…" : "Log in"}</button>
            </form>
            <p className={styles.signupPrompt}>New to SensLab? <Link href="/signup">Create an account</Link></p>
          </motion.section>
        </motion.div>
      )}
      </AnimatePresence>
    </main>
  );
}
