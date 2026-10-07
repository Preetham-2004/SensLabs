"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import styles from "./account-ui.module.css";

export default function AccountForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { login, signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (isSignup) {
        const signedIn = await signup(email, password);
        if (!signedIn) {
          setNotice("Account created. Check your email for a confirmation link, then log in.");
          return;
        }
      } else await login(email, password);
      router.push("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally { setBusy(false); }
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.top}><Link href="/">← SensLab</Link><Link href="/history">History</Link></div>
        <section className={styles.card}>
          <p className="eyebrow">SensLab account</p>
          <h1>{isSignup ? "Save your progress" : "Welcome back"}</h1>
          <p>{isSignup ? "Keep your calibration, settings, and practice rounds together." : "Sign in to continue with your saved calibration and history."}</p>
          <form onSubmit={submit}>
            <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Password<input type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}
            <button type="submit" disabled={busy}>{busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}</button>
          </form>
          <p className={styles.subtle}>{isSignup ? "Already have an account?" : "New to SensLab?"} <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create an account"}</Link></p>
          <p className={styles.subtle}>Password must be at least 8 characters.</p>
        </section>
      </div>
    </main>
  );
}
