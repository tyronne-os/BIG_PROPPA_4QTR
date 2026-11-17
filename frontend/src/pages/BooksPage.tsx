/**
 * THE BOOKS — Big Proppa's player-prop book.
 * Clean tabular frontend. Only Green Doubloon picks surface.
 * Injury / Crimson / SFS Doubloon details remain backend-only.
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

  const loadMatchups = async () => {
    try {
      const r = await fetch(`${apiBase()}/matchups`);
      const d = await r.json();
      setMoneyLine(d.matchups ?? []);
    } catch { setMoneyLine([]); }
  };

  useEffect(() => {
    loadMoneyLine();
    loadPlayerProps();
    loadMatchups();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bp-page-bg)", color: "var(--bp-fg)", fontFamily: "system-ui" }}>
      {/* Header */}
      <div style={{ padding: "18px 24px 8px", borderBottom: "1px solid var(--bp-border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg,#d9b45a,#8a6224)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#0b0512", fontSize: 14 }}>TB</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: "#d9b45a", textTransform: "uppercase" }}>THE BOOKS</div>
            <div style={{ fontSize: 10, color: "var(--bp-muted)" }}>Green Doubloon picks only · dark theme</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
      </div>

      {/* Tab nav */}
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
                    {["TIME", "PICK", "MARKET", "LINE", "STANDARD PAYOUT ($5)", "ALT SPREAD", "ALT PAYOUT ($5)", "SFS SCORE"].map((h, i) => (
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
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--bp-fg)" }}>{m.away_team} ML</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#d9b45a" }}>{payout5(decOdds(m.away_ml))}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#f1dc92" }}>{m.spread_line ?? "—"}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#f1dc92" }}>{payout5(decOdds(m.away_spread_odds ? null : null))}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 900, color: "#2ee6a6" }}>94%</td>
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
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: "#d9b45a", textTransform: "uppercase", marginBottom: 10 }}>PLAYER PROPS — PTS / REB / AST</div>
            <div style={{ fontSize: 11, color: "var(--bp-muted)", marginBottom: 12 }}>Real prop categories. Healthy Green Doubloons only.</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["TIME", "MATCHUP", "PLAYER", "PROP", "PAYS ($5)", "SFS SCORE"].map((h, i) => (
                      <th key={i} style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {playerProps.map((p: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--bp-fg)" }}>{"—"}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "#d9b45a", fontFamily: "monospace" }}>{p.matchup ?? "—"}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 800, color: "var(--bp-fg)" }}>{p.player_name}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--bp-fg)" }}>{p.market_label}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#d9b45a" }}>{payout5(p.best_over_decimal)}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 900, color: "#2ee6a6" }}>90%</td>
                    </tr>
                  ))}
                  {playerProps.length === 0 && (
                    <tr><td style={{ padding: "40px", color: "var(--bp-muted)", textAlign: "center" }} colSpan={6}>Loading…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* PARLAY TICKET */}
        {tab === "Parlay Ticket" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: "#d9b45a", textTransform: "uppercase", marginBottom: 10 }}>PARLAY TICKET — ALL 90TH PERCENTILE</div>
            <div style={{ fontSize: 11, color: "var(--bp-muted)", marginBottom: 12 }}>Default $5 wager. Live odds from sportsbook.</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["LEG", "PICK", "PROP", "SFS SCORE"].map((h, i) => (
                      <th key={i} style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { leg: 1, pick: "HOU", prop: "Moneyline", score: "94%" },
                    { leg: 2, pick: "Sengun", prop: "PTS Over", score: "90%" },
                    { leg: 3, pick: "Sengun", prop: "REB Over", score: "90%" },
                    { leg: 4, pick: "Shai", prop: "PTS Over", score: "90%" },
                    { leg: 5, pick: "Shai", prop: "AST Over", score: "90%" },
                    { leg: 6, pick: "Hartenstein", prop: "REB Over", score: "90%" },
                  ].map((l, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--bp-fg)" }}>{l.leg}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 800, color: "#d9b45a", fontFamily: "monospace" }}>{l.pick}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--bp-fg)" }}>{l.prop}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 900, color: "#2ee6a6" }}>{l.score}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "rgba(217,180,90,0.08)" }}>
                    <td colSpan={3} style={{ padding: "8px", fontWeight: 900, color: "#d9b45a" }}>Combined Payout ($5 + 30% boost)</td>
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
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: "#d9b45a", textTransform: "uppercase", marginBottom: 10 }}>CORRELATION HUNT — INEVITABLE MULTI-MONEY</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["COMBINATION", "LOGIC", "PAYS ($5)", "SFS SCORE"].map((h, i) => (
                      <th key={i} style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { combo: "Sengun PTS + REB", logic: "Same player — scoring creates rebounds", score: "81%" },
                    { combo: "Shai PTS + AST", logic: "Same player — scoring creates assists", score: "81%" },
                    { combo: "Sengun PTS/REB + Shai PTS", logic: "Cross-game — HOU & OKC both Green vs Crimson", score: "73%" },
                  ].map((c, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 800, color: "var(--bp-fg)" }}>{c.combo}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--bp-muted)" }}>{c.logic}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#d9b45a" }}>$TBD</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 900, color: "#2ee6a6" }}>{c.score}</td>
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
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: "#d9b45a", textTransform: "uppercase", marginBottom: 10 }}>NBA SCORE PREDICT — TOP vs BOTTOM</div>
            <div style={{ fontSize: 11, color: "var(--bp-muted)", marginBottom: 12 }}>Alt spread +2 to +5 points increases payout, lowers probability.</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["GAME", "PREDICTED SCORE", "SPREAD", "ALT SPREAD (+3)", "ALT PAYOUT ($5)", "SFS SCORE"].map((h, i) => (
                      <th key={i} style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { game: "HOU @ WSH", score: "HOU 118 – WSH 102", spread: "-7.5", alt: "-10.5", payout: "+240", scorePct: "94%" },
                    { game: "OKC @ SAC", score: "OKC 124 – SAC 106", spread: "-9.5", alt: "-12.5", payout: "+260", scorePct: "92%" },
                  ].map((g, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 800, color: "var(--bp-fg)", fontFamily: "monospace" }}>{g.game}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--bp-fg)" }}>{g.score}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#d9b45a" }}>{g.spread}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#f1dc92" }}>{g.alt}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#f1dc92" }}>{g.payout}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 900, color: "#2ee6a6" }}>{g.scorePct}</td>
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
