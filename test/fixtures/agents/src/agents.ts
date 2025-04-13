import { McpAgent } from "agents/mcp";


export class MyCustomMCP extends McpAgent {
  // @ts-ignore
  server = null;

  init(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export default MyCustomMCP.mount("/mcp", { binding: "MyMCP" });
