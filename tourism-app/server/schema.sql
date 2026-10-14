-- Run manually in a dedicated demo PostgreSQL database.
-- This initial demo stores a bounded snapshot history in one row, not a production telemetry schema.
CREATE TABLE IF NOT EXISTS tourism_demo_state (
    id integer PRIMARY KEY CHECK (id = 1),
    state jsonb NOT NULL
);
