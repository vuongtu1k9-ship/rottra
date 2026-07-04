import { mcpManager } from "../src/core/nlp-cognitive/mcp-client";

async function testMcp() {
  console.log("Starting MCP Test...");

  // Start dummy MCP server using bun
  await mcpManager.connectStdio(
    "dummy-market",
    "bun",
    ["run", "scripts/dummy-mcp-server.ts"]
  );

  console.log("\nFetching tools from MCP server...");
  const tools = await mcpManager.getAllTools();
  console.log("Available tools:", JSON.stringify(tools, null, 2));

  if (tools.some(t => t.name === "get_market_price")) {
    console.log("\nCalling get_market_price for Cà phê...");
    const result = await mcpManager.callTool("dummy-market", "get_market_price", {
      productName: "cà phê"
    });
    console.log("Result:", JSON.stringify(result, null, 2));
    
    console.log("\nCalling get_market_price for Sầu riêng...");
    const result2 = await mcpManager.callTool("dummy-market", "get_market_price", {
      productName: "sầu riêng"
    });
    console.log("Result 2:", JSON.stringify(result2, null, 2));
  }

  // Integration test with AI
  // Since Vercel AI SDK needs to be passed these tools, we would convert them:
  // const aiTools = tools.reduce((acc, tool) => {
  //   acc[tool.name] = tool( ... )
  //   return acc;
  // }, {});

  await mcpManager.disconnect("dummy-market");
  console.log("\nMCP Test Completed.");
  process.exit(0);
}

testMcp().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
