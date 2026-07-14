import { defineConfig, Plugin } from "vite";
import { performance } from "perf_hooks";
import tailwindcss from "@tailwindcss/vite";
import solidPlugin from "vite-plugin-solid";
import tsrxSolid from "@tsrx/vite-plugin-solid";
import devServer from "@hono/vite-dev-server";
import path from "path";



type TsrxMetric = {
  id: string;
  count: number;
  totalMs: number;
  lastMs: number;
  bytes: number;
};

function instrumentTsrxMetrics(plugin: Plugin): Plugin {
  const metrics = new Map<string, TsrxMetric>();
  const rootDir = process.cwd();
  let summaryTimer: ReturnType<typeof setTimeout> | undefined;
  let isServe = false;

  const originalResolveId = typeof plugin.resolveId === "function" ? plugin.resolveId : (plugin.resolveId as any)?.handler;
  const originalLoad = typeof plugin.load === "function" ? plugin.load : (plugin.load as any)?.handler;
  const originalConfigResolved = typeof plugin.configResolved === "function" ? plugin.configResolved : (plugin.configResolved as any)?.handler;
  const originalConfigureServer = typeof plugin.configureServer === "function" ? plugin.configureServer : (plugin.configureServer as any)?.handler;
  const originalCloseBundle = typeof plugin.closeBundle === "function" ? plugin.closeBundle : (plugin.closeBundle as any)?.handler;

  const formatMs = (value: number) => `${value.toFixed(1)}ms`;

  const relativePath = (id: string) => id.replace(rootDir, "").replace(/^\//, "");

  const scheduleSummary = () => {
    if (summaryTimer) clearTimeout(summaryTimer);
    summaryTimer = setTimeout(() => {
      const rows = [...metrics.values()].sort((a, b) => b.totalMs - a.totalMs);
      const totalMs = rows.reduce((sum, row) => sum + row.totalMs, 0);
      const avgMs = rows.length ? totalMs / rows.length : 0;
      const slowest = rows[0];
      const fastest = rows.length ? rows.reduce((min, row) => (row.lastMs < min.lastMs ? row : min), rows[0]) : undefined;
      const slowestLabel = slowest ? `${relativePath(slowest.id)} (${formatMs(slowest.lastMs)})` : "chưa có dữ liệu";
      const fastestLabel = fastest ? `${relativePath(fastest.id)} (${formatMs(fastest.lastMs)})` : "chưa có dữ liệu";

      console.log("");
      console.log("=== TSRX Dev Metrics ===");
      console.log(`files: ${rows.length}`);
      console.log(`tsrx_precompile_total: ${formatMs(totalMs)}`);
      console.log(`tsrx_precompile_avg: ${formatMs(avgMs)}`);
      console.log(`slowest_file: ${slowestLabel}`);
      console.log(`fastest_file: ${fastestLabel}`);
      console.log("========================");
    }, 450);
  };

  return {
    ...plugin,
    name: `${plugin.name || "tsrx"}+dev-metrics`,

    configResolved(this: any, config: any) {
      isServe = config.command === "serve";
      originalConfigResolved?.call(this, config);
    },

    async resolveId(this: any, source: string, importer: string | undefined, options: any) {
      if (!isServe) return originalResolveId?.call(this, source, importer, options);

      const start = performance.now();
      const result = await originalResolveId?.call(this, source, importer, options);
      const elapsed = performance.now() - start;

      if (source.endsWith(".tsrx") || String(result?.id ?? "").includes(".tsrx")) {
        console.log(`[tsrx resolve] ${source} -> ${result?.id || "fallback"} (${formatMs(elapsed)})`);
      }

      return result;
    },

    async load(this: any, id: string) {
      if (!isServe) return originalLoad?.call(this, id);

      const start = performance.now();
      const result = await originalLoad?.call(this, id);
      const elapsed = performance.now() - start;
      const realId = id.split("?")[0];

      if (realId.endsWith(".tsrx")) {
        const sourceId = realId;
        const code = typeof result === "string" ? result : result?.code;
        const previous = metrics.get(sourceId) ?? { id: sourceId, count: 0, totalMs: 0, lastMs: 0, bytes: 0 };
        metrics.set(sourceId, {
          ...previous,
          count: previous.count + 1,
          totalMs: previous.totalMs + elapsed,
          lastMs: elapsed,
          bytes: code ? code.length : previous.bytes,
        });
        scheduleSummary();
      }

      return result;
    },

    configureServer(this: any, server: any) {
      originalConfigureServer?.call(this, server);
      setTimeout(() => {
        if (metrics.size === 0) {
          console.log("");
          console.log("=== TSRX Dev Metrics ===");
          console.log("waiting for first .tsrx request...");
          console.log("========================");
        }
      }, 1500);
    },

    closeBundle(this: any) {
      if (summaryTimer) clearTimeout(summaryTimer);
      originalCloseBundle?.call(this);
    },
  };
}

function ssrSafeNodePolyfills(): Plugin {
  return {
    name: 'ssr-safe-node-polyfills',
    enforce: 'pre',
    resolveId(source, importer, options) {
      const nodeBuiltins = [
        "fs", "node:fs", "path", "node:path", "crypto", "node:crypto", 
        "stream", "node:stream", "perf_hooks", "events", "node:events", 
        "buffer", "process", "bun:sqlite", "needle", "duck-duck-scrape", 
        "child_process", "node:child_process", "net", "tls", "util", 
        "node:util", "node:os", "os", "node:worker_threads", "worker_threads", 
        "node:async_hooks", "async_hooks", "zlib", "node:zlib", "v8", 
        "node:v8", "http", "node:http", "https", "node:https", "url", "node:url"
      ];

      if (nodeBuiltins.includes(source)) {
        if (options?.ssr) {
          return null;
        }
        return path.resolve(__dirname, "./src/client/mocks/node-polyfills.ts");
      }
      return null;
    }
  };
}

export default defineConfig({
  plugins: [
    ssrSafeNodePolyfills(),
    devServer({
      entry: 'src/routes/api/[...paths].ts',
      exclude: [
        /^\/(?!api\/).*/,
        /^\/api\/ws-signaling/,
        /^\/@.+$/,
        /.*\.(ts|tsrx)($|\?)/,
        /.*\.(css)($|\?)/,
        /^\/favicon\.ico$/,
        /.*\.(svg|png)($|\?)/,
        /^\/(src|node_modules)\/.+/,
      ],
      injectClientScript: false,
    }),
    instrumentTsrxMetrics(tsrxSolid()),
    solidPlugin(),
    tailwindcss()
  ],
  server: {
    allowedHosts: true,
    open: false,
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/ws-signaling": {
        target: "ws://127.0.0.1:8080",
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ws-signaling/, "/"),
      },
    },
    hmr: {
      protocol: "ws",
      port: 5173,
      path: "vite-hmr",
    },
    watch: {
      ignored: [
        '**/rotta-marketing-studio/**',
        '**/pg_data/**',
        '**/pg_data.bak/**',
        '**/pg_data_backup/**',
        '**/pg_data_corrupted/**',
        '**/pg_data_temp_bak/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/finetune/**',
        '**/video_ads/**',
        '**/collatz_state.json',
        '**/notifications.log',
        '**/public/videos/**',
        '**/archive/**',
        '**/scratch/**',
        '**/models/**'
      ]
    }
  },
  resolve: {
    conditions: ['development', 'browser', 'solid'],
    alias: {
      "~": path.resolve(__dirname, "./src"),
      "solid-js": path.resolve(__dirname, "node_modules/solid-js"),
      "solid-js/web": path.resolve(__dirname, "node_modules/solid-js/web"),
      "solid-js/store": path.resolve(__dirname, "node_modules/solid-js/store")
    },
    dedupe: ["solid-js", "solid-js/web", "@solidjs/router", "solid-heroicons", "@tsrx/solid"],
    extensions: ['.ts', '.tsx', '.tsrx', '.json']
  },
  optimizeDeps: {
    entries: ["src/client/index.tsrx"],
    include: ["solid-js", "solid-js/web", "@solidjs/router", "solid-heroicons", "better-auth/solid", "@tsrx/solid"],
    exclude: ["pg", "pgpass", "netmask", "retry", "proper-lockfile"],
    esbuildOptions: {
      external: ["pg", "pgpass", "netmask", "retry", "proper-lockfile", "needle"],
      loader: {
        '.tsrx': 'ts'
      }
    }
  },
  ssr: {
    external: ["pg", "pgpass", "netmask", "retry", "proper-lockfile", "needle"]
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      external: ["@tensorflow/tfjs", "@tensorflow/tfjs-core", "@tensorflow/tfjs-node", "@tensorflow/tfjs-core/dist/register_all_gradients", "@tensorflow/tfjs-core/dist/public/chained_ops/register_all_chained_ops"],
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('mermaid')) {
              return 'vendor-mermaid';
            }
            if (id.includes('wardley')) {
              return 'vendor-wardley';
            }
            if (id.includes('cytoscape')) {
              return 'vendor-cytoscape';
            }
            if (id.includes('katex')) {
              return 'vendor-katex';
            }
            if (id.includes('leaflet')) {
              return 'vendor-leaflet';
            }
            if (id.includes('blockly')) {
              return 'vendor-blockly';
            }
            if (id.includes('better-auth')) {
              return 'vendor-auth';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});
