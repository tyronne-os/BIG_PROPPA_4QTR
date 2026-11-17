"""
SFS DATE-AWARE MATCHUP LAKE — "what's on today, in CST"

Single source of truth for today's matchups across NBA, NFL (Thu–Mon week),
and College Football Top 25 only. Designed from the TeamRankings schedule
context (teamrankings.com/{league}/schedules) but powered by ESPN's free
public API — no scraping dependency, no rate limits, live every render.

Every endpoint defaults to today's date in America/Chicago and only returns
games whose kickoff is today. This prevents the date-drift bug that posted
yesterday's NFL players on today's Monday Night card.

Data contract (per game):
{
  "league": "nba" | "nfl" | "cfb",
  "game_id": str,
  "date": "YYYY-MM-DD",        # CST date
  "start_cst": "HH:MM",        # CST kickoff
  "away": str, "home": str,    # abbreviations
  "away_name": str, "home_name": str,
  "status": "PRE" | "LIVE" | "FINAL" | ...
  "clock": str, "period": int,
  "spread": float|None, "total": float|None,
  "ml_home": float|None, "ml_away": float|None,
  "away_rank": int|None, "home_rank": int|None,   # CFB Top 25 rank
  "venue": str|None,
  "top25": bool                  # CFB: is either team Top 25?
}
"""

from __future__ import annotations

import json
import threading
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import FastAPI

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
CHI = ZoneInfo("America/Chicago")

_SITE = "https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard"
_CFB_TOP25_URL = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=400"

_cache: dict[str, tuple[float, object]] = {}
_lock = threading.Lock()


def _fetch(url: str, ttl: int = 45):
    with _lock:
        entry = _cache.get(url)
        if entry and entry[0] > __import__("time").time():
            return entry[1]
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=20) as r:
            body = json.loads(r.read())
        with _lock:
            _cache[url] = (__import__("time").time() + ttl, body)
        return body
    except Exception:
        return None


def _today_cst() -> str:
    return datetime.now(CHI).strftime("%Y-%m-%d")


def _norm_status(st: dict) -> tuple[str, int, str]:
    t = st.get("type") or {}
    name = (t.get("name") or "").upper()
    desc = (t.get("description") or "").upper()
    period = int(st.get("period") or 0)
    clock = str(st.get("displayClock") or "")
    if "FINAL" in name:
        return "FINAL", period, clock
    if "HALFTIME" in name or "HALFTIME" in desc:
        return "HALFTIME", 2, clock
    if "IN_PROGRESS" in name or "LIVE" in name:
        return ("OT" if period >= 5 else "LIVE"), period, clock
    return "PRE", period, clock


def _odds_of(comp: dict) -> dict:
    """Pull spread/total/moneyline from ESPN odds details."""
    out = {"spread": None, "total": None, "ml_home": None, "ml_away": None}
    for od in (comp.get("odds") or []):
        details = od.get("details") or {}
        if od.get("provider") and "spread" in str(od).lower():
            out["spread"] = details.get("spread")
        if od.get("provider") and "overunder" in str(od).lower():
            out["total"] = details.get("overUnder")
    return out


def _game_row(ev: dict, league: str, target_date: str) -> dict | None:
    comp = (ev.get("competitions") or [ev])[0]
    status, period, clock = _norm_status(comp.get("status") or ev.get("status") or {})
    cs = comp.get("competitors", [])
    away = next((c for c in cs if c.get("homeAway") == "away"), {})
    home = next((c for c in cs if c.get("homeAway") == "home"), {})

    def side(c):
        t = c.get("team") or {}
        recs = c.get("records") or []
        rec_map = {r.get("name", "").lower(): r.get("summary", "") for r in recs}
        return {
            "id": t.get("id"),
            "uid": t.get("uid"),
            "location": t.get("location"),
            "name": t.get("name"),
            "abbr": t.get("abbreviation"),
            "displayName": t.get("displayName"),
            "logo": (t.get("logos") or [{}])[0].get("href") if t.get("logos") else None,
            "record": rec_map,
            "score": c.get("score"),
        }

    a, h = side(away), side(home)
    start = comp.get("date") or ev.get("date") or ""
    # ESPN date is ISO UTC; convert to CST for display
    try:
        from datetime import datetime as _dt
        start_utc = _dt.fromisoformat(start.replace("Z", "+00:00"))
        start_cst = start_utc.astimezone(CHI).strftime("%Y-%m-%d %H:%M")
        date_cst = start_cst[:10]
        time_cst = start_cst[11:16]
    except Exception:
        date_cst = target_date
        time_cst = ""

    # Only return games whose CST date is today
    if date_cst != target_date:
        return None

    odds = _odds_of(comp)
    venue = (comp.get("venue") or {}).get("fullName")

    # CFB Top 25 detection: ranked teams
    a_rank = None
    h_rank = None
    for r in a["record"].values():
        if r and "#" in r:
            try:
                a_rank = int("".join(ch for ch in r if ch.isdigit()))
            except ValueError:
                pass
    for r in h["record"].values():
        if r and "#" in r:
            try:
                h_rank = int("".join(ch for ch in r if ch.isdigit()))
            except ValueError:
                pass

    top25 = bool((a_rank and a_rank <= 25) or (h_rank and h_rank <= 25))
    if league == "cfb" and not top25:
        return None  # CFB lake = Top 25 only

    return {
        "league": league,
        "game_id": ev.get("id"),
        "date": date_cst,
        "start_cst": time_cst,
        "away": a["abbr"],
        "home": h["abbr"],
        "away_name": a["displayName"],
        "home_name": h["displayName"],
        "away_logo": a["logo"],
        "home_logo": h["logo"],
        "status": status,
        "clock": clock,
        "period": period,
        "spread": odds["spread"],
        "total": odds["total"],
        "ml_home": odds["ml_home"],
        "ml_away": odds["ml_away"],
        "away_rank": a_rank,
        "home_rank": h_rank,
        "venue": venue,
        "top25": top25,
    }


def nba_today(target_date: str | None = None) -> list[dict]:
    """Today's NBA games (CST)."""
    target_date = target_date or _today_cst()
    body = _fetch(_SITE.format(sport="basketball", league="nba") + "/scoreboard")
    out = []
    for ev in (body or {}).get("events", []) or []:
        row = _game_row(ev, "nba", target_date)
        if row:
            out.append(row)
    out.sort(key=lambda g: g["start_cst"] or "")
    return out


def nfl_this_week(target_date: str | None = None) -> list[dict]:
    """NFL games for the current Thu–Mon week (CST). Defaults to today's games."""
    target_date = target_date or _today_cst()
    body = _fetch(_SITE.format(sport="football", league="nfl") + "/scoreboard")
    out = []
    for ev in (body or {}).get("events", []) or []:
        row = _game_row(ev, "nfl", target_date)
        if row:
            out.append(row)
    out.sort(key=lambda g: g["start_cst"] or "")
    return out


def cfb_top25_today(target_date: str | None = None) -> list[dict]:
    """Today's College Football games where either team is Top 25 (CST)."""
    target_date = target_date or _today_cst()
    body = _fetch(_CFB_TOP25_URL, ttl=60)
    out = []
    for ev in (body or {}).get("events", []) or []:
        row = _game_row(ev, "cfb", target_date)
        if row:
            out.append(row)
    out.sort(key=lambda g: g["start_cst"] or "")
    return out


def all_today(target_date: str | None = None) -> dict:
    """Every league's today matchups in one payload — the front door."""
    target_date = target_date or _today_cst()
    return {
        "date": target_date,
        "timezone": "America/Chicago",
        "nba": nba_today(target_date),
        "nfl": nfl_this_week(target_date),
        "cfb_top25": cfb_top25_today(target_date),
        "total": len(nba_today(target_date)) + len(nfl_this_week(target_date)) + len(cfb_top25_today(target_date)),
    }


def attach_to_app(app: FastAPI) -> None:
    @app.get("/api/matchup-lake/today")
    def api_matchup_lake_today(date: str | None = None):
        """Today's matchups across NBA, NFL (Thu–Mon), CFB Top 25 — CST default."""
        return all_today(date)

    @app.get("/api/matchup-lake/nba/today")
    def api_matchup_lake_nba_today(date: str | None = None):
        return {"date": date or _today_cst(), "league": "nba", "games": nba_today(date)}

    @app.get("/api/matchup-lake/nfl/today")
    def api_matchup_lake_nfl_today(date: str | None = None):
        return {"date": date or _today_cst(), "league": "nfl", "games": nfl_this_week(date)}

    @app.get("/api/matchup-lake/cfb/top25/today")
    def api_matchup_lake_cfb_top25_today(date: str | None = None):
        return {"date": date or _today_cst(), "league": "cfb", "top25_only": True, "games": cfb_top25_today(date)}
