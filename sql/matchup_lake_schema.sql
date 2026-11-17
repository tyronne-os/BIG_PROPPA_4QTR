-- =============================================================================
-- frontal-lobe2 : matchup lake -- date-aware "what's on today, in CST"
-- =============================================================================
-- Design reference: TeamRankings schedule pages
--   NBA  https://www.teamrankings.com/nba/schedules/
--   NFL  https://www.teamrankings.com/nfl/schedules/season/   (Thu–Mon week)
--   CFB  https://www.teamrankings.com/ncf/                     (Top 25 only)
--
-- This schema mirrors the TeamRankings schedule *structure* (columns +
-- dropdowns/splits) but is populated from ESPN's free public API — no
-- scraping dependency, no rate limits, live every render.
--
-- Every table is keyed by (league, game_id, game_date) and filtered so that
-- only TODAY's CST date renders by default. This prevents the date-drift bug
-- that posted yesterday's NFL players on today's card.
--
-- Target engine: DuckDB.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS silver;

-- ---------------------------------------------------------------------------
-- NBA schedule (today's games only, CST)
-- Mirrors teamrankings.com/nba/schedules/ columns + splits/dropdowns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS silver.matchup_lake_nba (
    league          VARCHAR NOT NULL DEFAULT 'nba',
    game_id         VARCHAR NOT NULL,
    game_date       DATE NOT NULL,            -- CST date
    start_cst       VARCHAR,                  -- HH:MM CST kickoff
    away_team       VARCHAR NOT NULL,
    home_team       VARCHAR NOT NULL,
    away_name       VARCHAR,
    home_name       VARCHAR,
    away_logo       VARCHAR,
    home_logo       VARCHAR,
    status          VARCHAR,                  -- PRE | LIVE | FINAL | ...
    clock           VARCHAR,
    period          INTEGER,
    spread          DOUBLE,
    total           DOUBLE,
    ml_home         DOUBLE,
    ml_away         DOUBLE,
    venue           VARCHAR,
    source          VARCHAR NOT NULL DEFAULT 'espn_api',
    ingest_run_id   VARCHAR NOT NULL,
    PRIMARY KEY (league, game_id, game_date)
);
CREATE INDEX IF NOT EXISTS ix_ml_nba_date ON silver.matchup_lake_nba (game_date);
CREATE INDEX IF NOT EXISTS ix_ml_nba_teams ON silver.matchup_lake_nba (away_team, home_team);

-- ---------------------------------------------------------------------------
-- NFL schedule (Thu–Mon week, today's games by default, CST)
-- Mirrors teamrankings.com/nfl/schedules/season/ columns + splits/dropdowns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS silver.matchup_lake_nfl (
    league          VARCHAR NOT NULL DEFAULT 'nfl',
    game_id         VARCHAR NOT NULL,
    season          INTEGER NOT NULL,
    week            INTEGER NOT NULL,
    game_date       DATE NOT NULL,            -- CST date
    weekday         VARCHAR,                  -- Thu | Fri | Sat | Sun | Mon
    start_cst       VARCHAR,                  -- HH:MM CST kickoff
    away_team       VARCHAR NOT NULL,
    home_team       VARCHAR NOT NULL,
    away_name       VARCHAR,
    home_name       VARCHAR,
    away_logo       VARCHAR,
    home_logo       VARCHAR,
    status          VARCHAR,
    clock           VARCHAR,
    period          INTEGER,
    spread          DOUBLE,
    total           DOUBLE,
    ml_home         DOUBLE,
    ml_away         DOUBLE,
    away_rank       INTEGER,                  -- CFB-style rank (NULL for NFL)
    home_rank       INTEGER,
    venue           VARCHAR,
    source          VARCHAR NOT NULL DEFAULT 'espn_api',
    ingest_run_id   VARCHAR NOT NULL,
    PRIMARY KEY (league, game_id, game_date)
);
CREATE INDEX IF NOT EXISTS ix_ml_nfl_date ON silver.matchup_lake_nfl (game_date);
CREATE INDEX IF NOT EXISTS ix_ml_nfl_week ON silver.matchup_lake_nfl (season, week);
CREATE INDEX IF NOT EXISTS ix_ml_nfl_teams ON silver.matchup_lake_nfl (away_team, home_team);

-- ---------------------------------------------------------------------------
-- College Football Top 25 only (Saturday, CST)
-- Mirrors teamrankings.com/ncf/ columns + splits/dropdowns
-- Only games where either team is ranked Top 25 are stored.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS silver.matchup_lake_cfb_top25 (
    league          VARCHAR NOT NULL DEFAULT 'cfb',
    game_id         VARCHAR NOT NULL,
    season          INTEGER NOT NULL,
    week            INTEGER NOT NULL,
    game_date       DATE NOT NULL,            -- CST date
    weekday         VARCHAR,                  -- typically Saturday
    start_cst       VARCHAR,                  -- HH:MM CST kickoff
    away_team       VARCHAR NOT NULL,
    home_team       VARCHAR NOT NULL,
    away_name       VARCHAR,
    home_name       VARCHAR,
    away_logo       VARCHAR,
    home_logo       VARCHAR,
    away_rank       INTEGER NOT NULL,         -- Top 25 rank
    home_rank       INTEGER,                  -- Top 25 rank (nullable)
    status          VARCHAR,
    clock           VARCHAR,
    period          INTEGER,
    spread          DOUBLE,
    total           DOUBLE,
    ml_home         DOUBLE,
    ml_away         DOUBLE,
    venue           VARCHAR,
    conference      VARCHAR,                  -- e.g. SEC, BIG, ACC
    source          VARCHAR NOT NULL DEFAULT 'espn_api',
    ingest_run_id   VARCHAR NOT NULL,
    PRIMARY KEY (league, game_id, game_date)
);
CREATE INDEX IF NOT EXISTS ix_ml_cfb_date ON silver.matchup_lake_cfb_top25 (game_date);
CREATE INDEX IF NOT EXISTS ix_ml_cfb_week ON silver.matchup_lake_cfb_top25 (season, week);
CREATE INDEX IF NOT EXISTS ix_ml_cfb_rank ON silver.matchup_lake_cfb_top25 (away_rank, home_rank);

-- ---------------------------------------------------------------------------
-- Unified view: every league's today matchups in one rowset (the front door)
-- Filter by game_date = CURRENT_DATE (or a bound parameter) to render only
-- today's matchups in CST.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW silver.v_matchup_lake_today AS
SELECT 'nba' AS league, game_id, game_date, start_cst,
       away_team, home_team, away_name, home_name,
       away_logo, home_logo, status, clock, period,
       spread, total, ml_home, ml_away,
       NULL AS away_rank, NULL AS home_rank, venue, source
FROM silver.matchup_lake_nba
UNION ALL
SELECT 'nfl', game_id, game_date, start_cst,
       away_team, home_team, away_name, home_name,
       away_logo, home_logo, status, clock, period,
       spread, total, ml_home, ml_away,
       away_rank, home_rank, venue, source
FROM silver.matchup_lake_nfl
UNION ALL
SELECT 'cfb', game_id, game_date, start_cst,
       away_team, home_team, away_name, home_name,
       away_logo, home_logo, status, clock, period,
       spread, total, ml_home, ml_away,
       away_rank, home_rank, venue, source
FROM silver.matchup_lake_cfb_top25;

-- ---------------------------------------------------------------------------
-- Helper queries (parameterized :date = 'YYYY-MM-DD' in CST):
--
--   SELECT * FROM silver.v_matchup_lake_today WHERE game_date = :date ORDER BY start_cst;
--
--   -- NBA only today
--   SELECT * FROM silver.matchup_lake_nba WHERE game_date = :date ORDER BY start_cst;
--
--   -- NFL only today (Thu–Mon week)
--   SELECT * FROM silver.matchup_lake_nfl WHERE game_date = :date ORDER BY start_cst;
--
--   -- CFB Top 25 only today
--   SELECT * FROM silver.matchup_lake_cfb_top25 WHERE game_date = :date ORDER BY start_cst;
--
--   -- What's on tonight (after 5pm CST)?
--   SELECT * FROM silver.v_matchup_lake_today
--   WHERE game_date = :date AND start_cst >= '17:00' ORDER BY start_cst;
-- =============================================================================
