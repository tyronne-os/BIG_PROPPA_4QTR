/**
 * NBA Insights page — predictive matchup edges and player prop nuggets.
 *
 * Reads from /api/nba/insights, /api/nba/matchups, /api/nba/props and
 * /api/nba/top-nugget (computed by backend/nba_correlations.py and
 * backend/nba_insights.py from ESPN live data).
 */
import { useEffect, useState } from "react";
import { api } from "../api";
import type {
  NBAInsightNugget,
  NBAMatchupCorrelation,
  NBAPlayerPropCorrelation,
  NBATopNugget,
} from "../types";

const C = {
  bg: "#0b0512", card: "#140a20", card2: "#0e0714", edge: "#2a1e36",
  purple: "#8b5cf6", purpleSoft: "#b79cff", gold: "#d9b45a", goldHi: "#f1dc92",
  text: "#ece6f2", mute: "#8a8290", green: "#2ee6a6", red: "#ef4444",
};
const MONO = "var(--font-mono, monospace)";
const SANS = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';

function sign(v: number | null): string {
  if (v == null) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(1);
}

function confidenceColor(c: number | null): string {
  if (c == null) return C.mute;
  if (c >= 0.85) return C.green;
  if (c >= 0.70) return C.gold;
  return C.mute;
}

function NuggetCard({ n }: { n: NBAInsightNugget }) {
  return (
    <div style={{ background: C.card2, border: `1px solid ${n.confidence >= 0.85 ? C.gold : C.edge}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{n.title}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, color: confidenceColor(n.confidence), border: `1px solid ${confidenceColor(n.confidence)}44`, borderRadius: 4, padding: "1px 6px" }}>
          {Math.round(n.confidence * 100)}%
        </span>
      </div>
      <span style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{n.body}</span>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: C.mute }}>{n.insight_kind}</span>
        {n.edge_label && (
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.goldHi }}>{n.edge_label}</span>
        )}
      </div>
    </div>
  );
}

export default function NBAInsightsPage() {
  const [insights, setInsights] = useState<NBAInsightNugget[]>([]);
  const [matchups, setMatchups] = useState<NBAMatchupCorrelation[]>([]);
  const [props, setProps] = useState<NBAPlayerPropCorrelation[]>([]);
  const [topNuggets, setTopNuggets] = useState<NBATopNugget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.nbaInsights(),
      api.nbaMatchups(),
      api.nbaProps(),
      api.nbaTopNugget(),
    ])
      .then(([i, m, p, t]) => {
        setInsights(i.insights || []);
        setMatchups(m.matchups || []);
        setProps(p.props || []);
        setTopNuggets(t.top_nuggets || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: SANS, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 13, color: C.mute }}>Loading NBA insights…</span>
      </div>
    );
  }

  // Group insights by game
  const byGame = new Map<string, NBAInsightNugget[]>();
  for (const n of insights) {
    const g = n.game_id;
    if (!byGame.has(g)) byGame.set(g, []);
    byGame.get(g)!.push(n);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: SANS }}>
      <header style={{ padding: "20px 24px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.28em", color: C.mute }}>NBA INSIGHTS</span>
          <span style={{ fontSize: 34, lineHeight: 0.92, fontWeight: 900, letterSpacing: "-0.01em", background: `linear-gradient(90deg, ${C.goldHi}, ${C.gold})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: "drop-shadow(0 2px 0 #2a1a08)" }}>
            HEY BIG PROPPA!
          </span>
        </div>
        <span style={{ fontSize: 11, color: C.mute, fontFamily: MONO }}>
          {insights.length} insights · {matchups.length} matchups · {props.length} prop edges
        </span>
      </header>

      {/* Top nuggets row */}
      {topNuggets.length > 0 && (
        <div style={{ padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", color: C.mute }}>TOP NUGGETS</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 12 }}>
            {topNuggets.map((n) => (
              <div key={n.game_id} style={{ background: C.card, border: `1px solid ${C.edge}`, borderRadius: 16, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{n.title}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: confidenceColor(n.confidence), border: `1px solid ${confidenceColor(n.confidence)}44`, borderRadius: 4, padding: "1px 6px" }}>
                    {Math.round(n.confidence * 100)}%
                  </span>
                </div>
                <span style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{n.body}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.mute, marginTop: 4, display: "block" }}>
                  {n.insight_kind} · {n.edge_label || ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All insights by game */}
      <div style={{ padding: "0 24px 40px", display: "flex", flexDirection: "column", gap: 26 }}>
        {Array.from(byGame.entries()).map(([gid, gameInsights]) => {
          const awayMatchup = matchups.find((m) => m.game_id === gid && m.location === "away");
          const homeMatchup = matchups.find((m) => m.game_id === gid && m.location === "home");
          const awayTeam = awayMatchup?.team || "—";
          const homeTeam = homeMatchup?.team || "—";
          const awayEdge = awayMatchup?.net_edge != null ? sign(awayMatchup.net_edge) : "—";
          const homeEdge = homeMatchup?.net_edge != null ? sign(homeMatchup.net_edge) : "—";

          return (
            <section key={gid} style={{ background: C.card, border: `1px solid ${C.edge}`, borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column", gap: 0, minWidth: 0 }}>
              <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${C.edge}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.goldHi }}>{awayTeam}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.mute }}>{awayEdge}</span>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: C.mute }}>
                    NBA MATCHUP
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.goldHi }}>{homeTeam}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.mute }}>{homeEdge}</span>
                </div>
              </div>
              <div style={{ padding: "14px 22px 22px" }}>
                {gameInsights.map((n) => (
                  <NuggetCard key={n.insight_kind + n.title} n={n} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
