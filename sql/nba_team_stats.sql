-- NBA team season stats (ESPN standings source).
-- Gold layer: one row per NBA team per season with full team profile used for
-- good-vs-bad team correlation and momentum modeling.
-- Source: https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings
-- Ingested by: scripts/build_nba_espn.py -> lake/gold/nba/nba_team_season.csv

CREATE TABLE IF NOT EXISTS gold.nba_team_season (
    season          INTEGER NOT NULL,          -- 2026
    conference      VARCHAR NOT NULL,          -- Eastern Conference / Western Conference
    team_id         VARCHAR NOT NULL,
    location        VARCHAR,
    name            VARCHAR NOT NULL,
    abbreviation    VARCHAR NOT NULL,
    display_name    VARCHAR,
    logo            VARCHAR,
    wins            INTEGER,
    losses          INTEGER,
    win_pct         DOUBLE,
    games_back      DOUBLE,
    ppg             DOUBLE,                    -- points per game (offense)
    opp_ppg         DOUBLE,                    -- opponent points per game (defense)
    point_diff      DOUBLE,                    -- ppg - opp_ppg (net rating)
    points_for      DOUBLE,
    points_against  DOUBLE,
    streak          VARCHAR,                   -- e.g. 'L9', 'W4'
    home_record     VARCHAR,
    road_record     VARCHAR,
    vs_division     VARCHAR,
    vs_conference   VARCHAR,
    last_10         VARCHAR,                   -- last 10 games record
    playoff_seed    INTEGER,
    source_url      VARCHAR NOT NULL,
    ingest_run_id   VARCHAR NOT NULL,
    PRIMARY KEY (season, team_id)
);

CREATE INDEX IF NOT EXISTS idx_nba_team_season_conf
    ON gold.nba_team_season (conference);
CREATE INDEX IF NOT EXISTS idx_nba_team_season_ppg
    ON gold.nba_team_season (ppg);
CREATE INDEX IF NOT EXISTS idx_nba_team_season_opp_ppg
    ON gold.nba_team_season (opp_ppg);
CREATE INDEX IF NOT EXISTS idx_nba_team_season_point_diff
    ON gold.nba_team_season (point_diff);
CREATE INDEX IF NOT EXISTS idx_nba_team_season_win_pct
    ON gold.nba_team_season (win_pct);
