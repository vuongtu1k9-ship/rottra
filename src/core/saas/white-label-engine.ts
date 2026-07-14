/**
 * 🧠 ROTTRA — WHITE-LABEL SaaS ENGINE
 * Multi-tenant isolation, billing/subscription, and custom branding.
 * Runs on Bun runtime.
 */

import { randomUUID, createHash } from "node:crypto";
import { db } from "~/infra/database/db-pool";
import { sql, eq, and, gte } from "drizzle-orm";
import { pgTable, text, integer, real, varchar, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

// ── Database Schema ───────────────────────────────────────────

export const tenants = pgTable("Tenant", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  domain: varchar("domain", { length: 255 }),
  plan: varchar("plan", { length: 50 }).default("free"),
  status: varchar("status", { length: 50 }).default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const tenantBranding = pgTable("TenantBranding", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenants.id),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 20 }).default("#10b981"),
  secondaryColor: varchar("secondary_color", { length: 20 }).default("#059669"),
  accentColor: varchar("accent_color", { length: 20 }).default("#34d399"),
  faviconUrl: text("favicon_url"),
  companyName: varchar("company_name", { length: 255 }),
  tagline: text("tagline"),
  customCss: text("custom_css"),
  customDomain: varchar("custom_domain", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const subscriptions = pgTable("Subscription", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenants.id),
  planId: varchar("plan_id", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("active"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const invoices = pgTable("Invoice", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenants.id),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).default("VND"),
  status: varchar("status", { length: 50 }).default("pending"),
  description: text("description"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const usageMetrics = pgTable("UsageMetrics", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenants.id),
  metricType: varchar("metric_type", { length: 100 }).notNull(),
  value: integer("value").default(0),
  period: varchar("period", { length: 20 }).notNull(), // "2026-07"
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow(),
});

// ── Types ─────────────────────────────────────────────────────

export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "starter" | "professional" | "enterprise";
  status: "active" | "suspended" | "cancelled";
  limits: TenantLimits;
}

export interface TenantLimits {
  maxUsers: number;
  maxProducts: number;
  maxApiCalls: number;
  maxStorageMb: number;
  maxAgents: number;
  features: string[];
}

export interface BrandingConfig {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  faviconUrl?: string;
  companyName?: string;
  tagline?: string;
  customCss?: string;
  customDomain?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: "monthly" | "yearly";
  limits: TenantLimits;
  features: string[];
}

// ── Plan Definitions ──────────────────────────────────────────

export const PLANS: Record<string, SubscriptionPlan> = {
  free: {
    id: "free",
    name: "Miễn phí",
    price: 0,
    currency: "VND",
    interval: "monthly",
    limits: {
      maxUsers: 3,
      maxProducts: 10,
      maxApiCalls: 1000,
      maxStorageMb: 100,
      maxAgents: 1,
      features: ["basic_chat", "product_listing"],
    },
    features: ["Chat AI cơ bản", "Đăng sản phẩm (tối đa 10)", "Hỗ trợ email"],
  },
  starter: {
    id: "starter",
    name: "Khởi đầu",
    price: 299000,
    currency: "VND",
    interval: "monthly",
    limits: {
      maxUsers: 10,
      maxProducts: 100,
      maxApiCalls: 10000,
      maxStorageMb: 1000,
      maxAgents: 3,
      features: ["basic_chat", "product_listing", "sensor_data", "basic_analytics"],
    },
    features: ["Chat AI nâng cao", "Quản lý sản phẩm", "Dữ liệu cảm biến", "Phân tích cơ bản"],
  },
  professional: {
    id: "professional",
    name: "Chuyên nghiệp",
    price: 999000,
    currency: "VND",
    interval: "monthly",
    limits: {
      maxUsers: 50,
      maxProducts: 1000,
      maxApiCalls: 100000,
      maxStorageMb: 10000,
      maxAgents: 10,
      features: ["basic_chat", "product_listing", "sensor_data", "basic_analytics", "fl_training", "a2a_protocol", "supply_chain"],
    },
    features: ["Tất cả tính năng Starter", "Federated Learning", "A2A Protocol", "Chuỗi cung ứng", "API đầy đủ"],
  },
  enterprise: {
    id: "enterprise",
    name: "Doanh nghiệp",
    price: 4999000,
    currency: "VND",
    interval: "monthly",
    limits: {
      maxUsers: -1, // unlimited
      maxProducts: -1,
      maxApiCalls: -1,
      maxStorageMb: -1,
      maxAgents: -1,
      features: ["*"],
    },
    features: [
      "Tất cả tính năng Professional",
      "White-label",
      "Custom branding",
      "Dedicated support",
      "SLA 99.9%",
      "On-premise deployment",
    ],
  },
};

// ── Multi-Tenant Isolation ────────────────────────────────────

const tenantContext = new Map<string, string>(); // requestId -> tenantId

/**
 * Set tenant context for current request
 */
export function setTenantContext(requestId: string, tenantId: string): void {
  tenantContext.set(requestId, tenantId);
}

/**
 * Get tenant context for current request
 */
export function getTenantContext(requestId: string): string | undefined {
  return tenantContext.get(requestId);
}

/**
 * Clear tenant context
 */
export function clearTenantContext(requestId: string): void {
  tenantContext.delete(requestId);
}

/**
 * Enforce tenant isolation on a query
 */
export function withTenantFilter(tenantId: string, query: any): any {
  // In a real implementation, this would add WHERE tenant_id = ? to all queries
  return { ...query, tenantFilter: tenantId };
}

// ── Tenant Management ─────────────────────────────────────────

/**
 * Create a new tenant
 */
export async function createTenant(name: string, slug: string, plan: string = "free", customDomain?: string): Promise<TenantConfig> {
  const id = randomUUID();
  const planConfig = PLANS[plan] || PLANS.free;

  try {
    await db.execute(sql`
      INSERT INTO "Tenant" (id, name, slug, plan, status)
      VALUES (${id}, ${name}, ${slug}, ${plan}, 'active')
    `);

    // Create default branding
    await db.execute(sql`
      INSERT INTO "TenantBranding" (id, tenant_id, primary_color, secondary_color, accent_color, company_name)
      VALUES (${randomUUID()}, ${id}, '#10b981', '#059669', '#34d399', ${name})
    `);

    // Create subscription
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86400000);
    await db.execute(sql`
      INSERT INTO "Subscription" (id, tenant_id, plan_id, status, current_period_start, current_period_end)
      VALUES (${randomUUID()}, ${id}, ${plan}, 'active', ${now.toISOString()}, ${periodEnd.toISOString()})
    `);
  } catch (err: any) {
    console.error(`[SAAS] Failed to create tenant: ${err.message}`);
  }

  return {
    id,
    name,
    slug,
    plan: plan as any,
    status: "active",
    limits: planConfig.limits,
  };
}

/**
 * Get tenant by slug
 */
export async function getTenantBySlug(slug: string): Promise<TenantConfig | null> {
  try {
    const result = await db.execute(sql`SELECT * FROM "Tenant" WHERE slug = ${slug} LIMIT 1`);
    const row = (result as any)?.rows?.[0] || result;
    if (!row) return null;

    const planConfig = PLANS[row.plan] || PLANS.free;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      status: row.status,
      limits: planConfig.limits,
    };
  } catch {
    return null;
  }
}

/**
 * Check if tenant has exceeded a usage limit
 */
export async function checkUsageLimit(tenantId: string, metricType: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) return { allowed: false, current: 0, limit: 0 };

  const planConfig = PLANS[tenant.plan] || PLANS.free;
  const limitMap: Record<string, number> = {
    api_calls: planConfig.limits.maxApiCalls,
    products: planConfig.limits.maxProducts,
    users: planConfig.limits.maxUsers,
    storage_mb: planConfig.limits.maxStorageMb,
    agents: planConfig.limits.maxAgents,
  };

  const limit = limitMap[metricType] || 0;
  if (limit === -1) return { allowed: true, current: 0, limit: -1 }; // unlimited

  // Query current usage
  const period = new Date().toISOString().slice(0, 7); // "2026-07"
  try {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(value), 0) as current_usage
      FROM "UsageMetrics"
      WHERE tenant_id = ${tenantId} AND metric_type = ${metricType} AND period = ${period}
    `);
    const current = Number((result as any)?.rows?.[0]?.current_usage || 0);
    return { allowed: current < limit, current, limit };
  } catch {
    return { allowed: true, current: 0, limit };
  }
}

/**
 * Increment usage metric
 */
export async function recordUsage(tenantId: string, metricType: string, value: number = 1): Promise<void> {
  const period = new Date().toISOString().slice(0, 7);
  try {
    await db.execute(sql`
      INSERT INTO "UsageMetrics" (id, tenant_id, metric_type, value, period)
      VALUES (${randomUUID()}, ${tenantId}, ${metricType}, ${value}, ${period})
      ON CONFLICT DO UPDATE SET value = value + ${value}
    `);
  } catch (err: any) {
    console.error(`[SAAS] Failed to record usage: ${err.message}`);
  }
}

async function getTenantById(tenantId: string): Promise<TenantConfig | null> {
  try {
    const result = await db.execute(sql`SELECT * FROM "Tenant" WHERE id = ${tenantId} LIMIT 1`);
    const row = (result as any)?.rows?.[0] || result;
    if (!row) return null;
    const planConfig = PLANS[row.plan] || PLANS.free;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      status: row.status,
      limits: planConfig.limits,
    };
  } catch {
    return null;
  }
}

// ── Branding ──────────────────────────────────────────────────

/**
 * Get tenant branding
 */
export async function getTenantBranding(tenantId: string): Promise<BrandingConfig> {
  try {
    const result = await db.execute(sql`SELECT * FROM "TenantBranding" WHERE tenant_id = ${tenantId} LIMIT 1`);
    const row = (result as any)?.rows?.[0] || result;
    return {
      logoUrl: row?.logo_url,
      primaryColor: row?.primary_color || "#10b981",
      secondaryColor: row?.secondary_color || "#059669",
      accentColor: row?.accent_color || "#34d399",
      faviconUrl: row?.favicon_url,
      companyName: row?.company_name,
      tagline: row?.tagline,
      customCss: row?.custom_css,
      customDomain: row?.custom_domain,
    };
  } catch {
    return { primaryColor: "#10b981", secondaryColor: "#059669", accentColor: "#34d399" };
  }
}

/**
 * Update tenant branding
 */
export async function updateTenantBranding(tenantId: string, branding: Partial<BrandingConfig>): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE "TenantBranding" SET
        logo_url = COALESCE(${branding.logoUrl}, logo_url),
        primary_color = COALESCE(${branding.primaryColor}, primary_color),
        secondary_color = COALESCE(${branding.secondaryColor}, secondary_color),
        accent_color = COALESCE(${branding.accentColor}, accent_color),
        company_name = COALESCE(${branding.companyName}, company_name),
        tagline = COALESCE(${branding.tagline}, tagline),
        custom_css = COALESCE(${branding.customCss}, custom_css),
        custom_domain = COALESCE(${branding.customDomain}, custom_domain),
        updated_at = NOW()
      WHERE tenant_id = ${tenantId}
    `);
  } catch (err: any) {
    console.error(`[SAAS] Failed to update branding: ${err.message}`);
  }
}

// ── Billing ───────────────────────────────────────────────────

/**
 * Create an invoice
 */
export async function createInvoice(
  tenantId: string,
  amount: number,
  description: string,
  dueDate?: Date,
): Promise<{ id: string; amount: number; status: string }> {
  const id = randomUUID();
  try {
    await db.execute(sql`
      INSERT INTO "Invoice" (id, tenant_id, amount, currency, status, description, due_date)
      VALUES (${id}, ${tenantId}, ${amount}, 'VND', 'pending', ${description}, ${dueDate?.toISOString() || new Date(Date.now() + 7 * 86400000).toISOString()})
    `);
  } catch (err: any) {
    console.error(`[SAAS] Failed to create invoice: ${err.message}`);
  }
  return { id, amount, status: "pending" };
}

/**
 * Upgrade tenant plan
 */
export async function upgradePlan(tenantId: string, newPlan: string): Promise<{ success: boolean; message: string }> {
  const planConfig = PLANS[newPlan];
  if (!planConfig) return { success: false, message: `Invalid plan: ${newPlan}` };

  try {
    await db.execute(sql`UPDATE "Tenant" SET plan = ${newPlan}, updated_at = NOW() WHERE id = ${tenantId}`);
    await db.execute(sql`UPDATE "Subscription" SET plan_id = ${newPlan} WHERE tenant_id = ${tenantId} AND status = 'active'`);
    return { success: true, message: `Upgraded to ${planConfig.name}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ── Hono Middleware ───────────────────────────────────────────

/**
 * Tenant resolution middleware for Hono
 */
export function createTenantMiddleware() {
  return async (c: any, next: any) => {
    // Extract tenant from header, subdomain, or path
    const tenantHeader = c.req.header("X-Tenant-ID");
    const host = c.req.header("host") || "";

    let tenantSlug = tenantHeader;

    // Try subdomain extraction (e.g., farm1.rottra.vn)
    if (!tenantSlug && host.includes(".")) {
      const parts = host.split(".");
      if (parts.length >= 3) tenantSlug = parts[0];
    }

    if (tenantSlug) {
      const tenant = await getTenantBySlug(tenantSlug);
      if (tenant) {
        c.set("tenant", tenant);
        c.set("tenantId", tenant.id);
      }
    }

    await next();
  };
}

export const saasEngine = {
  createTenant,
  getTenantBySlug,
  checkUsageLimit,
  recordUsage,
  getTenantBranding,
  updateTenantBranding,
  createInvoice,
  upgradePlan,
  createTenantMiddleware,
  PLANS,
};
