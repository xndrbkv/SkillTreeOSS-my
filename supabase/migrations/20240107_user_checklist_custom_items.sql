-- ─────────────────────────────────────────────────────────────────────────────
-- user_checklist.custom_items: checklist items the user added themselves,
-- as { "<nodeId>": [{ "id": "...", "label": "..." }] }.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE user_checklist
  ADD COLUMN IF NOT EXISTS custom_items jsonb NOT NULL DEFAULT '{}'::jsonb;
