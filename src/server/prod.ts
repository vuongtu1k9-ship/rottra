import app from "../routes/api/[...paths]";

const PORT = parseInt(process.env.PORT || "8080", 10);

console.log(`🚀 Unified Bun-native Server starting on port ${PORT}...`);

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    
    // Handle WebSocket upgrade for WebRTC signaling
    if (url.pathname.includes("/ws-signaling") || url.pathname.includes("/gold-prices/live")) {
      const upgraded = server.upgrade(req, {
        data: {
          pathname: url.pathname,
          room: url.searchParams.get("room") || "default",
          createdAt: Date.now(),
        }
      });
      if (upgraded) return;
    }
    
    // Otherwise, route to Hono app natively via Bun
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      const data = ws.data as any;
      
      if (data.pathname.includes("/gold-prices/live")) {
        console.log("[Gold Server] Client connected to live gold prices stream!");
        ws.send(
          JSON.stringify({
            buy: 148800000,
            sell: 151800000,
            updatedText: `Cập nhật Live: ${new Date().toLocaleTimeString()}`,
          })
        );
        
        (ws as any).goldInterval = setInterval(() => {
          const randomChangeBuy = (Math.random() - 0.5) * 400000;
          const randomChangeSell = (Math.random() - 0.5) * 400000;
          ws.send(
            JSON.stringify({
              buy: 148800000 + Math.round(randomChangeBuy),
              sell: 151800000 + Math.round(randomChangeSell),
              updatedText: `Cập nhật Live: ${new Date().toLocaleTimeString()}`,
            })
          );
        }, 5000);
        return;
      }
      
      ws.subscribe(data.room);
      ws.subscribe("global");
      if (data.room !== "default") {
        console.log(`[WS] Client connected to room: ${data.room}`);
      }
    },
    message(ws, message) {
      const data = ws.data as any;
      try {
        const msgStr = typeof message === "string" ? message : message.toString();
        const parsed = JSON.parse(msgStr);
        
        if (parsed.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        
        const isGlobal = parsed.type === "trade-sync" || parsed.type === "global" || parsed.type === "swarm-telemetry-update" || !data.room;
        
        if (isGlobal) {
          server.publish("global", msgStr);
        } else {
          server.publish(data.room, msgStr);
        }
      } catch (e) {
        server.publish(data.room, message);
      }
    },
    close(ws) {
      const data = ws.data as any;
      if (data.pathname.includes("/gold-prices/live") && (ws as any).goldInterval) {
        clearInterval((ws as any).goldInterval);
        console.log("[Gold Server] Client disconnected from live gold prices stream.");
      }
    }
  }
});
