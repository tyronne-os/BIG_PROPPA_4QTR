/**
 * PROP-CAST — Big Proppa's live prop watch.
 * Real Sports app-inspired UI: down/distance, period, clock, red zone, possession,
 * live prop values from ESPN, pace projection, win/loss status per leg.
 * Polls /api/live/ticket/{id} every 45s (ESPN update cadence).
 */
import { useEffect, useState } from "react";

type PropLeg = {
  id: string;           // unique leg identifier
  playerId: string;     // ESPN player ID
  playerName: string;   // display name
  team: string;         // team abbr
  prop: string;         // "passyds" | "recyds" | "recs" | "rushtd" | "anytd"
  line: number;         // the prop line (e.g., 250.5)
  current: number;      // live value from ESPN (updates every 45s)
  needed: number;       // line - current (positive = still needed)
  status: "PENDING" | "WIN" | "LOSS"; // resolved status
  pace: number;         // projected full-game pace (yds/gm or td pace)
  paceText: string;     // formatted pace display
  confidence: number;   // 1-5 stars from SFS Doubloon
  color: string;        // tier color (green/orange/crimson)
};

type LiveGameState = {
  gameId: string;
  status: "PRE" | "LIVE" | "HALFTIME" | "FINAL";
  period: number;       // 1-4 or OT
  clock: string;        // "8:47" style
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  situation: string;    // "2nd & 7" / "3rd & 5" etc.
  redZone: boolean;
  possession: string;   // "BAL" | "LAC" etc.
  qtrTimeouts: number;  // remaining
};

type TicketState = {
  ticketId: string;
  legs: PropLeg[];
  game: LiveGameState;
  overall: "PENDING" | "WIN" | "LOSS";
  totalPayout: number;
  stake: number;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "PENDING",
  WIN: "WIN ✓",
  LOSS: "LOSS ✗",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "var(--bp-fg)",
  WIN: "#2ee6a6",
  LOSS: "#ef4444",
};

const TIER_COLORS: Record<string, string> = {
  green: "#00FF88",
  orange: "#FFAA00",
  crimson: "#FF0044",
};

const STAR_FILLED = "★";
const STAR_EMPTY = "☆";

function formatPace(yards: number, period: number, clock: string): string {
  // Project yds per game based on current rate and time remaining
  if (yards <= 0 || period <= 0) return "—";
  // Simple projection: current yards / (period/4 of game) * 4
  // More sophisticated: use ESPN clock math
  const gameProgress = period + (clock ? (parseFloat(clock) / 60 || 0) / 4 : 0);
  const pacePerQtr = yards / Math.max(0.01, gameProgress / 4);
  const projected = pacePerQtr * 4;
  return `${Math.round(projected)} yd pace`;
}

function determineLegStatus(current: number, line: number, gameStatus: string): "PENDING" | "WIN" | "LOSS" {
  if (gameStatus === "FINAL") {
    // Game over — determine win/loss
    return current >= line ? "WIN" : "LOSS";
  }
  if (gameStatus === "HALFTIME" && current >= line) return "WIN";
  return "PENDING";
}

export default function PropCastPage() {
  const [ticket, setTicket] = useState<TicketState | null>(null);
  const [game, setGame] = useState<LiveGameState | null>(null);
  const [loading, setLoading] = useState(true);

  // Parse ticket ID from URL or use a default
  const ticketId = new URLSearchParams(window.location.search).get("id") || "lac-bal-live-2026";

  // Fetch live ticket data (ticket state + live game state from ESPN)
  useEffect(() => {
    async function fetchTicket() {
      try {
        // Fetch live game state first
        const gameRes = await fetch(`/api/live/game/${ticketId}`);
        const gameData = await gameRes.json();
        setGame(gameData);

        // Fetch ticket with leg states
        const ticketRes = await fetch(`/api/live/ticket/${ticketId}`);
        const ticketData = await ticketRes.json();
        setTicket(ticketData);
      } catch (err) {
        console.error("Failed to fetch Prop-Cast data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTicket();

    // Poll every 45s (ESPN update cadence)
    const interval = setInterval(fetchTicket, 45000);
    return () => clearInterval(interval);
  }, [ticketId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bp-page-bg)", color: "var(--bp-fg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div>Loading Prop-Cast…</div>
      </div>
    );
  }

  if (!ticket || !game) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bp-page-bg)", color: "var(--bp-fg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div>Loading live prop watch…</div>
      </div>
    );
  }

  // Compute overall ticket status
  let overall: "PENDING" | "WIN" | "LOSS" = "PENDING";
  let resolvedCount = 0;
  ticket.legs.forEach(leg => {
    if (leg.status !== "PENDING") resolvedCount++;
    if (leg.status === "WIN") overall = "WIN";
    if (leg.status === "LOSS") overall = "LOSS";
  });
  // If all legs resolved, overall is set; if some still pending, keep PENDING unless all are WIN
  if (resolvedCount === ticket.legs.length && overall !== "WIN") overall = "LOSS";

  const totalPayout = ticket.totalPayout || 0;
  const stake = ticket.stake || 5;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bp-page-bg)", color: "var(--bp-fg)", fontFamily: "system-ui" }}>
      {/* Header — Live game state bar (Real Sports app style) */}
      <div
        style={{
          padding: "16px 24px",
          background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          color: "#e94560",
          borderBottom: "2px solid #f6e05e",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "radial-gradient(circle at 30% 20%, #ffD700 0%, #ff8c00 70%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 16,
            }>
            🏈
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f6e05e" }}>
              PROP-CAST
            </div>
            <div style={{ fontSize: 10, color: "#a0a0a0", textTransform: "uppercase" }}>
              Live • {game.period}•{game.clock} • {game.possession} ball
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ padding: "6px 12px", background: "rgba(246,224,94,0.15)", borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {game.status}
          </div>
          {game.situation && (
            <div style={{ padding: "6px 12px", background: "rgba(246,224,94,0.1)", borderRadius: 20, fontSize: 10, color: "#f6e05e" }}>
              {game.situation}
            </div>
          )}
          <div style={{ padding: "6px 12px", background: game.redZone ? "rgba(239,68,68,0.15)" : "rgba(46,230,166,0.1)", borderRadius: 20, fontSize: 10, fontWeight: 700, color: game.redZone ? "#ef4444" : "#2ee6a6" }}>
            {game.redZone ? "RED ZONE" : "OPEN FIELD"}
          </div>
        </div>
      </div>

      {/* Main content: Live ticket + Leg tracker */}
      <div style={{ padding: "20px 24px", display: "flex", gap: 20, minHeight: "60vh" }}>

        {/* LEFT: Live Ticket Summary */}
        <div style={{ flex: 0, minWidth: "320px", background: "var(--bp-card-bg)", border: "1px solid var(--bp-border)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#d9b45a", marginBottom: 12 }}>LIVE TICKET</div>

          <div style={{ fontSize: 12, fontWeight: 800, color: "#e94560", marginBottom: 8 }}>
            {ticket.game.awayTeam} @ {ticket.game.homeTeam}
          </div>

          <div style={{ fontSize: 14, marginBottom: 12 }}>
            {ticket.game.awayScore} - {ticket.game.homeScore} • {ticket.game.period}•{ticket.game.clock}
          </div>

          <div style={{ fontSize: 10, color: "#a0a0a0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {ticket.game.situation || "—"} • {"RED ZONE" if ticket.game.redZone else "OPEN FIELD"} • {ticket.game.possession} ball
          </div>

          {/* Overall ticket result */}
          <div style={{
            marginTop: 16,
            padding: "12px",
            borderRadius: 8,
            background: overall === "WIN" ? "rgba(46,230,166,0.15)" : overall === "LOSS" ? "rgba(239,68,68,0.15)" : "rgba(246,224,94,0.1)",
            border: `1px solid ${overall === "WIN" ? "#2ee6a6" : overall === "LOSS" ? "#ef4444" : "#f6e05e"}`,
          }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>OVERALL: {STATUS_LABELS[overall]}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: overall === "WIN" ? "#2ee6a6" : overall === "LOSS" ? "#ef4444" : "#f6e05e" }}>
              +${totalPayout} (${stake} stake • 30% boost applied)
            </div>
          </div>
        </div>

        {/* RIGHT: Leg Tracker Table */}
        <div style={{ flex: 1, background: "var(--bp-card-bg)", border: "1px solid var(--bp-border)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#d9b45a", marginBottom: 12 }}>
            LEG TRACKER ({ticket.legs.length} legs)
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>LEG</th>
                <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>PLAYER & PROP</th>
                <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>LINE</th>
                <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>CURRENT</th>
                <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>NEEDED</th>
                <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>STATUS</th>
                <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>PACE</th>
                <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, fontWeight: 800, color: "var(--bp-muted)", letterSpacing: "0.1em", borderBottom: "1px solid var(--bp-border)" }}>★</th>
              </tr>
            </thead>
            <tbody>
              {ticket.legs.map((leg) => {
                const tierColor = TIER_COLORS[leg.color] || "#fff";
                const starText = Array.from({ length: leg.confidence }, () => STAR_FILLED).concat(
                  Array.from({ length: 5 - leg.confidence }, () => STAR_EMPTY)
                );
                const statusLabel = STATUS_LABELS[leg.status] || "PENDING";
                const statusColor = STATUS_COLORS[leg.status] || "var(--bp-fg)";
                const needed = Math.max(0, leg.line - leg.current);

                return (
                  <tr
                    key={leg.id}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      background: leg.status === "WIN"
                        ? "rgba(46,230,166,0.03)"
                        : leg.status === "LOSS"
                        ? "rgba(239,68,68,0.03)"
                        : "transparent",
                    }}
                  >
                    <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#d9b45a", fontWeight: 700 }}>
                      {leg.id}
                    </td>
                    <td style={{ padding: "6px 8px", color: tierColor, fontWeight: 700, textTransform: "uppercase" }}>
                      <div>{leg.playerName}</div>
                      <div style={{ fontSize: 9, color: "var(--bp-muted)" }}>{leg.prop.upper()}</div>
                    </td>
                    <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#d9b45a" }}>
                      {leg.line > 0 ? `${leg.line}` : "—"}
                    </td>
                    <td style={{ padding: "6px 8px", fontFamily: "monospace", color: tierColor, fontWeight: 700 }}>
                      {leg.current > 0 ? `${leg.current}` : "—"}
                    </td>
                    <td style={{ padding: "6px 8px", fontFamily: "monospace", color: statusColor, fontWeight: 700 }}>
                      {needed > 0 ? `${needed}` : "—"}
                    </td>
                    <td style={{ padding: "6px 8px", color: statusColor, fontWeight: 700 }}>
                      {statusLabel}
                    </td>
                    <td style={{ padding: "6px 8px", color: "var(--bp-fg)", fontFamily: "monospace" }}>
                      {leg.paceText}
                    </td>
                    <td style={{ padding: "6px 8px", color: tierColor, fontWeight: 900 }}>
                      {starText.join("")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <div
        style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--bp-border)",
          background: "var(--bp-page-bg)",
          color: "var(--bp-muted)",
          fontSize: 10,
          textAlign: "center",
        }}
      >
        Prop-Cast updates every 45s from ESPN API · Data live • Bet responsibly • Kizzy tracks every leg
      </div>
    </div>
  );
}