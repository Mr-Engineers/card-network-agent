-- Policies live in Modus (rule packs), not in Case Desk DB.
DROP TABLE IF EXISTS dispute_case_desk.policy_docs CASCADE;
ALTER TABLE dispute_case_desk.cases DROP COLUMN IF EXISTS attached_policies;

-- Sibling schema created earlier during exploration / alternate app name.
DROP TABLE IF EXISTS case_desk.case_policy_links CASCADE;
DROP TABLE IF EXISTS case_desk.policy_docs CASCADE;
