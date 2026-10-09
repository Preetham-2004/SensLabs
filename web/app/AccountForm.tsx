"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import PhaseTransition from "./PhaseTransition";
import styles from "./account-ui.module.css";

type GamePreference = "valorant" | "cs2";

export default function AccountForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { login, signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [preferredGame, setPreferredGame] = useState<GamePreference>("valorant");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [signupSent, setSignupSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isSignup = mode === "signup";

  function goToPhaseOneWithTransition() {
    setIsTransitioning(true);
    window.setTimeout(() => router.replace("/calibrate"), 1100);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (isSignup) {
        const requiresEmailConfirmation = await signup(email, password, username, preferredGame);
        if (requiresEmailConfirmation) {
          setSignupSent(true);
          return;
        }
        goToPhaseOneWithTransition();
        return;
      }
      await login(email, password);
      goToPhaseOneWithTransition();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally { setBusy(false); }
  }

  return (
    <main className={styles.page}>
      {isTransitioning && <PhaseTransition />}
      <div className={styles.wrap}>
        <div className={styles.top}><Link href="/" className={styles.backButton}>Back</Link></div>
        <section className={styles.card}>
          <p className="eyebrow">SensLab account</p>
          <h1>{isSignup ? "Save your progress" : "Welcome back"}</h1>
          <p>{isSignup ? "Keep your calibration, settings, and practice rounds together." : "Sign in to continue with your saved calibration and history."}</p>
          {signupSent ? <div role="status">
            <p>Your account has been created. Check your inbox for a confirmation link, then return here to log in.</p>
            <Link href="/login">Go to login</Link>
          </div> : <form onSubmit={submit}>
            {isSignup && <>
              <label>Username<input type="text" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required value={username} onChange={(event) => setUsername(event.target.value)} aria-describedby="username-help" /></label>
              <small id="username-help" className={styles.fieldHelp}>3–24 characters; letters, numbers, and underscores.</small>
              <label>Preferred game<select value={preferredGame} onChange={(event) => setPreferredGame(event.target.value as GamePreference)}><option value="valorant">VALORANT</option><option value="cs2">CS2</option></select></label>
            </>}
            <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Password<span className={styles.passwordField}><input type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? 12 : 8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className={styles.passwordToggle} onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button></span></label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}</button>
          </form>}
          <p className={styles.subtle}>{isSignup ? "Already have an account?" : "New to SensLab?"} <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create an account"}</Link></p>
          <p className={styles.subtle}>Passwords must be at least {isSignup ? "12" : "8"} characters.</p>
        </section>
      </div>
    </main>
  );
}
