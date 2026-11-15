"""
Read-only data layer over lake/gold/nba/*.csv (NBA pond, built from
TeamRankings stat pages via scripts/build_nba_teamrankings.py).

Mirrors backend/data.py's pattern so the NBA leaders/insights endpoints read
the same way the NFL pond does: every gold CSV is tracked in git, the
_index.csv manifest drives sourceStatus, and nothing is ever silently
fallbacked to placeholder values.

Per HANDOFF_CLAUDE_CODE.md sec 0, rule 1: only a chart whose _index.csv row
has status == "ok" is ever rendered with real data.

TeamRankings exposes no persistent player id, so player_id is a stable hash of
normalized name + team (nba-<slug>). TeamRankings is crawled at most once per
10s per its robots.txt Crawl-delay.
"""
from __future__ import annotations

import csv
import pathlib
import re
import threading
from functools import lru_cache

REPO = pathlib.Path(__file__).resolve().parent.parent
GOLD = REPO / "lake" / "gold" / "nba"

_lock = threading.Lock()


def _read_csv(name: str) -> list[dict]:
    path = GOLD / f"{name}.csv"
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


@lru_cache(maxsize=64)
def _cached_csv(name: str, _version: int) -> list[dict]:
    return _read_csv(name)


_VERSION = 0


def refresh_data() -> int:
    global _VERSION
    _VERSION += 1
    _cached_csv.cache_clear()
    return _VERSION


def load(name: str) -> list[dict]:
    with _lock:
        return _cached_csv(name, _VERSION)


def normalize_name(name: str) -> str:
    n = name.lower()
    n = re.sub(r"[.'\-]", "", n)
    n = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def _num(v, digits: int = 3):
    try:
        return round(float(v), digits)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# _index.csv -- the chart-status gate
# ---------------------------------------------------------------------------

def chart_index() -> dict[str, dict]:
    rows = load("_index")
    return {r["chart_name"]: r for r in rows}


def chart_status(chart_name: str) -> str:
    row = chart_index().get(chart_name)
    return row["status"] if row else "error"


# ---------------------------------------------------------------------------
# Player dimension -- nba-<slug> -> {name, team, pos}
# Built from whichever player CSVs carry names (all of them do).
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def player_dimension() -> dict[str, dict]:
    dim: dict[str, dict] = {}
    for csv_name in ("player_turnovers", "player_steals", "player_rebounds",
                     "player_assists", "player_win_score", "player_ts_pct",
                     "player_game_score", "player_double_doubles",
                     "player_triple_doubles", "player_pra", "player_sb"):
        for row in load(csv_name):
            pid = row.get("player_id")
            if not pid:
                continue
            existing = dim.get(pid)
            if existing is None:
                dim[pid] = {
                    "player_id": pid,
                    "name": row.get("name", pid),
                    "team": row.get("team", ""),
                    "pos": row.get("pos", ""),
                }
            else:
                # keep the most complete record (prefer one with a pos)
                if not existing.get("pos") and row.get("pos"):
                    existing["pos"] = row.get("pos")
                if not existing.get("team") and row.get("team"):
                    existing["team"] = row.get("team")
    return dim


def player_name(player_id: str) -> str:
    return player_dimension().get(player_id, {}).get("name", player_id)


def player_team(player_id: str) -> str:
    return player_dimension().get(player_id, {}).get("team", "")


def player_pos(player_id: str) -> str:
    return player_dimension().get(player_id, {}).get("pos", "")


def search_players(query: str, limit: int = 20) -> list[dict]:
    q = normalize_name(query)
    if not q:
        return []
    out = []
    for pid, row in player_dimension().items():
        if q in normalize_name(row["name"]):
            out.append({"playerId": pid, "name": row["name"], "team": row["team"], "pos": row.get("pos", "")})
    return out[:limit]


# ---------------------------------------------------------------------------
# Team stat helpers
# ---------------------------------------------------------------------------

_TEAM_STAT_COLS = {
    "team_assist_turnover_ratio": "stat_value",
    "team_turnover_pct": "stat_value",
    "team_assists_per_possession": "stat_value",
    "team_turnovers_per_game": "stat_value",
    "team_opponent_turnovers": "stat_value",
    "team_blocks_per_game": "stat_value",
    "team_steals_per_game": "stat_value",
    "team_opponent_1st_quarter_points": "stat_value",
    "team_3pm_per_game": "stat_value",
    "team_points_per_game": "stat_value",
    "team_total_rebounds_per_game": "stat_value",
    "team_win_pct_close_games": "stat_value",
}


def team_rows(chart_name: str) -> list[dict]:
    """All rows for a team stat chart, sorted by rank asc."""
    rows = load(chart_name)
    return sorted(rows, key=lambda r: int(re.sub(r"\D", "", r.get("rank") or 0) or 9999))


def team_value(chart_name: str, team: str) -> float | None:
    """Stat value for one team in one chart, or None."""
    for r in load(chart_name):
        if (r.get("team") or "").lower() == team.lower():
            return _num(r.get("stat_value"))
    return None


# ---------------------------------------------------------------------------
# Player stat helpers
# ---------------------------------------------------------------------------

_PLAYER_STAT_COLS = {
    "player_turnovers": "stat_value",
    "player_steals": "stat_value",
    "player_rebounds": "stat_value",
    "player_assists": "stat_value",
    "player_win_score": "stat_value",
    "player_ts_pct": "stat_value",
    "player_game_score": "stat_value",
    "player_double_doubles": "stat_value",
    "player_triple_doubles": "stat_value",
    "player_pra": "stat_value",
    "player_sb": "stat_value",
}


def player_rows(chart_name: str) -> list[dict]:
    """All rows for a player stat chart, sorted by rank asc."""
    rows = load(chart_name)
    return sorted(rows, key=lambda r: int(re.sub(r"\D", "", r.get("rank") or 0) or 9999))


def player_value(chart_name: str, player_id: str) -> float | None:
    for r in load(chart_name):
        if r.get("player_id") == player_id:
            return _num(r.get("stat_value"))
    return None
