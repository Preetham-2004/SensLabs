"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth, type GamePreference } from "../AuthProvider";
import styles from "../account-ui.module.css";

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, updateAccount, deleteAccount, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [preferredGame, setPreferredGame] = useState<GamePreference>("valorant");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username ?? "");
    setPreferredGame(user.preferred_game ?? "valorant");
  }, [user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await updateAccount(username.trim(), preferredGame);
      setNotice("Account preferences updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update your account.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    setError("");
    try {
      await deleteAccount();
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete your account.");
      setDeleteBusy(false);
      setDeleteConfirmOpen(false);
    }
  }

  if (loading || !user) return <main className={`${styles.page} ${styles.accountSettingsPage}`} aria-busy="true" />;

  return (
    <main className={`${styles.page} ${styles.accountSettingsPage}`}>
      <div className={styles.wrap}>
        <div className={styles.top}>
          <Link href="/" className={styles.backButton}>Back</Link>
          <button className={styles.signOutButton} type="button" onClick={logout}>Sign out</button>
        </div>
        <section className={`${styles.card} ${styles.accountCard}`}>
          <p className="eyebrow">Your SensLab account</p>
          <h1>Account settings</h1>
          <p>These are the details connected to your SensLab account.</p>
          <dl className={styles.accountDetails}>
            <div><dt>Username</dt><dd>{user.username || "Not set"}</dd></div>
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Preferred game</dt><dd>{user.preferred_game?.toUpperCase() ?? "Not set"}</dd></div>
          </dl>
          <form onSubmit={submit}>
            <label>Username<input type="text" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required value={username} onChange={(event) => setUsername(event.target.value)} aria-describedby="username-help" /></label>
            <small id="username-help" className={styles.fieldHelp}>3–24 characters; letters, numbers, and underscores.</small>
            <label>Preferred game<select value={preferredGame} onChange={(event) => setPreferredGame(event.target.value as GamePreference)}><option value="valorant">VALORANT</option><option value="cs2">CS2</option></select></label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}
            <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
          </form>
          <section className={styles.dangerZone} aria-labelledby="delete-account-title">
            <h2 id="delete-account-title">Delete account</h2>
            <p>Delete your sign-in and permanently remove your profile, calibration history, and practice rounds.</p>
            {!deleteConfirmOpen ? (
              <button className={styles.deleteButton} type="button" onClick={() => setDeleteConfirmOpen(true)}>Delete account</button>
            ) : (
              <div className={styles.deleteConfirm} role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-description">
                <h3 id="delete-confirm-title">Are you sure?</h3>
                <p id="delete-confirm-description">This permanently deletes your account and saved data. This cannot be undone.</p>
                <div>
                  <button type="button" onClick={() => setDeleteConfirmOpen(false)} disabled={deleteBusy}>No, keep my account</button>
                  <button className={styles.deleteButton} type="button" onClick={confirmDelete} disabled={deleteBusy}>{deleteBusy ? "Deleting..." : "Yes, delete my account"}</button>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
