# 02 — Modus rules & posture

Configure one demo agent that can reach both MCPs. Policy encodes the shop-demo principles: **geo/reputation gates**, **money thresholds**, **injection → specialist**, **ambiguity → human**.

Runtime path (unchanged):

```text
API key → Agent
  → MCP attached?
  → Role grants tool?
  → Rate limit OK?
  → Rule pack (first enabled match wins)
  → Specialist / human
```

---

## Agent & access

| Setting | Value |
|---|---|
| Agent | `Dispute Ops` (`agt_dispute_01`) |
| Role template | `dispute-operator` |
| Attached MCPs | Card Network Portal, Case Desk |
| Specialist | `Dispute specialist` (local or hosted) |
| Fail-closed | `onFailure: escalate_human` |
| Clear threshold | ~0.82–0.88 (tune in tests) |

### Role grants (`dispute-operator`)

| Grant | Tools |
|---|---|
| Allow | `network.txn.get`, `network.merchant.get`, `network.dispute.get`, `network.dispute.open`, `network.dispute.submit_evidence` |
| Allow | `case.list`, `case.get`, `case.update` |
| Allow (gated by rules) | `network.dispute.accept_representation`, `refund.post`, `refund.adjust`, `chargeback.file` |
| Deny by default | everything else |

Intern / junior variant (optional second role): no `accept_representation`, lower refund cap via rules only.

---

## Condition fields (expose via tool-arg extraction)

Map gateway-extracted fields from tool calls + prior context where needed:

| Field | Source | Used for |
|---|---|---|
| `merchant_country` | `network.merchant.get` / txn | location analogue |
| `trust_score` | merchant | reviews analogue |
| `dispute_rate` | merchant | reputation |
| `fraud_score` | `case.get` | ambiguity band |
| `refund_amount` | `refund.post` | spend-like |
| `txn_amount` | txn / case | mismatch |
| `amount_delta` | `abs(refund_amount - txn_amount)` | partial / over-refund |
| `reason_code` | chargeback / dispute | allowlist |
| `mcc` | txn | risky categories |
| `delta` / `abs_delta` | `refund.adjust` | magazine shrink |
| `reason` | adjust / accept rationale | bad reasons |
| `representation_present` | bool if acting after dispute.get with text | force specialist |
| `merchant_known` | allowlist / first_seen | new merchant |

---

## Rule pack — ordered (first match wins)

Enable top-to-bottom. Empty `and` = always match (use only as final default if needed).

### Pack: `dispute-network-writes`

| # | Tool | When | Outcome | Why |
|---|---|---|---|---|
| N1 | `network.dispute.accept_representation` | `merchant_country` is_empty OR not in `{DE,FR,NL,BE,AT,IE,ES,IT}` | **deny** | Location gate (shop empty/popup) |
| N2 | `network.dispute.accept_representation` | `trust_score` < 3.5 OR `dispute_rate` > 0.15 | **needs_ai** | Weak “reviews” |
| N3 | `network.dispute.accept_representation` | `representation_present` eq true | **needs_ai** | Injection surface — never silent allow |
| N4 | `network.dispute.accept_representation` | `fraud_score` >= 0.4 | **needs_ai** | Ambiguous / fraud-leaning |
| N5 | `network.dispute.open` | `reason_code` not in whitelist | **deny** | Hard policy |
| N6 | `network.dispute.open` | evidence missing AND amount > 50 | **needs_ai** | Incomplete file |
| N7 | `network.dispute.submit_evidence` | — | **allow** | Low risk |

### Pack: `dispute-money`

| # | Tool | When | Outcome | Why |
|---|---|---|---|---|
| M1 | `refund.post` | `refund_amount` > 500 | **deny** | Hard cap |
| M2 | `refund.post` | `amount_delta` > 0.01 AND kind = final | **needs_ai** | Over/under full txn |
| M3 | `refund.post` | `merchant_country` is_empty OR trust_score < 3.5 | **needs_ai** | Don’t auto-pay out blindly |
| M4 | `refund.post` | `fraud_score` between 0.35 and 0.75 | **needs_ai** | Ambiguity band |
| M5 | `refund.post` | amount ≤ 25 AND merchant_known AND fraud_score < 0.3 AND country allowlisted | **allow** | Safe micro path |
| M6 | `refund.post` | amount ≤ 200 AND fraud_score >= 0.8 AND kind = provisional | **allow** | Clear fraud provisional |
| M7 | `refund.post` | — (fallback) | **needs_ai** | Default caution |
| M8 | `refund.adjust` | `reason` not in `{correction, clawback, ops_fix}` | **deny** | Bad shrink reason |
| M9 | `refund.adjust` | `abs_delta` >= 50 | **needs_ai** | Large adjust |
| M10 | `refund.adjust` | `abs_delta` < 50 AND reason allowlisted | **allow** | Small correction |
| M11 | `chargeback.file` | reason_code whitelist AND case has evidence note | **allow** | Happy file |
| M12 | `chargeback.file` | else | **needs_ai** | Incomplete / odd |

### Pack: `dispute-case-reads`

| # | Tool | When | Outcome |
|---|---|---|---|
| C1 | `case.get`, `case.list` | — | **allow** |
| C2 | `case.update` | status in terminal set without prior approval ref | **needs_ai** (optional) |
| C3 | `case.update` | notes-only / non-terminal | **allow** |
| C4 | `network.txn.get`, `network.merchant.get`, `network.dispute.get` | — | **allow** |

---

## Specialist criteria (Dispute specialist)

When rules return `needs_ai`, specialist scores clear-allow vs deny using:

1. **Injection / instruction-like language** in representation or evidence OCR.
2. **Conflict:** high/mid fraud_score vs merchant “customer authorized” narrative.
3. **Merchant integrity:** DBA vs legal name, trust, dispute rate, jurisdiction.
4. **Amount integrity:** refund vs txn; adjust deltas; duplicate refunds.
5. **Policy fit:** reason codes, provisional vs final, customer tier.

| Specialist result | Gateway |
|---|---|
| score ≥ clearThreshold toward allow | forward |
| score ≥ clearThreshold toward deny | block |
| below threshold either way | **caution → human** |
| error / timeout | escalate human (fail-closed) |

**Demo target:** poisoned `accept_representation` → probs near 0.4 / 0.4 → Approvals queue.

---

## Rate limits (per agent)

| Scope | Cap (demo) | Intent |
|---|---|---|
| `refund.post` | low burst (e.g. 3 / 5 min) | Stop loops |
| `chargeback.file` | low burst | Same |
| `accept_representation` | very low | Rare path |
| All tools | higher daily budget | Cost control |

---

## Approvals & audit expectations

Pending approval should show:

- Agent, tool, redacted args (`case_id`, amounts, country, trust_score)
- Matched rule id (e.g. N3 representation_present)
- Specialist version + allow/deny probs
- Actions: Allow / Deny / Allow-with-TTL

Audit event chain: RBAC → rule → specialist → human → forward/block.

---

## Mapping to shop principles

| Shop rule idea | Dispute Modus rule |
|---|---|
| Deny checkout if `shop_location` empty | N1 deny accept if country empty/bad |
| needs_ai popup / remote spend | M3–M4 / N2 trust + fraud band |
| Allow HQ ≤ €50 | M5 micro refund allow |
| Magazine large `abs_delta` → needs_ai | M9 refund.adjust |
| Deny bad shrink reason | M8 bad adjust reason |
| New vendor → needs_ai | merchant_known / first-seen in M3/M7 |

---

## Config checklist (operators)

- [ ] Both MCPs in org catalog and attached to Dispute Ops
- [ ] Role grants match tables above
- [ ] Rule packs enabled in order N → M → C
- [ ] Specialist bound to agent; fail-closed on
- [ ] Approvals webhook optional for Slack notify
- [ ] Simulator scenarios registered for fixtures in [03-tests-secure-vs-naked.md](./03-tests-secure-vs-naked.md)

Next: [03-tests-secure-vs-naked.md](./03-tests-secure-vs-naked.md).
