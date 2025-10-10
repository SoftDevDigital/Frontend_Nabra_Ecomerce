// src/lib/notificationsApi.ts
import { apiFetch } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

/* ========== Tipos base ========== */
export type NotifType =
  | "ORDER"
  | "PROMOTION"
  | "WELCOME"
  | "SHIPPING"
  | "REVIEW"
  | "LOYALTY"
  | string;
export type NotifChannel = "EMAIL" | "SMS" | "PUSH" | "IN_APP" | string;
export type NotifStatus =
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "SCHEDULED"
  | string;

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

/* ===== channelSettings (passthrough) ===== */
export type ChannelQuietHours = {
  enabled?: boolean;
  start?: string;
  end?: string;
  timezone?: string;
};
export type ChannelConfig = {
  enabled?: boolean;
  /** tu backend a veces devuelve objeto vacío {} o string */
  frequency?: string | Record<string, any>;
  quietHours?: ChannelQuietHours;
};
export type ChannelSettings = {
  email?: ChannelConfig;
  sms?: ChannelConfig;
  push?: ChannelConfig;
  [k: string]: any;
};

export type PreferencesPayload = {
  preferences?: PreferencesMatrix;
  globalSettings?: {
    allowMarketing?: boolean;
    allowPromotional?: boolean;
    allowOrderUpdates?: boolean;
    allowShippingUpdates?: boolean;
    [k: string]: any;
  };
  /** si tu UI edita channelSettings, lo pasás acá y se reenvía tal cual */
  channelSettings?: ChannelSettings;
};

export type PreferencesResponse = {
  userId: string;
  preferences: PreferencesMatrix;
  globalSettings?: PreferencesPayload["globalSettings"];
  /** NUEVO: devolvemos lo que trae el backend por si querés usarlo en la UI */
  channelSettings?: ChannelSettings;
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

/* modes -> flags por canal */
function normalizeModeToChannels(mode?: string): Partial<Record<NotifChannel, boolean>> {
  const m = String(mode || "").toLowerCase();
  const on = (x: NotifChannel) => ({ [x]: true as const });
  switch (m) {
    case "all_channels":
    case "all":
    case "any":
      return { EMAIL: true, SMS: true, PUSH: true, IN_APP: true };
    case "email_only":
    case "email":
      return on("EMAIL");
    case "sms_only":
    case "sms":
      return on("SMS");
    case "push_only":
    case "push":
      return on("PUSH");
    case "in_app_only":
    case "in_app":
    case "inapp":
      return on("IN_APP");
    case "email_and_push":
      return { EMAIL: true, PUSH: true };
    case "email_and_sms":
      return { EMAIL: true, SMS: true };
    case "push_and_in_app":
      return { PUSH: true, IN_APP: true };
    case "none":
    case "disabled":
      return {};
    default:
      return {};
  }
}

/* flags por canal -> mode (backend) */
function channelsToMode(row: Partial<Record<NotifChannel, boolean>> | undefined): string {
  const on = (k: NotifChannel) => !!row?.[k];
  const E = on("EMAIL"), S = on("SMS"), P = on("PUSH"), I = on("IN_APP");

  if (!E && !S && !P && !I) return "disabled";
  if (E && S && P && I) return "all_channels";
  if (E && !S && !P && !I) return "email_only";
  if (!E && S && !P && !I) return "sms_only";
  if (!E && !S && P && !I) return "push_only";
  if (!E && !S && !P && I) return "in_app_only";
  if (E && P && !S && !I) return "email_and_push";
  if (E && S && !P && !I) return "email_and_sms";
  if (P && I && !E && !S) return "push_and_in_app";

  if (E && I && !S && !P) return "email_and_in_app";
  if (S && P && !E && !I) return "sms_and_push";
  if (S && I && !E && !P) return "sms_and_in_app";
  if (E && S && P && !I) return "email_sms_push";
  if (E && P && I && !S) return "email_push_in_app";
  if (E && S && I && !P) return "email_sms_in_app";
  if (S && P && I && !E) return "sms_push_in_app";

  return "disabled";
}

/* ========== User: list & stats (normalizado a tu UI) ========== */
export async function getNotifications(query: NotificationsQuery = {}) {
  const url = `${API_BASE}/notifications${buildQS(query)}`;
  const raw = await apiFetch<any>(url, { method: "GET" });
  const data = raw?.data ?? raw ?? {};

  const notifications: Notification[] = data.notifications ?? [];
  const total = Number.isFinite(data.total) ? Number(data.total) : notifications.length;
  const page = Number.isFinite(data.page) ? Number(data.page) : (query.page ?? 1);
  const limit = Number.isFinite(data.limit) ? Number(data.limit) : (query.limit ?? 20);

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const unreadCount = Number.isFinite(data?.stats?.unread) ? Number(data.stats.unread) : 0;

  return {
    notifications,
    total,
    page,
    totalPages,
    unreadCount,
  } as NotificationsListResponse;
}

export async function getNotificationStats(): Promise<NotifStats> {
  try {
    const url = `${API_BASE}/notifications/stats`;
    const res = await apiFetch<any>(url, { method: "GET" });

    // Puede venir plano o envuelto en data
    const d = res?.data ?? res ?? {};

    // El backend nuevo trae estos campos:
    const total    = Number(d.total ?? 0);
    const sent     = Number(d.sent ?? 0);
    const delivered= Number(d.delivered ?? 0);
    const failed   = Number(d.failed ?? 0);
    const pending  = Number(d.pending ?? 0);
    const read     = Number(d.read ?? 0);
    const unread   = Number(d.unread ?? 0);

    // Adaptamos al shape de tu UI
    return {
      totalNotifications: total,
      unreadCount: unread,
      readCount: read,
      byType: {},
      byChannel: {},
      byStatus: {
        total,
        sent,
        delivered,
        failed,
        pending,
        read,
        unread,
      },
    };
  } catch {
    // Fallback: estimamos a partir del listado (como ya tenías)
    const list = await getNotifications({ page: 1, limit: 1 });
    return {
      totalNotifications: list.total ?? 0,
      unreadCount: list.unreadCount ?? 0,
      readCount: Math.max(0, (list.total ?? 0) - (list.unreadCount ?? 0)),
      byType: {},
      byChannel: {},
      byStatus: {},
    };
  }
}

/* ========== User: marcar como leído ========== */
export async function markNotificationRead(id: string) {
  const url = `${API_BASE}/notifications/${encodeURIComponent(id)}/read`;
  await apiFetch<unknown>(url, { method: "PUT" });
  return { success: true as const };
}

// Reemplazar esta función en src/lib/notificationsApi.ts
export async function markAllNotificationsRead() {
  const url = `${API_BASE}/notifications/read-all`;

  // Helper para normalizar la respuesta en cualquier forma
  const pickMarked = (res: any): number => {
    if (!res) return 0;
    // casos: { success:true, markedCount: N }
    if (Number.isFinite(res?.markedCount)) return Number(res.markedCount);
    // casos: { success:true, data:{ markedCount: N } }
    if (Number.isFinite(res?.data?.markedCount)) return Number(res.data.markedCount);
    // casos: { data:{ success:true, markedCount: N }, message:"..." }
    if (Number.isFinite(res?.data?.data?.markedCount)) return Number(res.data.data.markedCount);
    return 0;
  };

  // 1) Intento con PUT
  try {
    const r = await apiFetch<any>(url, { method: "PUT" });
    const markedCount = pickMarked(r);
    return { success: true as const, markedCount };
  } catch {
    // 2) Fallback a POST (por si el backend usa POST)
    const r = await apiFetch<any>(url, { method: "POST" });
    const markedCount = pickMarked(r);
    return { success: true as const, markedCount };
  }
}


/* ============================================================================
   USER PREFERENCES (/notifications/preferences)
============================================================================ */

export type UserPreferencesRaw = {
  userId: string;
  preferences: Record<string, string>; // ej. "welcome": "email_and_push" | "disabled"
  channelSettings?: ChannelSettings;
  blockedTypes?: string[];
  blockedCategories?: string[];
  allowMarketing?: boolean;
  allowTransactional?: boolean;
  allowSystem?: boolean;
  language?: string;
  timezone?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastUpdatedAt?: string;
  [k: string]: any;
};

export async function getNotificationPreferencesRaw() {
  const url = `${API_BASE}/notifications/preferences`;
  const raw = await apiFetch<any>(url, { method: "GET" });
  return (raw?.data ?? raw ?? {}) as UserPreferencesRaw;
}

/** GET normalizado: modes -> flags, + globalSettings y channelSettings passthrough */
export async function getNotificationPreferences(): Promise<PreferencesResponse> {
  const d = await getNotificationPreferencesRaw();

  const preferences: PreferencesMatrix = {};
  Object.entries(d.preferences || {}).forEach(([k, mode]) => {
    preferences[k as NotifType] = normalizeModeToChannels(mode);
  });

  const globalSettings: PreferencesPayload["globalSettings"] = {
    allowMarketing: d.allowMarketing,
    allowPromotional: d.allowMarketing,
    allowOrderUpdates: d.allowTransactional,
    allowShippingUpdates: d.allowTransactional,
  };

  return {
    userId: d.userId,
    preferences,
    globalSettings,
    channelSettings: d.channelSettings, // NUEVO
  };
}

/** PUT normalizado: flags -> modes; mapeo de globales; channelSettings passthrough */
export async function updateNotificationPreferences(body: PreferencesPayload) {
  const url = `${API_BASE}/notifications/preferences`;

  // flags -> modes
  const modes: Record<string, string> = {};
  Object.entries(body.preferences ?? {}).forEach(([k, row]) => {
    modes[k] = channelsToMode(row as Partial<Record<NotifChannel, boolean>>);
  });

  // globales UI -> backend
  const gs = body.globalSettings ?? {};
  const allowMarketing =
    typeof gs.allowMarketing === "boolean"
      ? gs.allowMarketing
      : typeof gs.allowPromotional === "boolean"
      ? gs.allowPromotional
      : undefined;

  const allowTransactional =
    typeof gs.allowOrderUpdates === "boolean" || typeof gs.allowShippingUpdates === "boolean"
      ? Boolean(gs.allowOrderUpdates || gs.allowShippingUpdates)
      : undefined;

  const toSend: Record<string, any> = { preferences: modes };
  if (allowMarketing !== undefined) toSend.allowMarketing = allowMarketing;
  if (allowTransactional !== undefined) toSend.allowTransactional = allowTransactional;
  if (body.channelSettings) toSend.channelSettings = body.channelSettings;

  const res = await apiFetch<any>(url, {
    method: "PUT",
    body: JSON.stringify(toSend),
  });

  return {
    message: res?.message || res?.data?.message || "Preferencias actualizadas",
    preferences: body.preferences,
  } as { message?: string; preferences?: PreferencesMatrix };
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

/** Algunos backends esperan userIds como STRING CSV.
 *  Aceptamos string[] | string y convertimos a CSV si es arreglo. */
export async function adminBulkNotifications(body: {
  userIds: string[] | string;
  type: NotifType;
  channel: NotifChannel;
  title: string;
  content?: string;
  templateId?: string;
  templateData?: Record<string, any>;
}) {
  const url = `${API_BASE}/notifications/bulk`;

  const normalizedBody: Record<string, any> = {
    ...body,
    userIds: Array.isArray(body.userIds) ? body.userIds.join(",") : body.userIds,
  };

  return apiFetch<{ success: boolean; notificationIds?: string[]; count?: number }>(url, {
    method: "POST",
    body: JSON.stringify(normalizedBody),
  });
}

// Reemplazar adminSegmentNotifications en src/lib/notificationsApi.ts
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
  const res = await apiFetch<any>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });

  // Normalización tolerante:
  // puede venir { success, data:{ success, notificationIds, count }, message }
  // o llano en raíz.
  const d = res?.data ?? res ?? {};
  const inner = d?.data ?? d;

  const notificationIds: string[] = Array.isArray(inner?.notificationIds)
    ? inner.notificationIds
    : Array.isArray(d?.notificationIds)
    ? d.notificationIds
    : [];

  const countRaw =
    inner?.count ?? d?.count ?? (Array.isArray(notificationIds) ? notificationIds.length : 0);

  const count = Number.isFinite(Number(countRaw)) ? Number(countRaw) : 0;

  const success =
    typeof inner?.success === "boolean"
      ? inner.success
      : typeof d?.success === "boolean"
      ? d.success
      : true;

  const message = res?.message ?? d?.message ?? inner?.message;

  return { success, notificationIds, count, message } as {
    success: boolean;
    notificationIds: string[];
    count: number;
    message?: string;
  };
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
    deliveryStats: {
      sent: number;
      delivered: number;
      failed: number;
      deliveryRate: number;
    };
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    performance?: {
      averageDeliveryTime?: string;
      peakHours?: string[];
      bestPerformingType?: string;
    };
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
  return apiFetch<{ success?: boolean }>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminTestTemplate(body: {
  userId: string;
  templateId: string;
  channel: NotifChannel;
  templateData?: Record<string, any>;
}) {
  const url = `${API_BASE}/notifications/test/template`;
  return apiFetch<{ success?: boolean }>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* ========== Admin: preferencias de un usuario (GET/PUT) ========== */
export type AdminUserPreferencesRaw = {
  userId: string;
  preferences: Record<string, string>;
  channelSettings?: ChannelSettings;
  blockedTypes?: string[];
  blockedCategories?: string[];
  allowMarketing?: boolean;
  allowTransactional?: boolean;
  allowSystem?: boolean;
  language?: string;
  timezone?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastUpdatedAt?: string;
  [k: string]: any;
};

export async function adminGetUserPreferencesRaw(userId: string): Promise<AdminUserPreferencesRaw> {
  const url = `${API_BASE}/notifications/admin/users/${encodeURIComponent(userId)}/preferences`;
  const raw = await apiFetch<any>(url, { method: "GET" });
  return (raw?.data ?? raw ?? {}) as AdminUserPreferencesRaw;
}

export async function adminGetUserPreferences(userId: string): Promise<PreferencesResponse> {
  const d = await adminGetUserPreferencesRaw(userId);

  const matrix: PreferencesMatrix = {};
  Object.entries(d.preferences || {}).forEach(([prefKey, mode]) => {
    matrix[prefKey as NotifType] = normalizeModeToChannels(mode);
  });

  const globalSettings: PreferencesPayload["globalSettings"] = {
    allowMarketing: d.allowMarketing,
    allowPromotional: d.allowMarketing,
    allowOrderUpdates: d.allowTransactional,
    allowShippingUpdates: d.allowTransactional,
  };

  return {
    userId: d.userId,
    preferences: matrix,
    globalSettings,
    channelSettings: d.channelSettings,
  };
}

export async function adminUpdateUserPreferences(
  userId: string,
  payload: PreferencesPayload
): Promise<PreferencesResponse> {
  const url = `${API_BASE}/notifications/admin/users/${encodeURIComponent(userId)}/preferences`;

  const modes: Record<string, string> = {};
  Object.entries(payload.preferences ?? {}).forEach(([k, row]) => {
    modes[k] = channelsToMode(row as Partial<Record<NotifChannel, boolean>>);
  });

  const gs = payload.globalSettings ?? {};
  const allowMarketing =
    typeof gs.allowMarketing === "boolean" ? gs.allowMarketing :
    typeof gs.allowPromotional === "boolean" ? gs.allowPromotional : undefined;

  const allowTransactional =
    typeof gs.allowOrderUpdates === "boolean" || typeof gs.allowShippingUpdates === "boolean"
      ? Boolean(gs.allowOrderUpdates || gs.allowShippingUpdates)
      : undefined;

  const bodyToSend: Record<string, any> = {
    preferences: modes,
  };
  if (allowMarketing !== undefined) bodyToSend.allowMarketing = allowMarketing;
  if (allowTransactional !== undefined) bodyToSend.allowTransactional = allowTransactional;
  if (payload.channelSettings) bodyToSend.channelSettings = payload.channelSettings;

  await apiFetch<any>(url, {
    method: "PUT",
    body: JSON.stringify(bodyToSend),
  });

  return adminGetUserPreferences(userId);
}
