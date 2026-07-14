import { WebSocketServer, WebSocket } from "ws";
import http from "node:http";
import url from "node:url";

// A blazing-fast WebSocket signaling server for WebRTC P2P Mesh using the 'ws' package
const PORT = 8080;

// Create HTTP server for fallback messages and REST endpoints
const server = http.createServer((req, res) => {
  // Handle CORS and Private Network Access (PNA) preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE, UPGRADE");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Private-Network", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebRTC Signaling Server is running on WS!");
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const parsedUrl = url.parse(req.url || "", true);
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
    // Only log abnormal disconnects (e.g. failure to stay connected / errors), ignore 1006 (Abnormal Closure) which is normal on page reloads
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

server.listen(PORT, () => {
  console.log(`[WS] WebRTC Signaling Server listening on port ${PORT}`);

  // Start the DB Flusher Worker
  try {
    const workerPath = url.fileURLToPath(new URL("../../workers/db-flusher.worker.ts", import.meta.url));
    const worker = new Worker(workerPath);
    worker.onmessage = (event) => {
      console.log("[Worker Msg]", event.data);
    };
    worker.onerror = (err) => {
      console.error("[Worker Error]", err.message);
    };
  } catch (err) {
    console.warn("Failed to spawn db-flusher worker. (Ensure you are using Bun or Node 20+)", err);
  }
});
