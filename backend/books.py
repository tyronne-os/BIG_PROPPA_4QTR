"""
THE BOOKS — Big Proppa's own player-prop book, modeled on BetIQ/TeamRankings.

Endpoints:
  GET /api/books/props      — player props w/ best book price + team target rank
  GET /api/books/matchups   — week matchups w/ spread / total / moneyline
  GET /api/books/trends     — team ATS / cover trends
  GET /api/books/arbst      — arbitrage (best over vs best under across books)
  GET /api/books/watching   — watch list: 2nd/3rd-most-targeted players (Chase Brown principle)

No sportsbook subscription required. Built entirely from the free local data lake:
  lake/gold/nfl/prop_best_price.csv      best over/under price across books
  lake/gold/nfl/prop_line_rotowire.csv   per-book lines (FanDuel/DraftKings/Caesars)
  lake/gold/nfl/player_usage_by_team.csv rank_on_team (1st/2nd/3rd most targeted)
  lake/gold/nfl/schedule.csv             weekly games w/ spread, total, moneyline
  lake/gold/nfl/team_ats_current.csv     cover pct last 5 / last 10

The differentiator: every prop row carries the player's target rank on their team
(rank_on_team). A 2nd- or 3rd-most-targeted player on a high-powered offense —
like Chase Brown (rank 2) when Ja'Marr Chase draws the bracket — is the exact
edge "THE BOOKS" surfaces that raw prop sheets miss.
"""

from __future__ import annotations

import csv
import threading
from pathlib import Path
from functools import lru_cache

from fastapi import FastAPI

import data

GOLD = Path(__file__).resolve().parent.parent / "lake" / "gold" / "nfl"
_lock = threading.Lock()


def _read(name: str) -> list[dict]:
    path = GOLD / f"{name}.csv"
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


@lru_cache(maxsize=1)
def _usage_index() -> dict[str, dict]:
    """player_name (normalized) -> usage row, keyed so we can attach rank_on_team."""
    out: dict[str, dict] = {}
    for row in _read("player_usage_by_team"):
        key = data.normalize_name(row.get("player_name", ""))
        # keep the row with the best usage_index_score per player
        cur = out.get(key)
        if cur is None or float(row.get("usage_index_score") or 0) > float(
            cur.get("usage_index_score") or 0
        ):
            out[key] = row
    return out


@lru_cache(maxsize=1)
def _schedule_index() -> dict[str, dict]:
    """gsis id -> schedule row for matchup context (spread/total/ml)."""
    out: dict[str, dict] = {}
    for row in _read("schedule"):
        gsis = (row.get("gsis") or "").strip()
        if gsis:
            out[gsis] = row
    return out


@lru_cache(maxsize=1)
def _ats_index() -> dict[str, dict]:
    """team -> ATS current row (cover pct last 5/10)."""
    out: dict[str, dict] = {}
    for row in _read("team_ats_current"):
        out[(row.get("team") or "").upper()] = row
    return out


def _american_to_decimal(price):
    try:
        p = float(price)
    except (TypeError, ValueError):
        return None
    if p > 0:
        return round(1 + p / 100.0, 4)
    return round(1 - 100.0 / p, 4)


def _payout(stake: float, dec_odds: float) -> float:
    if not dec_odds:
        return 0.0
    return round(stake * dec_odds, 2)


def attach_books(app: FastAPI) -> None:

    @app.get("/api/books/props")
    def api_books_props(
        week: int | None = None,
        market: str | None = None,
        min_rank: int | None = None,
        max_rank: int | None = None,
    ):
        """
        Player props from NBA player_prop_correlation + matchup_correlation.

        Query params:
          week        — filter to props from games in this week
          market      — pts | reb | ast | any
        """
        GOLD_NBA = Path(__file__).resolve().parent.parent / "lake" / "gold" / "nba"

        def _read_nba(name: str) -> list[dict]:
            path = GOLD_NBA / f"{name}.csv"
            if not path.exists():
                return []
            with path.open(newline="", encoding="utf-8") as fh:
                return list(csv.DictReader(fh))

        props = _read_nba("nba_player_prop_correlation")
        matchups = _read_nba("nba_matchup_correlation")

        # Index matchups by game_id + team
        mu_index: dict[str, dict] = {}
        for m in matchups:
            key = (m.get("game_id"), m.get("team"))
            mu_index[key] = m

        out = []
        for r in props:
            mslug = (r.get("stat") or "").lower()
            if market and market != "any" and mslug != market.lower():
                continue

            name = r.get("name") or ""
            team = (r.get("team") or "").upper()
            game_id = r.get("game_id") or ""

            # Matchup context
            mu = mu_index.get((game_id, team)) or mu_index.get((game_id, ""))
            team_tier = "Green" if (mu and mu.get("good_vs_bad_signal", "").startswith("GOOD")) else "Crimson" if (mu and mu.get("good_vs_bad_signal", "").startswith("BAD")) else "Orange"

            # SFS Doubloon tier from confidence + team tier
            try:
                conf = float(r.get("prop_confidence") or 0)
            except (TypeError, ValueError):
                conf = 0.0

            if team_tier == "Green" and conf >= 0.85:
                doubloon = "green"
            elif team_tier == "Crimson" or conf < 0.75:
                doubloon = "crimson"
            else:
                doubloon = "orange"

            # Safe bet label
            if team_tier == "Green" and conf >= 0.85:
                safe_bet = f"OVER {r.get('line')}" if r.get("line") else "OVER"
            elif conf >= 0.50:
                safe_bet = "OVER prop"
            else:
                safe_bet = "No bet"

            # Justification (400 chars max)
            opp_def = r.get("opp_def_pts_allowed") or r.get("opp_def_reb_allowed") or r.get("opp_def_ast_allowed") or "—"
            edge = r.get("usage_matchup_edge") or "—"
            justification = (
                f"{name} ({team}) vs {r.get('opponent') or '—'}. "
                f"Season avg: {r.get('season_pts') or r.get('season_reb') or r.get('season_ast') or '—'}. "
                f"Opponent allows {opp_def} per game. Matchup edge: {edge}. "
                f"Prop confidence: {conf}. {mu.get('good_vs_bad_signal', 'N/A') if mu else 'N/A'}."
            )[:400]

            dec_over = _american_to_decimal(r.get("best_over_price") if r.get("best_over_price") else None)

            out.append({
                "player_name": name,
                "player_id": r.get("athlete_id"),
                "team": team,
                "position": r.get("position") or "",
                "market_slug": mslug,
                "market_label": mslug.upper(),
                "line": r.get("line") or "—",
                "rank_on_team": None,
                "rank_label": "",
                "best_over_price": r.get("best_over_price") or "—",
                "best_over_book": r.get("best_over_book") or "—",
                "best_over_decimal": dec_over,
                "best_over_payout_5": _payout(5, dec_over),
                "best_under_price": r.get("best_under_price") or "—",
                "best_under_book": r.get("best_under_book") or "—",
                "best_under_decimal": _american_to_decimal(r.get("best_under_price") if r.get("best_under_price") else None),
                "best_under_payout_5": _payout(5, _american_to_decimal(r.get("best_under_price") if r.get("best_under_price") else None)),
                "matchup": f"{r.get('away_team') or ''} @ {r.get('home_team') or ''}" if r.get('away_team') else f"{team} @ {r.get('opponent') or '—'}",
                "spread": None,
                "total": None,
                "cover_pct_last_5": None,
                "cover_pct_last_10": None,
                "is_second_or_third_target": False,
                "sfs_doubloon": doubloon,
                "matchup_grade": team_tier,
                "safe_bet": safe_bet,
                "justification": justification,
            })

        # Sort: Green doubloons first, then by confidence
        out.sort(key=lambda x: (x["sfs_doubloon"] != "green", -(float(x.get("prop_confidence") or 0))))
        return {
            "count": len(out),
            "props": out,
        }

    @app.get("/api/books/matchups")
    def api_books_matchups(week: int | None = None):
        """Week matchups with spread, total, moneyline — the 'Matchups' tab."""
        rows = _read("schedule")
        ats = _ats_index()
        out = []
        for r in rows:
            try:
                w = int(r.get("week") or 0)
            except (TypeError, ValueError):
                continue
            if week is not None and w != week:
                continue
            if r.get("season") != "2026":
                continue
            away = (r.get("away_team") or "").upper()
            home = (r.get("home_team") or "").upper()
            away_ats = ats.get(away, {})
            home_ats = ats.get(home, {})
            try:
                spread = float(r.get("spread_line")) if r.get("spread_line") else None
            except (TypeError, ValueError):
                spread = None
            try:
                total = float(r.get("total_line")) if r.get("total_line") else None
            except (TypeError, ValueError):
                total = None
            out.append({
                "game_id": r.get("game_id"),
                "gsis": r.get("gsis"),
                "week": w,
                "gameday": r.get("gameday"),
                "weekday": r.get("weekday"),
                "gametime": r.get("gametime"),
                "away_team": away,
                "home_team": home,
                "away_name": r.get("away_qb_name"),
                "home_name": r.get("home_qb_name"),
                "away_coach": r.get("away_coach"),
                "home_coach": r.get("home_coach"),
                "stadium": r.get("stadium"),
                "roof": r.get("roof"),
                "surface": r.get("surface"),
                "spread_line": spread,
                "away_spread_odds": r.get("away_spread_odds"),
                "home_spread_odds": r.get("home_spread_odds"),
                "total_line": total,
                "over_odds": r.get("over_odds"),
                "under_odds": r.get("under_odds"),
                "away_ml": r.get("away_moneyline"),
                "home_ml": r.get("home_moneyline"),
                "away_cover_pct_5": away_ats.get("cover_pct_last_5"),
                "home_cover_pct_5": home_ats.get("cover_pct_last_5"),
                "away_cover_pct_10": away_ats.get("cover_pct_last_10"),
                "home_cover_pct_10": home_ats.get("cover_pct_last_10"),
            })
        out.sort(key=lambda x: (x.get("gameday") or "", x.get("gametime") or ""))
        return {"count": len(out), "matchups": out}

    @app.get("/api/books/trends")
    def api_books_trends():
        """Team ATS / cover trends — the 'Trends' tab."""
        rows = _read("team_ats_current")
        out = []
        for r in rows:
            out.append({
                "team": r.get("team"),
                "games_played": r.get("games_played_this_season"),
                "covers_last_5": r.get("covers_last_5"),
                "games_last_5": r.get("games_last_5"),
                "cover_pct_last_5": r.get("cover_pct_last_5"),
                "covers_last_10": r.get("covers_last_10"),
                "games_last_10": r.get("games_last_10"),
                "cover_pct_last_10": r.get("cover_pct_last_10"),
            })
        out.sort(key=lambda x: float(x["cover_pct_last_5"] or -1), reverse=True)
        return {"count": len(out), "trends": out}

    @app.get("/api/books/arbst")
    def api_books_arbst():
        """
        Arbitrage: best OVER price vs best UNDER price across books for the same
        player/market. If best_over_decimal * best_under_decimal < 1.0 (after vig),
        there's a middle. We show the widest gap.
        """
        rows = _read("prop_best_price")
        best: dict[tuple[str, str], dict] = {}
        for r in rows:
            key = ((r.get("player_name") or "").strip().lower(), (r.get("market_slug") or "").lower())
            cur = best.get(key)
            if cur is None:
                best[key] = r
                continue
            # keep row with better over price
            try:
                if float(r.get("best_over_price") or -999) > float(cur.get("best_over_price") or -999):
                    best[key] = r
            except (TypeError, ValueError):
                pass
        out = []
        for (name, mslug), r in best.items():
            over_dec = _american_to_decimal(r.get("best_over_price"))
            under_dec = _american_to_decimal(r.get("best_under_price"))
            if not over_dec or not under_dec:
                continue
            # combined implied prob = 1/over + 1/under; < 1 means arb/middle
            impl = (1 / over_dec) + (1 / under_dec)
            edge = round((1 - impl) * 100, 2)
            out.append({
                "player_name": r.get("player_name"),
                "team": (r.get("team") or "").upper(),
                "market_slug": mslug,
                "market_label": data.PROP_LABELS.get(mslug, mslug.upper()),
                "line": r.get("line"),
                "best_over_price": r.get("best_over_price"),
                "best_over_book": r.get("best_over_book"),
                "best_over_decimal": over_dec,
                "best_under_price": r.get("best_under_price"),
                "best_under_book": r.get("best_under_book"),
                "best_under_decimal": under_dec,
                "combined_implied_pct": round(impl * 100, 2),
                "arb_edge_pct": edge,
                "is_arb": edge > 0,
            })
        out.sort(key=lambda x: -(x["arb_edge_pct"] or 0))
        return {"count": len(out), "arbs": out}

    @app.get("/api/books/watching")
    def api_books_watching():
        """
        Watch list: 2nd and 3rd most targeted players on each team — the Chase
        Brown principle. When WR1 draws the bracket, the defense leaves the box
        open and the #2/#3 target becomes the release valve.
        """
        rows = _read("prop_best_price")
        usage = _usage_index()
        out = []
        seen = set()
        for r in rows:
            name = r.get("player_name") or ""
            key = data.normalize_name(name)
            if key in seen:
                continue
            u = usage.get(key)
            rank = int(u.get("rank_on_team")) if u and u.get("rank_on_team") else None
            if rank not in (2, 3):
                continue
            seen.add(key)
            team = (r.get("team") or "").upper()
            line = r.get("line")
            over_price = r.get("best_over_price")
            dec_over = _american_to_decimal(over_price)
            out.append({
                "player_name": name,
                "team": team,
                "position": (u.get("position") if u else "") or "",
                "rank_on_team": rank,
                "rank_label": "2nd most targeted" if rank == 2 else "3rd most targeted",
                "usage_index_score": u.get("usage_index_score") if u else "",
                "usage_role": u.get("usage_role") if u else "",
                "market_slug": (r.get("market_slug") or "").lower(),
                "market_label": data.PROP_LABELS.get((r.get("market_slug") or "").lower(), ""),
                "line": line,
                "best_over_price": over_price,
                "best_over_book": r.get("best_over_book"),
                "best_over_decimal": dec_over,
                "best_over_payout_5": _payout(5, dec_over),
            })
        out.sort(key=lambda x: -(x["best_over_payout_5"] or 0))
        return {"count": len(out), "watching": out}


def _player_doubloon_tier(rank: int | None, cover_pct_5: str | None) -> str:
    """SFS Doubloon tier for a player based on team cover pct and target rank."""
    try:
        cp = float(cover_pct_5) if cover_pct_5 else 50.0
    except (TypeError, ValueError):
        cp = 50.0
    # Green = execute: good team cover pct + good rank
    if cp >= 60 and rank in (1, 2, 3):
        return "green"
    # Crimson = lockout: bad team cover pct or terrible rank
    if cp < 40 or rank is None:
        return "crimson"
    return "orange"


def _matchup_grade(cover_pct_5: str | None, spread: float | None) -> str:
    """Matchup grade A+ through F based on team cover pct and spread."""
    try:
        cp = float(cover_pct_5) if cover_pct_5 else 50.0
    except (TypeError, ValueError):
        cp = 50.0
    if cp >= 70:
        return "A+"
    if cp >= 60:
        return "A"
    if cp >= 55:
        return "B+"
    if cp >= 50:
        return "B"
    if cp >= 45:
        return "C+"
    if cp >= 40:
        return "C"
    return "D"


def _safe_bet_label(rank: int | None, cover_pct_5: str | None) -> str:
    """Safe bet text for the SFS safe bet column."""
    try:
        cp = float(cover_pct_5) if cover_pct_5 else 50.0
    except (TypeError, ValueError):
        cp = 50.0
    if cp >= 60 and rank in (1, 2):
        return "Anytime TD"
    if cp >= 60:
        return "OVER prop"
    if cp >= 50:
        return "Under prop"
    return "No bet"


def _player_justification(name: str, team: str, mslug: str, rank: int | None,
                          cover_pct_5: str | None, spread: float | None) -> str:
    """400-char justification for the prediction."""
    rank_txt = f"#{rank} most targeted on {team}" if rank else f"unranked on {team}"
    try:
        cp = float(cover_pct_5) if cover_pct_5 else 50.0
    except (TypeError, ValueError):
        cp = 50.0
    tier_txt = (
        "Green Doubloon (Execute)" if cp >= 60 and rank in (1, 2, 3)
        else "Crimson Doubloon (Lockout)" if cp < 40 or rank is None
        else "Orange Doubloon (Pivot)"
    )
    spread_txt = f", spread {spread}" if spread is not None else ""
    return (
        f"{name} ({rank_txt}). Team cover pct last 5: {cp}%. "
        f"SFS tier: {tier_txt}. Market: {mslug}. "
        f"Matchup analysis indicates {'favorable' if cp >= 60 else 'challenging'} conditions "
        f"{spread_txt}. Only bet if player is healthy and active at game time."
    )
