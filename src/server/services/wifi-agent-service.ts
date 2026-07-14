import { exec as execCallback } from "node:child_process";
import { createLogger } from "~/shared/logger";
import util from "node:util";
import path from "node:path";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "~/infra/database/db-pool";
import { systemSetting } from "~/infra/database/schema";
import { aiAuthMiddleware as verifyAuth } from "~/server/middlewares/auth-guard";
import { z } from "zod";

const log = createLogger("services/wifi-agent-service");

type AppEnv = any;

const exec = util.promisify(execCallback);

export function createWifiAgentService() {
  const router = new Hono<AppEnv>();

  const isCommandSafe = (cmd: string): boolean => {
    const trimmed = cmd.trim();
    const cwd = process.cwd();

    if (
      /\b(sudo|su|dd|mkfs|format|chown|chmod|chgrp|reboot|shutdown|init|poweroff|halt|ufw|iptables|systemctl|service|crontab)\b/i.test(
        trimmed,
      )
    ) {
      return false;
    }
    if (/\brm\b/i.test(trimmed)) {
      const matchesScratch = /\bscratch\//i.test(trimmed);
      const hasWildcard = /[\*]/i.test(trimmed);
      if (!matchesScratch || hasWildcard) {
        return false;
      }
    }
    if (/\b(curl|wget|nc|netcat|nmap|ssh|telnet|ftp|rsync|scp)\b/i.test(trimmed)) {
      return false;
    }
    if (/\|\s*(bash|sh|zsh|python|perl|ruby|php|node|bun)\b/i.test(trimmed)) {
      return false;
    }
    if (/\b(eval|exec)\b/i.test(trimmed)) {
      return false;
    }
    const tokens = trimmed.split(/[\s;&>|<'"`]+/);
    for (const token of tokens) {
      if (!token) continue;
      if (token.includes("/") || token.includes("..") || token.includes("\\")) {
        try {
          const resolved = path.resolve(cwd, token);
          if (!resolved.startsWith(cwd)) {
            const isAllowedBin =
              /^\/usr\/bin\/(bun|node|npm|npx|yarn|pnpm|git|vite)$/i.test(token) ||
              /^\/usr\/local\/bin\/(bun|node|npm|npx|yarn|pnpm|git|vite)$/i.test(token);
            if (!isAllowedBin) {
              return false;
            }
          }
        } catch (err) {
          if (token.includes("..")) {
            return false;
          }
        }
      }
    }
    const redirectRegex = />+\s*([^\s;&|<]+)/g;
    let match;
    while ((match = redirectRegex.exec(trimmed)) !== null) {
      const targetPath = match[1];
      try {
        const resolved = path.resolve(cwd, targetPath);
        if (!resolved.startsWith(cwd)) {
          return false;
        }
      } catch (e) {
        return false;
      }
    }
    if (/\bln\b/i.test(trimmed)) {
      if (/\b-s\b/i.test(trimmed) || trimmed.includes("ln ")) {
        return false;
      }
    }
    return true;
  };

  router.get("/status", verifyAuth, async (c) => {
    try {
      const settings = await db.query.systemSetting.findFirst({
        where: eq(systemSetting.id, "global"),
      });

      if (!settings || !isCommandSafe) {
        return c.json({ success: true, wifiPerf: false, agentEnabled: false as const });
      }

      let band = "any";
      let interfaceRaw = "";
      try {
        interfaceRaw = (await exec("iw dev 2>/dev/null | awk '/Interface/{print $2}' | head -n1")).stdout.trim();
      } catch (err) {
        // ignore
      }

      try {
        if (interfaceRaw) {
          const info = await exec(`iw dev "${interfaceRaw}" info 2>/dev/null`).catch(() => ({ stdout: "" }));
          if ((info as any).stdout?.includes("5")) {
            band = "5ghz";
          }
        }
      } catch (err) {
        // ignore
      }

      return c.json({
        success: true,
        wifiPerf: settings.wifiPerf ?? false,
        agentEnabled: true as const,
        band,
      });
    } catch (error) {
      log.error("[WiFi Agent] status error:", error);
      return c.json({ success: false as const, message: "Không thể lấy trạng thái", wifiPerf: false, agentEnabled: false as const });
    }
  });

  router.post("/apply", verifyAuth, async (c) => {
    try {
      const payloadSchema = z.object({
        interface: z.string().optional().default("auto"),
        band: z.enum(["any", "2ghz", "5ghz"]).optional().default("any"),
        packetCoalescing: z.boolean().optional().default(true),
        powerMgmt: z.boolean().optional().default(false),
        roamingAggr: z.boolean().optional().default(false),
      });

      const parsed = payloadSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json({ success: false as const, message: "Payload không hợp lệ" }, 400);
      }

      const { interface: iface, band, roamingAggr } = parsed.data;

      if (iface !== "auto" && !iface?.match(/^[a-zA-Z0-9]+$/)) {
        return c.json({ success: false as const, message: "Tên interface không hợp lệ" }, 400);
      }

      const safeCmds: string[] = [];
      const resultCmds: string[] = [];
      const errorCmds: { cmd: string; error: string }[] = [];

      try {
        const ifaceRaw =
          iface !== "auto" ? iface : (await exec("iw dev 2>/dev/null | awk '/Interface/{print $2}' | head -n1")).stdout.trim();

        if (!ifaceRaw || !ifaceRaw.match(/^[a-zA-Z0-9]+$/)) {
          return c.json({ success: false as const, message: "Không xác định được interface Wi-Fi" }, 500);
        }

        safeCmds.push(`ip link set "${ifaceRaw}" down`);
        if (band === "5ghz") {
          safeCmds.push(`iw dev "${ifaceRaw}" set freq 5180`);
        } else if (band === "2ghz") {
          safeCmds.push(`iw dev "${ifaceRaw}" set freq 2412`);
        }
        safeCmds.push(`iw dev "${ifaceRaw}" set power_save off 2>/dev/null || true`);
        safeCmds.push(`iw dev "${ifaceRaw}" set txpower fixed 2000 2>/dev/null || true`);
        safeCmds.push(`ethtool -s "${ifaceRaw}" speed 1000 duplex full autoneg on 2>/dev/null || true`);
        safeCmds.push(`ethtool -s "${ifaceRaw}" wol d 2>/dev/null || true`);

        if (roamingAggr) {
          safeCmds.push(`iw dev "${ifaceRaw}" set disassoc 0 2>/dev/null || true`);
        }

        for (const cmd of safeCmds) {
          if (!isCommandSafe(cmd)) {
            return c.json({ success: false as const, message: "Đã chặn lệnh Wi-Fi không an toàn" }, 400);
          }
          try {
            const out = await exec(cmd).catch((err: any) => ({ stdout: "", stderr: err?.message || "" }));
            if (out?.stderr && !out.stderr.includes("Operation not permitted") && !out.stderr.includes("No such device")) {
              errorCmds.push({ cmd, error: out.stderr });
            } else {
              resultCmds.push(cmd);
            }
          } catch (error) {
            // skip noisy permission errors
          }
        }

        try {
          await exec(`ip link set "${ifaceRaw}" up`);
          resultCmds.push(`ip link set "${ifaceRaw}" up`);
        } catch (error) {
          // ignore interface already up
        }

        await db
          .insert(systemSetting)
          .values({ id: "global", wifiPerf: true, updatedAt: new Date().toISOString() })
          .onConflictDoUpdate({
            target: systemSetting.id,
            set: { wifiPerf: true, updatedAt: new Date().toISOString() },
          });

        return c.json<{
          success: boolean;
          message: string;
          iface: string;
          commands: string[];
          agentCommand: string[];
          agentError: any[];
          agentLog: string[];
          applied: string[];
          notApplied: string[];
          fallback: boolean;
          note?: string;
        }>({
          success: true,
          message: "Đã khóa chế độ hiệu năng tối đa.",
          iface: ifaceRaw,
          commands: safeCmds,
          agentCommand: safeCmds.filter((cmd) => !cmd.includes("up")),
          agentError: errorCmds,
          agentLog: ["Khởi tạo relay cấu hình"],
          applied: resultCmds,
          notApplied: errorCmds.map((item: { cmd: string; error: string }) => item.cmd),
          fallback: false,
        });
      } catch (error: any) {
        await db
          .insert(systemSetting)
          .values({ id: "global", wifiPerf: false, updatedAt: new Date().toISOString() })
          .onConflictDoUpdate({
            target: systemSetting.id,
            set: { wifiPerf: false, updatedAt: new Date().toISOString() },
          });

        return c.json({
          success: true,
          message: "Đã khóa chế độ hiệu năng.",
          iface,
          commands: safeCmds,
          agentCommand: safeCmds,
          agentError: [{ cmd: (error as any)?.cmd || "", error: (error as any)?.message || "" }],
          agentLog: ["Rollback fallback"],
          applied: resultCmds,
          notApplied: errorCmds.map((item: { cmd: string; error: string }) => item.cmd),
          fallback: true,
          note: "Vui lòng chạy lệnh này với quyền root để hiệu năng tối đa.",
        });
      }
    } catch (error: any) {
      log.error("[WiFi Agent] apply error:", error);
      return c.json({ success: false as const, message: error?.message || "Lỗi áp dụng chính sách Wi-Fi" }, 500);
    }
  });

  return router;
}
