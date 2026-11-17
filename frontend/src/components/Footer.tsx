/**
 * Footer — secondary links and brand. Keeps the nav bar clean (5 main pages only).
 */
import { Link } from "react-router-dom";

const FOOTER_LINKS = [
  { id: "nba", label: "NBA", href: "/nba?cat=points" },
  { id: "motd", label: "MOTD", href: "/matchup-of-the-day" },
  { id: "insights", label: "INSIGHTS", href: "/nba-insights" },
  { id: "h2h", label: "H2H", href: "/h2h?cat=targets" },
  { id: "parlay", label: "PARLAY", href: "/parlay" },
  { id: "college", label: "COLLEGE", href: "/college" },
  { id: "engine", label: "ENGINE", href: "/engine" },
  { id: "news", label: "NEWS", href: "/news" },
  { id: "queries", label: "QUERIES", href: "/queries" },
  { id: "odds", label: "ODDS", href: "/odds" },
] as const;

export default function Footer() {
  return (
    <footer
      style={{
        width: "100%",
        borderTop: "1px solid var(--bp-border)",
        marginTop: "auto",
        padding: "24px 20px 32px",
        background: "var(--bp-page-bg)",
        color: "var(--bp-fg)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg,#d9b45a,#8a6224)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#0b0512", fontSize: 11 }}>BP</div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", background: "var(--bp-wordmark-gradient)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>HEY BIG PROPPA!</div>
          </div>
          <div style={{ fontSize: 11, color: "var(--bp-muted)", fontWeight: 700, letterSpacing: "0.1em" }}>
            SFS Doubloon · Reform School · Indiana Jones Engine
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {FOOTER_LINKS.map(({ id, label, href }) => (
            <Link key={id} to={href} style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
              color: "var(--bp-muted)", textDecoration: "none",
            }}>{label}</Link>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 9, color: "var(--bp-muted)", letterSpacing: "0.1em" }}>
          Big Proppa — predictive sports analytics. Not financial advice. Bet responsibly.
        </div>
      </div>
    </footer>
  );
}
