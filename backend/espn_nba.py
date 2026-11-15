# NBA through ESPN's public API -- free, no key, no rate limits, live streaming.
#
# scoreboard()   Today's games: team statistics (rebounds, assists, FG%, 3P%, FT%, points),
#                per-quarter linescores, player leaders (pts / reb / ast / rating with id,
#                headshot, position), team records (overall / home / road).
# standings()    Full season team stats by conference: PPG, OPP PPG, DIFF, win pct, wins/losses,
#                streak, home / road, vs conf, last 10, GB, playoff seed.
# build()        One snapshot of both, written to lake/gold/espn/nba_snapshot.json so the page
#                keeps working if ESPN is briefly down.
#
# ESPN endpoints used (all public, no auth):
#   https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
#   https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings

from __future__ import annotations

import json
import threading
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

_DIR = Path(__file__).resolve().parent.parent / "lake/gold/espn"
_SNAP = _DIR / "nba_snapshot.json"

_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
_STANDINGS_URL = "https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings"
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"


def _fetch(url: str) -> dict | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": _UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except Exception:
        return None


def _now_iso() -> str:
    return datetime.now(ZoneInfo("America/Chicago")).isoformat()


def _clean_team(t: dict) -> dict:
    return {
        "id": t.get("id"),
        "uid": t.get("uid"),
        "location": t.get("location"),
        "name": t.get("name"),
        "abbreviation": t.get("abbreviation"),
        "displayName": t.get("displayName"),
        "shortDisplayName": t.get("shortDisplayName"),
        "logo": (t.get("logos") or [{}])[0].get("href") if t.get("logos") else None,
    }


def scoreboard() -> list:
    """Today's NBA games with team statistics, per-quarter linescores, player leaders,
    and team records. Returns one dict per game."""
    body = _fetch(_SCOREBOARD_URL)
    if not body:
        return []
    out = []
    for ev in (body or {}).get("events", []) or []:
        comp = (ev.get("competitions") or [ev])[0]
        cs = comp.get("competitors", [])
        away = next((c for c in cs if c.get("homeAway") == "away"), {})
        home = next((c for c in cs if c.get("homeAway") == "home"), {})

        def side(c):
            t = c.get("team") or {}
            recs = c.get("records") or []
            rec_map = {r.get("name", "").lower(): r.get("summary", "") for r in recs}
            leaders = []
            for l in (c.get("leaders") or []):
                leaders_list = l.get("leaders") or []
                leader_entry = leaders_list[0] if leaders_list else {}
                ath = leader_entry.get("athlete", {})
                lv = leader_entry.get("value")
                lv = lv if isinstance(lv, (int, float)) else None
                leaders.append(
                    {
                        "stat": l.get("name"),
                        "athlete_id": ath.get("id"),
                        "name": ath.get("fullName") or ath.get("displayName"),
                        "position": (ath.get("position") or {}).get("abbreviation"),
                        "team_id": (ath.get("team") or {}).get("id"),
                        "value": lv,
                        "display": leader_entry.get("displayValue"),
                        "headshot": ath.get("headshot"),
                        "jersey": ath.get("jersey"),
                    }
                )
            stats = {}
            for s in (c.get("statistics") or []):
                stats[s.get("abbreviation") or s.get("name")] = {
                    "name": s.get("name"),
                    "abbreviation": s.get("abbreviation"),
                    "value": s.get("displayValue"),
                }
            return {
                "homeAway": c.get("homeAway"),
                "team": _clean_team(t),
                "score": c.get("score"),
                "statistics": stats,
                "leaders": leaders,
                "records": rec_map,
                "linescores": [
                    {
                        "period": ls.get("period"),
                        "value": ls.get("value"),
                        "display": ls.get("displayValue"),
                    }
                    for ls in (c.get("linescores") or [])
                ],
            }

        a, h = side(away), side(home)
        st = comp.get("status") or {}
        st_type = st.get("type") or {}
        out.append(
            {
                "gameId": comp.get("id") or ev.get("id"),
                "uid": ev.get("uid"),
                "date": ev.get("date"),
                "name": ev.get("shortName"),
                "status": st_type.get("name"),
                "statusDescription": st_type.get("description"),
                "period": st.get("period"),
                "clock": st.get("displayClock"),
                "away": a,
                "home": h,
                "venue": (comp.get("venue") or {}).get("fullName"),
                "broadcast": ", ".join(n for b in comp.get("broadcasts", []) for n in b.get("names", [])),
                "startDate": comp.get("startDate"),
                "ingest_run_id": _now_iso(),
            }
        )
    return out


def standings() -> dict:
    """Full NBA season standings by conference with team stats."""
    body = _fetch(_STANDINGS_URL)
    if not body:
        return {"conferences": [], "ingest_run_id": _now_iso()}
    conferences = []
    for ch in (body or {}).get("children", []) or []:
        st = ch.get("standings") or {}
        entries = st.get("entries") or []
        conf = {"name": ch.get("name"), "abbreviation": ch.get("abbreviation"), "teams": []}
        for e in entries:
            t = e.get("team") or {}
            stats = {s.get("abbreviation") or s.get("name"): s.get("displayValue") for s in (e.get("stats") or [])}
            conf["teams"].append(
                {
                    "id": t.get("id"),
                    "location": t.get("location"),
                    "name": t.get("name"),
                    "abbreviation": t.get("abbreviation"),
                    "displayName": t.get("displayName"),
                    "logo": (t.get("logos") or [{}])[0].get("href") if t.get("logos") else None,
                    "stats": stats,
                }
            )
        conferences.append(conf)
    return {"conferences": conferences, "ingest_run_id": _now_iso()}


def build() -> dict:
    """Snapshot scoreboard + standings to lake/gold/espn/nba_snapshot.json."""
    _DIR.mkdir(parents=True, exist_ok=True)
    snap = {"ingest_run_id": _now_iso(), "games": scoreboard(), "standings": standings()}
    _SNAP.write_text(json.dumps(snap, indent=1))
    return snap


if __name__ == "__main__":
    s = build()
    print("NBA snapshot: %d games, %d conferences" % (len(s["games"]), len(s["standings"]["conferences"])))
