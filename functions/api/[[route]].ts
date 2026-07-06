export const onRequest: PagesFunction<{ ROTTRA_KV?: KVNamespace; BACKEND_URL?: string }> = async (context) => {
  let backendUrl = context.env.BACKEND_URL;
  if (!backendUrl && context.env.ROTTRA_KV) {
    try {
      backendUrl = await context.env.ROTTRA_KV.get("TUNNEL_URL");
    } catch (e) {
      console.error("Failed to read from ROTTRA_KV", e);
    }
  }

  if (!backendUrl) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Backend server is offline. Please configure BACKEND_URL in Cloudflare settings or deploy the backend to a server.",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const url = new URL(context.request.url);
  
  // Rewrite POST /api/admin/product/delete/:id -> DELETE /api/admin/product/:id
  let proxyMethod = context.request.method;
  let proxyPathname = url.pathname;
  if (proxyMethod === "POST" && proxyPathname.startsWith("/api/admin/product/delete/")) {
    proxyMethod = "DELETE";
    proxyPathname = proxyPathname.replace("/api/admin/product/delete/", "/api/admin/product/");
  }

  // Construct the target URL pointing to the backend
  const targetUrl = new URL(proxyPathname + url.search, backendUrl);

  // Clone headers and set standard forwarding fields
  const newHeaders = new Headers(context.request.headers);
  newHeaders.set("X-Forwarded-Host", url.host);
  newHeaders.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

  let proxyBody = proxyMethod === "GET" || proxyMethod === "HEAD" ? null : context.request.body;
  // If rewriting POST to DELETE, the old backend crashes on empty body in c.req.json(), so inject "{}"
  if (proxyMethod === "DELETE" && !proxyBody) {
    proxyBody = "{}";
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      method: proxyMethod,
      headers: newHeaders,
      body: proxyBody,
      redirect: "manual",
    });

    // If WebSocket upgrade (101 Switching Protocols), return the response directly
    // wrapping it in a new Response strips the WebSocket context
    if (response.status === 101) {
      return response;
    }

    // Create a new response to allow modifying headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("X-Debug-Backend", targetUrl.toString());
    return newResponse;
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to connect to backend: " + err.message,
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
};
