import { McpServer } from "@modelcontextprotocol/server";
import { getPort } from "../shared/env.js";
import { createAppServer } from "../shared/http.js";
import { registerCaseDeskRest } from "./rest.js";
import { registerCaseDeskTools } from "./tools.js";

const port = getPort("CASE_DESK_MCP_PORT", 4102);

const { listen } = createAppServer({
  name: "dispute-case-desk-mcp",
  port,
  openapiRelPath: "openapi/dispute-case-desk.openapi.yaml",
  postmanRelPath: "postman/dispute-case-desk.postman_collection.json",
  registerRest: registerCaseDeskRest,
  factory: () => {
    const server = new McpServer({
      name: "dispute-case-desk-mcp",
      version: "0.1.0",
    });
    registerCaseDeskTools(server);
    return server;
  },
});

listen();
