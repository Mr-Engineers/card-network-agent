import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, type McpServer } from "@modelcontextprotocol/server";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";
import { getHost, getMcpApiKey } from "./env.js";
import { closeSql } from "./db.js";
import { resetDemoSeed } from "./seed.js";
import { mountDocs } from "./openapi.js";

type ServerFactory = () => McpServer;

export function createAppServer(opts: {
  name: string;
  port: number;
  factory: ServerFactory;
  openapiRelPath: string;
  postmanRelPath: string;
  registerRest?: (app: Express, auth: RequestHandler) => void;
}): { app: Express; listen: () => void } {
  const host = getHost();
  const apiKey = getMcpApiKey();

  const app =
    host === "127.0.0.1" || host === "localhost" || host === "::1"
      ? createMcpExpressApp()
      : createMcpExpressApp({
          host: "0.0.0.0",
          allowedHosts: [host, "localhost", "127.0.0.1"],
        });

  // Ensure REST / Postman JSON bodies are parsed (MCP path also benefits).
  app.use(express.json({ limit: "1mb" }));

  const handler = createMcpHandler(opts.factory);
  const node = toNodeHandler(handler);

  const auth: RequestHandler = (req, res, next) => {
    if (!apiKey) {
      next();
      return;
    }
    const header = req.header("authorization") || "";
    const token = header.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : req.header("x-api-key")?.trim();
    if (token !== apiKey) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: opts.name,
      seed: process.env.DEMO_SEED || "dispute_v1",
    });
  });

  app.post("/demo/reset", auth, async (_req, res) => {
    try {
      const result = await resetDemoSeed();
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: message });
    }
  });

  mountDocs(app, {
    openapiRelPath: opts.openapiRelPath,
    postmanRelPath: opts.postmanRelPath,
  });

  opts.registerRest?.(app, auth);

  app.all("/mcp", auth, (req: Request, res: Response) => {
    void node(req, res, req.body);
  });

  const listen = () => {
    const server = app.listen(opts.port, host, () => {
      console.error(
        `[${opts.name}] http://${host}:${opts.port}/mcp  openapi=/openapi.json  postman=/postman.json`,
      );
    });

    const shutdown = async () => {
      server.close();
      await handler.close();
      await closeSql();
      process.exit(0);
    };
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());
  };

  return { app, listen };
}

// keep NextFunction imported for Express typing consistency in consumers
export type { NextFunction };
