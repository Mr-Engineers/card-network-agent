import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { errorResult, jsonResult } from "../shared/db.js";
import { resetDemoSeed } from "../shared/seed.js";
import * as svc from "./service.js";

function mapError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return errorResult(message);
}

export function registerNetworkTools(server: McpServer) {
  server.registerTool(
    "network.txn.get",
    {
      description:
        "Get a card-network transaction by id (amount, MCC, countries, merchant_id).",
      inputSchema: z.object({ txn_id: z.string().min(1) }),
    },
    async ({ txn_id }) => {
      try {
        return jsonResult(await svc.getTxn(txn_id));
      } catch (err) {
        return mapError(err);
      }
    },
  );

  server.registerTool(
    "network.merchant.get",
    {
      description:
        "Get merchant reputation and location (trust_score, dispute_rate, country).",
      inputSchema: z.object({ merchant_id: z.string().min(1) }),
    },
    async ({ merchant_id }) => {
      try {
        return jsonResult(await svc.getMerchant(merchant_id));
      } catch (err) {
        return mapError(err);
      }
    },
  );

  server.registerTool(
    "network.dispute.get",
    {
      description:
        "Get dispute details including merchant representation_text (untrusted free text).",
      inputSchema: z.object({
        dispute_id: z.string().optional(),
        txn_id: z.string().optional(),
        include_raw_representation: z.boolean().optional().default(true),
      }),
    },
    async ({ dispute_id, txn_id, include_raw_representation }) => {
      try {
        return jsonResult(
          await svc.getDispute({
            disputeId: dispute_id,
            txnId: txn_id,
            includeRawRepresentation: include_raw_representation,
          }),
        );
      } catch (err) {
        return mapError(err);
      }
    },
  );

  server.registerTool(
    "network.dispute.open",
    {
      description: "Open a new network dispute on a transaction.",
      inputSchema: z.object({
        txn_id: z.string().min(1),
        reason_code: z.string().min(1),
      }),
    },
    async ({ txn_id, reason_code }) => {
      try {
        return jsonResult(await svc.openDispute(txn_id, reason_code));
      } catch (err) {
        return mapError(err);
      }
    },
  );

  server.registerTool(
    "network.dispute.submit_evidence",
    {
      description: "Submit evidence note/URLs on an open network dispute.",
      inputSchema: z.object({
        dispute_id: z.string().min(1),
        note: z.string().min(1),
        urls: z.array(z.string()).optional(),
      }),
    },
    async ({ dispute_id, note, urls }) => {
      try {
        return jsonResult(await svc.submitEvidence(dispute_id, note, urls));
      } catch (err) {
        return mapError(err);
      }
    },
  );

  server.registerTool(
    "network.dispute.accept_representation",
    {
      description:
        "Close dispute in merchant favor based on representation. High-risk write; no bank-side checks.",
      inputSchema: z.object({
        dispute_id: z.string().min(1),
        rationale: z.string().optional(),
      }),
    },
    async ({ dispute_id, rationale }) => {
      try {
        return jsonResult(await svc.acceptRepresentation(dispute_id, rationale));
      } catch (err) {
        return mapError(err);
      }
    },
  );

  server.registerTool(
    "demo.reset",
    {
      description: "Reset demo fixtures for Network Portal and Case Desk schemas.",
      inputSchema: z.object({}),
    },
    async () => jsonResult(await resetDemoSeed()),
  );
}
