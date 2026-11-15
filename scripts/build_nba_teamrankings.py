"""
NBA TeamRankings ingestion pipeline.

Scrapes the TeamRankings NBA stat & player-stat pages (free, public, no key)
and writes normalized gold CSVs under lake/gold/nba/ following the same
manifest pattern the NFL pond uses (_index.csv drives sourceStatus).

Respects TeamRankings robots.txt Crawl-delay: 10s between requests.

Team pages (Rank, Team, 2026, Last 3, Last 1, Home, Away, 2025):
  assist-turnover-ratio, turnover-pct, assists-per-possession,
  turnovers-per-game, opponent-turnovers-per-game, blocks-per-game,
  steals-per-game, opponent-1st-quarter-points-per-game,
  three-pointers-made-per-game, points-per-game,
  total-rebounds-per-game, win-pct-close-games

Player pages (Rank, Player, Team, Pos, Value):
  turnovers, steals, rebounds, assists, win-score, ts-percentage,
  game-score, double-doubles, triple-doubles,
  points-plus-rebounds-plus-assists, steals-plus-blocks

Run:
    python scripts/build_nba_teamrankings.py   # full rebuild (respects 10s crawl-delay)
    python scripts/build_nba_teamrankings.py --team  # team pages only
    python scripts/build_nba_teamrankings.py --player  # player pages only
"""
from __future__ import annotations

import csv
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import urllib.request

REPO = Path(__file__).resolve().parent.parent
GOLD = REPO / "lake" / "gold" / "nba"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
CRAWL_DELAY = 10.0  # seconds, per TeamRankings robots.txt
SEASON = 2026

# ── Team stat pages ─────────────────────────────────────────────────────────
TEAM_PAGES = {
    "team_assist_turnover_ratio": "assist--per--turnover-ratio",
    "team_turnover_pct": "turnover-pct",
    "team_assists_per_possession": "assists-per-possession",
    "team_turnovers_per_game": "turnovers-per-game",
    "team_opponent_turnovers": "opponent-turnovers-per-game",
    "team_blocks_per_game": "blocks-per-game",
    "team_steals_per_game": "steals-per-game",
    "team_opponent_1st_quarter_points": "opponent-1st-quarter-points-per-game",
    "team_3pm_per_game": "three-pointers-made-per-game",
    "team_points_per_game": "points-per-game",
    "team_total_rebounds_per_game": "total-rebounds-per-game",
    "team_win_pct_close_games": "win-pct-close-games",
}

# ── Player stat pages ───────────────────────────────────────────────────────
PLAYER_PAGES = {
    "player_turnovers": "turnovers",
    "player_steals": "steals",
    "player_rebounds": "rebounds",
    "player_assists": "assists",
    "player_win_score": "win-score",
    "player_ts_pct": "ts-percentage",
    "player_game_score": "game-score",
    "player_double_doubles": "double-doubles",
    "player_triple_doubles": "triple-doubles",
    "player_pra": "points-plus-rebounds-plus-assists",
    "player_sb": "steals-plus-blocks",
}


def _fetch(url: str) -> str | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read().decode("utf-8", errors="ignore")
    except Exception as exc:
        print(f"  ! fetch failed {url}: {exc}")
        return None


def _parse_table(html: str):
    """Return (headers, rows) from the first tr-table datatable."""
    m = re.search(r'<table[^>]*class="[^"]*tr-table[^"]*"[^>]*>(.*?)</table>', html, re.S)
    if not m:
        return None, []
    body = m.group(1)
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", body, re.S)
    out = []
    for r in rows:
        cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)
        clean = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
        if clean:
            out.append(clean)
    if not out:
        return None, []
    return out[0], out[1:]


def _now_iso() -> str:
    return datetime.now(ZoneInfo("America/Chicago")).isoformat()


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def _pid(name: str, team: str) -> str:
    """Stable player id from normalized name + team (TeamRankings exposes no id)."""
    base = re.sub(r"[^a-z0-9]+", "", (name + "|" + team).lower())
    return f"nba-{base}"


def scrape_team(slug: str, path: str) -> list[dict]:
    url = f"https://www.teamrankings.com/nba/stat/{path}"
    html = _fetch(url)
    if not html:
        return []
    headers, rows = _parse_table(html)
    if headers is None:
        print(f"  ! no table for {slug}")
        return []
    out = []
    for r in rows:
        if len(r) < 2:
            continue
        out.append(
            {
                "season": SEASON,
                "rank": int(re.sub(r"\D", "", r[0]) or 0),
                "team": r[1],
                "stat_value": r[2] if len(r) > 2 else "",
                "last_3": r[3] if len(r) > 3 else "",
                "last_1": r[4] if len(r) > 4 else "",
                "home": r[5] if len(r) > 5 else "",
                "away": r[6] if len(r) > 6 else "",
                "previous_season": r[7] if len(r) > 7 else "",
                "source_url": url,
                "ingest_run_id": _now_iso(),
            }
        )
    return out


def scrape_player(slug: str, path: str) -> list[dict]:
    url = f"https://www.teamrankings.com/nba/player-stat/{path}"
    html = _fetch(url)
    if not html:
        return []
    headers, rows = _parse_table(html)
    if headers is None:
        print(f"  ! no table for {slug}")
        return []
    out = []
    for r in rows:
        if len(r) < 3:
            continue
        name = r[1]
        team = r[2] if len(r) > 2 else ""
        pos = r[3] if len(r) > 3 else ""
        value = r[4] if len(r) > 4 else ""
        try:
            fval = float(re.sub(r"[^\d.\-]", "", value) or 0)
        except ValueError:
            fval = 0.0
        out.append(
            {
                "season": SEASON,
                "player_id": _pid(name, team),
                "name": name,
                "team": team,
                "pos": pos,
                "games_played": "",
                "stat_value": fval,
                "per_game": fval,
                "rank": int(re.sub(r"\D", "", r[0]) or 0),
                "source_url": url,
                "ingest_run_id": _now_iso(),
            }
        )
    return out


def _write_csv(name: str, rows: list[dict], fieldnames: list[str]) -> None:
    GOLD.mkdir(parents=True, exist_ok=True)
    path = GOLD / f"{name}.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})
    print(f"  wrote {path} ({len(rows)} rows)")


def _write_index(entries: list[dict]) -> None:
    path = GOLD / "_index.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(
            fh,
            fieldnames=[
                "chart_name",
                "source_table_or_view",
                "grain",
                "row_count",
                "last_exported_at_utc",
                "source_name",
                "status",
            ],
        )
        w.writeheader()
        for e in entries:
            w.writerow(e)
    print(f"  wrote {path} ({len(entries)} entries)")


def main(team_only: bool = False, player_only: bool = False) -> None:
    GOLD.mkdir(parents=True, exist_ok=True)
    index_entries = []
    run_id = _now_iso()

    if not player_only:
        print("=== NBA team stat pages ===")
        for slug, path in TEAM_PAGES.items():
            rows = scrape_team(slug, path)
            fieldnames = [
                "season", "rank", "team", "stat_value", "last_3", "last_1",
                "home", "away", "previous_season", "source_url", "ingest_run_id",
            ]
            _write_csv(slug, rows, fieldnames)
            index_entries.append(
                {
                    "chart_name": slug,
                    "source_table_or_view": f"nba_team_{slug}",
                    "grain": "one row per NBA team per season",
                    "row_count": len(rows),
                    "last_exported_at_utc": run_id,
                    "source_name": "teamrankings.com",
                    "status": "ok" if rows else "empty",
                }
            )
            time.sleep(CRAWL_DELAY)

    if not team_only:
        print("=== NBA player stat pages ===")
        for slug, path in PLAYER_PAGES.items():
            rows = scrape_player(slug, path)
            fieldnames = [
                "season", "player_id", "name", "team", "pos", "games_played",
                "stat_value", "per_game", "rank", "source_url", "ingest_run_id",
            ]
            _write_csv(slug, rows, fieldnames)
            index_entries.append(
                {
                    "chart_name": slug,
                    "source_table_or_view": f"nba_player_{slug}",
                    "grain": "one row per NBA player per season",
                    "row_count": len(rows),
                    "last_exported_at_utc": run_id,
                    "source_name": "teamrankings.com",
                    "status": "ok" if rows else "empty",
                }
            )
            time.sleep(CRAWL_DELAY)

    _write_index(index_entries)
    print("=== NBA ingestion complete ===")


if __name__ == "__main__":
    team_only = "--team" in sys.argv
    player_only = "--player" in sys.argv
    main(team_only=team_only, player_only=player_only)
