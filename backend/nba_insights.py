# NBA insight/nugget generation engine.
#
# Reads the correlation tables (gold.nba_matchup_correlation,
# gold.nba_player_prop_correlation) and produces human-readable insight nuggets
# with quantitative confidence scores. One nugget per insight type per game,
# plus a curated "top nugget" per game (highest confidence).
#
# Run standalone:
#     python backend/nba_insights.py

from __future__ import annotations

import csv
import pathlib
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "backend"))

import data_nba  # noqa: E402

REPO = pathlib.Path(__file__).resolve().parent.parent
GOLD = REPO / "lake" / "gold" / "nba"


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _now():
    return datetime.now(ZoneInfo("America/Chicago")).isoformat()


def _team_name(tmap, abbr):
    if not abbr:
        return abbr
    return tmap.get(abbr, {}).get("name", abbr)


def generate_insights():
    """Build insight nuggets from the correlation tables."""
    matchups = data_nba.load("nba_matchup_correlation")
    props = data_nba.load("nba_player_prop_correlation")
    teams = data_nba.load("nba_team_season")
    tmap = {r.get("abbreviation", "").upper(): r for r in teams if r.get("abbreviation")}

    nuggets = []

    # Group matchups by game
    games = {}
    for m in matchups:
        gid = m.get("game_id")
        if gid not in games:
            games[gid] = {"away": None, "home": None}
        side = m.get("location")
        if side in games[gid]:
            games[gid][side] = m

    # ---- Team-level nuggets ----
    for gid, sides in games.items():
        away = sides.get("away")
        home = sides.get("home")
        if not away or not home:
            continue
        season = int(away.get("season") or 2026)

        away_name = _team_name(tmap, away.get("opponent") or away.get("team"))
        home_name = _team_name(tmap, home.get("opponent") or home.get("team"))

        # Good vs bad team nugget
        away_net = _num(away.get("net_edge"))
        home_net = _num(home.get("net_edge"))
        away_conf = _num(away.get("confidence"))
        home_conf = _num(home.get("confidence"))
        if away_net is not None and home_net is not None:
            better = away if away_net > home_net else home
            worse = home if away_net > home_net else away
            diff = round(abs(away_net - home_net), 1)
            if diff >= 5.0:
                nugget = {
                    "season": season,
                    "game_id": gid,
                    "insight_kind": "GOOD_VS_BAD_TEAM",
                    "title": better["team"] + " has the edge vs " + worse["team"],
                    "body": (
                        better["team"] + " projects " + str(diff) +
                        " pts better per game vs " + worse["team"] +
                        "'s defense (" + str(better.get("offense_vs_defense_edge")) +
                        " offense vs defense edge). " + better["team"] +
                        " is the " +
                        ("home" if better.get("location") == "home" else "away") + " team."
                    ),
                    "confidence": round(min((_num(better.get("confidence")) or 0.5) + 0.1, 1.0), 2),
                    "teams": better["team"] + "," + worse["team"],
                    "players": "",
                    "edge_value": diff,
                    "edge_label": str(diff) + " pts/game edge",
                    "source_table": "nba_matchup_correlation",
                    "source_row_id": better.get("team") or "",
                    "created_at": _now(),
                }
                nuggets.append(nugget)

        # Blowout risk nugget
        for side_key, side_m in (("away", away), ("home", home)):
            blowout = _num(side_m.get("blowout_risk"))
            if blowout and blowout >= 0.7:
                team_name = _team_name(tmap, side_m.get("team"))
                # Per-game differential for display (ppg - opp_ppg)
                pg_diff = None
                team_ppg = _num(side_m.get("team_ppg"))
                team_opp_ppg = _num(side_m.get("team_opp_ppg"))
                if team_ppg is not None and team_opp_ppg is not None:
                    pg_diff = round(team_ppg - team_opp_ppg, 1)
                nugget = {
                    "season": season,
                    "game_id": gid,
                    "insight_kind": "BLOWOUT_RISK",
                    "title": team_name + " blowout risk",
                    "body": (
                        team_name + " has a " + str(int(blowout * 100)) +
                        "% blowout-risk score (" + str(pg_diff if pg_diff is not None else "—") +
                        " pt differential per game). Expect a double-digit lead if this trend holds."
                    ),
                    "confidence": round(min(_num(side_m.get("confidence")) or 0.5, 1.0), 2),
                    "teams": side_m.get("team") or "",
                    "players": "",
                    "edge_value": blowout,
                    "edge_label": str(int(blowout * 100)) + "% blowout risk",
                    "source_table": "nba_matchup_correlation",
                    "source_row_id": side_m.get("team") + "_blowout",
                    "created_at": _now(),
                }
                nuggets.append(nugget)

        # Momentum swing nugget
        for side_key, side_m in (("away", away), ("home", home)):
            mom = _num(side_m.get("momentum_score"))
            streak = side_m.get("team_streak_num")
            if mom and mom >= 0.7 and streak and streak > 0:
                team_name = _team_name(tmap, side_m.get("team"))
                nugget = {
                    "season": season,
                    "game_id": gid,
                    "insight_kind": "MOMENTUM_SWING",
                    "title": team_name + " riding momentum",
                    "body": (
                        team_name + " is on a " + str(streak) +
                        "-game win streak with a " + str(int(mom * 100)) +
                        "% momentum score — riding hot form into this matchup."
                    ),
                    "confidence": round(min(_num(side_m.get("confidence")) or 0.5, 1.0), 2),
                    "teams": side_m.get("team") or "",
                    "players": "",
                    "edge_value": mom,
                    "edge_label": str(int(mom * 100)) + "% momentum",
                    "source_table": "nba_matchup_correlation",
                    "source_row_id": side_m.get("team") + "_momentum",
                    "created_at": _now(),
                }
                nuggets.append(nugget)

    # ---- Player prop nuggets ----
    prop_games = {}
    for p in props:
        gid = p.get("game_id")
        if gid not in prop_games:
            prop_games[gid] = []
        prop_games[gid].append(p)

    for gid, plist in prop_games.items():
        plist_sorted = sorted(
            [p for p in plist if p.get("usage_matchup_edge") is not None],
            key=lambda p: float(p.get("usage_matchup_edge") or 0),
            reverse=True,
        )
        for p in plist_sorted[:3]:
            edge = float(p.get("usage_matchup_edge") or 0)
            if abs(edge) < 1.0:
                continue
            conf = float(p.get("prop_confidence") or 0)
            if conf < 0.7:
                continue
            stat_label = {"pts": "points", "reb": "rebounds", "ast": "assists"}.get(p.get("stat"), p.get("stat"))
            nugget = {
                "season": int(p.get("season") or 2026),
                "game_id": gid,
                "insight_kind": "PLAYER_PROP_EDGE",
                "title": p["name"] + " " + stat_label + " vs " + p["opponent"],
                "body": (
                    p["name"] + " averages " +
                    str(p.get("season_pts") or p.get("season_reb") or p.get("season_ast")) +
                    " " + stat_label + " per game. " +
                    p["opponent"] + " allows " +
                    str(p.get("opp_def_pts_allowed") or p.get("opp_def_reb_allowed") or p.get("opp_def_ast_allowed")) +
                    " per player — a " +
                    ("+" if edge > 0 else "") + str(edge) +
                    " " + ("favorable" if edge > 0 else "tough") + " matchup."
                ),
                "confidence": round(conf, 2),
                "teams": p.get("team") or "",
                "players": p.get("name") or "",
                "edge_value": edge,
                "edge_label": ("+" if edge > 0 else "") + str(edge) + " vs opp",
                "source_table": "nba_player_prop_correlation",
                "source_row_id": p.get("athlete_id") + "_" + gid,
                "created_at": _now(),
            }
            nuggets.append(nugget)

    # ---- Heat nuggets ----
    for gid, plist in prop_games.items():
        hot = [p for p in plist if p.get("heat_signal") == "HEATING_UP"]
        for p in hot[:2]:
            nugget = {
                "season": int(p.get("season") or 2026),
                "game_id": gid,
                "insight_kind": "PLAYER_HEAT",
                "title": p["name"] + " heating up",
                "body": (
                    p["name"] + " is trending up — recent form above season average (" +
                    ("+" if float(p.get("form_edge") or 0) > 0 else "") +
                    str(p.get("form_edge") or 0) + " " + p.get("stat") +
                    "). Ride the momentum."
                ),
                "confidence": round(min(float(p.get("prop_confidence") or 0.5) + 0.05, 1.0), 2),
                "teams": p.get("team") or "",
                "players": p.get("name") or "",
                "edge_value": float(p.get("form_edge") or 0),
                "edge_label": ("+" if float(p.get("form_edge") or 0) > 0 else "") + str(p.get("form_edge")) + " form",
                "source_table": "nba_player_prop_correlation",
                "source_row_id": p.get("athlete_id") + "_" + gid + "_heat",
                "created_at": _now(),
            }
            nuggets.append(nugget)

    return nuggets


def write_insights(nuggets):
    """Write nuggets to gold CSVs + update _index.csv manifest."""
    GOLD.mkdir(parents=True, exist_ok=True)

    n_fields = [
        "season", "game_id", "insight_kind", "title", "body", "confidence",
        "teams", "players", "edge_value", "edge_label", "source_table",
        "source_row_id", "created_at",
    ]
    with (GOLD / "nba_insight_nugget.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=n_fields)
        w.writeheader()
        for n in nuggets:
            w.writerow(n)

    by_game = {}
    for n in nuggets:
        gid = n.get("game_id")
        if gid not in by_game or float(n.get("confidence") or 0) > float(
            by_game[gid].get("confidence") or 0
        ):
            by_game[gid] = n

    t_fields = ["season", "game_id", "insight_kind", "title", "body", "confidence", "edge_value", "edge_label"]
    with (GOLD / "nba_game_top_nugget.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=t_fields)
        w.writeheader()
        for gid, n in sorted(by_game.items()):
            w.writerow({k: n.get(k) for k in t_fields})

    index_path = GOLD / "_index.csv"
    existing = []
    if index_path.exists():
        with index_path.open(newline="", encoding="utf-8") as fh:
            existing = list(csv.DictReader(fh))
    new_entries = [
        {
            "chart_name": "nba_insight_nugget",
            "source_table_or_view": "nba_insight_nugget",
            "grain": "one row per insight per game",
            "row_count": len(nuggets),
            "last_exported_at_utc": _now(),
            "source_name": "espn.com + model",
            "status": "ok" if nuggets else "empty",
        },
        {
            "chart_name": "nba_game_top_nugget",
            "source_table_or_view": "nba_game_top_nugget",
            "grain": "one row per game (highest confidence insight)",
            "row_count": len(by_game),
            "last_exported_at_utc": _now(),
            "source_name": "espn.com + model",
            "status": "ok" if by_game else "empty",
        },
    ]
    existing = [e for e in existing if e.get("chart_name") not in ("nba_insight_nugget", "nba_game_top_nugget")]
    existing.extend(new_entries)
    with index_path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(
            fh,
            fieldnames=["chart_name", "source_table_or_view", "grain", "row_count",
                        "last_exported_at_utc", "source_name", "status"],
        )
        w.writeheader()
        for e in existing:
            w.writerow(e)
    print("Wrote %d insights, %d top nuggets" % (len(nuggets), len(by_game)))


def main():
    nuggets = generate_insights()
    write_insights(nuggets)


if __name__ == "__main__":
    main()
