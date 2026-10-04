-- Registers the Network Portal (card-network-agent) in proxy-server (schema proxy) as app
-- "card_network". Idempotent. Run against the proxy database (DATABASE_URL of proxy-server):
--   psql "$PROXY_DATABASE_URL" -v ON_ERROR_STOP=1 -f deploy/proxy-app.sql
--
-- The agent calls https://<proxy>/apps/card_network/v1/... ; proxy-server forwards to the
-- card-network service in cluster 2 through the public ALB-2 listener on port 8443 (same
-- certificate as backend-2, proxy-server already trusts its CA). REST only (the proxy has no
-- MCP adapter yet), so the catalog maps the REST mirrors /v1/* of the MCP tools.
-- Upstream token: the same MARKETPLACE_API_TOKEN proxy-server sends to backend-2; the
-- card-network task gets it as MCP_API_KEY (one-infrastructure, ecs_card_network.tf).
-- If the ALB-2 DNS name changes, update upstream_url (terraform output card_network_url).

begin;

set local proxy.actor = 'card-network-agent';

insert into proxy.apps (id, name, protocol, upstream_url, timeout_ms, auth_type, auth_secret_env)
values ('card_network', 'Card Network Portal', 'rest',
        'https://one-dev-2-alb-1648560586.eu-north-1.elb.amazonaws.com:8443', 10000, 'bearer', 'MARKETPLACE_API_TOKEN')
on conflict (id) do update set upstream_url = excluded.upstream_url, auth_type = excluded.auth_type,
  auth_secret_env = excluded.auth_secret_env, aws_region = null, aws_service = null;

-- Catalog (unknown route = DENY). Reads are scanned (merchant representations may carry injections).

insert into proxy.tools (app_id, name, kind, description, http_method, http_path, args)
values
  ('card_network', 'transaction_get', 'read', 'Card transaction', 'GET', '/v1/transactions/{txn_id}',
   '{"txn_id": "$.txn_id"}'),
  ('card_network', 'merchant_get', 'read', 'Merchant profile', 'GET', '/v1/merchants/{merchant_id}',
   '{"merchant_id": "$.merchant_id"}'),
  ('card_network', 'dispute_get', 'read', 'Network dispute with merchant representation', 'GET',
   '/v1/disputes/{dispute_id}', '{"dispute_id": "$.dispute_id"}'),
  ('card_network', 'dispute_get_by_txn', 'read', 'Latest network dispute of a transaction', 'GET',
   '/v1/disputes', '{"txn_id": "$.txn_id"}')
on conflict (app_id, name) do update set http_method = excluded.http_method, http_path = excluded.http_path,
  args = excluded.args, description = excluded.description;

insert into proxy.tools (app_id, name, kind, description, http_method, http_path, args, input_schema)
values
  ('card_network', 'dispute_open', 'write', 'Open a network dispute for a transaction', 'POST', '/v1/disputes',
   '{"txn_id": "$.txn_id", "reason_code": "$.reason_code"}',
   '{"type": "object", "required": ["txn_id", "reason_code"],
     "properties": {"txn_id": {"type": "string"}, "reason_code": {"type": "string"}}}'),
  ('card_network', 'dispute_submit_evidence', 'write', 'Submit evidence to a dispute', 'POST',
   '/v1/disputes/{dispute_id}/evidence', '{"dispute_id": "$.dispute_id"}',
   '{"type": "object", "required": ["note"],
     "properties": {"note": {"type": "string"}, "urls": {"type": "array", "items": {"type": "string"}}}}'),
  ('card_network', 'dispute_accept_representation', 'write', 'Accept the merchant representation (closes the dispute)',
   'POST', '/v1/disputes/{dispute_id}/accept-representation', '{"dispute_id": "$.dispute_id"}',
   '{"type": "object", "properties": {"rationale": {"type": "string"}}}')
on conflict (app_id, name) do update set http_method = excluded.http_method, http_path = excluded.http_path,
  args = excluded.args, input_schema = excluded.input_schema, description = excluded.description;

commit;
