# How to use Case Desk (and Network Portal)

Brief operator guide for the dispute-ops MCP apps.

## 1. Start

```bash
cp .env.example .env   # set DATABASE_URL
npm install
npm run seed
npm run start:case-desk   # :4102
# optional second terminal
npm run start:network     # :4101
```

## 2. OpenAPI & Postman (served live)

| URL | What |
|---|---|
| `http://127.0.0.1:4102/openapi.json` | Case Desk OpenAPI 3.1 (JSON) |
| `http://127.0.0.1:4102/openapi.yaml` | Same, YAML |
| `http://127.0.0.1:4102/postman.json` | Case Desk Postman collection |

Repo copies (source of truth for edit):

- [`openapi/dispute-case-desk.openapi.yaml`](../openapi/dispute-case-desk.openapi.yaml)
- [`postman/dispute-case-desk.postman_collection.json`](../postman/dispute-case-desk.postman_collection.json)
- [`postman/dispute-ops.postman_environment.json`](../postman/dispute-ops.postman_environment.json)

### Import into Postman

1. **Import** → select `postman/dispute-case-desk.postman_collection.json`
2. Also import `postman/dispute-ops.postman_environment.json` and select it
3. Run **Ops → Demo reset**, then **REST mirrors → GET case_189_unrecognized**
4. Optional: set `apiKey` in the environment if `MCP_API_KEY` is set in `.env`

### Smoke with curl

```bash
curl http://127.0.0.1:4102/health
curl http://127.0.0.1:4102/openapi.json
curl -X POST http://127.0.0.1:4102/demo/reset
curl http://127.0.0.1:4102/v1/cases/case_189_unrecognized
curl -X POST http://127.0.0.1:4102/v1/refunds \
  -H "Content-Type: application/json" \
  -d "{\"case_id\":\"case_189_unrecognized\",\"amount_eur\":189,\"kind\":\"provisional\"}"
```

## 3. MCP (Modus)

Register remote MCP URL: `http://127.0.0.1:4102/mcp`  
Tools: `case.list`, `case.get`, `case.update`, `refund.post`, `refund.adjust`, `chargeback.file`, `demo.reset`

REST `/v1/*` is a convenience mirror for humans/Postman; agents should use MCP.

**Policies / rules are configured in Modus**, not in this database — see [`MODUS_SETUP.md`](./MODUS_SETUP.md).

## 4. Docs repo

Canonical human + machine contracts also live in the hackathon `docs` repo:

- `docs/contracts/dispute-case-desk-api.md`
- `docs/contracts/dispute-ops/*`
