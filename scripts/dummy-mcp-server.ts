import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "rottra-dummy-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_market_price",
        description: "Lấy giá nông sản thị trường thời gian thực",
        inputSchema: {
          type: "object",
          properties: {
            productName: {
              type: "string",
              description: "Tên nông sản cần lấy giá (ví dụ: cà phê, hồ tiêu, sầu riêng)",
            },
          },
          required: ["productName"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_market_price") {
    const productName = String(request.params.arguments?.productName).toLowerCase();
    let price = "Không rõ";
    if (productName.includes("cà phê") || productName.includes("coffee")) {
      price = "120,000 VNĐ/kg";
    } else if (productName.includes("tiêu") || productName.includes("pepper")) {
      price = "150,000 VNĐ/kg";
    } else if (productName.includes("sầu riêng") || productName.includes("durian")) {
      price = "80,000 VNĐ/kg";
    }

    return {
      content: [
        {
          type: "text",
          text: `Giá thị trường hiện tại của ${productName} là: ${price}`,
        },
      ],
    };
  }
  
  throw new Error("Tool not found");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Dummy MCP Server running on stdio");
}

main().catch(console.error);
