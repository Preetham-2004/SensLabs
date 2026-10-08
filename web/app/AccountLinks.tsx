"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import styles from "./account.module.css";

export default function AccountLinks() {
  const { user, loading, logout } = useAuth();
  if (loading) return null;
  return (
    <nav className={styles.accountLinks} aria-label="Account">
      {user ? <>
        <span>{user.username || user.email.split("@")[0]}</span>
        <Link href="/account">Account</Link>
        <Link href="/history">My history</Link>
        <button type="button" onClick={logout}>Sign out</button>
      </> : <>
        <Link href="/login">Log in</Link>
        <Link className={styles.signUpLink} href="/signup">Sign up</Link>
        <Link href="/history">History</Link>
      </>}
    </nav>
  );
}
