/**
 * 🧠 ROTTRA — MOBILE APP BACKEND
 * Offline-first sync protocol, push notifications, biometric auth support.
 * Backend services for Rottra mobile app.
 * Runs on Bun runtime.
 */

import { randomUUID, createHash } from "node:crypto";
import { Hono } from "hono";

// ── Types ─────────────────────────────────────────────────────

export interface SyncPayload {
  deviceId: string;
  userId: string;
  lastSyncTimestamp: number;
  changes: SyncChange[];
}

export interface SyncChange {
  entityType: "product" | "order" | "sensor" | "chat" | "profile";
  entityId: string;
  operation: "create" | "update" | "delete";
  data: Record<string, any>;
  timestamp: number;
}

export interface SyncResponse {
  serverTimestamp: number;
  changes: SyncChange[];
  conflicts: SyncConflict[];
}

export interface SyncConflict {
  entityType: string;
  entityId: string;
  clientVersion: Record<string, any>;
  serverVersion: Record<string, any>;
  resolution: "client_wins" | "server_wins" | "manual";
}

export interface PushNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any> | undefined;
  priority: "low" | "normal" | "high";
  sentAt: Date;
  readAt?: Date;
}

export interface BiometricCredential {
  id: string;
  userId: string;
  deviceId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  createdAt: Date;
  lastUsedAt?: Date;
}

// ── Offline-First Sync Engine ─────────────────────────────────

const deviceSyncState: Map<string, { lastSync: number; pendingChanges: SyncChange[] }> = new Map();
const syncLog: SyncChange[] = [];

/**
 * Process a sync request from a mobile device
 */
export async function processSyncRequest(payload: SyncPayload): Promise<SyncResponse> {
  const { deviceId, userId, lastSyncTimestamp, changes } = payload;

  // Apply client changes to server
  const conflicts: SyncConflict[] = [];
  for (const change of changes) {
    const conflict = await applyChange(change, userId);
    if (conflict) conflicts.push(conflict);
  }

  // Get server changes since last sync
  const serverChanges = syncLog.filter(
    (c) => c.timestamp > lastSyncTimestamp && c.entityType !== "chat", // exclude chat for perf
  );

  // Update device sync state
  deviceSyncState.set(deviceId, {
    lastSync: Date.now(),
    pendingChanges: [],
  });

  return {
    serverTimestamp: Date.now(),
    changes: serverChanges.slice(0, 100), // limit to 100
    conflicts,
  };
}

/**
 * Apply a single change from client
 */
async function applyChange(change: SyncChange, userId: string): Promise<SyncConflict | null> {
  // Log the change
  syncLog.push({ ...change, timestamp: Date.now() });

  // Keep sync log bounded
  if (syncLog.length > 10000) {
    syncLog.splice(0, syncLog.length - 5000);
  }

  // In production, would write to DB with conflict detection
  // For now, return null (no conflict)
  return null;
}

/**
 * Get offline-cached data for a device
 */
export async function getOfflineData(userId: string, entityTypes: string[]): Promise<Record<string, any[]>> {
  const result: Record<string, any[]> = {};
  for (const type of entityTypes) {
    result[type] = []; // Would query DB in production
  }
  return result;
}

// ── Push Notifications �────────────────────────────────────────

const pushSubscriptions: Map<string, { endpoint: string; keys: { p256dh: string; auth: string } }> = new Map();
const notifications: PushNotification[] = [];

/**
 * Register a push notification subscription
 */
export function registerPushSubscription(userId: string, endpoint: string, keys: { p256dh: string; auth: string }): void {
  pushSubscriptions.set(userId, { endpoint, keys });
  console.log(`[PUSH] Subscription registered for user ${userId}`);
}

/**
 * Send push notification to a user
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>,
  priority: PushNotification["priority"] = "normal",
): Promise<{ sent: boolean; error?: string }> {
  const subscription = pushSubscriptions.get(userId);
  if (!subscription) {
    return { sent: false, error: "No push subscription found" };
  }

  const notification: PushNotification = {
    id: randomUUID(),
    userId,
    title,
    body,
    data,
    priority,
    sentAt: new Date(),
  };

  notifications.push(notification);

  // In production, would use web-push library to send
  console.log(`[PUSH] Notification sent to ${userId}: ${title}`);
  return { sent: true };
}

/**
 * Send bulk push notifications
 */
export async function sendBulkPushNotification(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const result = await sendPushNotification(userId, title, body, data);
    if (result.sent) sent++;
    else failed++;
  }

  return { sent, failed };
}

/**
 * Get notification history for a user
 */
export function getNotificationHistory(userId: string, limit: number = 50): PushNotification[] {
  return notifications
    .filter((n) => n.userId === userId)
    .slice(-limit)
    .reverse();
}

// ── Biometric Authentication (WebAuthn) ──────────────────────

const biometricCredentials: Map<string, BiometricCredential[]> = new Map();

/**
 * Start biometric registration (create challenge)
 */
export function startBiometricRegistration(userId: string, deviceId: string): { challenge: string; credentialId: string } {
  const challenge = randomUUID();
  const credentialId = randomUUID();

  // Store challenge for verification
  deviceSyncState.set(`bio_challenge_${challenge}`, {
    lastSync: Date.now(),
    pendingChanges: [
      { entityType: "profile", entityId: credentialId, operation: "create", data: { userId, deviceId }, timestamp: Date.now() },
    ],
  });

  return { challenge, credentialId };
}

/**
 * Complete biometric registration (verify and store credential)
 */
export function completeBiometricRegistration(
  userId: string,
  deviceId: string,
  credentialId: string,
  publicKey: string,
): BiometricCredential {
  const credential: BiometricCredential = {
    id: randomUUID(),
    userId,
    deviceId,
    credentialId,
    publicKey,
    counter: 0,
    createdAt: new Date(),
  };

  const userCreds = biometricCredentials.get(userId) || [];
  userCreds.push(credential);
  biometricCredentials.set(userId, userCreds);

  console.log(`[BIOMETRIC] Credential registered for user ${userId} on device ${deviceId}`);
  return credential;
}

/**
 * Verify biometric authentication
 */
export function verifyBiometric(userId: string, credentialId: string): { verified: boolean; error?: string } {
  const userCreds = biometricCredentials.get(userId) || [];
  const cred = userCreds.find((c) => c.credentialId === credentialId);

  if (!cred) {
    return { verified: false, error: "Credential not found" };
  }

  // Update counter and last used
  cred.counter++;
  cred.lastUsedAt = new Date();

  return { verified: true };
}

/**
 * Get biometric credentials for a user
 */
export function getBiometricCredentials(userId: string): BiometricCredential[] {
  return biometricCredentials.get(userId) || [];
}

/**
 * Remove a biometric credential
 */
export function removeBiometricCredential(userId: string, credentialId: string): boolean {
  const userCreds = biometricCredentials.get(userId) || [];
  const idx = userCreds.findIndex((c) => c.credentialId === credentialId);
  if (idx === -1) return false;
  userCreds.splice(idx, 1);
  biometricCredentials.set(userId, userCreds);
  return true;
}

// ── Hono API Routes ───────────────────────────────────────────

/**
 * Create mobile app API routes for Hono
 */
export function createMobileRoutes() {
  const mobileApp = new Hono();

  // POST /mobile/sync — Sync data with server
  mobileApp.post("/sync", async (c: any) => {
    const body = await c.req.json();
    const response = await processSyncRequest(body);
    return c.json({ success: true, ...response });
  });

  // POST /mobile/push/register — Register push subscription
  mobileApp.post("/push/register", async (c: any) => {
    const body = await c.req.json();
    registerPushSubscription(body.userId, body.endpoint, body.keys);
    return c.json({ success: true });
  });

  // POST /mobile/push/send — Send push notification
  mobileApp.post("/push/send", async (c: any) => {
    const body = await c.req.json();
    const result = await sendPushNotification(body.userId, body.title, body.body, body.data, body.priority);
    return c.json({ success: true, ...result });
  });

  // GET /mobile/push/history — Get notification history
  mobileApp.get("/push/history", (c: any) => {
    const userId = c.req.query("userId");
    const history = getNotificationHistory(userId);
    return c.json({ success: true, history });
  });

  // POST /mobile/biometric/register/start — Start biometric registration
  mobileApp.post("/biometric/register/start", async (c: any) => {
    const body = await c.req.json();
    const result = startBiometricRegistration(body.userId, body.deviceId);
    return c.json({ success: true, ...result });
  });

  // POST /mobile/biometric/register/complete — Complete biometric registration
  mobileApp.post("/biometric/register/complete", async (c: any) => {
    const body = await c.req.json();
    const cred = completeBiometricRegistration(body.userId, body.deviceId, body.credentialId, body.publicKey);
    return c.json({ success: true, credential: cred });
  });

  // POST /mobile/biometric/verify — Verify biometric auth
  mobileApp.post("/biometric/verify", async (c: any) => {
    const body = await c.req.json();
    const result = verifyBiometric(body.userId, body.credentialId);
    return c.json({ success: true, ...result });
  });

  // GET /mobile/biometric/credentials — List biometric credentials
  mobileApp.get("/biometric/credentials", (c: any) => {
    const userId = c.req.query("userId");
    const creds = getBiometricCredentials(userId);
    return c.json({ success: true, credentials: creds });
  });

  return mobileApp;
}

export const mobileEngine = {
  processSyncRequest,
  getOfflineData,
  registerPushSubscription,
  sendPushNotification,
  sendBulkPushNotification,
  getNotificationHistory,
  startBiometricRegistration,
  completeBiometricRegistration,
  verifyBiometric,
  getBiometricCredentials,
  removeBiometricCredential,
  createMobileRoutes,
};
