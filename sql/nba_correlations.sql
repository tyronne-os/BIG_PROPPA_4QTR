-- NBA correlation model outputs (quantitative, predictive).
--
-- These tables store the results of the correlation models in
-- backend/nba_correlations.py. Each row is a computed signal for a specific
-- matchup or player, suitable for driving insight nuggets and prop picks.
--
-- The models weight recent form (last 10 games) more heavily than full-season
-- averages, and use opponent-adjusted rates so a good offense vs a bad defense
-- produces a larger edge than good vs good.

-- Team-level matchup edge: good offense vs bad defense, good vs bad, etc.
-- One row per team per upcoming opponent.
CREATE TABLE IF NOT EXISTS gold.nba_matchup_correlation (
    season              INTEGER NOT NULL,
    game_id             VARCHAR NOT NULL,
    team                VARCHAR NOT NULL,
    opponent            VARCHAR NOT NULL,
    location            VARCHAR NOT NULL,          -- home | away | neutral
    -- raw season rates
    team_ppg            DOUBLE,
    team_opp_ppg        DOUBLE,
    team_point_diff     DOUBLE,
    team_win_pct        DOUBLE,
    opp_ppg             DOUBLE,
    opp_opp_ppg         DOUBLE,
    opp_point_diff      DOUBLE,
    opp_win_pct         DOUBLE,
    -- momentum (last 10 vs season)
    team_last10_win_pct DOUBLE,
    opp_last10_win_pct  DOUBLE,
    team_streak_num     INTEGER,                   -- +N win streak, -N loss streak
    opp_streak_num      INTEGER,
    -- correlation signals
    offense_vs_defense_edge DOUBLE,                -- team_ppg - opp_opp_ppg (offense vs opp defense)
    defense_vs_offense_edge DOUBLE,                -- opp_ppg - team_opp_ppg (defense vs team offense)
    net_edge            DOUBLE,                    -- combined matchup edge
    good_vs_bad_signal  VARCHAR,                   -- 'GOOD_OFF_vs_BAD_DEF' | 'BAD_OFF_vs_GOOD_DEF' | 'MISMATCH' | 'EVEN'
    confidence          DOUBLE,                    -- 0-1 model confidence in the edge
    blowout_risk        DOUBLE,                    -- 0-1 probability of double-digit lead
    momentum_score      DOUBLE,                    -- 0-1 'big mo' momentum (recent form vs season)
    source_url          VARCHAR NOT NULL,
    ingest_run_id       VARCHAR NOT NULL,
    PRIMARY KEY (season, game_id, team)
);

CREATE INDEX IF NOT EXISTS idx_nba_matchup_corr_game
    ON gold.nba_matchup_correlation (season, game_id);
CREATE INDEX IF NOT EXISTS idx_nba_matchup_corr_edge
    ON gold.nba_matchup_correlation (net_edge DESC);
CREATE INDEX IF NOT EXISTS idx_nba_matchup_corr_signal
    ON gold.nba_matchup_correlation (good_vs_bad_signal);

-- Player-level prop correlation: usage vs matchup, "as he goes they go"
-- One row per player per game.
CREATE TABLE IF NOT EXISTS gold.nba_player_prop_correlation (
    season          INTEGER NOT NULL,
    game_id         VARCHAR NOT NULL,
    athlete_id      VARCHAR NOT NULL,
    name            VARCHAR NOT NULL,
    team            VARCHAR NOT NULL,
    position        VARCHAR,
    opponent        VARCHAR NOT NULL,
    location        VARCHAR NOT NULL,
    -- season averages
    season_pts      DOUBLE,
    season_reb      DOUBLE,
    season_ast      DOUBLE,
    season_ts_pct   DOUBLE,
    -- recent form (last 5/10)
    recent_pts      DOUBLE,
    recent_reb      DOUBLE,
    recent_ast      DOUBLE,
    -- matchup context
    opp_def_pts_allowed DOUBLE,                   -- opponent PPG allowed to position
    opp_def_reb_allowed DOUBLE,
    opp_def_ast_allowed DOUBLE,
    -- correlation signals
    usage_matchup_edge DOUBLE,                    -- season rate vs opp allowed rate
    form_edge           DOUBLE,                   -- recent form vs season avg
    prop_confidence     DOUBLE,                   -- 0-1 confidence in the prop
    heat_signal         VARCHAR,                  -- 'HEATING_UP' | 'COOLING_DOWN' | 'STEADY'
    source_url          VARCHAR NOT NULL,
    ingest_run_id       VARCHAR NOT NULL,
    PRIMARY KEY (season, game_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_nba_player_prop_game
    ON gold.nba_player_prop_correlation (season, game_id);
CREATE INDEX IF NOT EXISTS idx_nba_player_prop_confidence
    ON gold.nba_player_prop_correlation (prop_confidence DESC);
