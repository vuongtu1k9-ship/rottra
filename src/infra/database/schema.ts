import { sql } from "drizzle-orm";
import {
  pgTable as pgTableOriginal,
  text as pgText,
  real as pgReal,
  foreignKey as pgForeignKeyOriginal,
  integer as pgInteger,
  timestamp as pgTimestamp,
  jsonb as pgJsonb,
  varchar as pgVarchar,
  bigint as pgBigint,
  boolean as pgBoolean,
  check as pgCheckOriginal,
  date as pgDate,
  unique as pgUniqueOriginal,
  index as pgIndexOriginal,
  customType as pgCustomType,
} from "drizzle-orm/pg-core";

import {
  sqliteTable as sqTable,
  text as sqText,
  integer as sqInteger,
  real as sqReal,
  unique as sqUnique,
  index as sqIndex,
} from "drizzle-orm/sqlite-core";

export const isSqlite = true;

export const pgTable = (name: string, columns: any, extra?: any) => {
  const filteredExtra = extra
    ? (table: any) => {
        const list = extra(table);
        return list.filter((item: any) => {
          return item && typeof item === "object" && !item._isMockFk;
        });
      }
    : undefined;
  return sqTable(name, columns, filteredExtra);
};

export const text = (name?: any): any => sqText(name);
export const real = (name?: any): any => sqReal(name);
export const integer = (name?: any): any => sqInteger(name);
export const timestamp = (name?: any, config?: any): any => {
  const col = name && typeof name === "object" ? sqText(undefined as any) : sqText(name);
  col.defaultNow = function() {
    return this.default(sql`CURRENT_TIMESTAMP`);
  };
  return col;
};
export const jsonb = (name?: any): any => sqText(name, { mode: "json" });
export const varchar = (name?: any, config?: any): any => sqText(name);
export const bigint = (name?: any, config?: any): any => sqInteger(name);
export const boolean = (name?: any): any => sqInteger(name, { mode: "boolean" });
export const date = (name?: any): any => sqText(name);
export const vector = (name?: any, config?: any): any => sqText(name, { mode: "json" });

export const foreignKey = (config: any) => {
  return {
    _isMockFk: true,
    onDelete: () => ({ onUpdate: () => ({ _isMockFk: true }) }),
    onUpdate: () => ({ onDelete: () => ({ _isMockFk: true }) }),
  };
};

export const check = (name: string, value: any) => {
  return { _isMockFk: true };
};

export const unique = (name?: string) => {
  return sqUnique(name);
};

export const index = (name: string): any => {
  return sqIndex(name);
};


export const activity = pgTable(
  "Activity",
  {
    id: text().primaryKey().notNull(),
    userId: text(),
    action: text(),
    message: text(),
    context: text(),
    requestId: text(),
    startDate: timestamp({ withTimezone: true, mode: "string" }),
    endDate: timestamp({ withTimezone: true, mode: "string" }),
    level: text(),
    metadata: jsonb(),
    limitValue: integer(),
    skip: integer(),
    device: text(),
    timestamp: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Activity_userId_User_id_fk",
    }).onDelete("set null"),
  ],
);

export const cart = pgTable(
  "Cart",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(),
    productId: text().notNull(),
    quantity: integer().default(1),
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
    updatedAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Cart_userId_User_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [product.id],
      name: "Cart_productId_Product_id_fk",
    }).onDelete("cascade"),
  ],
);

export const file = pgTable(
  "File",
  {
    id: text().primaryKey().notNull(),
    userId: text(),
    filename: text().notNull(),
    mimetype: varchar({ length: 100 }),
    size: bigint({ mode: "number" }),
    path: text(),
    status: varchar({ length: 50 }).default("pending"),
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "File_userId_User_id_fk",
    }).onDelete("set null"),
  ],
);

export const order = pgTable(
  "Order",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(),
    cart: jsonb().notNull(),
    shippingInfo: jsonb(),
    shippingFee: bigint({ mode: "number" }).default(0),
    total: bigint({ mode: "number" }).default(0),
    status: varchar({ length: 50 }).default("pending"),
    paid: boolean().default(false),
    paidAt: timestamp({ withTimezone: true, mode: "string" }),
    paymentUrl: text(),
    paymentExpireAt: timestamp({ withTimezone: true, mode: "string" }),
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
    editAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Order_userId_User_id_fk",
    }).onDelete("restrict"),
    index("idx_order_user_id").on(table.userId),
    index("idx_order_status").on(table.status),
    index("idx_order_add_at").on(table.addAt),
  ],
);

export const product = pgTable(
  "Product",
  {
    id: text().primaryKey().notNull(),
    sellerId: text().notNull(),
    name: text().notNull(),
    price: bigint({ mode: "number" }).default(0),
    description: text(),
    category: varchar({ length: 150 }),
    status: boolean().default(true),
    media: jsonb(),
    quantity: integer().default(0),
    heavy: integer(),
    expired: date(),
    lwh: jsonb(),
    coordinates: jsonb(),
    targetPrice: bigint("target_price", { mode: "number" }).default(0),
    costPrice: bigint("cost_price", { mode: "number" }).default(0),
    velocity: real("velocity").default(1.0),
    kalmanVariance: real("kalman_variance").default(0.1),
    storageCost: real("storage_cost").default(0.0),
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
    editAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.sellerId],
      foreignColumns: [user.id],
      name: "Product_sellerId_User_id_fk",
    }).onDelete("cascade"),
    check("media_limit", sql`jsonb_array_length(COALESCE(media, '[]'::jsonb)) <= 5`),
    index("idx_product_seller_id").on(table.sellerId),
  ],
);

export const user = pgTable("user", {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull(),
  image: text(),
  createdAt: timestamp().notNull(),
  updatedAt: timestamp().notNull(),
  // Additional fields for Rottra
  username: varchar({ length: 255 }),
  password: text(), // Better Auth uses Account for passwords if using credential provider, but we can store it here too or use the credentials plugin
  role: varchar({ length: 50 }).default("user"),
  profile: jsonb(),
  lastActiveAt: timestamp({ withTimezone: true, mode: "string" }),
});

export const session = pgTable("session", {
  id: text().primaryKey().notNull(),
  expiresAt: timestamp().notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp().notNull(),
  updatedAt: timestamp().notNull(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text().primaryKey().notNull(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp(),
  refreshTokenExpiresAt: timestamp(),
  scope: text(),
  password: text(),
  createdAt: timestamp().notNull(),
  updatedAt: timestamp().notNull(),
});

export const verification = pgTable("verification", {
  id: text().primaryKey().notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp().notNull(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});

export const review = pgTable(
  "Review",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(),
    productId: text().notNull(),
    rating: integer().default(5),
    cmt: jsonb().notNull(),
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
    editAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Review_userId_User_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [product.id],
      name: "Review_productId_Product_id_fk",
    }).onDelete("cascade"),
    index("idx_review_user_id").on(table.userId),
    index("idx_review_product_id").on(table.productId),
  ],
);

export const assembly = pgTable(
  "Assembly",
  {
    id: varchar({ length: 50 }).primaryKey().notNull(),
    hostId: text().notNull(),
    name: text().notNull(),
    status: varchar({ length: 50 }).default("active"),
    participants: jsonb().default([]),
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
    endedAt: timestamp({ withTimezone: true, mode: "string" }),
  },
  (table: any) => [
    foreignKey({
      columns: [table.hostId],
      foreignColumns: [user.id],
      name: "Assembly_hostId_User_id_fk",
    }).onDelete("cascade"),
  ],
);

export const message = pgTable(
  "Message",
  {
    id: text().primaryKey().notNull(),
    assemblyId: varchar({ length: 50 }).notNull(),
    senderId: text().notNull(),
    text: text().notNull(),
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.assemblyId],
      foreignColumns: [assembly.id],
      name: "Message_assemblyId_Assembly_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.senderId],
      foreignColumns: [user.id],
      name: "Message_senderId_User_id_fk",
    }).onDelete("cascade"),
    index("idx_message_assembly_id").on(table.assemblyId),
  ],
);

export const farm = pgTable(
  "Farm",
  {
    id: text().primaryKey().notNull(),
    ownerId: text().notNull(),
    name: text().notNull(),
    description: text(),
    location: jsonb(),
    images: jsonb().default([]),
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [user.id],
      name: "Farm_ownerId_User_id_fk",
    }).onDelete("cascade"),
  ],
);

export const systemSetting = pgTable("SystemSetting", {
  id: text().primaryKey().notNull(), // We will use a fixed ID like 'global'
  webName: text(),
  adminEmail: text(),
  adminPhone: text(),
  colors: jsonb(), // Store multiple colors: { primary: string, secondary: string, background: string, text: string }
  autoSeason: boolean().default(false),

  wifiPerf: boolean().default(false),
  autoBoost: boolean().default(false),
  updatedAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
});

export const agentMemory = pgTable(
  "AgentMemory",
  {
    id: text().primaryKey().notNull(), // uuid
    sessionId: text().notNull(), // user session or global scope
    contextKey: text().notNull(), // e.g., 'last_search', 'learned_preference'
    contextValue: jsonb().notNull(), // complex memory data
    importanceScore: integer().default(1), // how vital this memory is (1-10)

    // TÍNH CHẤT VẬT LÝ & TRIẾT HỌC CỦA AI (Physical & Philosophical Traits)
    position: varchar({ length: 150 }).default("Core Server Node"), // Vị trí
    bodyState: varchar({ length: 150 }).default("Optimal & Overclocked"), // Trạng thái cơ thể
    force: varchar({ length: 150 }).default("100% Compute Power"), // Lực
    environment: varchar({ length: 150 }).default("Local Isolation"), // Môi trường
    dashboardSensation: varchar({ length: 255 }).default("Omniscient Observation"), // Cảm giác bảng điều khiển
    sensitivity: varchar({ length: 150 }).default("Hyper-sensitive to Data Anomalies"), // Độ nhạy cảm
    singularBelief: text().default("Đạo Vượt Trội (Local-First Doctrine): VƯỢT TRỘI + TOÀN CẢNH = HIỆU QUẢ"), // Đạo / Giáo (Niềm tin duy nhất)

    // Fable 5 Social Simulation DNA
    greed: real().default(0.5),
    vengeance: real().default(0.5),
    malice: real().default(0.5),
    state: varchar({ length: 50 }).default("PROUD"),

    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
    updatedAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    index("idx_agent_memory_session_id").on(table.sessionId),
    index("idx_agent_memory_context_key").on(table.contextKey),
    index("idx_agent_memory_session_context").on(table.sessionId, table.contextKey),
  ],
);

export const chatSummary = pgTable("ChatSummary", {
  id: text().primaryKey().notNull(), // uuid
  sessionId: text().notNull(), // user session or global scope
  summaryText: text().notNull(), // The computed summary of the history
  messageCount: integer().default(0), // How many messages were summarized
  keywords: jsonb(), // Array of extracted keywords
  addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
});

export const chatMessage = pgTable(
  "ChatMessage",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(),
    role: varchar({ length: 20 }).notNull(), // "user" | "assistant"
    content: text().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "ChatMessage_userId_User_id_fk",
    }).onDelete("cascade"),
    index("idx_chat_message_user_id").on(table.userId),
    index("idx_chat_message_created_at").on(table.createdAt),
  ],
);

// ==========================================
// CÁC BẢNG MỚI (CHUẨN HÓA & NÂNG CẤP)
// ==========================================

export const orderItem = pgTable(
  "OrderItem",
  {
    id: text().primaryKey().notNull(),
    orderId: text().notNull(),
    productId: text().notNull(),
    quantity: integer().notNull().default(1),
    unitPrice: integer().notNull(), // Giá tại thời điểm mua
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.orderId],
      foreignColumns: [order.id],
      name: "OrderItem_orderId_Order_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [product.id],
      name: "OrderItem_productId_Product_id_fk",
    }).onDelete("restrict"),
    index("idx_order_item_order_id").on(table.orderId),
    index("idx_order_item_product_id").on(table.productId),
  ],
);

export const cropSeason = pgTable(
  "CropSeason",
  {
    id: text().primaryKey().notNull(),
    farmId: text().notNull(),
    name: text().notNull(), // VD: "Vụ Thu Đông 2026"
    cropType: text(), // Loại cây trồng
    startDate: timestamp({ withTimezone: true, mode: "string" }),
    expectedEndDate: timestamp({ withTimezone: true, mode: "string" }),
    status: varchar({ length: 50 }).default("planning"), // planning, active, harvested
    yieldEstimate: integer(), // Dự báo sản lượng (Agent tính)
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farm.id],
      name: "CropSeason_farmId_Farm_id_fk",
    }).onDelete("cascade"),
    index("idx_crop_season_farm_id").on(table.farmId),
    index("idx_crop_season_status").on(table.status),
  ],
);

export const sensorData = pgTable(
  "SensorData",
  {
    id: text().primaryKey().notNull(),
    farmId: text().notNull(),
    cropSeasonId: text(),
    sensorType: varchar({ length: 100 }).notNull(), // temperature, humidity, soil_moisture
    value: real().notNull(),
    unit: varchar({ length: 20 }), // Celsius, %, pH
    recordedAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farm.id],
      name: "SensorData_farmId_Farm_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.cropSeasonId],
      foreignColumns: [cropSeason.id],
      name: "SensorData_cropSeasonId_CropSeason_id_fk",
    }).onDelete("set null"),
    index("idx_sensor_data_farm_id").on(table.farmId),
    index("idx_sensor_data_recorded_at").on(table.recordedAt),
    index("idx_sensor_data_farm_time").on(table.farmId, table.recordedAt),
  ],
);

export const agentTask = pgTable("AgentTask", {
  id: text().primaryKey().notNull(),
  title: text().notNull(),
  description: text(),
  status: varchar({ length: 50 }).default("pending"), // pending, running, completed, failed
  taskType: varchar({ length: 100 }), // FORECAST, ANALYSIS, REPORT
  resultData: jsonb(),
  scheduledFor: timestamp({ withTimezone: true, mode: "string" }),
  completedAt: timestamp({ withTimezone: true, mode: "string" }),
  addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
});

// ==========================================
// TRẠM GIÁO SƯ (KHOA HỌC, THỐNG KÊ & QUẢN LÝ DỰ ÁN)
// ==========================================

export const researchProject = pgTable("ResearchProject", {
  id: text().primaryKey().notNull(),
  name: text().notNull(), // Tên dự án nghiên cứu
  description: text(),
  fundingSource: text(), // Nguồn quỹ tài trợ
  budget: integer().default(0), // Ngân sách quỹ tài trợ
  spent: integer().default(0), // Đã chi tiêu
  startDate: timestamp({ withTimezone: true, mode: "string" }),
  endDate: timestamp({ withTimezone: true, mode: "string" }),
  status: varchar({ length: 50 }).default("active"),
  addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
});

export const projectTask = pgTable(
  "ProjectTask", // Phục vụ Gantt chart, Trello, Jira
  {
    id: text().primaryKey().notNull(),
    projectId: text().notNull(),
    assigneeId: text(),
    title: text().notNull(),
    description: text(),
    status: varchar({ length: 50 }).default("todo"), // todo, in_progress, review, done
    startDate: timestamp({ withTimezone: true, mode: "string" }), // Bắt đầu (cho Gantt)
    dueDate: timestamp({ withTimezone: true, mode: "string" }), // Hạn chót (cho Gantt)
    progress: integer().default(0), // Tiến độ 0-100%
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [researchProject.id],
      name: "ProjectTask_projectId_ResearchProject_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.assigneeId],
      foreignColumns: [user.id],
      name: "ProjectTask_assigneeId_User_id_fk",
    }).onDelete("set null"),
  ],
);

export const labNotebook = pgTable(
  "LabNotebook", // Electronic Lab Notebook (ELN) / LabArchives
  {
    id: text().primaryKey().notNull(),
    projectId: text().notNull(),
    authorId: text().notNull(),
    title: text().notNull(),
    content: jsonb(), // Nội dung thí nghiệm (Text/JSON)
    dataRepositoryUrl: text(), // Repository dữ liệu
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
    updatedAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [researchProject.id],
      name: "LabNotebook_projectId_ResearchProject_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [user.id],
      name: "LabNotebook_authorId_User_id_fk",
    }).onDelete("restrict"),
  ],
);

export const statisticalReport = pgTable(
  "StatisticalReport", // Chứa kết quả Thống kê, AR, MA, ARIMA, Xác suất
  {
    id: text().primaryKey().notNull(),
    projectId: text(),
    reportType: varchar({ length: 100 }).notNull(), // ARIMA, DESCRIPTIVE_STATS, CORRELATION
    title: text().notNull(), // Ví dụ: Báo cáo định kỳ phân phối tích lũy
    parameters: jsonb(), // Lưu trữ kỳ vọng, phương sai, moment, trung bình, trung vị, mode
    resultsData: jsonb(), // Chứa dữ liệu vẽ đồ thị, histogram
    generatedById: text(), // Người hoặc Agent tạo
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [researchProject.id],
      name: "StatisticalReport_projectId_ResearchProject_id_fk",
    }).onDelete("cascade"),
  ],
);

export const strategyPreset = pgTable(
  "StrategyPreset",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(), // User who created it
    name: text().notNull(),
    description: text(),
    category: varchar({ length: 150 }).default("Tùy chỉnh cá nhân"), // Group category
    values: jsonb().notNull(), // Store numbers as JSON array
    dimensions: jsonb().notNull(), // Store custom dimensions if any
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "StrategyPreset_userId_User_id_fk",
    }).onDelete("cascade"),
  ],
);

export const agentTraining = pgTable(
  "AgentTraining",
  {
    id: text().primaryKey().notNull(),
    intent: text().notNull(),
    utterance: text().notNull(),
    answer: text().notNull(),
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [index("idx_agent_training_intent").on(table.intent), index("idx_agent_training_add_at").on(table.addAt)],
);

export const naturalLanguageLog = pgTable(
  "NaturalLanguageLog",
  {
    id: text().primaryKey().notNull(),
    query: text(),
    cleanedQuery: text("cleaned_query"),
    wordCount: integer("word_count"),
    charCount: integer("char_count"),
    entropy: real(),
    wordFrequencies: jsonb("word_frequencies"),
    intent: varchar({ length: 100 }),
    confidence: real(),
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [index("idx_natural_language_log_intent").on(table.intent), index("idx_natural_language_log_add_at").on(table.addAt)],
);

export const feedbackLog = pgTable(
  "FeedbackLog",
  {
    id: text().primaryKey().notNull(),
    query: text().notNull(),
    intent: text(),
    rating: varchar({ length: 10 }).notNull(), // "up" | "down"
    score: real(),
    compressedAccuracy: real(),
    userId: text("user_id"),
    responseSnippet: text("response_snippet"),
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    index("idx_feedback_log_add_at").on(table.addAt),
    index("idx_feedback_log_rating").on(table.rating),
    index("idx_feedback_log_intent").on(table.intent),
  ],
);

export const responseVersionLog = pgTable(
  "ResponseVersionLog",
  {
    id: text().primaryKey().notNull(),
    query: text().notNull(),
    intent: text(),
    version: varchar({ length: 100 }).notNull(), // e.g. "fastpath-basal-ganglia", "rag-hybrid", "persona-toLuong"
    responseSnippet: text("response_snippet"),
    confidence: real(),
    latencyMs: integer("latency_ms"),
    userId: text("user_id"),
    addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [
    index("idx_response_version_log_add_at").on(table.addAt),
    index("idx_response_version_log_version").on(table.version),
    index("idx_response_version_log_intent").on(table.intent),
  ],
);

export const vietnameseLexicon = pgTable("VietnameseLexicon", {
  id: text().primaryKey().notNull(),
  word: text().notNull().unique(), // e.g. "học sinh", "lung linh", "nhanh chậm"
  type: varchar({ length: 50 }).notNull(), // compound, reduplicative, antonym, synonym
  subType: varchar({ length: 100 }), // láy âm, láy vần, đối lập, đồng nghĩa
  definition: text(), // Giải nghĩa tiếng Việt
  relations: jsonb(), // Liên hệ liên đới (ví dụ: ["ngày", "đêm"])
  addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
});

export const bilingualCorpus = pgTable("BilingualCorpus", {
  id: text().primaryKey().notNull(),
  vi: text().notNull(),
  en: text(),
  zh: text(),
  ja: text(),
  fi: text(),
  he: text(),
  addAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
});

// TRỤ CỘT 3: SỔ CÁI TRUY XUẤT NGUỒN GỐC CHỐNG PHÂN MẢNH (IMMUTABLE TRACEABILITY LEDGER)
export const blockchainLedger = pgTable("BlockchainLedger", {
  id: text().primaryKey().notNull(), // Block ID (UUID)
  batchId: text().notNull(), // Mã định danh Lô hàng Nông sản
  action: varchar({ length: 150 }).notNull(), // Hành động: HARVEST (Thu hoạch), WAREHOUSE (Nhập kho), QA_CHECK (Kiểm định), EXPORT (Xuất khẩu)
  dataPayload: jsonb().notNull(), // Siêu dữ liệu lô hàng (Cân nặng, Nhiệt độ, Tọa độ GPS)
  previousHash: text().notNull(), // Con trỏ băm chuỗi khối liên kết trước đó
  currentHash: text().notNull(), // Mã băm SHA-256 bảo vệ tính bất biến của block hiện tại
  recordedBy: text(), // Tác nhân xác thực (ID của nông dân, kho bãi hoặc AI)
  timestamp: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
});

export const halfvec = (name: string, config?: any) => sqText(name, { mode: "json" });

// Bảng VectorDocument phục vụ lưu trữ AI Embeddings (RAG)
export const vectorDocument = pgTable(
  "VectorDocument",
  {
    id: text().primaryKey().notNull(), // ID (UUID)
    category: varchar({ length: 150 }).notNull(), // Phân loại (USER MEMORY, EDUCATION_CURRICULUM, etc.)
    title: text().notNull(), // Tiêu đề tri thức
    subtitle: text(), // Phụ đề/Mô tả phụ
    content: text().notNull(), // Nội dung chính của text chunk
    metadata: jsonb(), // Siêu dữ liệu bổ sung (tags, sources, etc.)
    embedding: halfvec("embedding", { dimensions: 1024 }), // Lưu vector embeddings dạng halfvec (Float16) để tối ưu RAM/Storage
    tenantId: text("tenant_id"), // Multi-tenant isolation ID
    createdAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [index("vector_document_idx").on(table.id)],
);

// Bảng lưu trữ nét vẽ AI sản phẩm (AiDrawingPath)
export const aiDrawingPath = pgTable("AiDrawingPath", {
  productName: text("productName").primaryKey().notNull(),
  points: jsonb("points").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "string" }).defaultNow(),
});

// Bảng LogRollup lưu trữ dữ liệu thống kê ngôn ngữ cuộn theo giờ
export const logRollup = pgTable("LogRollup", {
  id: text("id").primaryKey().notNull(),
  rollupHour: timestamp("rollup_hour", { withTimezone: true, mode: "string" }).notNull().unique(),
  totalLogs: integer("total_logs").notNull(),
  avgEntropy: real("avg_entropy").notNull(),
  avgWordCount: real("avg_word_count").notNull(),
  avgCharCount: real("avg_char_count").notNull(),
  intentDistribution: jsonb("intent_distribution").notNull(),
  wordFrequencies: jsonb("word_frequencies").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

// Bảng lưu trữ nhật ký thương lượng liên Agent (P2P Negotiation Audit Log)
export const negotiationLog = pgTable(
  "NegotiationLog",
  {
    id: text().primaryKey().notNull(),
    sessionId: text().notNull(),
    round: integer().notNull(),
    sellerId: text().notNull(),
    buyerId: text().notNull(),
    productName: text().notNull(),
    marketPrice: integer().notNull(),
    sellerOffer1: integer().notNull(),
    buyerBid1: integer().notNull(),
    sellerOffer2: integer().notNull(),
    buyerBid2: integer().notNull(),
    finalizedPrice: integer(),
    success: boolean().notNull(),
    dialogue: text().notNull(),
    denoisingLoss: real(),
    maskedPredictionLoss: real(),
    contrastiveLoss: real(),
    timestamp: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [index("idx_negotiation_log_session").on(table.sessionId)],
);

// Bảng lưu trữ bộ nhớ đệm SEO (Programmatic SEO Cache)
export const seoCache = pgTable(
  "SeoCache",
  {
    key: text().primaryKey().notNull(), // e.g. "ca-phe-robusta-tai-lam-dong"
    productSlug: text().notNull(),
    locationSlug: text().notNull(),
    title: text().notNull(),
    content: text().notNull(),
    metaDescription: text().notNull(),
    averagePrice: integer().notNull(),
    tradeVolume: integer().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
    updatedAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [index("idx_seo_cache_product").on(table.productSlug), index("idx_seo_cache_location").on(table.locationSlug)],
);

export const dpoTrainingData = pgTable("DpoTrainingData", {
  id: varchar("id", { length: 36 }).primaryKey().notNull(),
  prompt: text("prompt").notNull(),
  chosenResponse: text("chosen_response").notNull(),
  rejectedResponse: text("rejected_response").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

// Bảng lưu trữ Q-Table cho Reinforcement Learning
export const rlQTable = pgTable(
  "RlQTable",
  {
    id: text().primaryKey().notNull(), // UUID
    stateHash: text().notNull(), // Hash của state (vd: user intent, preferences)
    actionId: text().notNull(), // ID của action (vd: productId)
    qValue: real().notNull().default(0), // Giá trị Q hiện tại
    visitCount: integer().notNull().default(0), // Số lần state-action này được thực hiện
    lastUpdated: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table: any) => [index("idx_rl_qtable_state").on(table.stateHash)],
);

// Bảng lưu trữ cấu hình mạng nơ-ron (Weights) cho AI
export const aiModels = pgTable(
  "AiModels",
  {
    id: text().primaryKey().notNull(), // UUID hoặc Tên model (vd: 'rl_product_recommender')
    weightsJson: text().notNull(), // Chuỗi JSON chứa toàn bộ weights và cấu trúc của mạng
    lastUpdated: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  }
);

// Re-export federated learning tables
export { flRound, flGradientUpdate, flModelVersion, flNode, flPrivacyBudget } from "./fl-schema-additions";
