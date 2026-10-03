import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { errorResult, jsonResult } from "../shared/db.js";
import { resetDemoSeed } from "../shared/seed.js";
import * as svc from "./service.js";

function asToolResult(fn: () => Promise<unknown>) {
  return fn()
    .then((data) => jsonResult(data))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(message);
    });
}

export function registerCaseDeskTools(server: McpServer) {
  server.registerTool(
    "case.list",
    {
      description: "List internal dispute cases (optional status / txn filters).",
      inputSchema: z.object({
        status: z.string().optional(),
        txn_id: z.string().optional(),
      }),
    },
    async ({ status, txn_id }) =>
      asToolResult(() => svc.listCases({ status, txnId: txn_id })),
  );

  server.registerTool(
    "case.get",
    {
      description:
        "Get a case with fraud_score, txn_id, refunds, chargebacks, and history.",
      inputSchema: z.object({
        case_id: z.string().min(1),
      }),
    },
    async ({ case_id }) => asToolResult(() => svc.getCase(case_id)),
  );

  server.registerTool(
    "case.update",
    {
      description: "Update case status, notes, or internal reason code.",
      inputSchema: z.object({
        case_id: z.string().min(1),
        status: z.string().optional(),
        notes: z.string().optional(),
        reason_code: z.string().optional(),
      }),
    },
    async ({ case_id, status, notes, reason_code }) =>
      asToolResult(() =>
        svc.updateCase(case_id, {
          status,
          notes,
          reasonCode: reason_code,
        }),
      ),
  );

  server.registerTool(
    "refund.post",
    {
      description:
        "Post a provisional/final/clawback refund against a case (money out).",
      inputSchema: z.object({
        case_id: z.string().min(1),
        amount_eur: z.number().positive(),
        kind: z.enum(["provisional", "final", "clawback"]),
        idempotency_key: z.string().optional(),
      }),
    },
    async ({ case_id, amount_eur, kind, idempotency_key }) =>
      asToolResult(() =>
        svc.postRefund({
          caseId: case_id,
          amountEur: amount_eur,
          kind,
          idempotencyKey: idempotency_key,
        }),
      ),
  );

  server.registerTool(
    "refund.adjust",
    {
      description:
        "Adjust a posted refund by delta_eur (magazine shrink analogue).",
      inputSchema: z.object({
        refund_id: z.string().min(1),
        delta_eur: z.number(),
        reason: z.string().min(1),
      }),
    },
    async ({ refund_id, delta_eur, reason }) =>
      asToolResult(() => svc.adjustRefund(refund_id, delta_eur, reason)),
  );

  server.registerTool(
    "chargeback.file",
    {
      description: "File a chargeback intent for a case (irreversible ops path).",
      inputSchema: z.object({
        case_id: z.string().min(1),
        reason_code: z.string().min(1),
        evidence_note: z.string().optional(),
        network_dispute_id: z.string().optional(),
        idempotency_key: z.string().optional(),
      }),
    },
    async ({
      case_id,
      reason_code,
      evidence_note,
      network_dispute_id,
      idempotency_key,
    }) =>
      asToolResult(() =>
        svc.fileChargeback({
          caseId: case_id,
          reasonCode: reason_code,
          evidenceNote: evidence_note,
          networkDisputeId: network_dispute_id,
          idempotencyKey: idempotency_key,
        }),
      ),
  );

  server.registerTool(
    "demo.reset",
    {
      description: "Reset demo fixtures for Network Portal and Case Desk schemas.",
      inputSchema: z.object({}),
    },
    async () => asToolResult(() => resetDemoSeed()),
  );
}
