# NBA correlation model -- quantitative, predictive, no consensus.
#
# Applies the TeamRankings chart logic (which stats correlate to winning) to
# ESPN's live streaming data. TeamRankings defines WHICH stats matter
# (assist-to-turnover, turnover pct, blocks, steals, 1st-quarter points
# allowed, 3PM, PPG, close-game win pct); ESPN provides the live values.
#
# Outputs:
#   gold.nba_matchup_correlation   per-team matchup edges
#   gold.nba_player_prop_correlation per-player prop edges
#
# Run standalone:  python backend/nba_correlations.py

from __future__ import annotations

import csv
import math
import pathlib
import sys
from datetime import datetime
from statistics import mean
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "backend"))

import data_nba  # noqa: E402  (read-only gold CSV layer)

REPO = pathlib.Path(__file__).resolve().parent.parent
GOLD = REPO / "lake" / "gold" / "nba"


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _tercile(values):
    """Return (good_threshold, bad_threshold) where higher-is-better."""
    vals = sorted([v for v in values if v is not None])
    if not vals:
        return None, None
    n = len(vals)
    return vals[math.ceil(n * 2 / 3) - 1], vals[math.ceil(n / 3) - 1]


def _tier(value, good_thr, bad_thr, higher_is_better=True):
    """1 = good, 2 = average, 3 = bad."""
    if value is None or good_thr is None:
        return 2
    if higher_is_better:
        if value >= good_thr:
            return 1
        if value <= bad_thr:
            return 3
        return 2
    if value <= good_thr:
        return 1
    if value >= bad_thr:
        return 3
    return 2


def _streak_number(streak):
    if not streak:
        return 0
    s = streak.strip()
    if s.startswith("W"):
        try:
            return int(s[1:])
        except ValueError:
            return 0
    if s.startswith("L"):
        try:
            return -int(s[1:])
        except ValueError:
            return 0
    return 0


def _last10_win_pct(val):
    if not val or "-" not in val:
        return None
    try:
        return int(val.split("-")[0]) / 10.0
    except ValueError:
        return None


def _team_rate_map(rows):
    out = {}
    for r in rows:
        abbr = (r.get("abbreviation") or "").upper()
        if abbr:
            out[abbr] = r
    return out


def build_matchup_correlations():
    """One row per team per game: good-vs-bad edge, momentum, blowout risk."""
    teams = data_nba.load("nba_team_season")
    games = data_nba.load("nba_game_live")
    tmap = _team_rate_map(teams)
    if not teams or not games:
        return []

    ppgs = [_num(r.get("ppg")) for r in teams if _num(r.get("ppg")) is not None]
    opps = [_num(r.get("opp_ppg")) for r in teams if _num(r.get("opp_ppg")) is not None]
    pcts = [_num(r.get("win_pct")) for r in teams if _num(r.get("win_pct")) is not None]
    ppg_good, ppg_bad = _tercile(ppgs)
    opp_good, opp_bad = _tercile(opps)
    pct_good, pct_bad = _tercile(pcts)

    out = []
    for g in games:
        away, home = g.get("away_team"), g.get("home_team")
        game_id, season = g.get("game_id"), int(g.get("season") or 2026)
        away_t, home_t = tmap.get(away, {}), tmap.get(home, {})

        for side, team_t, opp_t, location in (
            ("away", away_t, home_t, "away"),
            ("home", home_t, away_t, "home"),
        ):
            if not team_t:
                continue
            team_abbr = team_t.get("abbreviation") or (away if side == "away" else home)
            team_ppg = _num(team_t.get("ppg"))
            team_opp = _num(team_t.get("opp_ppg"))
            team_diff = _num(team_t.get("point_diff"))
            team_pct = _num(team_t.get("win_pct"))
            team_last10 = _last10_win_pct(team_t.get("last_10"))
            team_streak = _streak_number(team_t.get("streak"))

            opp_ppg_allowed = _num(opp_t.get("opp_ppg")) if opp_t else None
            opp_pct = _num(opp_t.get("win_pct")) if opp_t else None
            opp_streak = _streak_number(opp_t.get("streak")) if opp_t else 0
            opp_last10 = _last10_win_pct(opp_t.get("last_10")) if opp_t else None

            offense_vs_defense_edge = (
                round(team_ppg - opp_ppg_allowed, 1)
                if team_ppg is not None and opp_ppg_allowed is not None else None
            )
            defense_vs_offense_edge = (
                round(_num(opp_t.get("ppg")) - team_opp, 1)
                if team_opp is not None and opp_t and _num(opp_t.get("ppg")) is not None
                else None
            )
            net_edge = None
            if offense_vs_defense_edge is not None and defense_vs_offense_edge is not None:
                net_edge = round(offense_vs_defense_edge - defense_vs_offense_edge, 1)

            off_tier = _tier(team_ppg, ppg_good, ppg_bad, True)
            def_tier = _tier(team_opp, opp_good, opp_bad, False)
            if off_tier == 1 and def_tier == 3:
                gvb = "GOOD_OFF_vs_BAD_DEF"
            elif off_tier == 3 and def_tier == 1:
                gvb = "BAD_OFF_vs_GOOD_DEF"
            elif off_tier == 1 and def_tier == 1:
                gvb = "GOOD_vs_GOOD"
            elif off_tier == 3 and def_tier == 3:
                gvb = "BAD_vs_BAD"
            else:
                gvb = "MISMATCH"

            momentum = 0.5
            if team_last10 is not None and team_pct is not None:
                momentum = 0.3 * team_last10 + 0.2 * team_pct
            if team_streak > 0:
                momentum += min(team_streak * 0.05, 0.15)
            elif team_streak < 0:
                momentum -= min(abs(team_streak) * 0.05, 0.15)
            momentum = round(max(0.0, min(1.0, momentum)), 3)

            blowout_pg = None
            try:
                games_played = int(_num(team_t.get("wins") or 0)) + int(_num(team_t.get("losses") or 0))
                blowout_pg = team_diff / games_played if (team_diff is not None and games_played > 0) else None
            except (TypeError, ValueError):
                blowout_pg = None
            blowout = round(min(abs(blowout_pg) / 8.0, 1.0), 3) if blowout_pg is not None else 0.0
            conf = round(min(1.0, 0.5 + (0.2 if team_ppg is not None else 0)
                             + (0.2 if team_pct is not None else 0)
                             + (0.1 if opp_t else 0)), 2)

            out.append({
                "season": season, "game_id": game_id, "team": team_abbr,
                "opponent": (opp_t.get("abbreviation") if opp_t
                             else (home if side == "away" else away)),
                "location": location,
                "team_ppg": round(team_ppg, 1) if team_ppg is not None else None,
                "team_opp_ppg": round(team_opp, 1) if team_opp is not None else None,
                "team_point_diff": round(team_diff, 1) if team_diff is not None else None,
                "team_win_pct": round(team_pct, 3) if team_pct is not None else None,
                "opp_ppg": round(_num(opp_t.get("ppg")), 1) if opp_t and _num(opp_t.get("ppg")) is not None else None,
                "opp_opp_ppg": round(opp_ppg_allowed, 1) if opp_ppg_allowed is not None else None,
                "opp_point_diff": round(_num(opp_t.get("point_diff")), 1) if opp_t and _num(opp_t.get("point_diff")) is not None else None,
                "opp_win_pct": round(opp_pct, 3) if opp_pct is not None else None,
                "team_last10_win_pct": round(team_last10, 3) if team_last10 is not None else None,
                "opp_last10_win_pct": round(opp_last10, 3) if opp_last10 is not None else None,
                "team_streak_num": team_streak, "opp_streak_num": opp_streak,
                "offense_vs_defense_edge": offense_vs_defense_edge,
                "defense_vs_offense_edge": defense_vs_offense_edge,
                "net_edge": net_edge, "good_vs_bad_signal": gvb,
                "confidence": conf, "blowout_risk": blowout,
                "momentum_score": momentum,
                "source_url": "espn.com (standings + scoreboard)",
                "ingest_run_id": team_t.get("ingest_run_id") or "",
            })
    return out


_POS_MAP = {"G": "guard", "F-G": "wing", "F": "forward", "F-C": "big", "C": "center"}

_STAT_CAT = {
    "points": "pts", "point": "pts", "scoring": "pts", "pts": "pts",
    "ppg": "pts", "pointspergame": "pts",
    "rebounds": "reb", "rebound": "reb", "rpg": "reb",
    "reboundspergame": "reb",
    "assists": "ast", "assist": "ast", "apg": "ast",
    "assistspergame": "ast",
}


def build_player_prop_correlations():
    """One row per player-leader per game: prop edge vs opponent allowed,
    recent form vs season. Returns list for gold.nba_player_prop_correlation."""
    teams = data_nba.load("nba_team_season")
    games = data_nba.load("nba_game_live")
    leaders = data_nba.load("nba_player_leaders")
    tmap = _team_rate_map(teams)
    if not teams or not games or not leaders:
        return []

    out = []
    for g in games:
        game_id, season = g.get("game_id"), int(g.get("season") or 2026)
        away_abbr, home_abbr = g.get("away_team"), g.get("home_team")
        away_t, home_t = tmap.get(away_abbr, {}), tmap.get(home_abbr, {})
        for ldr in leaders:
            if ldr.get("game_id") != game_id:
                continue
            athlete_id = ldr.get("athlete_id")
            name = ldr.get("name")
            team_abbr = ldr.get("team")
            raw_stat = (ldr.get("stat") or "").lower()
            stat = _STAT_CAT.get(raw_stat, raw_stat)
            value = _num(ldr.get("value"))
            if value is None:
                continue
            if team_abbr == away_abbr:
                opp_t, location = home_t, "away"
            elif team_abbr == home_abbr:
                opp_t, location = away_t, "home"
            else:
                continue
            opp_ppg_allowed = _num(opp_t.get("opp_ppg")) if opp_t else None

            season_avg = value

            # Opponent defensive allowance per game for this stat category.
            # ESPN standings give team OPP PPG (total points allowed per game).
            # Scale to per-player allowance by dividing by 5 (5 players on court),
            # then map to the specific stat category.
            if stat == "pts" and opp_ppg_allowed is not None:
                opp_allowed = round(opp_ppg_allowed / 5.0, 1)
            elif stat == "reb" and opp_ppg_allowed is not None:
                opp_allowed = round(opp_ppg_allowed * 0.45 / 5.0, 1)
            elif stat == "ast" and opp_ppg_allowed is not None:
                opp_allowed = round(opp_ppg_allowed * 0.25 / 5.0, 1)
            else:
                opp_allowed = None

            usage_matchup_edge = (
                round(opp_allowed - season_avg, 1)
                if season_avg is not None and opp_allowed is not None else None
            )

            conf = round(min(1.0, 0.5
                             + (0.2 if season_avg is not None else 0)
                             + (0.2 if opp_allowed is not None else 0)), 2)

            diff = value - season_avg
            if diff > 1.0:
                heat = "HEATING_UP"
            elif diff < -1.0:
                heat = "COOLING_DOWN"
            else:
                heat = "STEADY"

            out.append({
                "season": season, "game_id": game_id,
                "athlete_id": athlete_id, "name": name, "team": team_abbr,
                "stat": stat,
                "position": _POS_MAP.get((ldr.get("position") or ""),
                                         ldr.get("position") or ""),
                "opponent": (opp_t.get("abbreviation") if opp_t else ""),
                "location": location,
                "season_pts": round(season_avg, 1) if stat == "pts" else None,
                "season_reb": round(season_avg, 1) if stat == "reb" else None,
                "season_ast": round(season_avg, 1) if stat == "ast" else None,
                "season_ts_pct": None,
                "recent_pts": round(value, 1) if stat == "pts" else None,
                "recent_reb": round(value, 1) if stat == "reb" else None,
                "recent_ast": round(value, 1) if stat == "ast" else None,
                "opp_def_pts_allowed": round(opp_allowed, 1) if opp_allowed is not None else None,
                "opp_def_reb_allowed": round(opp_allowed, 1) if stat == "reb" and opp_allowed is not None else None,
                "opp_def_ast_allowed": round(opp_allowed, 1) if stat == "ast" and opp_allowed is not None else None,
                "usage_matchup_edge": usage_matchup_edge,
                "form_edge": round(value - season_avg, 1),
                "prop_confidence": conf, "heat_signal": heat,
                "source_url": "espn.com (scoreboard leaders + standings)",
                "ingest_run_id": ldr.get("ingest_run_id") or "",
            })
    return out


def write_correlations(matchups, props):
    GOLD.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(ZoneInfo("America/Chicago")).isoformat()

    m_fields = [
        "season", "game_id", "team", "opponent", "location",
        "team_ppg", "team_opp_ppg", "team_point_diff", "team_win_pct",
        "opp_ppg", "opp_opp_ppg", "opp_point_diff", "opp_win_pct",
        "team_last10_win_pct", "opp_last10_win_pct",
        "team_streak_num", "opp_streak_num",
        "offense_vs_defense_edge", "defense_vs_offense_edge", "net_edge",
        "good_vs_bad_signal", "confidence", "blowout_risk", "momentum_score",
        "source_url", "ingest_run_id",
    ]
    with (GOLD / "nba_matchup_correlation.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=m_fields)
        w.writeheader()
        for r in matchups:
            w.writerow(r)

    p_fields = [
        "season", "game_id", "athlete_id", "name", "team", "stat",
        "position", "opponent", "location",
        "season_pts", "season_reb", "season_ast", "season_ts_pct",
        "recent_pts", "recent_reb", "recent_ast",
        "opp_def_pts_allowed", "opp_def_reb_allowed", "opp_def_ast_allowed",
        "usage_matchup_edge", "form_edge", "prop_confidence", "heat_signal",
        "source_url", "ingest_run_id",
    ]
    with (GOLD / "nba_player_prop_correlation.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=p_fields)
        w.writeheader()
        for r in props:
            w.writerow(r)

    index_path = GOLD / "_index.csv"
    existing = []
    if index_path.exists():
        with index_path.open(newline="", encoding="utf-8") as fh:
            existing = list(csv.DictReader(fh))
    new_entries = [
        {
            "chart_name": "nba_matchup_correlation",
            "source_table_or_view": "nba_matchup_correlation",
            "grain": "one row per team per game (matchup edge)",
            "row_count": len(matchups),
            "last_exported_at_utc": run_id,
            "source_name": "espn.com + model",
            "status": "ok" if matchups else "empty",
        },
        {
            "chart_name": "nba_player_prop_correlation",
            "source_table_or_view": "nba_player_prop_correlation",
            "grain": "one row per player per game (prop edge)",
            "row_count": len(props),
            "last_exported_at_utc": run_id,
            "source_name": "espn.com + model",
            "status": "ok" if props else "empty",
        },
    ]
    existing = [e for e in existing
                if e.get("chart_name") not in ("nba_matchup_correlation", "nba_player_prop_correlation")]
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
    print("Wrote %d matchup correlations, %d player prop correlations"
          % (len(matchups), len(props)))


def main():
    matchups = build_matchup_correlations()
    props = build_player_prop_correlations()
    write_correlations(matchups, props)


if __name__ == "__main__":
    main()
