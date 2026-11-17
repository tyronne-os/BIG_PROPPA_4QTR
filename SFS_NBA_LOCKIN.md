# SFS NBA Data Lake Lock-In — Wealth Building v2
Date locked: 2026-11-16

## Status: LOCKED IN

Big Proppa is now a science, not a get-rich-quick tool.

### The Pipeline
1. **Ingest** ESPN live + BBRef advanced + TeamRankings discipline
   - lake/gold/nba/nba_game_live.csv, nba_team_season.csv, nba_team_turnovers_per_game.csv
   - nba_sfs_top10_*.csv, nba_player_leaders.csv

2. **SFS Doubloon v2 Team Scoring**
   - TeamScore = 0.22*NetDominance + 0.18*TwoWay + 0.15*Discipline + 0.15*Effort30 + 0.12*ShotDefense + 0.10*Control + 0.08*Momentum
   - Green >=70 / Orange 40-69 / Crimson <=40
   - Living 10-game promotion/demotion state machine

3. **SFS Doubloon v2 Player Scoring**
   - Per-30 value + winning impact + effort/discipline + MPG floor + trend + matchup/Tyson
   - Green = OVER eligible, Crimson = Lockout for OVER / Target for UNDER

4. **Reform School Filter**
   - Only Green vs Crimson team mismatches
   - Max 2-leg correlated Stay bets
   - No Red Doubloon on OVER slips

5. **90 Percentile Gate**
   - Prob Score >=0.90 required to escape data lake to Big Stage
   - Individual justification 400 chars
   - $5 default wager shown with sportsbook decimal multiplier

6. **Output Format Locked**
   - Heading: WELCOME TO [DAY] NIGHT IN THE NBA HERE'S WHAT I KNOW FOR SURE
   - Columns: Match Time CST | Team | Player/Market | Prop | Doubloon | Prob Score | American Odds | $5 Return
   - Parlay view with avg 30% profit boost

### NBA Data Lake Files Committed
- landing/nba_2026-11-16_convictions.md
- landing/nba_today_2026-11-16.html
- SFS_SUMMARY.md, backend/sfs_doubloon_engine.py, backend/sfs_parlay_replacer.py
- frontend/src/components/SFSDoubloonBadge.tsx

### Wealth Building Loop
Daily post of what Big Proppa knows for sure → $5 repeatable process → compound interest → cream rises → 90 percentile only → beat DraftKings/FanDuel with science.

The data lake is now a real wealth building tool.
