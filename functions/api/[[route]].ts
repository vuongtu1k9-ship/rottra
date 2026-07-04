export const onRequest: PagesFunction<{ ROTTRA_KV: KVNamespace; BACKEND_URL?: string }> = async (context) => {
  const backendUrl = context.env.BACKEND_URL || (await context.env.ROTTRA_KV.get("TUNNEL_URL"));
  if (!backendUrl) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Backend server is offline. Please configure BACKEND_URL or start your local laptop tunnel.",
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
  // Construct the target URL pointing to the backend
  const targetUrl = new URL(url.pathname + url.search, backendUrl);

  // Clone headers and set standard forwarding fields
  const newHeaders = new Headers(context.request.headers);
  newHeaders.set("X-Forwarded-Host", url.host);
  newHeaders.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

  try {
    const response = await fetch(targetUrl.toString(), {
      method: context.request.method,
      headers: newHeaders,
      body: context.request.method === "GET" || context.request.method === "HEAD" ? null : context.request.body,
      redirect: "manual",
    });

    return response;
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
