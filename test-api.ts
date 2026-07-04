import { handleChatExpert } from "./src/server/api/agent-chat";

async function run() {
  const reqObj = {
    query: "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 11)",
    tenantId: "default",
    usePrivateBrain: false,
    role: "admin"
  };

  const mockContext: any = {
    req: {
      json: async () => reqObj,
      header: (name: string) => null,
      query: (name: string) => null,
    },
    get: (key: string) => {
      if (key === "user") return { id: "admin-123", role: "admin" };
      return null;
    },
    json: (data: any, status?: number) => {
      return { status: status || 200, data };
    }
  };

  console.log("[TEST API] Sending request to handleChatExpert (Admin)...");
  const response = await handleChatExpert(mockContext);
  
  console.log("\n[API RESPONSE]:");
  console.log(JSON.stringify(response.data, null, 2));
  
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
