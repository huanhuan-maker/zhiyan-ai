-- Stable JSON question IDs are case sensitive; MySQL's default text collation is not.
ALTER TABLE answers MODIFY question_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
