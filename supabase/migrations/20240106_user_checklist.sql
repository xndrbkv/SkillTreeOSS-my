-- ─────────────────────────────────────────────────────────────────────────────
-- user_checklist: per-user checked sub-topics (node checklists) for a tree.
-- Item keys are stored as '<nodeId>/<itemId>'.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_checklist (
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tree_id          text        NOT NULL,
  checked_item_ids text[]      NOT NULL DEFAULT '{}',
  last_updated     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tree_id)
);

-- RLS
ALTER TABLE user_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own checklist"
  ON user_checklist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checklist"
  ON user_checklist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checklist"
  ON user_checklist FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
