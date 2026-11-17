/**
 * NavBar — simplified SaaS nav.
 * 5 main pages: Landing, Leaders, The Books, MY BOO, Better-Verse.
 * Everything else lives in the Footer.
 */
import { Link, useLocation } from "react-router-dom";
import type { BooUser } from "../auth";

const MAIN_TABS = [
  { id: "home",   label: "LANDING",   href: "/home/index.html" },
  { id: "leaders", label: "LEADERS",  href: "/leaders?cat=targets" },
  { id: "books",   label: "BOOKS",    href: "/books" },
  { id: "myboo",   label: "MY BOO",   href: "/myboo" },
  { id: "betterverse", label: "BETTER-VERSE", href: "/betterverse" },
] as const;

type NavBarProps = { activeTab?: string; currentUser?: BooUser | null; onLogout?: () => void };

function makePill(isActive: boolean, isBoo: boolean) {
  const borderColor = isActive
    ? (isBoo ? "#a78bfa" : "#c9a54e")
    : (isBoo ? "#3a2060" : "var(--bp-border)");
  const background = isActive
    ? (isBoo ? "rgba(139,92,246,0.18)" : "rgba(201,165,78,0.14)")
    : (isBoo ? "rgba(139,92,246,0.06)" : "var(--bp-card-bg)");
  const color = isActive
    ? (isBoo ? "#c4b5fd" : "#f1dc92")
    : (isBoo ? "#9d72ff" : "var(--bp-fg)");
  return {
    display: "inline-flex", alignItems: "center",
    height: 32, padding: "0 14px", borderRadius: 999,
    border: `1px solid ${borderColor}`,
    background,
    color,
    fontSize: 12, fontWeight: 700, letterSpacing: "0.1em",
    textDecoration: "none", cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
  };
}

export default function NavBar({ activeTab, currentUser, onLogout }: NavBarProps) {
  const location = useLocation();
  const p = location.pathname;
  const currentTab = activeTab ?? (p.startsWith("/leaders") || p.startsWith("/player") ? "leaders"
    : p.startsWith("/nba") ? "nba"
    : p.startsWith("/matchup-of-the-day") ? "motd"
    : p.startsWith("/nba-insights") ? "insights"
    : p.startsWith("/h2h") ? "h2h"
    : p === "/parlay" || p === "/parlays" ? "parlay"
    : p === "/books" ? "books"
    : p.startsWith("/myboo") ? "myboo"
    : p.startsWith("/betterverse") ? "betterverse"
    : p.startsWith("/moneyball") ? "moneyball"
    : p === "/signup" ? "signup"
    : p === "/login" ? "login"
    : "home");

  const authPills = currentUser ? (
    <>
      <Link to="/myboo" style={makePill(currentTab === "myboo", true)}>MY BOO</Link>
      <button onClick={onLogout} style={{ ...makePill(false, false), background: "transparent", borderColor: "var(--bp-border)", color: "var(--bp-muted)" }}>
        SIGN OUT
      </button>
      <span style={{ fontSize: 10, color: "var(--bp-muted)", fontWeight: 700, letterSpacing: "0.1em" }}>{currentUser.username}</span>
    </>
  ) : (
    <>
      <Link to="/signup" style={makePill(currentTab === "signup", false)}>SIGN UP</Link>
      <Link to="/login" style={makePill(currentTab === "login", false)}>LOG IN</Link>
    </>
  );

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 0,
      padding: "10px 20px 12px", flex: "0 0 auto", borderBottom: "1px solid var(--bp-border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/home/index.html" style={{ ...makePill(currentTab === "home", false), fontWeight: 800, fontSize: 13 }}>HOME</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {authPills}
        </div>
      </div>

      {/* 5 main tabs only */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {MAIN_TABS.map(({ id, label, href }) => (
          <Link key={id} to={href} style={makePill(currentTab === id, id === "myboo")}>{label}</Link>
        ))}
      </div>
    </div>
  );
}
