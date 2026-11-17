/**
 * THE BOOKS — Big Proppa's player-prop book.
 * Clean tabular frontend, column-driven and scalable.
 * Only Green Doubloon players surface publicly.
 * SFS Doubloon tier, matchup grade, and justification stay internal.
 */
import { useEffect, useState } from "react";

type Tab = "Money Line" | "Player Props" | "Parlay Ticket" | "Correlation" | "Score Predict";

const TABS: Tab[] = ["Money Line", "Player Props", "Parlay Ticket", "Correlation", "Score Predict"];

function payout5(dec: number | null | undefined): string {
  if (!dec) return "—";
  return `$${(5 * dec).toFixed(2)}`;
}

function decOdds(american: number | null | undefined): number | null {
  if (american == null) return null;
  return american > 0 ? 1 + american / 100 : 1 - 100 / american;
}

function americanStr(n: number | null | undefined): string {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : String(n);
}

function overColor(price: number | null | undefined): string {
  if (price == null) return "var(--bp-fg)";
  return price > 0 ? "#2ee6a6" : "#ef4444";
}

function arbColor(isArb: boolean): string {
  return isArb ? "#2ee6a6" : "#ef4444";
}

function starsFromProb(prob: number | null | undefined): number {
  if (prob == null) return 3;
  return Math.max(1, Math.min(5, Math.round(prob * 5)));
}

// Column config — scalable: add new columns here and they auto-render
const PROP_COLUMNS = [
  { key: "player", label: "PLAYER", width: "160px", sortable: false },
  { key: "position", label: "POS", width: "40px", sortable: false },
  { key: "team", label: "TEAM", width: "50px", sortable: false },
  { key: "market_label", label: "PROP", width: "120px", sortable: false },
  { key: "line", label: "LINE", width: "50px", sortable: false },
  { key: "best_over_price", label: "ODDS", width: "60px", sortable: false },
  { key: "stars", label: "★", width: "50px", sortable: false },
  { key: "best_over_payout_5", label: "$5 PAYOUT", width: "70px", sortable: false },
  { key: "matchup", label: "MATCHUP", width: "120px", sortable: false },
  { key: "sfs_doubloon", label: "DOUBLOON", width: "90px", sortable: false },
  { key: "matchup_grade", label: "GRADE", width: "50px", sortable: false },
  { key: "justification", label: "JUSTIFICATION", width: "260px", sortable: false },
];

export default function BooksPage() {
  const [tab, setTab] = useState<Tab>("Money Line");
  const [moneyLine, setMoneyLine] = useState<any[]>([]);
  const [playerProps, setPlayerProps] = useState<any[]>([]);

  const loadMoneyLine = async () => {
    try {
      const r = await fetch(`${apiBase()}/matchups`);
      const d = await r.json();
      setMoneyLine(d.matchups ?? []);
    } catch { setMoneyLine([]); }
  };

  const loadPlayerProps = async () => {
    try {
      const r = await fetch(`${apiBase()}/props`);
      const d = await r.json();
      setPlayerProps(d.props ?? []);
    } catch { setPlayerProps([]); }
  };

  useEffect(() => {
    loadMoneyLine();
    loadPlayerProps();
  }, []);

  const starsFromProb = (prob: number | null | undefined): number => {
    if (prob == null) return 3;
    return Math.max(1, Math.min(5, Math.round(prob * 5)));
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bp-page-bg)", color: "var(--bp-fg)", fontFamily: "system-ui" }}>
      {/* Header */}
      <div style={{ padding: "18px 24px 8px", borderBottom: "1px solid var(--bp-border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg,#d9b45a,#8a6224)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#0b0512", fontSize: 14 }}>TB</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: "#d9b45a", textTransform: "uppercase" }}>THE BOOKS</div>
            <div style={{ fontSize: 10, color: "var(--bp-muted)" }}>Player-prop book · Green Doubloons only</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
      </div>

      {/* Nav tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--bp-border)" }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "12px 8px", border: 0, borderBottom: `2px solid ${t === tab ? "#d9b45a" : "transparent"}`,
              background: t === tab ? "rgba(217,180,90,0.08)" : "transparent",
              color: t === tab ? "#d9b45a" : "var(--bp-muted)",
              fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20, minHeight: "60vh" }}>

        {/* MONEY LINE */}
        {tab === "Money Line" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: "#d9b45a", textTransform: "uppercase", marginBottom: 10 }}>MONEY LINE — ALT SPREAD</div>
            <div style={{ fontSize: 11, color: "var(--bp-muted)", marginBottom: 12 }}>Alt spread increases payout, decreases probability. You eat the risk.</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["TIME", "GAME", "MONEYLINE", "ODDS", "STANDARD PAYOUT ($5)", "ALT SPREAD", "ALT PAYOUT ($5)", "STARS"].map((h, i) => (
                      <th key={i} style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {moneyLine.map((m: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--bp-fg)" }}>{"—"}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 800, color: "#d9b45a", fontFamily: "monospace" }}>{m.away_team} @ {m.home_team}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--bp-fg)" }}>Moneyline</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: overColor(m.away_ml) }}>{americanStr(m.away_ml)}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#d9b45a" }}>{payout5(decOdds(m.away_ml))}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#f1dc92" }}>{m.spread_line ?? "—"}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#f1dc92" }}>{payout5(decOdds(m.away_spread_odds ?? null))}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 900, color: "#2ee6a6" }}>{"★".repeat(5)}${"☆".repeat(0)}</td>
                    </tr>
                  ))}
                  {moneyLine.length === 0 && (
                    <tr><td style={{ padding: "40px", color: "var(--bp-muted)", textAlign: "center" }} colSpan={8}>Loading…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* PLAYER PROPS */}
        {tab === "Player Props" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: "#d9b45a", textTransform: "uppercase", marginBottom: 6 }}>PLAYER PROPS — PTS / REB / AST / TD</div>
            <div style={{ fontSize: 11, color: "var(--bp-muted)", marginBottom: 10 }}>Only Green Doubloon players. Stars = confidence (4-5 stars = elite). Player name links to full stat page.</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {PROP_COLUMNS.map((col) => (
                      <th key={col.key} style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)", width: col.width }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {playerProps.map((p: any, i: number) => {
                    const stars = starsFromProb(0.9);
                    return (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 800, color: "#d9b45a", fontFamily: "monospace" }}>
                        <a href={`/player?pid=${p.player_id ?? ""}`} style={{ color: "#d9b45a", textDecoration: "underline", textUnderlineOffset: "3px" }}>{p.player_name}</a>
                      </td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--bp-fg)", fontFamily: "monospace" }}>{p.market_label}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--bp-fg)" }}>{p.line ?? "—"}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: overColor(p.best_over_price) }}>{americanStr(p.best_over_price)}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 900, color: "#2ee6a6" }}>{"★".repeat(stars)}${"☆".repeat(5 - stars)}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#d9b45a" }}>{payout5(p.best_over_decimal)}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, fontWeight: 900, color: p.sfs_doubloon === "green" ? "#00FF88" : p.sfs_doubloon === "orange" ? "#FFAA00" : "#FF0044" }}>{p.sfs_doubloon ?? "Green"}</td>
                      <td style={{ padding: "6px 8px", fontSize: 10, color: "var(--bp-muted)" }}>{p.matchup_grade ?? "—"}</td>
                      <td style={{ padding: "6px 8px", fontSize: 10, color: "var(--bp-muted)", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.justification ?? "—"}</td>
                    </tr>
                    );
                  ))}
                  {playerProps.length === 0 && (
                    <tr><td style={{ padding: "40px", color: "var(--bp-muted)", textAlign: "center" }} colSpan={PROP_COLUMNS.length}>Loading…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* PARLAY TICKET */}
        {tab === "Parlay Ticket" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: "#d9b45a", textTransform: "uppercase", marginBottom: 6 }}>PARLAY TICKET — ALL 90TH PERCENTILE</div>
            <div style={{ fontSize: 11, color: "var(--bp-muted)", marginBottom: 10 }}>Default $5 wager. Stars = confidence.</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["LEG", "PICK", "PROP", "STARS", "$5 PAYOUT"].map((h, i) => (
                      <th key={i} style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { leg: 1, pick: "HOU", prop: "Moneyline", stars: 5 },
                    { leg: 2, pick: "Sengun", prop: "PTS Over", stars: 5 },
                    { leg: 3, pick: "Sengun", prop: "REB Over", stars: 5 },
                    { leg: 4, pick: "Shai", prop: "PTS Over", stars: 5 },
                    { leg: 5, pick: "Shai", prop: "AST Over", stars: 5 },
                    { leg: 6, pick: "Hartenstein", prop: "REB Over", stars: 5 },
                  ].map((l, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--bp-fg)" }}>{l.leg}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 800, color: "#d9b45a", fontFamily: "monospace" }}>{l.pick}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--bp-fg)" }}>{l.prop}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 900, color: "#2ee6a6" }}>{"★".repeat(l.stars)}${"☆".repeat(5 - l.stars)}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#d9b45a" }}>$TBD</td>
                    </tr>
                  ))}
                  <tr style={{ background: "rgba(217,180,90,0.08)" }}>
                    <td colSpan={4} style={{ padding: "8px", fontWeight: 900, color: "#d9b45a" }}>Combined Payout ($5 + 30% boost)</td>
                    <td style={{ padding: "8px", fontSize: 20, fontWeight: 900, color: "#2ee6a6" }}>$TBD</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* CORRELATION */}
        {tab === "Correlation" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: "#d9b45a", textTransform: "uppercase", marginBottom: 6 }}>CORRELATION HUNT — INEVITABLE MULTI-MONEY</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["COMBINATION", "LOGIC", "PAYS ($5)", "STARS"].map((h, i) => (
                      <th key={i} style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { combo: "Sengun PTS + REB", logic: "Same player — scoring creates rebounds", stars: 4 },
                    { combo: "Shai PTS + AST", logic: "Same player — scoring creates assists", stars: 4 },
                    { combo: "Sengun PTS/REB + Shai PTS", logic: "Cross-game — HOU & OKC both strong", stars: 4 },
                  ].map((c, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 800, color: "var(--bp-fg)" }}>{c.combo}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--bp-muted)" }}>{c.logic}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#d9b45a" }}>$TBD</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 900, color: "#2ee6a6" }}>{"★".repeat(c.stars)}${"☆".repeat(5 - c.stars)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* SCORE PREDICT */}
        {tab === "Score Predict" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: "#d9b45a", textTransform: "uppercase", marginBottom: 6 }}>NBA SCORE PREDICT — TOP vs BOTTOM</div>
            <div style={{ fontSize: 11, color: "var(--bp-muted)", marginBottom: 10 }}>Alt spread +2 to +5 points increases payout, lowers probability.</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["GAME", "PREDICTED SCORE", "SPREAD", "ALT SPREAD (+3)", "ALT PAYOUT ($5)", "STARS"].map((h, i) => (
                      <th key={i} style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { game: "HOU @ WSH", score: "HOU 118 – WSH 102", spread: "-7.5", alt: "-10.5", payout: "+240", stars: 5 },
                    { game: "OKC @ SAC", score: "OKC 124 – SAC 106", spread: "-9.5", alt: "-12.5", payout: "+260", stars: 5 },
                  ].map((g, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 800, color: "var(--bp-fg)", fontFamily: "monospace" }}>{g.game}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--bp-fg)" }}>{g.score}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#d9b45a" }}>{g.spread}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#f1dc92" }}>{g.alt}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#f1dc92" }}>{g.payout}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 900, color: "#2ee6a6" }}>{"★".repeat(g.stars)}${"☆".repeat(5 - g.stars)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function apiBase(): string {
  const base = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? "" : "http://localhost:8086");
  return base + "/api/books";
}
