"""
SFS Doubloon Operating System
Color-based player filtering for NBA/WNBA
Doubloon tiers replace dots: Green Doubloon / Orange Doubloon / Crimson Doubloon
"""

from enum import Enum
from dataclasses import dataclass
from typing import Literal

class DoubloonTier(str, Enum):
    GREEN = "green_doubloon"
    ORANGE = "orange_doubloon"
    CRIMSON = "crimson_doubloon"

@dataclass
class SFSMetrics:
    pef: float
    mpg_season: float
    mpg_l5: float
    net_rtg_delta: float
    walking_pct: float
    hustle_per36: float
    ast_tov: float
    team_win_pct: float
    tyson88_opponent: float
    prop_cover_l10: float
    prop_cover_l5: float
    clearing_margin: float

def compute_doubloon(m: SFSMetrics) -> tuple[DoubloonTier, int, str]:
    # Pillar 11 Playtime Floor
    if m.mpg_season < 32.0 or m.mpg_l5 < 30.0:
        return DoubloonTier.CRIMSON, 0, "MPG floor fail"

    # Lazy / Ghost filters
    lazy_flags = []
    if m.walking_pct > 45.0:
        lazy_flags.append("high_walking")
    if m.hustle_per36 < 2.8:
        lazy_flags.append("low_hustle")
    if m.ast_tov < 1.15:
        lazy_flags.append("poor_ast_tov")
    if m.net_rtg_delta <= -6.5:
        lazy_flags.append("negative_net")
    if m.pef <= 0.0:
        lazy_flags.append("negative_pef")

    if len(lazy_flags) >= 2:
        return DoubloonTier.CRIMSON, 20, f"Toxic: {','.join(lazy_flags)}"

    # Tyson 88 Gatekeeper
    if m.tyson88_opponent >= 85:
        return DoubloonTier.CRIMSON, 25, "Tyson88 lockout"

    # General Powell Stars
    stars = 0
    if m.prop_cover_l10 >= 0.70:
        stars += 1
    if m.prop_cover_l5 >= 0.80:
        stars += 1
    if m.clearing_margin > 1.5:
        stars += 1
    if m.pef > 5.0:
        stars += 1
    if m.team_win_pct >= 0.500 and m.mpg_season >= 32.0:
        stars += 1

    if stars >= 4:
        score = 85 + min(15, int((m.pef - 5.0) * 2))
        return DoubloonTier.GREEN, min(100, score), f"{stars} stars PEF {m.pef:.1f}"
    elif stars >= 2:
        return DoubloonTier.ORANGE, 60 + stars*5, f"{stars} stars pivot"
    else:
        return DoubloonTier.CRIMSON, 35, f"{stars} stars insufficient"

DOUBLOON_COLORS = {
    DoubloonTier.GREEN: "#00FF88",
    DoubloonTier.ORANGE: "#FFAA00",
    DoubloonTier.CRIMSON: "#FF0044",
}

DOUBLOON_LABELS = {
    DoubloonTier.GREEN: "Green Doubloon - Execute",
    DoubloonTier.ORANGE: "Orange Doubloon - Pivot",
    DoubloonTier.CRIMSON: "Crimson Doubloon - Lockout",
}
