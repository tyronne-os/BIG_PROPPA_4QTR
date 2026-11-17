import { useEffect, useState } from "react";
import { api } from "../api";
import type { LeaderRow, LeadersResponse } from "../types";
import { playerSlugUrl } from "../playerNav";

/**
 * NBA Leaders — same styling and logic as the NFL Leaders tab, but with NBA
 * prop categories only (points, rebounds, 3 pts, assists, double double,
 * triple double, blocks, steals). Default view shows top 25; can be raised to 50.
 *
 * Backend: calls the same /api/chart/leaders?category= endpoint. NBA categories
 * return empty rows until NBA player-prop data is loaded into the lake — the
 * page shows a clean empty state until then.
 */
const CATEGORIES = ["POINTS", "REBOUNDS", "3 PTS", "ASSISTS", "DOUBLE DOUBLE", "TRIPLE DOUBLE", "BLOCKS", "STEALS"];

const CATEGORY_LABEL: Record<string, string> = {
  POINTS: "POINTS",
  REBOUNDS: "REBOUNDS",
  "3 PTS": "3-POINTERS",
  ASSISTS: "ASSISTS",
  "DOUBLE DOUBLE": "DOUBLE-DOUBLE",
  "TRIPLE DOUBLE": "TRIPLE-DOUBLE",
  BLOCKS: "BLOCKS",
  STEALS: "STEALS",
};

// Deep violet ground, purple for interaction, gold for emphasis. Green/red stay reserved
// for good/bad signals.
const C = {
  bg: "#000000", card: "#070707", card2: "#111111", edge: "#26232b", hover: "rgba(139,92,246,0.14)",
  purple: "#8b5cf6", purpleSoft: "#b79cff", gold: "#d9b45a", goldHi: "#f1dc92", goldDeep: "#8a6224",
  text: "#f1ecf8", mute: "#9a8fb0", green: "#22c55e", red: "#ef4444",
};
const MONO = "var(--font-mono, monospace)";
const SANS = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';

function initials(name: string): string {
  if (!name.includes(" ")) return name.slice(0, 3).toUpperCase();
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function fmt(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined ? "—" : v.toFixed(digits).replace(/\.0$/, "");
}

function Photo({ url, name, size }: { url?: string | null; name: string; size: number }) {
  const [broken, setBroken] = useState(false);
  const box = { width: size, height: size, flex: `0 0 ${size}px`, borderRadius: "50%", background: C.card2, border: `1px solid ${C.edge}`, overflow: "hidden" as const };
  if (url && !broken) {
    return <img src={url} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ ...box, objectFit: "cover", objectPosition: "center top" }} />;
  }
  return <span style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: size * 0.34, fontWeight: 700, color: C.mute }}>{initials(name)}</span>;
}

export default function NBALeadersTab({ onOpenPlayer }: { onOpenPlayer: (playerId: string, market?: string) => void }) {
  const [category, setCategory] = useState(() => {
    try {
      const c = new URLSearchParams(window.location.search).get("cat")?.toUpperCase();
      if (c && CATEGORIES.includes(c)) return c;
      const saved = sessionStorage.getItem("bp_nba_leaders_cat");
      if (saved && CATEGORIES.includes(saved)) return saved;
    } catch { /* */ }
    return "POINTS";
  });
  const [data, setData] = useState<LeadersResponse | null>(null);
  const [limit, setLimit] = useState<number>(25);

  useEffect(() => {
    try { sessionStorage.setItem("bp_nba_leaders_cat", category); } catch { /* */ }
    setData(null);
    let alive = true;
    api.leaders(category).then((d) => {
      if (!alive) return;
      setData(d);
    }).catch(() => alive && setData(null));
    return () => { alive = false; };
  }, [category]);

  return (
    <div className="nba-wrap" style={{ fontFamily: SANS, color: C.text, background: C.bg, border: `1px solid ${C.edge}`, borderRadius: 20, padding: "16px 18px 22px", display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <style>{`.nba-wrap button{font-family:inherit}.nba-row:hover{background:${C.hover}}.nba-row:hover .nba-name{color:${C.goldHi};text-decoration:underline}`}</style>

      {/* Category pills */}
      <div style={{ display: "flex", gap: 4, padding: 4, background: C.card, border: `1px solid ${C.edge}`, borderRadius: 14, overflowX: "auto" }}>
        {CATEGORIES.map((c) => {
          const on = c === category;
          return (
            <button key={c} onClick={() => setCategory(c)}
              style={{ flex: "1 0 auto", height: 40, padding: "0 16px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap",
                fontSize: 13, fontWeight: 800, letterSpacing: "0.08em",
                border: `1px solid ${on ? C.purple : "transparent"}`,
                background: on ? "linear-gradient(180deg, rgba(139,92,246,0.35), rgba(139,92,246,0.14))" : "transparent",
                color: on ? C.goldHi : C.mute, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {CATEGORY_LABEL[c]}
            </button>
          );
        })}
      </div>

      {!data && <div style={{ color: C.mute, fontSize: 15 }}>Loading NBA leaders...</div>}

      {data && data.sourceStatus !== "ok" && (
        <div style={{ background: C.card, border: `1px solid ${C.edge}`, borderRadius: 16, padding: 40, textAlign: "center", color: C.mute }}>
          <span style={{ fontSize: 13 }}>NBA player data not yet in the lake — add NBA prop CSVs to see leaders here.</span>
          <br />
          <span style={{ fontSize: 11, marginTop: 6, display: "block", color: C.mute }}>Category: {CATEGORY_LABEL[category]}</span>
        </div>
      )}

      {data && data.sourceStatus === "ok" && data.rows && data.rows.length > 0 && (
        <>
          {data.rows.length > 25 && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: C.mute }}>SHOW</span>
              {[25, 50].map((n) => {
                const on = limit === n;
                return (
                  <button key={n} onClick={() => setLimit(n)}
                    style={{ padding: "8px 13px", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", cursor: "pointer", borderRadius: 8,
                      border: `1px solid ${on ? C.gold : C.edge}`, background: on ? `linear-gradient(180deg, ${C.goldHi}, ${C.gold})` : C.card, color: on ? "#1a0d05" : C.mute }}>
                    {n}
                  </button>
                );
              })}
              <span style={{ fontFamily: MONO, fontSize: 11, color: C.mute }}>of {data.rows.length}</span>
            </div>
          )}

          <div style={{ background: C.card, border: `1px solid ${C.edge}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 64px 100px minmax(100px,260px)", gap: 14, alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${C.edge}`, fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", color: C.gold }}>
              <span>RK</span><span>PLAYER</span><span style={{ textAlign: "right" }}>GP</span><span style={{ textAlign: "right" }}>{category === "POINTS" ? "PTS/G" : category === "REBOUNDS" ? "REB/G" : category === "3 PTS" ? "3PT/G" : category === "ASSISTS" ? "AST/G" : category === "DOUBLE DOUBLE" ? "DD/G" : category === "TRIPLE DOUBLE" ? "TD/G" : category === "BLOCKS" ? "BLK/G" : "STL/G"}</span><span />
            </div>
            {data.rows.slice(0, limit).map((r) => {
              const colKey = category === "POINTS" ? "value" : category === "REBOUNDS" ? "value" : category === "3 PTS" ? "value" : category === "ASSISTS" ? "value" : category === "DOUBLE DOUBLE" ? "value" : category === "TRIPLE DOUBLE" ? "value" : category === "BLOCKS" ? "value" : "value";
              return (
                <div key={r.playerId} className="nba-row"
                  onClick={() => onOpenPlayer(r.playerId)}
                  style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 64px 100px minmax(100px,260px)", gap: 14, alignItems: "center", padding: "10px 18px", borderBottom: `1px solid ${C.edge}`, cursor: "pointer" }}>
                  <span style={{ fontFamily: MONO, fontSize: 14, color: r.rank <= 3 ? C.gold : C.mute, fontWeight: r.rank <= 3 ? 800 : 400 }}>{r.rank}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <Photo url={r.photoUrl} name={r.name} size={44} />
                    <a
                      className="nba-name"
                      href={playerSlugUrl(r.playerId, r.name, r.team)}
                      onClick={(e) => { e.preventDefault(); onOpenPlayer(r.playerId); }}
                      style={{ fontSize: 17, fontWeight: 600, color: "inherit", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {r.name} <span style={{ color: C.mute, fontWeight: 400 }}>({r.team})</span>
                    </a>
                  </span>
                  <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 15, color: C.mute }}>{r.gp}</span>
                  <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 18, fontWeight: 700 }}>{fmt(r[colKey as keyof LeaderRow] as number)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {data && data.sourceStatus === "ok" && data.rows && data.rows.length === 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.edge}`, borderRadius: 16, padding: 40, textAlign: "center", color: C.mute }}>
          <span style={{ fontSize: 13 }}>No NBA leaders for {CATEGORY_LABEL[category]} yet.</span>
        </div>
      )}
    </div>
  );
}
