import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class McpClientManager {
  private static instance: McpClientManager;
  private clients: Map<string, Client> = new Map();

  private constructor() {}

  public static getInstance(): McpClientManager {
    if (!McpClientManager.instance) {
      McpClientManager.instance = new McpClientManager();
    }
    return McpClientManager.instance;
  }

  /**
   * Connects to a local MCP server using Stdio transport.
   */
  public async connectStdio(serverId: string, command: string, args: string[]): Promise<void> {
    if (this.clients.has(serverId)) {
      return;
    }

    try {
      const transport = new StdioClientTransport({
        command,
        args
      });

      const client = new Client(
        { name: `rottra-mcp-${serverId}`, version: "1.0.0" },
        { capabilities: {} }
      );

      await client.connect(transport);
      this.clients.set(serverId, client);
      console.log(`[MCP] Connected to server: ${serverId}`);
    } catch (err) {
      console.error(`[MCP] Failed to connect to server ${serverId}:`, err);
    }
  }

  /**
   * Disconnect a server
   */
  public async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.close();
      this.clients.delete(serverId);
    }
  }

  /**
   * Retrieve all tools from all connected MCP servers.
   * Returns a list of standardized tool formats.
   */
  public async getAllTools() {
    const allTools: Array<{
      serverId: string;
      name: string;
      description: string;
      inputSchema: any;
    }> = [];

    for (const [serverId, client] of this.clients.entries()) {
      try {
        const response = await client.listTools();
        if (response?.tools) {
          for (const tool of response.tools) {
            allTools.push({
              serverId,
              name: tool.name,
              description: tool.description || "",
              inputSchema: tool.inputSchema
            });
          }
        }
      } catch (err) {
        console.error(`[MCP] Failed to list tools for ${serverId}:`, err);
      }
    }

    return allTools;
  }

  /**
   * Call a tool on a specific server
   */
  public async callTool(serverId: string, toolName: string, args: any): Promise<any> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`MCP server ${serverId} is not connected`);
    }

    console.log(`[MCP] Calling tool ${toolName} on server ${serverId} with args:`, args);
    const result = await client.callTool({
      name: toolName,
      arguments: args
    });

    return result;
  }
}

export const mcpManager = McpClientManager.getInstance();
