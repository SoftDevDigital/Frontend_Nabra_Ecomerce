// src/lib/notificationsApi.ts
import { apiFetch } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

/* ========== Tipos base ========== */
export type NotifType = "ORDER" | "PROMOTION" | "WELCOME" | "SHIPPING" | "REVIEW" | "LOYALTY" | string;
export type NotifChannel = "EMAIL" | "SMS" | "PUSH" | "IN_APP" | string;
export type NotifStatus = "SENT" | "DELIVERED" | "READ" | "FAILED" | "SCHEDULED" | string;

export type Notification = {
  _id: string;
  userId: string;
  type: NotifType;
  channel: NotifChannel;
  title: string;
  content?: string;
  status: NotifStatus;
  isRead?: boolean;
  metadata?: Record<string, any>;
  sentAt?: string | null;
  readAt?: string | null;
  createdAt?: string;
};

export type NotificationsListResponse = {
  notifications: Notification[];
  total: number;
  page: number;
  totalPages: number;
  unreadCount: number;
};

export type NotificationsQuery = {
  page?: number;
  limit?: number;
  type?: NotifType;
  channel?: NotifChannel;
  status?: NotifStatus;
  unreadOnly?: boolean;
};

export type NotifStats = {
  totalNotifications: number;
  unreadCount: number;
  readCount: number;
  byType: Record<string, number>;
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
};

export type PreferencesMatrix = Record<
  NotifType,
  Partial<Record<NotifChannel, boolean>>
>;

export type PreferencesPayload = {
  preferences?: PreferencesMatrix;
  globalSettings?: {
    allowMarketing?: boolean;
    allowPromotional?: boolean;
    allowOrderUpdates?: boolean;
    allowShippingUpdates?: boolean;
    [k: string]: any;
  };
};

export type PreferencesResponse = {
  userId: string;
  preferences: PreferencesMatrix;
  globalSettings?: PreferencesPayload["globalSettings"];
};

/* ========== Helpers ========== */
function buildQS(q: Record<string, any>) {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (typeof v === "boolean") params.set(k, String(v));
    else params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

/* ========== User: list & stats ========== */
export async function getNotifications(query: NotificationsQuery = {}) {
  const url = `${API_BASE}/notifications${buildQS(query)}`;
  return apiFetch<NotificationsListResponse>(url, { method: "GET" });
}

export async function getNotificationStats() {
  const url = `${API_BASE}/notifications/stats`;
  return apiFetch<NotifStats>(url, { method: "GET" });
}

/* ========== User: marcar como leído ========== */
export async function markNotificationRead(id: string) {
  const url = `${API_BASE}/notifications/${encodeURIComponent(id)}/read`;
  // 204 sin contenido
  await apiFetch<unknown>(url, { method: "PUT" });
  return { success: true as const };
}

export async function markAllNotificationsRead() {
  const url = `${API_BASE}/notifications/read-all`;
  return apiFetch<{ success: true; markedCount: number }>(url, { method: "PUT" });
}

/* ========== User: preferencias ========== */
export async function getNotificationPreferences() {
  const url = `${API_BASE}/notifications/preferences`;
  return apiFetch<PreferencesResponse>(url, { method: "GET" });
}

export async function updateNotificationPreferences(body: PreferencesPayload) {
  const url = `${API_BASE}/notifications/preferences`;
  return apiFetch<{ message?: string; preferences?: PreferencesMatrix }>(url, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/* ========== Admin: crear / bulk / segment / stats ========== */
export async function adminCreateNotification(body: {
  userId: string;
  type: NotifType;
  channel: NotifChannel;
  title: string;
  content?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  scheduledFor?: string;
}) {
  const url = `${API_BASE}/notifications`;
  return apiFetch<Notification>(url, { method: "POST", body: JSON.stringify(body) });
}

export async function adminBulkNotifications(body: {
  userIds: string[];
  type: NotifType;
  channel: NotifChannel;
  title: string;
  content?: string;
  templateId?: string;
  templateData?: Record<string, any>;
}) {
  const url = `${API_BASE}/notifications/bulk`;
  return apiFetch<{ success: boolean; notificationIds: string[]; count: number }>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminSegmentNotifications(body: {
  segment: { type: string; criteria: Record<string, any> };
  type: NotifType;
  channel: NotifChannel;
  title: string;
  content?: string;
  templateId?: string;
  templateData?: Record<string, any>;
}) {
  const url = `${API_BASE}/notifications/segment`;
  return apiFetch<{ success?: boolean }>(url, { method: "POST", body: JSON.stringify(body) });
}

export async function adminGetNotificationsStats(q?: {
  type?: NotifType;
  channel?: NotifChannel;
  dateFrom?: string;
  dateTo?: string;
}) {
  const url = `${API_BASE}/notifications/admin/stats${buildQS(q ?? {})}`;
  return apiFetch<{
    totalNotifications: number;
    deliveryStats: { sent: number; delivered: number; failed: number; deliveryRate: number };
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    performance?: { averageDeliveryTime?: string; peakHours?: string[]; bestPerformingType?: string };
  }>(url, { method: "GET" });
}

/* ========== Admin: testing ========== */
export async function adminTestSend(body: {
  userId: string;
  type: NotifType;
  channel: NotifChannel;
  title: string;
  content: string;
}) {
  const url = `${API_BASE}/notifications/test/send`;
  return apiFetch<{ success?: boolean }>(url, { method: "POST", body: JSON.stringify(body) });
}

export async function adminTestTemplate(body: {
  userId: string;
  templateId: string;
  channel: NotifChannel;
  templateData?: Record<string, any>;
}) {
  const url = `${API_BASE}/notifications/test/template`;
  return apiFetch<{ success?: boolean }>(url, { method: "POST", body: JSON.stringify(body) });
}
