import { botActionsMap, BotActionHelpers, BotActionResult } from "./bot-actions";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export const MCP_TOOLS: MCPTool[] = [
  {
    name: "add_product",
    description: "Thêm một sản phẩm nông sản mới vào sàn giao dịch của phân cách.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tên sản phẩm nông sản (Ví dụ: Tỏi cô đơn Lý Sơn 🧄)" },
        category: { type: "string", description: "Danh mục sản phẩm (Trái cây, Dược liệu, Gia vị, Trà...)" },
        description: { type: "string", description: "Mô tả chi tiết về sản phẩm nông sản" },
        price: { type: "number", description: "Đơn giá sản phẩm (đơn vị: VNĐ)" },
        quantity: { type: "number", description: "Số lượng kho hàng ban đầu" },
      },
      required: ["name", "category"],
    },
  },
  {
    name: "edit_product",
    description: "Cập nhật thông tin chi tiết hoặc điều chỉnh giá bán của một sản phẩm hiện có.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "ID của sản phẩm cần chỉnh sửa" },
        name: { type: "string", description: "Tên sản phẩm mới (nếu muốn đổi)" },
        price: { type: "number", description: "Đơn giá mới muốn điều chỉnh" },
        quantity: { type: "number", description: "Cập nhật lại số lượng tồn kho" },
      },
      required: ["productId"],
    },
  },
  {
    name: "delete_product",
    description: "Xóa hoàn toàn sản phẩm nông sản ra khỏi sàn giao dịch.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "ID sản phẩm cần xóa" },
      },
      required: ["productId"],
    },
  },
  {
    name: "fix_product_image",
    description: "Sửa lỗi hoặc phục hồi định dạng ảnh của sản phẩm nông sản về chuẩn 3D SVG.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "ID sản phẩm cần sửa ảnh" },
      },
      required: ["productId"],
    },
  },
  {
    name: "generate_product_image",
    description: "Sử dụng Rottra Local Diffuser tạo ra ảnh sản phẩm nghệ thuật theo mô tả (prompt).",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "ID sản phẩm cần vẽ ảnh mới" },
        prompt: { type: "string", description: "Mô tả bức ảnh nghệ thuật muốn vẽ" },
      },
      required: ["productId"],
    },
  },
  {
    name: "generate_product_video",
    description: "Sử dụng Hyperframes để tự động dựng kịch bản và sản xuất video quảng cáo ngắn cho sản phẩm.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "ID sản phẩm cần dựng video quảng cáo" },
      },
      required: ["productId"],
    },
  },
  {
    name: "generate_3d_product_image",
    description: "Tạo ảnh kết xuất 3D siêu thực (Ngoại tuyến 100%) cho sản phẩm nông sản.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "ID sản phẩm cần tạo ảnh 3D" },
      },
      required: ["productId"],
    },
  },
];

// Bản đồ ánh xạ tên MCP Tool sang action key nội bộ của BotActionsMap
const mcpActionMapping: Record<string, string> = {
  add_product: "add",
  edit_product: "edit",
  delete_product: "delete",
  fix_product_image: "fix-image",
  generate_product_image: "image",
  generate_product_video: "video",
  generate_3d_product_image: "3d",
};

export async function executeMCPTool(
  toolName: string,
  args: any,
  userId: string,
  agentId: string,
  helpers: BotActionHelpers,
): Promise<BotActionResult> {
  const actionKey = mcpActionMapping[toolName];
  if (!actionKey) {
    return { success: false, action: toolName, message: `MCP Tool '${toolName}' not supported by Rottra Server.` };
  }

  const executor = botActionsMap.get(actionKey);
  if (!executor) {
    return { success: false, action: toolName, message: `Internal action executor for '${actionKey}' not found.` };
  }

  console.log(`\n🔌 [MCP Server] Executing tool: ${toolName}`);
  console.log(`   ├─ Persona: ${agentId}`);
  console.log(`   └─ Arguments: ${JSON.stringify(args)}\n`);

  try {
    return await executor.execute(userId, agentId, helpers, args);
  } catch (error: any) {
    console.error(`❌ [MCP Server Error] Execution failed for ${toolName}:`, error);
    return { success: false, action: toolName, message: error.message };
  }
}
