"""
NBA ESPN streaming ingestion.

Pulls live NBA data from ESPN's public API (free, no key, no rate limits) and
writes normalized gold CSVs under lake/gold/nba/ following the same manifest
pattern the NFL pond uses (_index.csv drives sourceStatus).

Sources:
  scoreboard  https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
              live games: team statistics, per-quarter linescores, player leaders,
              team records
  standings   https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings
              full season team stats by conference

Run:
    python scripts/build_nba_espn.py
"""
from __future__ import annotations

import csv
import json
import pathlib
from zoneinfo import ZoneInfo

import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "backend"))

import espn_nba

REPO = pathlib.Path(__file__).resolve().parent.parent
GOLD = REPO / "lake" / "gold" / "nba"


def _write_csv(name: str, rows: list, fieldnames: list) -> None:
    GOLD.mkdir(parents=True, exist_ok=True)
    path = GOLD / f"{name}.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})
    print("  wrote %s (%d rows)" % (path, len(rows)))


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _first(lst, default=None):
    return lst[0] if lst else default


def build():
    snap = espn_nba.build()
    run_id = snap["ingest_run_id"]
    games = snap["games"]
    conferences = snap["standings"]["conferences"]

    # ---- Team season table (from standings) ----
    team_rows = []
    for conf in conferences:
        for t in conf["teams"]:
            st = t.get("stats", {}) or {}
            team_rows.append(
                {
                    "season": 2026,
                    "conference": conf["name"],
                    "team_id": t.get("id"),
                    "location": t.get("location"),
                    "name": t.get("name"),
                    "abbreviation": t.get("abbreviation"),
                    "displayName": t.get("displayName"),
                    "logo": t.get("logo"),
                    "wins": st.get("W"),
                    "losses": st.get("L"),
                    "win_pct": st.get("LPCT"),
                    "games_back": st.get("GB"),
                    "ppg": st.get("PPG"),
                    "opp_ppg": st.get("OPP PPG"),
                    "point_diff": st.get("DIFF"),
                    "points_for": st.get("PF"),
                    "points_against": st.get("PA"),
                    "streak": st.get("STRK"),
                    "home_record": st.get("Home"),
                    "road_record": st.get("Road"),
                    "vs_division": st.get("vs. Div."),
                    "vs_conference": st.get("vs. Conf."),
                    "last_10": st.get("Last Ten Games"),
                    "playoff_seed": st.get("SEED"),
                    "league_win_pct": st.get("LPCT"),
                    "source_url": espn_nba._STANDINGS_URL,
                    "ingest_run_id": run_id,
                }
            )
    _write_csv(
        "nba_team_season",
        team_rows,
        [
            "season", "conference", "team_id", "location", "name", "abbreviation",
            "displayName", "logo", "wins", "losses", "win_pct", "games_back",
            "ppg", "opp_ppg", "point_diff", "points_for", "points_against", "streak",
            "home_record", "road_record", "vs_division", "vs_conference", "last_10",
            "playoff_seed", "league_win_pct", "source_url", "ingest_run_id",
        ],
    )

    # ---- Game live table (from scoreboard) ----
    game_rows = []
    leader_rows = []
    for g in games:
        game_rows.append(
            {
                "season": 2026,
                "game_id": g.get("gameId"),
                "uid": g.get("uid"),
                "date": g.get("date"),
                "name": g.get("name"),
                "status": g.get("status"),
                "status_description": g.get("statusDescription"),
                "period": g.get("period"),
                "clock": g.get("clock"),
                "away_team_id": g["away"]["team"]["id"],
                "away_team": g["away"]["team"]["abbreviation"],
                "away_team_name": g["away"]["team"]["displayName"],
                "away_score": g["away"]["score"],
                "away_logo": g["away"]["team"]["logo"],
                "away_record": g["away"]["records"].get("total"),
                "away_home_record": g["away"]["records"].get("Home"),
                "away_road_record": g["away"]["records"].get("Road"),
                "home_team_id": g["home"]["team"]["id"],
                "home_team": g["home"]["team"]["abbreviation"],
                "home_team_name": g["home"]["team"]["displayName"],
                "home_score": g["home"]["score"],
                "home_logo": g["home"]["team"]["logo"],
                "home_record": g["home"]["records"].get("total"),
                "home_home_record": g["home"]["records"].get("Home"),
                "home_road_record": g["home"]["records"].get("Road"),
                "venue": g.get("venue"),
                "broadcast": g.get("broadcast"),
                "start_date": g.get("startDate"),
                "away_fgm": _first([s.get("value") for s in g["away"]["statistics"].values() if s.get("abbreviation") == "FGM"]),
                "away_fga": _first([s.get("value") for s in g["away"]["statistics"].values() if s.get("abbreviation") == "FGA"]),
                "away_fg_pct": _first([s.get("value") for s in g["away"]["statistics"].values() if s.get("abbreviation") == "FG%"]),
                "away_3pm": _first([s.get("value") for s in g["away"]["statistics"].values() if s.get("abbreviation") == "3PM"]),
                "away_3pa": _first([s.get("value") for s in g["away"]["statistics"].values() if s.get("abbreviation") == "3PA"]),
                "away_3p_pct": _first([s.get("value") for s in g["away"]["statistics"].values() if s.get("abbreviation") == "3P%"]),
                "away_ftm": _first([s.get("value") for s in g["away"]["statistics"].values() if s.get("abbreviation") == "FTM"]),
                "away_fta": _first([s.get("value") for s in g["away"]["statistics"].values() if s.get("abbreviation") == "FTA"]),
                "away_ft_pct": _first([s.get("value") for s in g["away"]["statistics"].values() if s.get("abbreviation") == "FT%"]),
                "away_reb": _first([s.get("value") for s in g["away"]["statistics"].values() if s.get("abbreviation") == "REB"]),
                "away_ast": _first([s.get("value") for s in g["away"]["statistics"].values() if s.get("abbreviation") == "AST"]),
                "away_pts": _first([s.get("value") for s in g["away"]["statistics"].values() if s.get("abbreviation") == "PTS"]),
                "home_fgm": _first([s.get("value") for s in g["home"]["statistics"].values() if s.get("abbreviation") == "FGM"]),
                "home_fga": _first([s.get("value") for s in g["home"]["statistics"].values() if s.get("abbreviation") == "FGA"]),
                "home_fg_pct": _first([s.get("value") for s in g["home"]["statistics"].values() if s.get("abbreviation") == "FG%"]),
                "home_3pm": _first([s.get("value") for s in g["home"]["statistics"].values() if s.get("abbreviation") == "3PM"]),
                "home_3pa": _first([s.get("value") for s in g["home"]["statistics"].values() if s.get("abbreviation") == "3PA"]),
                "home_3p_pct": _first([s.get("value") for s in g["home"]["statistics"].values() if s.get("abbreviation") == "3P%"]),
                "home_ftm": _first([s.get("value") for s in g["home"]["statistics"].values() if s.get("abbreviation") == "FTM"]),
                "home_fta": _first([s.get("value") for s in g["home"]["statistics"].values() if s.get("abbreviation") == "FTA"]),
                "home_ft_pct": _first([s.get("value") for s in g["home"]["statistics"].values() if s.get("abbreviation") == "FT%"]),
                "home_reb": _first([s.get("value") for s in g["home"]["statistics"].values() if s.get("abbreviation") == "REB"]),
                "home_ast": _first([s.get("value") for s in g["home"]["statistics"].values() if s.get("abbreviation") == "AST"]),
                "home_pts": _first([s.get("value") for s in g["home"]["statistics"].values() if s.get("abbreviation") == "PTS"]),
                "source_url": espn_nba._SCOREBOARD_URL,
                "ingest_run_id": run_id,
            }
        )
        for l in g["away"]["leaders"] + g["home"]["leaders"]:
            leader_rows.append(
                {
                    "season": 2026,
                    "game_id": g.get("gameId"),
                    "team": g["away"]["team"]["abbreviation"] if l.get("team_id") == g["away"]["team"]["id"] else g["home"]["team"]["abbreviation"],
                    "stat": l.get("stat"),
                    "athlete_id": l.get("athlete_id"),
                    "name": l.get("name"),
                    "position": l.get("position"),
                    "value": l.get("value"),
                    "display": l.get("display"),
                    "headshot": l.get("headshot"),
                    "jersey": l.get("jersey"),
                    "source_url": espn_nba._SCOREBOARD_URL,
                    "ingest_run_id": run_id,
                }
            )
    _write_csv(
        "nba_game_live",
        game_rows,
        [
            "season", "game_id", "uid", "date", "name", "status", "status_description",
            "period", "clock",
            "away_team_id", "away_team", "away_team_name", "away_score", "away_logo",
            "away_record", "away_home_record", "away_road_record",
            "home_team_id", "home_team", "home_team_name", "home_score", "home_logo",
            "home_record", "home_home_record", "home_road_record",
            "venue", "broadcast", "start_date",
            "away_fgm", "away_fga", "away_fg_pct", "away_3pm", "away_3pa", "away_3p_pct",
            "away_ftm", "away_fta", "away_ft_pct", "away_reb", "away_ast", "away_pts",
            "home_fgm", "home_fga", "home_fg_pct", "home_3pm", "home_3pa", "home_3p_pct",
            "home_ftm", "home_fta", "home_ft_pct", "home_reb", "home_ast", "home_pts",
            "source_url", "ingest_run_id",
        ],
    )
    _write_csv(
        "nba_player_leaders",
        leader_rows,
        [
            "season", "game_id", "team", "stat", "athlete_id", "name", "position",
            "value", "display", "headshot", "jersey", "source_url", "ingest_run_id",
        ],
    )

    # ---- Manifest ----
    index_entries = [
        {
            "chart_name": "nba_team_season",
            "source_table_or_view": "nba_team_season",
            "grain": "one row per NBA team per season (ESPN standings)",
            "row_count": len(team_rows),
            "last_exported_at_utc": run_id,
            "source_name": "espn.com",
            "status": "ok" if team_rows else "empty",
        },
        {
            "chart_name": "nba_game_live",
            "source_table_or_view": "nba_game_live",
            "grain": "one row per NBA game (live scoreboard)",
            "row_count": len(game_rows),
            "last_exported_at_utc": run_id,
            "source_name": "espn.com",
            "status": "ok" if game_rows else "empty",
        },
        {
            "chart_name": "nba_player_leaders",
            "source_table_or_view": "nba_player_leaders",
            "grain": "one row per player stat leader per game (ESPN scoreboard leaders)",
            "row_count": len(leader_rows),
            "last_exported_at_utc": run_id,
            "source_name": "espn.com",
            "status": "ok" if leader_rows else "empty",
        },
    ]
    path = GOLD / "_index.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(
            fh,
            fieldnames=[
                "chart_name", "source_table_or_view", "grain", "row_count",
                "last_exported_at_utc", "source_name", "status",
            ],
        )
        w.writeheader()
        for e in index_entries:
            w.writerow(e)
    print("  wrote %s (%d entries)" % (path, len(index_entries)))
    print("NBA ESPN build complete: %d teams, %d games, %d leader rows" % (len(team_rows), len(game_rows), len(leader_rows)))


if __name__ == "__main__":
    build()
