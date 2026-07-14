/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "rottra-app",
      removal: "remove",
      home: "aws"
    };
  },
  async run() {
    // 1. Backend Hono API (AWS Lambda)
    const api = new sst.aws.Function("RottraApi", {
      runtime: "bun",
      handler: "src/server/lambda.handler", // Adapter handler file
      url: true,
      environment: {
        DATABASE_URL: process.env.DATABASE_URL || "",
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || ""
      }
    });

    // 2. Frontend Static Site (S3 + CloudFront)
    const site = new sst.aws.StaticSite("RottraFrontend", {
      build: {
        command: "bun run build",
        output: "dist"
      },
      environment: {
        VITE_API_URL: api.url
      }
    });

    return {
      apiUrl: api.url,
      frontendUrl: site.url
    };
  }
});
