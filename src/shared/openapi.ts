import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { Express, RequestHandler } from "express";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function loadText(relPath: string): string {
  return readFileSync(join(root, relPath), "utf8");
}

export function mountDocs(
  app: Express,
  opts: {
    openapiRelPath: string;
    postmanRelPath: string;
    auth?: RequestHandler;
  },
) {
  const openapiYaml = loadText(opts.openapiRelPath);
  const openapiJson = parseYaml(openapiYaml);
  const postmanJson = loadText(opts.postmanRelPath);

  app.get("/openapi.yaml", (_req, res) => {
    res.type("text/yaml").send(openapiYaml);
  });

  app.get("/openapi.json", (_req, res) => {
    res.json(openapiJson);
  });

  app.get("/postman.json", (_req, res) => {
    res.type("application/json").send(postmanJson);
  });
}
