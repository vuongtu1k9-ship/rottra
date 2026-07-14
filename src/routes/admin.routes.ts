import { Hono } from "hono";
import { db, pgClient } from "~/infra/database/db-pool";
import { user, product, systemSetting, agentMemory, agentTraining, activity } from "~/infra/database/schema";
import { eq, sql } from "drizzle-orm";
import * as dbSchema from "~/infra/database/schema";
import { getTableConfig } from "drizzle-orm/pg-core";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { exec as execCallback } from "node:child_process";
import WebSocket from "ws";
import { ALL_DOMAIN_TRAINING_PAIRS } from "~/core/nlp-cognitive/domain-training-data";
import { trainAndSaveNlpModel } from "~/core/nlp-cognitive/tokenizer";
import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";
import {
  serverAgentBudgets,
  serverAgentGold,
  serverAgentEmployees,
  getDynamicSkillTitle,
  calculateAgentLoanAmount,
  agentLoanParametersMap,
} from "~/shared/constants";
import { auth } from "~/server/auth";

function promisify(fn: Function) {
  return function (...args: any[]) {
    return new Promise((resolve, reject) => {
      fn(...args, (err: any, ...results: any[]) => {
        if (err) return reject(err);
        resolve(results.length === 1 ? results[0] : results);
      });
    });
  };
}
const execAsync = promisify(execCallback);

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

  let match;
  const redirectRegex = />+\s*([^\s;&|<]+)/g;
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

const parseDevice = (userAgent?: string) => {
  if (!userAgent) return "Không xác định";
  const ua = userAgent.toLowerCase();
  if (ua.includes("tablet") || ua.includes("ipad")) return "Máy tính bảng (Tablet)";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "Điện thoại (Mobile)";
  return "Máy tính (PC/Laptop)";
};

const verifyAuth = async (c: any, next: any) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ success: false, reason: "Unauthorized" }, 401);
    const dbUser = await db.query.user.findFirst({ where: eq(user.id, session.user.id) });
    if (dbUser?.profile && (dbUser.profile as any).banned) {
      return c.json({ success: false, reason: "Banned", message: "Tài khoản của bạn đã bị khóa." }, 403);
    }
    c.set("user", dbUser || session.user);
    await next();
  } catch (e: any) {
    console.error("verifyAuth Error:", e);
    return c.json({ error: "Auth verification failed", details: e.message }, 500);
  }
};

const logActivity = async (userId: string | null, action: string, message: string | null, level: string, userAgent?: string) => {
  try {
    const device = parseDevice(userAgent);
    await db.insert(activity).values({
      id: crypto.randomUUID(),
      userId,
      action,
      message,
      level: "1 - Bất tiện",
      device,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};

export function registerAdminRoutes(app: Hono) {
  // --- Admin Users ---
  app.get("/admin/users", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") {
      return c.json({ success: false, message: "Forbidden" }, 403);
    }

    const rawUsers = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        profile: user.profile,
      })
      .from(user);

    const { getEnrichedProfile } = await import("~/routes/api/[...paths]");
    const enrichedUsers = [];
    for (const u of rawUsers) {
      const enriched = await getEnrichedProfile(u);
      enrichedUsers.push({
        ...u,
        profile: enriched,
      });
    }

    return c.json({ success: true, users: enrichedUsers });
  });

  app.delete("/admin/users/:email", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") {
      return c.json({ success: false, message: "Forbidden" }, 403);
    }
    const emailToDelete = c.req.param("email");

    if (emailToDelete === "admin@test.com") {
      return c.json({ success: false, message: "Cannot delete the main admin account" }, 400);
    }

    const result = await db.delete(user).where(eq(user.email, emailToDelete)).returning();

    if (result.length > 0) {
      await logActivity(
        currentUser.id,
        `Xóa tài khoản người dùng '${emailToDelete}'`,
        `Tài khoản đã bị xóa khỏi hệ thống bởi quản trị viên`,
        "security",
        c.req.header("user-agent"),
      );
      return c.json({ success: true, message: "User deleted" });
    } else {
      return c.json({ success: false, message: "User not found" }, 404);
    }
  });

  // --- Admin AI Export Dataset API ---
  app.post("/admin/ai/export-dataset", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);
    try {
      const dbTrainings = await db.query.agentTraining.findMany();

      const utteranceSet = new Set<string>();
      const mergedList: Array<{ utterance: string; intent: string; answer: string }> = [];

      dbTrainings.forEach((t: any) => {
        const uClean = t.utterance.trim().toLowerCase();
        if (!utteranceSet.has(uClean)) {
          utteranceSet.add(uClean);
          mergedList.push({
            utterance: t.utterance,
            intent: t.intent,
            answer: t.answer,
          });
        }
      });

      ALL_DOMAIN_TRAINING_PAIRS.forEach((t: any) => {
        const uClean = t.utterance.trim().toLowerCase();
        if (!utteranceSet.has(uClean)) {
          utteranceSet.add(uClean);
          mergedList.push({
            utterance: t.utterance,
            intent: t.intent,
            answer: t.answer,
          });
        }
      });

      if (mergedList.length === 0) {
        return c.json({ success: false, message: "Không có dữ liệu huấn luyện nào!" }, 400);
      }

      const finetuneDir = path.join(process.cwd(), "finetune", "data");
      if (!fs.existsSync(finetuneDir)) {
        fs.mkdirSync(finetuneDir, { recursive: true });
      }

      const datasetPath = path.join(finetuneDir, "rottra_dataset.jsonl");
      let jsonlContent = "";

      mergedList.forEach((t: any) => {
        const dataRow = {
          messages: [
            {
              role: "system",
              content:
                "Bạn là Hệ Chuyên Gia Siêu Trí Tuệ của dự án Rottra. Bạn am hiểu sâu sắc về Toán học, Văn học và Khoa học thực chứng.",
            },
            { role: "user", content: t.utterance },
            { role: "assistant", content: t.answer },
          ],
        };
        jsonlContent += JSON.stringify(dataRow) + "\n";
      });

      fs.writeFileSync(datasetPath, jsonlContent);

      const classificationPath = path.join(finetuneDir, "rottra_classification.json");
      const classificationData = mergedList.map((item) => ({
        utterance: item.utterance,
        intent: item.intent,
      }));
      fs.writeFileSync(classificationPath, JSON.stringify(classificationData, null, 2));

      return c.json({
        success: true,
        message: `Đã xuất thành công ${mergedList.length} dòng dữ liệu (gồm cả dữ liệu mẫu) ra chuẩn JSONL và Classification JSON.`,
        path: datasetPath,
        classificationPath,
      });
    } catch (error: any) {
      return c.json({ success: false, message: "Lỗi xuất dữ liệu: " + error.message }, 500);
    }
  });

  // --- Admin AI Train NLP Machine Learning ---
  app.post("/admin/ai/train-nlp", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);

    try {
      const trainingLogs: string[] = [];
      const result = await trainAndSaveNlpModel((logLine) => {
        trainingLogs.push(logLine);
      });

      if (result.success) {
        return c.json({
          success: true,
          message: "Đào tạo mạng Neural hoàn tất! Đã cập nhật mô hình học máy thành công.",
          logs: trainingLogs,
        });
      } else {
        return c.json(
          {
            success: false,
            message: "Huấn luyện thất bại, vui lòng kiểm tra logs.",
            logs: trainingLogs,
          },
          500,
        );
      }
    } catch (error: any) {
      return c.json({ success: false, message: "Lỗi hệ thống khi huấn luyện: " + error.message }, 500);
    }
  });

  // --- Admin AI Global Corpus API ---
  app.get("/admin/ai/global-corpus", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);

    try {
      const products = await db.select().from(dbSchema.product).limit(100);
      const lexicons = await db.select().from(dbSchema.vietnameseLexicon).limit(300);
      const farms = await db.select().from(dbSchema.farm).limit(20);
      const settings = await db.select().from(dbSchema.systemSetting).limit(1);

      let corpus = "=== DỮ LIỆU SẢN PHẨM (PRODUCTS) ===\n";
      products.forEach((p: any) => {
        corpus += `- [${p.name}] (Giá: ${p.price}): ${p.description || "Không có mô tả"}\n`;
      });

      corpus += "\n=== TỪ ĐIỂN CHUYÊN NGÀNH (LEXICON) ===\n";
      lexicons.forEach((l: any) => {
        corpus += `- [${l.word}] (${l.type}): ${l.definition}\n`;
      });

      corpus += "\n=== DANH SÁCH NÔNG TRẠI (FARMS) ===\n";
      farms.forEach((f: any) => {
        corpus += `- [${f.name}]: ${f.description || ""}\n`;
      });

      corpus += "\n=== CẤU HÌNH HỆ THỐNG ===\n";
      if (settings && settings[0]) {
        const s = settings[0];
        corpus += `- Web Name: ${s.webName}\n- Tự động Mùa vụ: ${s.autoSeason}\n`;
      }

      return c.json({ success: true, corpus });
    } catch (e: any) {
      return c.json({ success: false, message: e.message }, 500);
    }
  });

  // --- Admin AI Memory API ---
  app.post("/admin/ai/memory", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);

    const body = await c.req.json();
    const { text } = body;
    if (!text) return c.json({ success: false, message: "Thiếu nội dung ký ức" }, 400);

    const id = crypto.randomUUID();
    await db.insert(agentMemory).values({
      id,
      sessionId: "global",
      contextKey: "user_training",
      contextValue: { text },
      importanceScore: 10,
      addAt: new Date().toISOString(),
    });

    return c.json({ success: true, id, message: "Đã khắc sâu ký ức vào lõi PostgreSQL" });
  });

  app.post("/admin/ai/ingest-llms-url", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);

    const body = await c.req.json();
    const { url } = body;
    if (!url) return c.json({ success: false, message: "Thiếu URL tài liệu" }, 400);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return c.json({ success: false, message: `Không thể tải tài liệu từ URL. Mã lỗi: ${response.status}` }, 400);
      }
      const fullText = await response.text();

      const sections = fullText.split(/(?=\n##+ )/);
      let insertedCount = 0;

      for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed || trimmed.length < 50) continue;

        const id = crypto.randomUUID();
        await db.insert(agentMemory).values({
          id,
          sessionId: "global",
          contextKey: "user_training",
          contextValue: { text: trimmed },
          importanceScore: 8,
          addAt: new Date().toISOString(),
        });
        insertedCount++;
      }

      return c.json({
        success: true,
        message: `Đã nạp thành công tài liệu từ ${url}`,
        chunks: insertedCount,
      });
    } catch (e: any) {
      return c.json({ success: false, message: e.message }, 500);
    }
  });

  app.get("/admin/ai/memory", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);

    const memories = await db
      .select()
      .from(agentMemory)
      .where(eq(agentMemory.contextKey, "user_training"))
      .orderBy(sql`"addAt" DESC`);

    return c.json({ success: true, memories });
  });

  app.delete("/admin/ai/memory/:id", verifyAuth, async (c: any) => {
    try {
      const currentUser = c.get("user");
      if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);

      const id = c.req.param("id");

      await pgClient.query(`DELETE FROM "AgentMemory" WHERE id = $1`, [id]);

      return c.json({ success: true, message: "Đã xóa vĩnh viễn ký ức" });
    } catch (err: any) {
      console.error("Delete memory error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  });

  app.get("/admin/ai/certainty-telemetry", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);
    try {
      const { selfCorrection } = await import("~/core/nlp-cognitive/self-correction");
      const weights = selfCorrection.certaintyNet.exportWeights();

      const corrections = await db
        .select()
        .from(agentMemory)
        .where(eq(agentMemory.sessionId, "self_correction_session"))
        .orderBy(sql`"addAt" DESC`);

      const parsedCorrections = corrections.map((rec: any) => {
        return typeof rec.contextValue === "string" ? JSON.parse(rec.contextValue) : rec.contextValue;
      });

      return c.json({
        success: true,
        weights,
        corrections: parsedCorrections,
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  });

  app.get("/admin/ai/agents-telemetry", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);
    try {
      const dnaRecords = await db.select().from(agentMemory).where(eq(agentMemory.contextKey, "personality_dna"));

      const agentsData = dnaRecords.map((rec: any) => {
        const agentId = rec.sessionId;
        const loanParams = agentLoanParametersMap[agentId] || null;
        return {
          id: agentId,
          greed: rec.greed,
          vengeance: rec.vengeance,
          malice: rec.malice,
          state: rec.state,
          loanParams,
        };
      });

      return c.json({
        success: true,
        agents: agentsData,
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  });

  app.post("/admin/ai/reset-certainty-weights", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);
    try {
      const { selfCorrection } = await import("~/core/nlp-cognitive/self-correction");

      const { TinyNeuralNet } = await import("~/core/nlp-cognitive/tiny-neural-net");
      selfCorrection.certaintyNet = new TinyNeuralNet(3, 4, 1);

      await selfCorrection.saveWeightsToDb();

      return c.json({
        success: true,
        message: "Đã thiết lập lại (re-initialize) trọng số mạng Neural thành công!",
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  });

  // --- Admin Activity Log API ---
  app.get("/admin/activity", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") {
      return c.json({ success: false, message: "Forbidden" }, 403);
    }

    const levelParam = c.req.query("level");

    try {
      const query = db
        .select({
          id: activity.id,
          userId: activity.userId,
          user: user.name,
          action: activity.action,
          message: activity.message,
          level: activity.level,
          device: activity.device,
          timestamp: activity.timestamp,
        })
        .from(activity)
        .leftJoin(user, eq(activity.userId, user.id));

      let results;
      if (levelParam && levelParam !== "all") {
        results = await query
          .where(eq(activity.level, levelParam))
          .orderBy(sql`${activity.timestamp} DESC`)
          .limit(200);
      } else {
        results = await query.orderBy(sql`${activity.timestamp} DESC`).limit(200);
      }

      return c.json({ success: true, activities: results });
    } catch (error: any) {
      console.error("Fetch activity logs error:", error);
      return c.json({ success: false, message: error.message || "Lỗi máy chủ khi lấy nhật ký hoạt động" }, 500);
    }
  });

  app.post("/admin/users/:email/action", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") {
      return c.json({ success: false, message: "Forbidden" }, 403);
    }
    const targetEmail = c.req.param("email");
    const body = await c.req.json();
    const { action, payload, groupName } = body;

    if (targetEmail === "admin@test.com" && (action === "warn" || action === "ban")) {
      return c.json({ success: false, message: "Cannot ban or warn the main admin account" }, 400);
    }

    const dbUser = await db.query.user.findFirst({
      where: eq(user.email, targetEmail),
    });

    if (!dbUser) {
      return c.json({ success: false, message: "User not found" }, 404);
    }

    const profile: any = dbUser.profile || {};

    const actionHandlers: Record<string, (p: any) => void> = {
      warn: (p) => {
        p.warnings = p.warnings || [];
        p.warnings.push({ date: new Date().toISOString(), reason: "Vi phạm chính sách" });
      },
      ban: (p) => {
        p.banned = true;
        p.banReason = "Quản trị viên chặn";
      },
      add_group: (p) => {
        p.groups = p.groups || [];
        const name = groupName || (payload && payload.groupName) || "Nhóm Đặc Quyền";
        p.groups.push({ name, product: [] });
      },
    };

    const executeAction = actionHandlers[action as string];

    if (executeAction) {
      executeAction(profile);
    } else {
      return c.json({ success: false, message: "Invalid action" }, 400);
    }

    await db.update(user).set({ profile }).where(eq(user.email, targetEmail));

    let logMsg = "";
    let logLvl = "user";
    if (action === "warn") {
      logMsg = `Cảnh báo người dùng ${dbUser.name}`;
      logLvl = "security";
    } else if (action === "ban") {
      logMsg = `Khóa tài khoản người dùng ${dbUser.name}`;
      logLvl = "security";
    } else {
      logMsg = `Cấp nhóm đặc quyền cho người dùng ${dbUser.name}`;
    }

    await logActivity(currentUser.id, logMsg, `Hành động thực hiện bởi quản trị viên`, logLvl, c.req.header("user-agent"));

    return c.json({ success: true, message: `Action ${action} executed successfully` });
  });

  // --- Dynamic ERD Extractor ---
  app.get("/admin/diagram/erd", async (c: any) => {
    try {
      let erd = "erDiagram\n";
      for (const [key, table] of Object.entries(dbSchema)) {
        if (table && typeof table === "object" && Symbol.for("drizzle:Name") in table) {
          const config = getTableConfig(table as any);
          erd += `    ${config.name} {\n`;

          const columns = config.columns;
          for (const col of columns) {
            erd += `        ${col.dataType} ${col.name}\n`;
          }
          erd += `    }\n`;

          if (config.foreignKeys) {
            for (const fk of config.foreignKeys) {
              const refTable = getTableConfig(fk.reference().foreignTable).name;
              erd += `    ${config.name} ||--o{ ${refTable} : "relates_to"\n`;
            }
          }
        }
      }
      return c.json({ success: true, erd });
    } catch (e: any) {
      return c.json({ success: false, message: e.message }, 500);
    }
  });

  // --- Dynamic Macro Architecture Extractor ---
  app.get("/admin/diagram/architecture", async (c: any) => {
    try {
      let endpointsCount = 0;
      let tablesCount = 0;
      let routesCount = 0;

      for (const [key, table] of Object.entries(dbSchema)) {
        if (table && typeof table === "object" && Symbol.for("drizzle:Name") in table) {
          tablesCount++;
        }
      }

      const apiPath = path.join(process.cwd(), "src", "routes", "api", "[...paths].ts");
      if (fs.existsSync(apiPath)) {
        const code = fs.readFileSync(apiPath, "utf8");
        const matches = code.match(/app\.(get|post|put|delete|patch)\(/g);
        if (matches) endpointsCount = matches.length;
      }

      const dashPath = path.join(process.cwd(), "src", "routes", "dashboard");
      if (fs.existsSync(dashPath)) {
        const files = fs.readdirSync(dashPath);
        routesCount = files.filter((f) => f.endsWith(".tsrx") || f.endsWith(".tsx")).length;
      }

      const architecture = `graph TD
    %% Tầng Giao tiếp (Edge Layer)
    subgraph Frontend["Tầng Giao tiếp (TSRX SolidJS)"]
        UI["Giao diện Người dùng<br/>(Dashboard Modules: ${routesCount})"]
        Compiler["TSRX Compiler<br/>(Bypass JSX)"]
    end
    
    %% Tầng Xử lý Cốt lõi (Backend)
    subgraph Backend["Tầng Xử lý Cốt lõi (Bun API)"]
        Router{"Hono Routing<br/>(Endpoints: ${endpointsCount})"}
        GraphRAG["Lõi Graph RAG & Giáo dục Toán học"]
        VideoEngine["Hyperframes<br/>(Kết xuất Video AI)"]
    end
    
    %% Tầng Cơ sở hạ tầng (Database)
    subgraph Infra["Tầng Cơ sở Hạ tầng (Data)"]
        DB[("PostgreSQL<br/>(Tổng số Bảng: ${tablesCount})")]
        Redis[("Vector/Cache DB")]
    end
    
    UI <==>|"REST / WSS"| Router
    UI -.-> Compiler
    
    Router <--> GraphRAG
    Router <--> VideoEngine
    
    GraphRAG -->|"Lưu trữ Tri thức & Giáo trình"| DB
    VideoEngine -->|"I/O File"| DB
    
    style Frontend fill:#1e3a8a,stroke:#3b82f6,stroke-width:2px,color:#fff
    style Backend fill:#047857,stroke:#10b981,stroke-width:2px,color:#fff
    style Infra fill:#b91c1c,stroke:#f87171,stroke-width:2px,color:#fff`;

      return c.json({ success: true, architecture });
    } catch (e: any) {
      return c.json({ success: false, message: e.message }, 500);
    }
  });

  // --- System Settings ---
  app.get("/admin/settings", async (c: any) => {
    try {
      const settings = await db.query.systemSetting.findFirst({
        where: eq(systemSetting.id, "global"),
      });

      if (settings) {
        return c.json({
          ...settings,
          wifiPerf: settings.wifiPerf !== null && settings.wifiPerf !== undefined ? settings.wifiPerf : false,
          autoBoost: settings.autoBoost !== null && settings.autoBoost !== undefined ? settings.autoBoost : false,
        });
      }

      return c.json({
        webName: "Rotta",
        adminEmail: "admin@test.com",
        adminPhone: "",
        colors: {
          primary: "#3b82f6",
          background: "#ffffff",
          text: "#1f2937",
        },
        autoSeason: false,
        wifiPerf: false,
        autoBoost: false,
      });
    } catch (e) {
      return c.json({ success: false, message: "Lỗi tải cấu hình" }, 500);
    }
  });

  app.post("/admin/settings", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false }, 403);

    try {
      const body = await c.req.json();

      await db.insert(systemSetting).values({
        id: "global",
        webName: body.webName,
        adminEmail: body.adminEmail,
        adminPhone: body.adminPhone,
        colors: body.colors,
        autoSeason: body.autoSeason,
        wifiPerf: body.wifiPerf,
        autoBoost: body.autoBoost,
        updatedAt: new Date().toISOString(),
      });

      return c.json({ success: true });
    } catch (e) {
      console.error(e);
      return c.json({ success: false, message: "Lỗi lưu cấu hình" }, 500);
    }
  });

  // --- SQL DB Query API ---
  app.post("/admin/db-query", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

    try {
      const { query } = await c.req.json();
      if (!query || typeof query !== "string") {
        return c.json({ success: false, message: "Truy vấn không hợp lệ" }, 400);
      }

      console.log(`[SQL EXECUTION] Chạy lệnh: ${query}`);
      const result = await pgClient.query(query);
      return c.json({
        success: true,
        rows: result.rows,
        fields: result.fields,
        affectedRows: result.affectedRows,
      });
    } catch (e: any) {
      console.error(e);
      return c.json({ success: false, message: e.message || "Lỗi truy vấn SQL" }, 500);
    }
  });

  // --- Web IDE API endpoints ---
  app.get("/admin/ide/files", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

    try {
      const queryDir = c.req.query("dir") || "";
      const targetDir = path.resolve(process.cwd(), queryDir);

      if (!targetDir.startsWith(process.cwd())) {
        return c.json({ success: false, message: "Truy cập thư mục bất hợp lệ" }, 403);
      }

      if (!fs.existsSync(targetDir)) {
        return c.json({ success: false, message: "Thư mục không tồn tại" }, 404);
      }

      const stats = fs.statSync(targetDir);
      if (!stats.isDirectory()) {
        return c.json({ success: false, message: "Đường dẫn không phải thư mục" }, 400);
      }

      const items = fs.readdirSync(targetDir);
      const result = items
        .filter((name) => {
          if (name.startsWith(".") && name !== ".env") return false;
          if (["node_modules", "dist", "pg_data", "rotta-marketing-studio"].includes(name)) return false;
          return true;
        })
        .map((name) => {
          const fullPath = path.join(targetDir, name);
          const itemStats = fs.statSync(fullPath);
          const relativePath = path.relative(process.cwd(), fullPath);
          return {
            name,
            path: relativePath,
            isDirectory: itemStats.isDirectory(),
            size: itemStats.isFile() ? itemStats.size : 0,
          };
        })
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

      return c.json({ success: true, files: result });
    } catch (e: any) {
      console.error("IDE Files Error:", e);
      return c.json({ success: false, message: e.message || "Lỗi đọc danh sách tệp" }, 500);
    }
  });

  app.get("/admin/ide/file", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

    try {
      const filePath = c.req.query("path");
      if (!filePath) {
        return c.json({ success: false, message: "Thiếu đường dẫn tệp" }, 400);
      }

      const targetFile = path.resolve(process.cwd(), filePath);
      if (!targetFile.startsWith(process.cwd())) {
        return c.json({ success: false, message: "Truy cập tệp bất hợp lệ" }, 403);
      }

      if (!fs.existsSync(targetFile)) {
        return c.json({ success: false, message: "Tệp không tồn tại" }, 404);
      }

      const stats = fs.statSync(targetFile);
      if (!stats.isFile()) {
        return c.json({ success: false, message: "Đường dẫn không phải tệp tin" }, 400);
      }

      const content = fs.readFileSync(targetFile, "utf-8");
      return c.json({ success: true, content, size: stats.size });
    } catch (e: any) {
      console.error("IDE Read File Error:", e);
      return c.json({ success: false, message: e.message || "Lỗi đọc nội dung tệp" }, 500);
    }
  });

  app.post("/admin/ide/file", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

    try {
      const { path: filePath, content } = await c.req.json();
      if (!filePath || content === undefined) {
        return c.json({ success: false, message: "Thiếu đường dẫn hoặc nội dung tệp" }, 400);
      }

      const targetFile = path.resolve(process.cwd(), filePath);
      if (!targetFile.startsWith(process.cwd())) {
        return c.json({ success: false, message: "Ghi tệp bất hợp lệ" }, 403);
      }

      const parentDir = path.dirname(targetFile);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(targetFile, content, "utf-8");
      return c.json({ success: true, message: "Đã lưu tệp tin thành công" });
    } catch (e: any) {
      console.error("IDE Write File Error:", e);
      return c.json({ success: false, message: e.message || "Lỗi ghi tệp tin" }, 500);
    }
  });

  app.post("/admin/ide/run", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

    try {
      const { path: filePath, command } = await c.req.json();
      let cmdToRun = "";

      if (command) {
        cmdToRun = command;
      } else if (filePath) {
        const targetFile = path.resolve(process.cwd(), filePath);
        if (!targetFile.startsWith(process.cwd())) {
          return c.json({ success: false, message: "Tệp thực thi bất hợp lệ" }, 403);
        }

        if (!fs.existsSync(targetFile)) {
          return c.json({ success: false, message: "Tệp không tồn tại" }, 404);
        }

        const ext = path.extname(targetFile);
        if (ext === ".ts" || ext === ".tsrx" || ext === ".tsx") {
          cmdToRun = `bun run "${targetFile}"`;
        } else if (ext === ".js" || ext === ".jsx") {
          cmdToRun = `node "${targetFile}"`;
        } else if (ext === ".sh") {
          cmdToRun = `bash "${targetFile}"`;
        } else {
          return c.json({ success: false, message: "Không hỗ trợ chạy tệp tin dạng này" }, 400);
        }
      } else {
        return c.json({ success: false, message: "Thiếu thông tin chạy" }, 400);
      }

      if (!isCommandSafe(cmdToRun)) {
        return c.json(
          {
            success: false,
            message:
              "Lệnh thực thi chứa các câu lệnh nguy hiểm (ví dụ: rm, chmod, sudo) đã bị hệ thống bảo mật chặn lại để bảo vệ mã nguồn.",
          },
          400,
        );
      }

      console.log(`[IDE RUN] Chạy lệnh: ${cmdToRun}`);
      const [ stdout, stderr ] = (await execAsync(cmdToRun, { timeout: 10000 })) as any;
      return c.json({
        success: true,
        stdout: stdout || "",
        stderr: stderr || "",
      });
    } catch (e: any) {
      console.error("IDE Run Error:", e);
      return c.json({
        success: false,
        message: e.message || "Lỗi thực thi lệnh",
        stdout: e.stdout || "",
        stderr: e.stderr || e.message || "",
      });
    }
  });

  app.post("/admin/ide/agent/plan", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

    try {
      const { prompt } = await c.req.json();
      if (!prompt) return c.json({ success: false, message: "Thiếu mô tả nhiệm vụ" }, 400);

      const allFiles: string[] = [];
      const scanDir = (dir: string) => {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          if (["node_modules", "pg_data", ".git", ".gemini", "dist"].some((ignore) => item.name.includes(ignore))) continue;
          const fullPath = path.join(dir, item.name);
          const relative = path.relative(process.cwd(), fullPath);
          if (item.isDirectory()) {
            if (allFiles.length < 100) scanDir(fullPath);
          } else {
            if (
              relative.endsWith(".ts") ||
              relative.endsWith(".tsx") ||
              relative.endsWith(".tsrx") ||
              relative.endsWith(".json") ||
              relative.endsWith(".md")
            ) {
              allFiles.push(relative);
            }
          }
        }
      };
      scanDir(process.cwd());

      const fileListContext = allFiles.slice(0, 150).join("\n");

      const systemPrompt = `Bạn là Giáo sư AI, Kỹ sư phần mềm Tự trị hàng đầu 2026. Nhiệm vụ của bạn là giải quyết yêu cầu lập trình sau của người dùng: "${prompt}".
Danh sách các file chính trong workspace dự án:
${fileListContext}

Hãy lập một kế hoạch chi tiết gồm các bước (checklist) để thực thi nhiệm vụ này.
Mỗi bước phải là một đối tượng JSON có dạng:
{
  "id": "chuỗi định danh duy nhất (ví dụ: step_1, step_2)",
  "title": "Tên ngắn gọn của bước (tiếng Việt)",
  "description": "Chi tiết thao tác",
  "type": "read" | "modify" | "command" | "verify",
  "path": "Đường dẫn file (đối với read, modify) hoặc câu lệnh shell cần chạy (đối với command)"
}

Hãy trả về một mảng JSON các bước hành động này, ví dụ:
[
  { "id": "step_1", "title": "Đọc file schema", "description": "Kiểm tra định nghĩa bảng", "type": "read", "path": "src/db/schema.ts" },
  { "id": "step_2", "title": "Cập nhật logic API", "description": "Thêm trường mới vào endpoint", "type": "modify", "path": "src/routes/api/[...paths].ts" }
]

Yêu cầu bắt buộc: TRẢ VỀ DUY NHẤT một mảng JSON hợp lệ, không giải thích dài dòng, không bọc ngoài các văn bản khác ngoài mảng JSON.`;

      const { text: reply } = await generateTextLocal({
        system: systemPrompt,
        prompt: `Hãy lập kế hoạch cho nhiệm vụ: ${prompt}`,
        isInternalReasoning: true,
      });
      const cleanJson = reply
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let steps = [];
      try {
        steps = JSON.parse(cleanJson);
        if (!Array.isArray(steps)) {
          steps = [steps];
        }
      } catch (parseErr) {
        console.error("Failed to parse agent plan JSON:", reply);
        steps = [
          {
            id: "step_1",
            title: "Phân tích dự án",
            description: "Giáo sư phân tích yêu cầu lập trình",
            type: "read",
            path: "src/routes/api/[...paths].ts",
          },
          {
            id: "step_2",
            title: "Thực thi kiểm tra",
            description: "Chạy build hệ thống",
            type: "command",
            path: "bun run build",
          },
        ];
      }

      return c.json({ success: true, steps });
    } catch (e: any) {
      console.error("Agent Plan Error:", e);
      return c.json({ success: false, message: e.message || "Lỗi tạo kế hoạch" }, 500);
    }
  });

  app.post("/admin/ide/agent/step", verifyAuth, async (c: any) => {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

    try {
      const { prompt, steps, currentStepId, logs } = await c.req.json();
      if (!steps || !currentStepId) {
        return c.json({ success: false, message: "Thiếu dữ liệu bước chạy" }, 400);
      }

      const currentStep = steps.find((s: any) => s.id === currentStepId);
      if (!currentStep) {
        return c.json({ success: false, message: "Không tìm thấy bước cần chạy" }, 404);
      }

      let outputLog = "";
      let stepResult: any = {};
      let isSuccess = true;
      let nextSteps = [...steps];

      console.log(`[AUTONOMOUS STEP] Đang thực thi bước ${currentStepId} (${currentStep.type}) - ${currentStep.title}`);

      if (currentStep.type === "read") {
        const targetFile = path.resolve(process.cwd(), currentStep.path);
        if (!targetFile.startsWith(process.cwd())) {
          throw new Error("Không được phép đọc file ngoài thư mục dự án");
        }

        if (fs.existsSync(targetFile)) {
          const fileContent = fs.readFileSync(targetFile, "utf-8");
          const truncatedContent =
            fileContent.length > 15000 ? fileContent.substring(0, 15000) + "\n...[Nội dung bị cắt bớt do dung lượng lớn]..." : fileContent;
          outputLog = `[GIÁO SƯ AI] Đã đọc thành công tệp: ${currentStep.path}\n`;
          stepResult = { content: truncatedContent };
        } else {
          outputLog = `[GIÁO SƯ AI] Cảnh báo: Tệp tin ${currentStep.path} không tồn tại.`;
          isSuccess = false;
        }
      } else if (currentStep.type === "modify") {
        const targetFile = path.resolve(process.cwd(), currentStep.path);
        if (!targetFile.startsWith(process.cwd())) {
          throw new Error("Không được phép sửa file ngoài thư mục dự án");
        }

        let originalContent = "";
        if (fs.existsSync(targetFile)) {
          originalContent = fs.readFileSync(targetFile, "utf-8");
        }

        const systemPrompt = `Bạn là Giáo sư AI, Kỹ sư phần mềm Tự trị hàng đầu 2026.
Nhiệm vụ tổng thể: "${prompt}"
Kế hoạch của bạn:
${JSON.stringify(steps)}

Hiện tại bạn đang ở bước: "${currentStep.title}" - "${currentStep.description}".
Bạn cần viết lại toàn bộ nội dung của tệp tin: \`${currentStep.path}\` để đạt được mục tiêu này.

Nội dung hiện tại của tệp tin \`${currentStep.path}\`:
\`\`\`
${originalContent}
\`\`\`

Hãy trả về toàn bộ nội dung mới cho tệp tin này. Bạn cần chỉnh sửa/thêm logic tương thích hoàn hảo với phần còn lại của codebase.
Yêu cầu bắt buộc: TRẢ VỀ DUY NHẤT nội dung mã nguồn mới cho tệp tin. KHÔNG giải thích dài dòng, KHÔNG bọc trong markdown codeblock \`\`\` hay bất kỳ thẻ nào khác. Chỉ trả về code sạch.`;

        const { text: newContentRaw } = await generateTextLocal({
          system: systemPrompt,
          prompt: `Hãy viết mã nguồn cập nhật cho tệp: ${currentStep.path}`,
          isInternalReasoning: true,
        });
        let newContent = newContentRaw || "";

        if (newContent.trim().startsWith("```")) {
          newContent = newContent
            .replace(/^```[a-zA-Z0-9]*\n/, "")
            .replace(/\n```$/, "")
            .trim();
        }

        const parentDir = path.dirname(targetFile);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        fs.writeFileSync(targetFile, newContent, "utf-8");
        outputLog = `[GIÁO SƯ AI] Đã tự động cập nhật và lưu thay đổi vào tệp: ${currentStep.path}\n`;
        stepResult = {
          original: originalContent,
          modified: newContent,
          path: currentStep.path,
        };
      } else if (currentStep.type === "command") {
        const cmdToRun = currentStep.path;
        outputLog = `[GIÁO SƯ AI] Đang chạy lệnh shell: "${cmdToRun}"...\n`;

        if (!isCommandSafe(cmdToRun)) {
          isSuccess = false;
          outputLog += `[LỖI BẢO MẬT] Lệnh shell nguy hiểm bị chặn bởi hệ thống bảo mật Rottra Core Guard.\n`;
          stepResult = { stdout: "", stderr: "Lệnh bị chặn vì lý do bảo mật" };
        } else {
          try {
            const [ stdout, stderr ] = (await execAsync(cmdToRun, { timeout: 15000 })) as any;
            outputLog += `[LỆNH RA]:\n${stdout || "(Không có output)"}\n`;
            if (stderr) outputLog += `[STDERR]:\n${stderr}\n`;
            stepResult = { stdout, stderr };
          } catch (cmdErr: any) {
            isSuccess = false;
            outputLog += `[LỖI THỰC THI]:\n${cmdErr.message || "Lệnh kết thúc với lỗi"}\n`;
            if (cmdErr.stderr) outputLog += `[STDERR]:\n${cmdErr.stderr}\n`;
            stepResult = { stdout: cmdErr.stdout || "", stderr: cmdErr.stderr || cmdErr.message };

            const nextIdx = nextSteps.findIndex((s: any) => s.id === currentStepId) + 1;
            const debugStep = {
              id: `debug_${crypto.randomUUID().split("-")[0]}`,
              title: "Tự sửa lỗi (Self-Healing)",
              description: `Sửa lỗi phát sinh từ câu lệnh: ${cmdToRun}`,
              type: "modify",
              path: steps.find((s: any) => s.type === "modify")?.path || "src/routes/api/[...paths].ts",
            };

            nextSteps.splice(nextIdx, 0, debugStep);
            outputLog += `\n[TỰ SỬA LỖI] Giáo sư AI phát hiện lỗi biên dịch. Đã tự động chèn bước Tự sửa lỗi (Self-Healing) vào kế hoạch để tự sửa file.\n`;
          }
        }
      } else if (currentStep.type === "verify") {
        outputLog = `[GIÁO SƯ AI] Đang đối chiếu và xác nhận tính toàn vẹn hệ thống...\n`;
        try {
          await execAsync("bun run build", { timeout: 15000 });
          outputLog += `[GIÁO SƯ AI] Toàn bộ hệ thống biên dịch sạch sẽ! Build thành công.\n`;
        } catch (buildErr: any) {
          isSuccess = false;
          outputLog += `[GIÁO SƯ AI] Biên dịch thử nghiệm thất bại sau khi hoàn tất. Cần rà soát.\n`;
        }
      }

      nextSteps = nextSteps.map((s: any) => {
        if (s.id === currentStepId) {
          return { ...s, status: isSuccess ? "completed" : "failed" };
        }
        return s;
      });

      const currentIdx = nextSteps.findIndex((s: any) => s.id === currentStepId);
      let nextStepId = "";
      if (currentIdx !== -1 && currentIdx < nextSteps.length - 1) {
        nextStepId = nextSteps[currentIdx + 1].id;
      }

      return c.json({
        success: true,
        steps: nextSteps,
        currentStepId: nextStepId,
        logs: [...logs, outputLog],
        result: stepResult,
      });
    } catch (e: any) {
      console.error("Agent Step Execution Error:", e);
      return c.json({ success: false, message: e.message || "Lỗi thực thi bước" }, 500);
    }
  });
}
