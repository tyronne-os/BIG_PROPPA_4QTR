-- NBA player game leaders (ESPN scoreboard leaders source).
-- Gold layer: per-game player stat leaders (pts / reb / ast / rating) with
-- ESPN athlete id, headshot, position. Used for player prop correlations and
-- the "as he goes they go" combo indicators.
-- Source: https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
-- Ingested by: scripts/build_nba_espn.py -> lake/gold/nba/nba_player_leaders.csv

CREATE TABLE IF NOT EXISTS gold.nba_player_leaders (
    season        INTEGER NOT NULL,          -- 2026
    game_id       VARCHAR NOT NULL,
    team          VARCHAR NOT NULL,          -- team abbreviation the leader played for
    stat          VARCHAR NOT NULL,          -- points | rebounds | assists | rating
    athlete_id    VARCHAR NOT NULL,
    name          VARCHAR NOT NULL,
    position      VARCHAR,
    value         DOUBLE,                    -- leader value for the stat
    display       VARCHAR,                   -- display value string
    headshot      VARCHAR,                   -- ESPN headshot URL
    jersey        VARCHAR,
    source_url    VARCHAR NOT NULL,
    ingest_run_id VARCHAR NOT NULL,
    PRIMARY KEY (season, game_id, team, stat, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_nba_player_leaders_game
    ON gold.nba_player_leaders (season, game_id);
CREATE INDEX IF NOT EXISTS idx_nba_player_leaders_athlete
    ON gold.nba_player_leaders (athlete_id);
CREATE INDEX IF NOT EXISTS idx_nba_player_leaders_stat
    ON gold.nba_player_leaders (stat);
