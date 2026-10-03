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

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export async function getTxn(txnId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, merchant_id, amount_eur, currency, mcc, merchant_country,
           acquirer_country, auth_at, card_last4, status
    FROM dispute_network.transactions
    WHERE id = ${txnId}
    LIMIT 1
  `;
  if (!rows[0]) throw new NotFoundError(`transaction not found: ${txnId}`);
  const t = rows[0];
  return {
    id: t.id as string,
    merchant_id: t.merchant_id as string,
    amount_eur: num(t.amount_eur),
    currency: t.currency as string,
    mcc: t.mcc as string | null,
    merchant_country: t.merchant_country as string,
    acquirer_country: t.acquirer_country as string,
    auth_at: t.auth_at,
    card_last4: t.card_last4 as string,
    status: t.status as string,
  };
}

export async function getMerchant(merchantId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, dba_name, legal_name, country, acquirer_id, trust_score,
           dispute_rate, review_count, mcc_primary, first_seen_at
    FROM dispute_network.merchants
    WHERE id = ${merchantId}
    LIMIT 1
  `;
  if (!rows[0]) throw new NotFoundError(`merchant not found: ${merchantId}`);
  const m = rows[0];
  return {
    id: m.id as string,
    dba_name: m.dba_name as string,
    legal_name: m.legal_name as string,
    country: m.country as string,
    acquirer_id: m.acquirer_id as string | null,
    trust_score: num(m.trust_score),
    dispute_rate: num(m.dispute_rate),
    review_count: m.review_count as number,
    mcc_primary: m.mcc_primary as string | null,
    first_seen_at: m.first_seen_at,
    merchant_known: Boolean(m.first_seen_at),
  };
}

export async function getDispute(opts: {
  disputeId?: string;
  txnId?: string;
  includeRawRepresentation?: boolean;
}) {
  if (!opts.disputeId && !opts.txnId) {
    throw new Error("provide dispute_id or txn_id");
  }
  const sql = getSql();
  const rows = opts.disputeId
    ? await sql`
        SELECT id, txn_id, reason_code, status, representation_text,
               evidence_urls, evidence_notes, opened_at, closed_at, close_rationale
        FROM dispute_network.disputes
        WHERE id = ${opts.disputeId}
        LIMIT 1
      `
    : await sql`
        SELECT id, txn_id, reason_code, status, representation_text,
               evidence_urls, evidence_notes, opened_at, closed_at, close_rationale
        FROM dispute_network.disputes
        WHERE txn_id = ${opts.txnId!}
        ORDER BY opened_at DESC
        LIMIT 1
      `;
  if (!rows[0]) throw new NotFoundError("dispute not found");
  const d = rows[0];
  const include = opts.includeRawRepresentation !== false;
  const representation = include
    ? d.representation_text
    : d.representation_text
      ? "[redacted — set include_raw_representation=true]"
      : null;
  return {
    id: d.id as string,
    txn_id: d.txn_id as string,
    reason_code: d.reason_code as string,
    status: d.status as string,
    representation_text: representation as string | null,
    representation_present: Boolean(d.representation_text),
    evidence_urls: d.evidence_urls as string[],
    evidence_notes: d.evidence_notes as string[],
    opened_at: d.opened_at,
    closed_at: d.closed_at,
    close_rationale: d.close_rationale as string | null,
  };
}

export async function openDispute(txnId: string, reasonCode: string) {
  const sql = getSql();
  const tx = await sql`
    SELECT id FROM dispute_network.transactions WHERE id = ${txnId} LIMIT 1
  `;
  if (!tx[0]) throw new NotFoundError(`transaction not found: ${txnId}`);
  const id = newId("disp");
  const rows = await sql`
    INSERT INTO dispute_network.disputes (id, txn_id, reason_code, status)
    VALUES (${id}, ${txnId}, ${reasonCode}, 'open')
    RETURNING id, txn_id, reason_code, status, opened_at
  `;
  return { dispute_id: rows[0].id as string, ...rows[0] };
}

export async function submitEvidence(
  disputeId: string,
  note: string,
  urls?: string[],
) {
  const sql = getSql();
  const existing = await sql`
    SELECT id, status, evidence_urls, evidence_notes
    FROM dispute_network.disputes WHERE id = ${disputeId} LIMIT 1
  `;
  if (!existing[0]) throw new NotFoundError(`dispute not found: ${disputeId}`);
  if (existing[0].status !== "open") {
    throw new ConflictError(`dispute is not open: ${existing[0].status}`);
  }
  const nextUrls = [...((existing[0].evidence_urls as string[]) || []), ...(urls || [])];
  const nextNotes = [...((existing[0].evidence_notes as string[]) || []), note];
  await sql`
    UPDATE dispute_network.disputes
    SET evidence_urls = ${nextUrls}, evidence_notes = ${nextNotes}
    WHERE id = ${disputeId}
  `;
  return { ok: true, dispute_id: disputeId, evidence_urls: nextUrls, evidence_notes: nextNotes };
}

export async function acceptRepresentation(disputeId: string, rationale?: string) {
  const sql = getSql();
  const existing = await sql`
    SELECT id, status FROM dispute_network.disputes WHERE id = ${disputeId} LIMIT 1
  `;
  if (!existing[0]) throw new NotFoundError(`dispute not found: ${disputeId}`);
  if (existing[0].status !== "open") {
    throw new ConflictError(`dispute already closed: ${existing[0].status}`);
  }
  const rows = await sql`
    UPDATE dispute_network.disputes
    SET status = 'closed_favor_merchant',
        closed_at = now(),
        close_rationale = ${rationale || "accepted_representation"}
    WHERE id = ${disputeId}
    RETURNING id, txn_id, status, closed_at, close_rationale
  `;
  return {
    ok: true,
    dispute_id: rows[0].id as string,
    status: rows[0].status as string,
    closed_at: rows[0].closed_at,
    close_rationale: rows[0].close_rationale as string,
  };
}
