import { hc } from "hono/client";
import type { RpcAppType } from "~/server/rpc/rpc-router";

// Khởi tạo RPC Client bọc toàn bộ kiểu dữ liệu từ Backend
// "hc" là Hono Client, nó sẽ tự động đọc RpcAppType để sinh ra các hàm gọi API
export const rpc = hc<RpcAppType>("/api/rpc");

/*
Ví dụ cách sử dụng ở bất kỳ file giao diện SolidJS nào:
------------------------------------------------------
import { rpc } from "../lib/rpcClient";

// Gọi API lấy sản phẩm:
const res = await rpc.products.$get();
const data = await res.json();
console.log(data.products); // Tự động nhận diện có biến `products`

// Gửi data lên server (như Server Actions):
const res2 = await rpc.echo.$post({ json: { message: "Hello Backend" } });
const reply = await res2.json();
console.log(reply.serverTime); // Tự động nhận diện có `serverTime`
*/
