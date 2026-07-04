import { WebSocketServer, WebSocket } from "ws";
import { createAdaptorServer } from "@hono/node-server";
import rootApp from "../routes/api/[...paths]";
import url from "url";

const PORT = parseInt(process.env.PORT || "8080", 10);

// Create HTTP server running Hono rootApp
const server = createAdaptorServer(rootApp);

// Create WebSocket server attached to HTTP server for WebRTC P2P Mesh
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const parsedUrl = url.parse(req.url || "", true);
  if (parsedUrl.pathname === "/gold-prices/live") {
    console.log("[Gold Server] Client connected to live gold prices stream!");

    ws.send(
      JSON.stringify({
        buy: 148800000,
        sell: 151800000,
        updatedText: `Cập nhật Live: ${new Date().toLocaleTimeString()}`,
      }),
    );

    const intervalId = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const randomChangeBuy = (Math.random() - 0.5) * 400000;
        const randomChangeSell = (Math.random() - 0.5) * 400000;
        const mockBuy = 148800000 + Math.round(randomChangeBuy);
        const mockSell = 151800000 + Math.round(randomChangeSell);

        ws.send(
          JSON.stringify({
            buy: mockBuy,
            sell: mockSell,
            updatedText: `Cập nhật Live: ${new Date().toLocaleTimeString()}`,
          }),
        );
      }
    }, 5000);

    ws.on("close", () => {
      clearInterval(intervalId);
      console.log("[Gold Server] Client disconnected from live gold prices stream.");
    });
    return;
  }

  const parameters = parsedUrl.query;
  const room = (parameters.room as string) || "default";
  (ws as any).room = room;
  (ws as any).isAlive = true;

  if (room !== "default") {
    console.log(`[WS] Client connected to room: ${room}`);
  }

  ws.on("pong", () => {
    (ws as any).isAlive = true;
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Handle application-level ping to keep connection alive
      if (data.type === "ping") {
        (ws as any).isAlive = true;
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      const isGlobal = data.type === "trade-sync" || data.type === "global" || data.type === "swarm-telemetry-update" || !room;

      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          if (isGlobal || (client as any).room === room) {
            client.send(message);
          }
        }
      });
    } catch (e) {
      // Fallback: broadcast to everyone in the same room
      wss.clients.forEach((client) => {
        if (client !== ws && (client as any).room === room && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });

  ws.on("close", (code, reason) => {
    if (code !== 1000 && code !== 1001 && code !== 1005 && code !== 1006) {
      console.error(
        `❌ [WS] Client failed to stay connected to room: ${room} (code: ${code}, reason: ${reason ? reason.toString() : "none"})`,
      );
    }
  });
});

// Protocol-level ping interval every 30 seconds to detect dead/idle sockets
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const extWs = ws as any;
    if (extWs.isAlive === false) {
      console.warn(`⚠️ [WS] Terminating dead/idle connection in room: ${extWs.room}`);
      return ws.terminate();
    }
    extWs.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});

// Listen on 0.0.0.0 for public cloud access
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Unified Production Server running Hono + WebSockets on port ${PORT}`);
});
