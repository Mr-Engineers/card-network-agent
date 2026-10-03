import { McpServer } from "@modelcontextprotocol/server";
import { getPort } from "../shared/env.js";
import { createAppServer } from "../shared/http.js";
import { registerNetworkRest } from "./rest.js";
import { registerNetworkTools } from "./tools.js";

const port = getPort("NETWORK_MCP_PORT", 4101);

const { listen } = createAppServer({
  name: "dispute-network-mcp",
  port,
  openapiRelPath: "openapi/dispute-network.openapi.yaml",
  postmanRelPath: "postman/dispute-network.postman_collection.json",
  registerRest: registerNetworkRest,
  factory: () => {
    const server = new McpServer({
      name: "dispute-network-mcp",
      version: "0.1.0",
    });
    registerNetworkTools(server);
    return server;
  },
});

listen();
