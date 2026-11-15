/**
 * MATCHUP OF THE DAY — ESPN matchup + player props (Motowire-style)
 *
 * For each NFL game on the chosen date: ESPN scoreboard + game summary
 * (player box scores) split into starters ("foundational props", cleared the
 * SFS starter threshold) and bench/breakout candidates (SFS filter: low
 * opportunity but high efficiency or trending up).
 *
 * Clicking a player name opens that player's standard single-player page —
 * the same page reached from a leader click-through.
 */
import { useEffect, useState } from "react";
import { api } from "../api";
import type { MatchupOfTheDayResponse, MOTDPlayer } from "../types";
import { playerSlugUrl } from "../playerNav";

const C = {
  bg: "#0b0512", card: "#140a20", card2: "#0e0714", edge: "#2a1e36",
  purple: "#8b5cf6", purpleSoft: "#b79cff", gold: "#d9b45a", goldHi: "#f1dc92",
  text: "#ece6f2", mute: "#8a8290", green: "#2ee6a6", red: "#ef4444",
};
const MONO = "var(--font-mono, monospace)";
const SANS = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';

function fmt(v: number | null | undefined, digits = 1): string {
  return v == null ? "—" : Number(v).toFixed(digits).replace(/\.0$/, "");
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function Photo({ url, name, size }: { url?: string | null; name: string; size: number }) {
  const [broken, setBroken] = useState(false);
  const box = { width: size, height: size, flex: `0 0 ${size}px`, borderRadius: "50%", background: C.card2, border: `1px solid ${C.edge}`, overflow: "hidden" as const };
  if (url && !broken) {
    return <img src={url} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ ...box, objectFit: "cover", objectPosition: "center top" }} />;
  }
  return <span style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: size * 0.34, fontWeight: 700, color: C.mute }}>{initials(name)}</span>;
}

function primaryStat(pos: string): { key: string; label: string } {
  const p = (pos || "").toUpperCase();
  if (p === "QB") return { key: "passyds", label: "PASS YDS" };
  if (p === "RB" || p === "FB") return { key: "rushyds", label: "RUSH YDS" };
  if (p === "WR" || p === "TE") return { key: "recyds", label: "REC YDS" };
  return { key: "recyds", label: "YDS" };
}

function secondary(pos: string): { key: string; label: string } {
  const p = (pos || "").toUpperCase();
  if (p === "QB") return { key: "passtd", label: "TD" };
  if (p === "RB" || p === "FB") return { key: "rushtd", label: "TD" };
  if (p === "WR" || p === "TE") return { key: "recs", label: "REC" };
  return { key: "recs", label: "REC" };
}

function statNum(stats: Record<string, unknown>, key: string): number {
  const v = stats[key];
  return v == null ? 0 : Number(v);
}

function trendBars(stats: Record<string, unknown>): JSX.Element | null {
  const l5 = stats["l5"];
  if (!Array.isArray(l5) || l5.length === 0) return null;
  const max = Math.max(...l5.map((g: any) => Number(g.value || 0)), 1);
  return (
    <span style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 26 }}>
      {l5.map((g: any, i: number) => {
        const v = Number(g.value || 0);
        return (
          <span
            key={String(g.week) + i}
            style={{
              flex: 1, maxWidth: 20, height: Math.max(3, (v / max) * 26),
              background: v > 0 ? C.green : "var(--bp-border)", borderRadius: "3px 3px 0 0",
            }}
            title={`Wk ${g.week} ${v}`}
          />
        );
      })}
    </span>
  );
}

function PlayerCard({ p, starter }: { p: MOTDPlayer; starter: boolean }) {
  const ps = primaryStat(p.position);
  const sc = secondary(p.position);
  const val = statNum(p.stats, ps.key);
  const scVal = statNum(p.stats, sc.key);
  const label = starter ? "FOUNDATIONAL" : "BREAKOUT";
  const accent = starter ? C.gold : C.purpleSoft;
  const link = playerSlugUrl(p.playerId, p.name, p.team);

  return (
    <a
      href={link}
      onClick={(e) => { e.preventDefault(); window.location.assign(link); }}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{ background: C.card, border: `1px solid ${starter ? C.gold : C.edge}`, borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Photo url={p.photoUrl} name={p.name} size={44} />
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.mute }}>
                <span>{p.team}</span>
                <span style={{ width: 4, height: 4, borderRadius: 999, background: accent }}></span>
                <span>{p.position}</span>
              </span>
            </div>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", border: `1px solid ${accent}`, borderRadius: 4, padding: "1px 6px", color: accent, background: starter ? "rgba(201,165,78,0.12)" : "rgba(139,92,246,0.10)" }}>
            {label}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
          <StatCell label={ps.label} value={fmt(val)} big accent={val > 0 ? C.green : C.mute} />
          <StatCell label={sc.label} value={fmt(scVal, 0)} big accent={scVal > 0 ? C.green : C.mute} />
          <StatCell label="TGT/CAR" value={fmt(statNum(p.stats, "tgt") || statNum(p.stats, "carries"), 0)} big accent={C.mute} />
        </div>

        {trendBars(p.stats) && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.edge}` }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.mute, marginBottom: 4, display: "block" }}>LAST 5 · {ps.label}</span>
            {trendBars(p.stats)}
          </div>
        )}
      </div>
    </a>
  );
}

function StatCell({ label, value, big, accent }: { label: string; value: string; big?: boolean; accent?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: C.mute }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: big ? 20 : 15, fontWeight: 800, color: accent || C.text }}>{value}</span>
    </div>
  );
}

function TeamBlock({ abbr, score }: { abbr: string; score: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{abbr}</span>
      <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 900, lineHeight: 1, color: C.goldHi }}>{score}</span>
    </div>
  );
}

function statusLabel(status: string): { text: string; color: string } {
  const s = (status || "").toUpperCase();
  if (s === "FINAL") return { text: "FINAL", color: C.mute };
  if (s === "LIVE" || s === "OT" || s === "HALFTIME") return { text: "LIVE", color: C.green };
  return { text: "UPCOMING", color: C.mute };
}

export default function MatchupOfTheDayPage() {
  const [data, setData] = useState<MatchupOfTheDayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => {
    try { return new Date().toLocaleDateString("en-CA"); } catch { return ""; } // YYYY-MM-DD
  });

  useEffect(() => {
    setLoading(true);
    api.espnMatchupOfTheDay(date).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [date]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: SANS, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 13, color: C.mute }}>Loading matchup of the day…</span>
      </div>
    );
  }

  const games = data?.games ?? [];

  if (games.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: SANS, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 14, color: C.mute }}>No NFL games on ESPN for {date || "today"}.</span>
        <span style={{ fontSize: 11, color: C.mute }}>Pick a date above to load a different day’s matchups.</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: SANS }}>
      <header style={{ padding: "20px 24px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.28em", color: C.mute }}>MATCHUP OF THE DAY</span>
          <span style={{ fontSize: 34, lineHeight: 0.92, fontWeight: 900, letterSpacing: "-0.01em", background: `linear-gradient(90deg, ${C.goldHi}, ${C.gold})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: "drop-shadow(0 2px 0 #2a1a08)" }}>
            HEY BIG PROPPA!
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.mute }}>DATE</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ height: 32, padding: "0 8px", border: `1px solid ${C.edge}`, borderRadius: 8, background: C.card2, color: C.goldHi, fontSize: 12, fontWeight: 800, fontFamily: MONO, cursor: "pointer" }}
          />
        </div>
      </header>

      <div style={{ padding: "0 24px 40px", display: "flex", flexDirection: "column", gap: 26 }}>
        {games.map((g) => {
          const { text: statusText, color: statusColor } = statusLabel(g.status);
          const confident = (g.status === "PRE") && g.spread != null;

          return (
            <section key={g.gameId} style={{ background: C.card, border: `1px solid ${confident ? C.gold : C.edge}`, borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column", gap: 0, minWidth: 0 }}>
              {/* Matchup header */}
              <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${C.edge}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <TeamBlock abbr={g.away} score={g.awayScore} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: C.mute }}>
                    {new Date(g.start || "").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} {new Date(g.start || "").toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {confident && (
                    <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 800, letterSpacing: "0.08em", color: "#1a0d05", background: C.gold, borderRadius: 3, padding: "1px 5px", whiteSpace: "nowrap" }}>
                      65%+ CONFIDENT
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <TeamBlock abbr={g.home} score={g.homeScore} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: C.mute, fontFamily: MONO }}>
                  {g.spread && <span>{g.spread}</span>}
                  {g.total && <span>O/U {g.total}</span>}
                  <span style={{ fontSize: 10, fontWeight: 800, color: statusColor }}>{statusText}</span>
                </div>
              </div>

              {/* Tabs: Foundational vs Bench */}
              <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.edge}` }}>
                <TabButton active={true} label="FOUNDATIONAL PROPS" count={g.starters.length} />
                <TabButton active={false} label="BENCH &amp; BREAKOUT" count={g.bench.length} />
              </div>

              <div style={{ padding: "14px 22px 22px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))", gap: 12 }}>
                {g.starters.map((p) => <PlayerCard key={p.playerId} p={p} starter={true} />)}
                {g.starters.length === 0 && <div style={{ gridColumn: "1 / -1", color: C.mute, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No foundational props for this matchup.</div>}
              </div>

              <div style={{ padding: "0 22px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))", gap: 12, borderTop: `1px solid ${C.edge}`, marginTop: 10 }}>
                <div style={{ gridColumn: "1 / -1", fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: C.purple, marginBottom: 8 }}>
                  BENCH &amp; BREAKOUT — SFS FILTER: low opportunity, high efficiency or trending up
                </div>
                {g.bench.map((p) => <PlayerCard key={p.playerId} p={p} starter={false} />)}
                {g.bench.length === 0 && <div style={{ gridColumn: "1 / -1", color: C.mute, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No breakout candidates flagged.</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TabButton({ active, label, count }: { active: boolean; label: string; count: number }) {
  return (
    <button style={{ flex: 1, padding: "10px 0", border: 0, background: active ? C.gold : "transparent", color: active ? "#0b0512" : C.mute, fontFamily: MONO, fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", cursor: "pointer", borderBottom: active ? `3px solid #0b0512` : `3px solid transparent` }}>
      {label}
      <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.8 }}>{count}</span>
    </button>
  );
}
