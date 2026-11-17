/**
 * Auth state for Big Proppa SaaS shape.
 * Account-only (no charge). Session kept in localStorage.
 */
import { api } from "./api";

export interface BooUser {
  id: string;
  email: string;
  username: string;
  role: "member" | "admin";
}

const STORAGE_KEY = "bp_user";

export function getStoredUser(): BooUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BooUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: BooUser | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* */ }
}

export async function signup(email: string, username: string, password: string): Promise<BooUser | null> {
  const r = await api.accountSignup({ email, username, password });
  if (r.ok && r.user) {
    const u: BooUser = r.user;
    setStoredUser(u);
    return u;
  }
  return null;
}

export async function login(email: string, password: string): Promise<BooUser | null> {
  const r = await api.accountLogin({ email, password });
  if (r.ok && r.user) {
    const u: BooUser = r.user;
    setStoredUser(u);
    return u;
  }
  return null;
}

export async function logout() {
  setStoredUser(null);
}

export async function me(email?: string): Promise<boolean> {
  try {
    const r = await api.accountMe(email);
    if (r.authenticated && r.user) {
      setStoredUser(r.user);
      return true;
    }
    setStoredUser(null);
    return false;
  } catch {
    setStoredUser(null);
    return false;
  }
}
