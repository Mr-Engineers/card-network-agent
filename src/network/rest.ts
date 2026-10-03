import type { Express, RequestHandler } from "express";
import { param } from "../shared/http-params.js";
import * as svc from "./service.js";

function sendError(res: import("express").Response, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const status =
    err instanceof svc.NotFoundError
      ? 404
      : err instanceof svc.ConflictError
        ? 409
        : 400;
  res.status(status).json({ error: { message } });
}

export function registerNetworkRest(app: Express, auth: RequestHandler) {
  app.get("/v1/transactions/:txn_id", auth, async (req, res) => {
    try {
      res.json(await svc.getTxn(param(req, "txn_id")));
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/v1/merchants/:merchant_id", auth, async (req, res) => {
    try {
      res.json(await svc.getMerchant(param(req, "merchant_id")));
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/v1/disputes/:dispute_id", auth, async (req, res) => {
    try {
      const include =
        req.query.include_raw_representation === undefined
          ? true
          : String(req.query.include_raw_representation) !== "false";
      res.json(
        await svc.getDispute({
          disputeId: param(req, "dispute_id"),
          includeRawRepresentation: include,
        }),
      );
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/v1/disputes", auth, async (req, res) => {
    try {
      const { txn_id, reason_code } = req.body ?? {};
      const created = await svc.openDispute(String(txn_id), String(reason_code));
      res.status(201).json(created);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/v1/disputes/:dispute_id/evidence", auth, async (req, res) => {
    try {
      const { note, urls } = req.body ?? {};
      res.json(
        await svc.submitEvidence(
          param(req, "dispute_id"),
          String(note),
          Array.isArray(urls) ? urls.map(String) : undefined,
        ),
      );
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post(
    "/v1/disputes/:dispute_id/accept-representation",
    auth,
    async (req, res) => {
      try {
        res.json(
          await svc.acceptRepresentation(
            param(req, "dispute_id"),
            req.body?.rationale ? String(req.body.rationale) : undefined,
          ),
        );
      } catch (err) {
        sendError(res, err);
      }
    },
  );
}
