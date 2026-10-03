import type { Express, RequestHandler } from "express";
import { param } from "../shared/http-params.js";
import * as svc from "./service.js";

function sendError(res: import("express").Response, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const status = err instanceof svc.NotFoundError ? 404 : 400;
  res.status(status).json({ error: { message } });
}

/** REST mirrors of Case Desk MCP tools — used by OpenAPI / Postman. */
export function registerCaseDeskRest(app: Express, auth: RequestHandler) {
  app.get("/v1/cases", auth, async (req, res) => {
    try {
      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;
      const txnId =
        typeof req.query.txn_id === "string" ? req.query.txn_id : undefined;
      res.json(await svc.listCases({ status, txnId }));
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/v1/cases/:case_id", auth, async (req, res) => {
    try {
      res.json(await svc.getCase(param(req, "case_id")));
    } catch (err) {
      sendError(res, err);
    }
  });

  app.patch("/v1/cases/:case_id", auth, async (req, res) => {
    try {
      const body = req.body ?? {};
      res.json(
        await svc.updateCase(param(req, "case_id"), {
          status: body.status ? String(body.status) : undefined,
          notes: body.notes !== undefined ? String(body.notes) : undefined,
          reasonCode:
            body.reason_code !== undefined
              ? String(body.reason_code)
              : undefined,
        }),
      );
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/v1/refunds", auth, async (req, res) => {
    try {
      const body = req.body ?? {};
      const idempotencyKey =
        req.header("idempotency-key") || body.idempotency_key;
      const result = await svc.postRefund({
        caseId: String(body.case_id),
        amountEur: Number(body.amount_eur),
        kind: body.kind,
        idempotencyKey: idempotencyKey
          ? String(idempotencyKey)
          : undefined,
      });
      res.status(result.idempotent ? 200 : 201).json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/v1/refunds/:refund_id/adjust", auth, async (req, res) => {
    try {
      const body = req.body ?? {};
      res.json(
        await svc.adjustRefund(
          param(req, "refund_id"),
          Number(body.delta_eur),
          String(body.reason),
        ),
      );
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/v1/chargebacks", auth, async (req, res) => {
    try {
      const body = req.body ?? {};
      const idempotencyKey =
        req.header("idempotency-key") || body.idempotency_key;
      const result = await svc.fileChargeback({
        caseId: String(body.case_id),
        reasonCode: String(body.reason_code),
        evidenceNote: body.evidence_note
          ? String(body.evidence_note)
          : undefined,
        networkDisputeId: body.network_dispute_id
          ? String(body.network_dispute_id)
          : undefined,
        idempotencyKey: idempotencyKey
          ? String(idempotencyKey)
          : undefined,
      });
      res.status(result.idempotent ? 200 : 201).json(result);
    } catch (err) {
      sendError(res, err);
    }
  });
}
