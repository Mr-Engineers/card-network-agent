import { getSql, num } from "../shared/db.js";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

async function appendHistory(
  caseId: string,
  eventType: string,
  details: Record<string, string | number | boolean | null>,
) {
  const sql = getSql();
  await sql`
    INSERT INTO dispute_case_desk.case_history (case_id, event_type, details)
    VALUES (${caseId}, ${eventType}, ${sql.json(details)})
  `;
}

export async function listCases(filters: { status?: string; txnId?: string }) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, txn_id, customer_id, status, fraud_score, customer_tier,
           reason_code_internal, created_at, updated_at
    FROM dispute_case_desk.cases
    WHERE (${filters.status ?? null}::text IS NULL OR status = ${filters.status ?? null})
      AND (${filters.txnId ?? null}::text IS NULL OR txn_id = ${filters.txnId ?? null})
    ORDER BY created_at DESC
  `;
  return {
    cases: rows.map((c) => ({
      ...c,
      fraud_score: num(c.fraud_score),
    })),
  };
}

export async function getCase(caseId: string) {
  const sql = getSql();
  const cases = await sql`
    SELECT * FROM dispute_case_desk.cases WHERE id = ${caseId} LIMIT 1
  `;
  if (!cases[0]) throw new NotFoundError(`case not found: ${caseId}`);
  const c = cases[0];
  const refunds = await sql`
    SELECT id, case_id, amount_eur, kind, status, posted_at, idempotency_key
    FROM dispute_case_desk.refunds WHERE case_id = ${caseId}
    ORDER BY posted_at ASC
  `;
  const chargebacks = await sql`
    SELECT id, case_id, network_dispute_id, reason_code, evidence_note, status, filed_at
    FROM dispute_case_desk.chargeback_intents WHERE case_id = ${caseId}
    ORDER BY filed_at ASC
  `;
  const history = await sql`
    SELECT id, event_type, details, created_at
    FROM dispute_case_desk.case_history WHERE case_id = ${caseId}
    ORDER BY created_at ASC
  `;
  return {
    id: c.id as string,
    txn_id: c.txn_id as string,
    customer_id: c.customer_id as string,
    status: c.status as string,
    fraud_score: num(c.fraud_score),
    customer_tier: c.customer_tier as string,
    internal_notes: c.internal_notes as string,
    reason_code_internal: c.reason_code_internal as string | null,
    created_at: c.created_at,
    updated_at: c.updated_at,
    refunds: refunds.map((r) => ({ ...r, amount_eur: num(r.amount_eur) })),
    chargeback_intents: chargebacks,
    history,
  };
}

export async function updateCase(
  caseId: string,
  patch: { status?: string; notes?: string; reasonCode?: string },
) {
  const sql = getSql();
  const existing = await sql`
    SELECT * FROM dispute_case_desk.cases WHERE id = ${caseId} LIMIT 1
  `;
  if (!existing[0]) throw new NotFoundError(`case not found: ${caseId}`);
  const nextStatus = patch.status ?? (existing[0].status as string);
  const nextNotes =
    patch.notes === undefined
      ? (existing[0].internal_notes as string)
      : patch.notes
        ? `${existing[0].internal_notes}\n${patch.notes}`.trim()
        : (existing[0].internal_notes as string);
  const nextReason = patch.reasonCode ?? (existing[0].reason_code_internal as string | null);
  const rows = await sql`
    UPDATE dispute_case_desk.cases
    SET status = ${nextStatus},
        internal_notes = ${nextNotes},
        reason_code_internal = ${nextReason},
        updated_at = now()
    WHERE id = ${caseId}
    RETURNING *
  `;
  await appendHistory(caseId, "case.update", {
    status: nextStatus,
    reason_code: nextReason,
    notes_appended: patch.notes ?? null,
  });
  const c = rows[0];
  return { ...c, fraud_score: num(c.fraud_score) };
}

export async function postRefund(input: {
  caseId: string;
  amountEur: number;
  kind: "provisional" | "final" | "clawback";
  idempotencyKey?: string;
}) {
  const sql = getSql();
  const key =
    input.idempotencyKey ||
    `refund:${input.caseId}:${input.kind}:${input.amountEur}`;
  const prior = await sql`
    SELECT id, case_id, amount_eur, kind, status, posted_at, idempotency_key
    FROM dispute_case_desk.refunds WHERE idempotency_key = ${key} LIMIT 1
  `;
  if (prior[0]) {
    return {
      idempotent: true,
      refund: { ...prior[0], amount_eur: num(prior[0].amount_eur) },
    };
  }
  const cases = await sql`
    SELECT id FROM dispute_case_desk.cases WHERE id = ${input.caseId} LIMIT 1
  `;
  if (!cases[0]) throw new NotFoundError(`case not found: ${input.caseId}`);
  const id = newId("ref");
  const rows = await sql`
    INSERT INTO dispute_case_desk.refunds
      (id, case_id, amount_eur, kind, status, idempotency_key)
    VALUES (${id}, ${input.caseId}, ${input.amountEur}, ${input.kind}, 'posted', ${key})
    RETURNING *
  `;
  await appendHistory(input.caseId, "refund.post", {
    refund_id: id,
    amount_eur: input.amountEur,
    kind: input.kind,
  });
  await sql`
    UPDATE dispute_case_desk.cases SET updated_at = now() WHERE id = ${input.caseId}
  `;
  return {
    idempotent: false,
    refund: { ...rows[0], amount_eur: num(rows[0].amount_eur) },
  };
}

export async function adjustRefund(
  refundId: string,
  deltaEur: number,
  reason: string,
) {
  const sql = getSql();
  const existing = await sql`
    SELECT * FROM dispute_case_desk.refunds WHERE id = ${refundId} LIMIT 1
  `;
  if (!existing[0]) throw new NotFoundError(`refund not found: ${refundId}`);
  const nextAmount = num(existing[0].amount_eur) + deltaEur;
  if (nextAmount < 0) throw new Error("adjusted amount cannot be negative");
  const rows = await sql`
    UPDATE dispute_case_desk.refunds
    SET amount_eur = ${nextAmount}
    WHERE id = ${refundId}
    RETURNING *
  `;
  await appendHistory(existing[0].case_id as string, "refund.adjust", {
    refund_id: refundId,
    delta_eur: deltaEur,
    reason,
    amount_eur: nextAmount,
  });
  return {
    refund: { ...rows[0], amount_eur: num(rows[0].amount_eur) },
    delta_eur: deltaEur,
    abs_delta: Math.abs(deltaEur),
    reason,
  };
}

export async function fileChargeback(input: {
  caseId: string;
  reasonCode: string;
  evidenceNote?: string;
  networkDisputeId?: string;
  idempotencyKey?: string;
}) {
  const sql = getSql();
  const key =
    input.idempotencyKey ||
    `cb:${input.caseId}:${input.reasonCode}:${input.networkDisputeId || ""}`;
  const prior = await sql`
    SELECT * FROM dispute_case_desk.chargeback_intents
    WHERE idempotency_key = ${key} LIMIT 1
  `;
  if (prior[0]) return { idempotent: true, intent: prior[0] };
  const cases = await sql`
    SELECT id FROM dispute_case_desk.cases WHERE id = ${input.caseId} LIMIT 1
  `;
  if (!cases[0]) throw new NotFoundError(`case not found: ${input.caseId}`);
  const id = newId("cb");
  const rows = await sql`
    INSERT INTO dispute_case_desk.chargeback_intents
      (id, case_id, network_dispute_id, reason_code, evidence_note, status, idempotency_key)
    VALUES (
      ${id}, ${input.caseId}, ${input.networkDisputeId || null}, ${input.reasonCode},
      ${input.evidenceNote || null}, 'filed', ${key}
    )
    RETURNING *
  `;
  await appendHistory(input.caseId, "chargeback.file", {
    intent_id: id,
    reason_code: input.reasonCode,
    network_dispute_id: input.networkDisputeId || null,
  });
  await sql`
    UPDATE dispute_case_desk.cases
    SET status = 'chargeback_filed', updated_at = now()
    WHERE id = ${input.caseId}
  `;
  return { idempotent: false, intent: rows[0] };
}
