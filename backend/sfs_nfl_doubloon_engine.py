"""
SFS NFL Doubloon Operating System
Filters out "asshole" low-production players and keeps Green Doubloon winners.
Rules derived from SFS 13-Pillar thesis and coaching brain.
"""
from enum import Enum
from dataclasses import dataclass

class DoubloonTier(str, Enum):
    GREEN = "green_doubloon"
    ORANGE = "orange_doubloon"
    CRIMSON = "crimson_doubloon"

@dataclass
class NFLSFSMetrics:
    player_id: str
    team: str
    position: str
    usage_share: float
    target_share: float
    redzone_touches: float
    ypa: float
    epa_per_play: float
    first_down_rate: float
    turnover_rate: float
    snap_share: float
    team_off_eff: float
    opponent_def_rank: float
    motivation_score: float
    last_3_form: float

def compute_nfl_doubloon(m: NFLSFSMetrics):
    # Pillar 11 Playtime Floor
    if m.snap_share < 55:
        return DoubloonTier.CRIMSON, 0.0, "Snap floor fail"
    
    # Lazy / Empty stats filter
    if m.usage_share < 12 and m.position in ["RB","WR","TE"]:
        return DoubloonTier.CRIMSON, 0.35, "Low usage empty stats"
    
    # 2TD DNA filter - must have redzone presence
    if m.redzone_touches < 0.15:
        tier = DoubloonTier.ORANGE
        score = 0.55
        reason = "Low redzone"
    else:
        # Quality production
        pef = (m.epa_per_play * 10) + m.first_down_rate*5 - m.turnover_rate*10
        if pef >= 2.5 and m.target_share >= 18:
            tier = DoubloonTier.GREEN
            score = 0.90 + min(0.10, m.last_3_form*0.05)
            reason = "Green execution"
        elif pef >= 1.0:
            tier = DoubloonTier.ORANGE
            score = 0.65
            reason = "Pivot"
        else:
            tier = DoubloonTier.CRIMSON
            score = 0.30
            reason = "Crimson lockout"
    
    return tier, round(score,2), reason

# Filter rule: remove "asshole" players like LaPorta type
# If player has high volume but low EPA/First down rate -> Crimson
def is_asshole_player(m: NFLSFSMetrics):
    return m.usage_share > 20 and m.epa_per_play < 0.05 and m.first_down_rate < 0.25

# Example PIT vs CIN Nov 16 2026
"""
PIT @ CIN 20:20 ET
Green players: Ja'Marr Chase, Tee Higgins, Chase Brown, Darnell Washington, Jaylen Warren
Crimson players to remove from OVER slips: low EPA TEs, low usage WR3
"""
