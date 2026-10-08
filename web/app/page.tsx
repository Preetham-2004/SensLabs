"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { useAuth } from "./AuthProvider";
import PhaseTransition from "./PhaseTransition";
import styles from "./landing.module.css";

export default function Home() {
  const { user, login } = useAuth();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const startCalibrationTransition = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    window.setTimeout(() => router.push("/calibrate"), 1100);
  };

  const triggerCalibrateTransition = (event: MouseEvent) => {
    event.preventDefault();
    if (!user) {
      setError("");
      setLoginOpen(true);
      return;
    }
    startCalibrationTransition();
  };

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
      startCalibrationTransition();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.site}>
      <motion.div className={styles.progress} style={{ scaleX: progress }} aria-hidden="true" />
      <motion.header className={styles.header} initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
        <Link href="/" className={styles.brand} aria-label="SensLab home">
          <span className={styles.brandLogo} aria-hidden="true">
            <Image className={styles.brandLogoBase} src="/senslab-minimal-logo.png" alt="" width={76} height={76} priority />
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
              <span className={styles.email}>{user.username || user.email.split("@")[0]}</span>
              <Link className={styles.loginButton} href="/account">Account</Link>
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
        <motion.div className={styles.heroContent} initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: .12, ease: "easeOut" }}>
          <p className={styles.kicker}><span /> PERSONAL SENSITIVITY CALIBRATION</p>
          <h1 className={styles.heroTitle}>Find the sensitivity<br />that feels <em className={styles.voltHighlight}>like yours.</em></h1>
          <p className={styles.lede}>Measure your natural mouse movement, get a practical starting sensitivity, then test it in a practice range before taking it into VALORANT or CS2.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href={user ? "/calibrate" : "/login?next=%2Fcalibrate"} onClick={triggerCalibrateTransition}>Find my sensitivity <span aria-hidden="true">&#8599;</span></Link>
            <a className={styles.textLink} href="#method">See how it works <span aria-hidden="true">&#8595;</span></a>
          </div>
          <div className={styles.heroMeta}><span>VALORANT / CS2</span><i aria-hidden="true" /><span>No automatic setting changes</span></div>
        </motion.div>
      </motion.section>

      <motion.section className={styles.method} id="method" initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }} whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: .18 }} transition={{ duration: .55, ease: "easeOut" }}>
        <div className={styles.sectionIntro}>
          <div>
            <p className={styles.kicker}>A CLEAR CALIBRATION PATH</p>
            <h2 className={styles.horizontalHeadline}>
              <span>Measure</span>
              <i className={styles.dotSeparator} aria-hidden="true" />
              <span>Compare</span>
              <i className={styles.dotSeparator} aria-hidden="true" />
              <span>Practice</span>
            </h2>
          </div>

          <p className={styles.sectionLede}>Three deliberate steps turn your natural movement into a setting you can try for yourself.</p>
        </div>
        <ol className={styles.featureList}>
          <li>
            <span className={styles.featureNo}>01</span>
            <div><h3>Set your input</h3><p>Choose your game and enter your mouse DPI. That is all SensLab needs to understand your setup.</p></div>
            <span className={styles.featureTag}>GAME · DPI</span>
          </li>
          <li>
            <span className={styles.featureNo}>02</span>
            <div><h3>Measure your swipe</h3><p>Swipe end to end across your mousepad three times. Your natural, comfortable range becomes the reference for a full turn.</p></div>
            <span className={styles.featureTag}>3 SWIPES</span>
          </li>
          <li>
            <span className={styles.featureNo}>03</span>
            <div><h3>Compare your options</h3><p>Get a recommended starting sensitivity plus a slightly lower and higher option, converted for your game.</p></div>
            <span className={styles.featureTag}>3 OPTIONS</span>
          </li>
          <li>
            <span className={styles.featureNo}>04</span>
            <div><h3>Test your setting</h3><p>Take your starting point into focused flick, tracking and precision drills, then keep the one that feels right.</p></div>
            <span className={styles.featureTag}>3 DRILLS</span>
          </li>
        </ol>
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
        <div className={styles.practiceHead}>
          <div className={styles.practiceCopy}>
            <p className={styles.kicker}>AFTER CALIBRATION</p>
            <h2>Test it.<br /><em>Don’t just trust it.</em></h2>
            <p>Your starting sensitivity is a recommendation. Three focused drills show how it holds up under the situations you actually face in a match.</p>
          </div>
          <Link className={styles.textLink} href="/practice">Explore practice <span aria-hidden="true">↗</span></Link>
        </div>
        <div className={styles.drillGrid}>
          <article className={styles.drillCard}>
            <div className={styles.drillHead}><span><b>01</b> DRILL</span><span className={styles.drillTime}>30 SEC</span></div>
            <h3>Flick</h3>
            <p>Snap onto targets that spawn 5–22° away from your crosshair, the way an enemy appears around a corner.</p>
            <dl className={styles.drillStats}>
              <div><dt>Tracks</dt><dd>Hit rate · time to hit</dd></div>
              <div><dt>Reveals</dt><dd>Overshoot vs. undershoot</dd></div>
            </dl>
          </article>
          <article className={styles.drillCard}>
            <div className={styles.drillHead}><span><b>02</b> DRILL</span><span className={styles.drillTime}>20 SEC</span></div>
            <h3>Tracking</h3>
            <p>Stay on a target that strafes like a real player, with sharp A/D direction changes and the occasional jump.</p>
            <dl className={styles.drillStats}>
              <div><dt>Tracks</dt><dd>Time on target</dd></div>
              <div><dt>Reveals</dt><dd>How smooth your aim stays</dd></div>
            </dl>
          </article>
          <article className={styles.drillCard}>
            <div className={styles.drillHead}><span><b>03</b> DRILL</span><span className={styles.drillTime}>30 SEC</span></div>
            <h3>Precision</h3>
            <p>Tiny head-sized targets that disappear after three seconds. Rewards calm micro-adjustments over raw speed.</p>
            <dl className={styles.drillStats}>
              <div><dt>Tracks</dt><dd>Hit rate · time to hit</dd></div>
              <div><dt>Reveals</dt><dd>Final aim error</dd></div>
            </dl>
          </article>
        </div>
        <div className={styles.practiceTip}>
          <span className={styles.practiceTipLabel}>READING YOUR RESULTS</span>
          <p><b>Flying past targets?</b> Try the lower option.</p>
          <p><b>Falling short or lagging behind?</b> Try the higher option.</p>
        </div>
      </motion.section>

      <motion.section className={styles.principle} initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }} whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: .3 }} transition={{ duration: .55, ease: "easeOut" }}>
        <p className={styles.kicker}>THE SENSLAB PRINCIPLE</p>
        <h2>Your hand makes<br />the final call.</h2>
        <p>SensLab gives you a measured place to start.<br />Practice tells you whether it belongs there.</p>
      </motion.section>

      <motion.section className={styles.bottomCallout} initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }} transition={{ duration: .5, ease: "easeOut" }}>
        <div><p className={styles.kicker}>YOUR MOVEMENT IS THE STARTING POINT</p><h2>Stop copying someone else’s sens.</h2><p>Find a starting point built around your movement.</p></div>
        <Link className={styles.primaryButton} href={user ? "/calibrate" : "/login?next=%2Fcalibrate"} onClick={triggerCalibrateTransition}>Find my sensitivity <span aria-hidden="true">↗</span></Link>
      </motion.section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.brand} aria-label="SensLab home"><span className={styles.brandLogo} aria-hidden="true"><Image className={styles.brandLogoBase} src="/senslab-minimal-logo.png" alt="" width={76} height={76} /></span></Link>
        <span className={styles.footerTagline}>A measured starting point for your sensitivity.<br />Refine it through focused practice.</span>
        <nav className={styles.footerLinks} aria-label="Footer navigation"><Link href={user ? "/calibrate" : "/login?next=%2Fcalibrate"} onClick={triggerCalibrateTransition}>Calibration</Link><Link href="/practice">Practice</Link><Link href="/history">History</Link></nav>
        <span className={styles.footerGames}>VALORANT / CS2</span>
      </footer>

      <AnimatePresence>
      {isTransitioning && <PhaseTransition />}
      {loginOpen && (
        <motion.div className={styles.modalBackdrop} initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: prefersReducedMotion ? 0 : .18 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setLoginOpen(false); }}>
          <motion.section className={styles.loginModal} role="dialog" aria-modal="true" aria-labelledby="login-title" initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .99 }} transition={{ duration: prefersReducedMotion ? 0 : .22, ease: "easeOut" }}>
            <button className={styles.closeButton} type="button" aria-label="Close login" onClick={() => setLoginOpen(false)}>×</button>
            <p className={styles.kicker}>YOUR SENSLAB ACCOUNT</p>
            <h2 id="login-title">Welcome back.</h2>
            <p className={styles.modalText}>Log in to pick up where your calibration and practice history left off.</p>
            <form onSubmit={submitLogin}>
              <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label>Password<span className={styles.passwordField}><input type={showLoginPassword ? "text" : "password"} autoComplete="current-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className={styles.passwordToggle} onClick={() => setShowLoginPassword((visible) => !visible)} aria-label={showLoginPassword ? "Hide password" : "Show password"} aria-pressed={showLoginPassword}>{showLoginPassword ? "Hide" : "Show"}</button></span></label>
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
