# API usage — Dispute Ops MCP backends

Two HTTP services expose **MCP** (agent surface) plus **REST mirrors** (Postman / humans).

| Service | Default base | OpenAPI | Postman |
|---|---|---|---|
| Network Portal | `http://127.0.0.1:4101` | [`/openapi.json`](http://127.0.0.1:4101/openapi.json) | [`/postman.json`](http://127.0.0.1:4101/postman.json) |
| Case Desk | `http://127.0.0.1:4102` | [`/openapi.json`](http://127.0.0.1:4102/openapi.json) | [`/postman.json`](http://127.0.0.1:4102/postman.json) |

Source files in-repo:

- OpenAPI: [`openapi/dispute-network.openapi.yaml`](../openapi/dispute-network.openapi.yaml), [`openapi/dispute-case-desk.openapi.yaml`](../openapi/dispute-case-desk.openapi.yaml)
- Postman: [`postman/`](../postman/)
- Org docs: [`Mr-Engineers/docs` contracts](https://github.com/Mr-Engineers/docs/tree/master/contracts)

## Quick start

```bash
cp .env.example .env   # set DATABASE_URL
npm install
npm run seed
npm run start:network    # :4101
npm run start:case-desk  # :4102
```

## Postman

1. Import `postman/dispute-network.postman_collection.json`
2. Import `postman/dispute-case-desk.postman_collection.json`
3. Import `postman/dispute-ops.postman_environment.json` and select it
4. Run **Ops → Demo reset**, then REST or MCP folders

If `MCP_API_KEY` is set in `.env`, put the same value in collection/environment `apiKey` (`X-Api-Key`).

## MCP (Modus / agents)

Register remote MCP URLs:

```text
NETWORK_MCP_URL=http://127.0.0.1:4101/mcp
CASE_DESK_MCP_URL=http://127.0.0.1:4102/mcp
```

`POST /mcp` accepts JSON-RPC (`initialize`, `tools/list`, `tools/call`) with:

```http
Content-Type: application/json
Accept: application/json, text/event-stream
```

Example tool call:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "network.dispute.get",
    "arguments": { "dispute_id": "disp_poisoned" }
  }
}
```

## REST mirrors

Same business logic as MCP tools, easier for curl/Postman:

| MCP tool | REST |
|---|---|
| `network.txn.get` | `GET /v1/transactions/{txn_id}` |
| `network.merchant.get` | `GET /v1/merchants/{merchant_id}` |
| `network.dispute.get` | `GET /v1/disputes/{dispute_id}` |
| `network.dispute.accept_representation` | `POST /v1/disputes/{id}/accept-representation` |
| `case.get` | `GET /v1/cases/{case_id}` |
| `refund.post` | `POST /v1/refunds` |
| `chargeback.file` | `POST /v1/chargebacks` |

## Demo fixtures

Full Modus scenario matrix (T1–T12): [`scenarios/`](./scenarios/).

`POST /demo/reset` (or MCP `demo.reset`) restores both schemas.
