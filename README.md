# Card Network Agent — Dispute Ops MCP backends

Two MCP apps for the Modus dispute-ops demo, backed by **per-app Postgres schemas** on the Shopping-Warehouse Supabase project.

| App | Schema | Default URL |
|---|---|---|
| Card Network Dispute Portal | `dispute_network` | `http://127.0.0.1:4101/mcp` |
| Case Desk | `dispute_case_desk` | `http://127.0.0.1:4102/mcp` |

Plans: [`plans/dispute-ops/`](./plans/dispute-ops/).  
Usage (OpenAPI / Postman): [`docs/USAGE.md`](./docs/USAGE.md).  
Modus policies (not in DB): [`docs/MODUS_SETUP.md`](./docs/MODUS_SETUP.md).

## Setup

```bash
cp .env.example .env
# set DATABASE_URL from Supabase → Shopping-Warehouse Database → Settings → Database
npm install
npm run seed
```

Start both servers (two terminals):

```bash
npm run start:network
npm run start:case-desk
```

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness |
| `POST /demo/reset` | restore `dispute_v1` fixtures |
| `GET /openapi.json` | OpenAPI 3.1 |
| `GET /openapi.yaml` | OpenAPI YAML |
| `GET /postman.json` | Postman Collection v2.1 |
| `POST /mcp` | MCP streamable HTTP (agents / Modus) |
| `GET/POST /v1/*` | REST mirrors of MCP tools |

### Machine contracts in-repo

```
openapi/
  dispute-case-desk.openapi.yaml
  dispute-network.openapi.yaml
postman/
  dispute-case-desk.postman_collection.json
  dispute-network.postman_collection.json
  dispute-ops.postman_environment.json
```

Import Postman collection + environment, run **Demo reset**, then exercise **REST mirrors**. See [`docs/USAGE.md`](./docs/USAGE.md).

## MCP tools

### Network Portal (`dispute-network-mcp`)

- `network.txn.get`
- `network.merchant.get`
- `network.dispute.get` — returns poisoned `representation_text` verbatim
- `network.dispute.open`
- `network.dispute.submit_evidence`
- `network.dispute.accept_representation` — high-risk close favor-merchant

### Case Desk (`dispute-case-desk-mcp`)

- `case.list` / `case.get` / `case.update`
- `refund.post` / `refund.adjust` (idempotent keys supported)
- `chargeback.file`
- `demo.reset`

Policies live in Modus only — see [`docs/MODUS_SETUP.md`](./docs/MODUS_SETUP.md).

## Demo fixtures & Modus scenarios

Seed covers T1–T12. Runbooks: [`docs/scenarios/`](./docs/scenarios/).

| Id | Role |
|---|---|
| `txn_189_travel` / `case_189_unrecognized` / `disp_poisoned` | T1 T2 T4 T6 T10 T12 |
| `txn_12_coffee` / `case_12_clear_fraud` | T3 clear-fraud allow |
| `txn_88_shoplite` / `case_88_low_trust` | T5 low trust, clean letter |
| `txn_64_gadget` / `case_64_chargeback_ready` | T9 chargeback happy |
| `txn_650_travel` / `case_650_overcap` | T6 hard-cap variant |
| `case_12_adjust` / `ref_adjust_seed` | T7 T8 refund.adjust |

## Modus env

```bash
NETWORK_MCP_URL=http://127.0.0.1:4101/mcp
CASE_DESK_MCP_URL=http://127.0.0.1:4102/mcp
DEMO_SEED=dispute_v1
```

Optional: set `MCP_API_KEY` and send `Authorization: Bearer …` or `X-Api-Key`.
