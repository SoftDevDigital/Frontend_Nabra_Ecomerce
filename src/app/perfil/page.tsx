// src/app/perfil/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import s from "./Perfil.module.css";

/* 🔔 NUEVO: notifications API */
import {
  getNotifications,
  getNotificationStats,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  adminCreateNotification,
  adminBulkNotifications,
  adminSegmentNotifications,
  adminGetNotificationsStats,
  adminTestSend,
  adminTestTemplate,
  type Notification,
  type NotifType,
  type NotifChannel,
  type NotifStatus,
  type PreferencesResponse,
  type PreferencesPayload,
} from "@/lib/notificationsApi";

type Address = {
  street?: string;
  city?: string;
  zip?: string;
  country?: string;
  [k: string]: any;
};

type UserProfile = {
  _id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  address?: Address;
  [k: string]: any;
};

type ProfileResponse =
  | { success: true; data: UserProfile; message?: string }
  | { success: false; message: string };

/* ========= helpers para detectar admin por el token ========= */
function getJwtPayload(): any | null {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}
function isAdminFromToken(): boolean {
  const p = getJwtPayload();
  if (!p) return false;
  const role = p.role || p.roles || p.userRole || p["https://example.com/roles"];
  if (Array.isArray(role)) return role.map(String).some((r) => r.toLowerCase() === "admin");
  if (typeof role === "string") return role.toLowerCase() === "admin";
  return false;
}
/* ===================================================================== */

export default function PerfilPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // estado para editar y guardar perfil
  const [formName, setFormName] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formZip, setFormZip] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // admin + listado de usuarios (GET /users)
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersErr, setUsersErr] = useState<string | null>(null);

  // edición de rol
  const ROLE_OPTIONS = ["user", "admin"] as const;
  type Role = typeof ROLE_OPTIONS[number];
  const [roleDraft, setRoleDraft] = useState<Record<string, Role>>({});
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);

  // eliminación de usuario
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

  type UsersResponse =
    | { success: true; data: UserProfile[]; message?: string }
    | { success: false; message: string };

  async function loadAllUsers() {
    setUsersErr(null);
    setUsersLoading(true);
    setRoleMsg(null);
    try {
      const r = await apiFetch<UsersResponse>("/users", { method: "GET" });
      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudieron obtener los usuarios");
      }
      const list = r.data || [];
      setUsers(list);
      const draft: Record<string, Role> = {};
      list.forEach((u) => (draft[u._id] = ((u.role || "user") as Role)));
      setRoleDraft(draft);
    } catch (e: any) {
      const m = String(e?.message || "No se pudieron obtener los usuarios");
      if (/403|administrador/i.test(m)) {
        setUsersErr("Se requiere rol de administrador");
      } else if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("token")) {
        window.location.href = "/auth?redirectTo=/perfil";
        return;
      } else {
        setUsersErr(m);
      }
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadProfile() {
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch<ProfileResponse>("/users/profile", { method: "GET" });
      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudo obtener el perfil");
      }
      setProfile(r.data);

      const p = r.data;
      setFormName(p.name || [p.firstName, p.lastName].filter(Boolean).join(" "));
      setFormStreet(p.address?.street || "");
      setFormCity(p.address?.city || "");
      setFormZip(p.address?.zip || "");
      setFormCountry(p.address?.country || "");
    } catch (e: any) {
      const msg = String(e?.message || "No se pudo obtener el perfil");
      if (msg.toLowerCase().includes("no autenticado") || msg.toLowerCase().includes("token")) {
        window.location.href = "/auth?redirectTo=/perfil";
        return;
      }
      setErr(msg.includes("404") || /no encontrado/i.test(msg) ? "Usuario no encontrado" : msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  function fullName(p: UserProfile | null) {
    if (!p) return "";
    if (p.name) return p.name;
    const fn = p.firstName ?? "";
    const ln = p.lastName ?? "";
    return [fn, ln].filter(Boolean).join(" ");
  }

  function handleLogout() {
    try {
      localStorage.removeItem("nabra_token");
    } catch {}
    window.location.href = "/";
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    setErr(null);

    const body: Record<string, string> = {};
    if (formName.trim()) body.name = formName.trim();
    if (formStreet.trim()) body.street = formStreet.trim();
    if (formCity.trim()) body.city = formCity.trim();
    if (formZip.trim()) body.zip = formZip.trim();
    if (formCountry.trim()) body.country = formCountry.trim();

    if (Object.keys(body).length === 0) {
      setSaveMsg("No hay cambios para guardar.");
      return;
    }

    setSaving(true);
    try {
      const r = await apiFetch<ProfileResponse>("/users/profile", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudo actualizar el perfil");
      }

      setProfile(r.data);
      setSaveMsg("Perfil actualizado ✅");

      const p = r.data;
      setFormName(p.name || [p.firstName, p.lastName].filter(Boolean).join(" "));
      setFormStreet(p.address?.street || "");
      setFormCity(p.address?.city || "");
      setFormZip(p.address?.zip || "");
      setFormCountry(p.address?.country || "");
    } catch (e: any) {
      const msg = String(e?.message || "No se pudo actualizar el perfil");
      if (msg.toLowerCase().includes("no autenticado") || msg.toLowerCase().includes("token")) {
        window.location.href = "/auth?redirectTo=/perfil";
        return;
      }
      setSaveMsg(msg.includes("404") || /no encontrado/i.test(msg) ? "Usuario no encontrado" : msg);
    } finally {
      setSaving(false);
    }
  }

  function resetFormFromProfile() {
    const p = profile;
    setFormName(p ? (p.name || [p.firstName, p.lastName].filter(Boolean).join(" ")) : "");
    setFormStreet(p?.address?.street || "");
    setFormCity(p?.address?.city || "");
    setFormZip(p?.address?.zip || "");
    setFormCountry(p?.address?.country || "");
    setSaveMsg(null);
  }

  type RoleUpdateResponse =
    | { success: true; data: UserProfile; message?: string }
    | { success: false; message: string };

  async function handleUpdateUserRole(userId: string) {
    if (!userId) return;
    setRoleMsg(null);
    const desired = roleDraft[userId] as Role | undefined;
    if (!desired || !ROLE_OPTIONS.includes(desired)) {
      setRoleMsg("Rol inválido.");
      return;
    }

    setRoleSavingId(userId);
    try {
      const r = await apiFetch<RoleUpdateResponse>(`/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: desired }),
      });

      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudo actualizar el rol");
      }

      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, role: r.data.role } : u)));
      setRoleDraft((s) => ({ ...s, [userId]: (r.data.role as Role) }));
      setRoleMsg(`Rol actualizado ✅ (${r.data.email}: ${r.data.role})`);
    } catch (e: any) {
      const m = String(e?.message || "No se pudo actualizar el rol");
      if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("token")) {
        window.location.href = "/auth?redirectTo=/perfil";
        return;
      }
      setRoleMsg(m);
    } finally {
      setRoleSavingId(null);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!userId) return;

    if (profile?._id === userId) {
      setDeleteMsg("No podés eliminar tu propio usuario.");
      return;
    }

    const ok = window.confirm("¿Eliminar este usuario de forma permanente?");
    if (!ok) return;

    setDeleteMsg(null);
    setDeletingUserId(userId);
    try {
      await apiFetch<unknown>(`/users/${userId}`, { method: "DELETE" });

      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setRoleDraft((prev) => {
        const { [userId]: _omit, ...rest } = prev;
        return rest as typeof prev;
      });
      setDeleteMsg("Usuario eliminado 🗑️");
    } catch (e: any) {
      const m = String(e?.message || "No se pudo eliminar el usuario");
      if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("token")) {
        window.location.href = "/auth?redirectTo=/perfil";
        return;
      }
      setDeleteMsg(m);
    } finally {
      setDeletingUserId(null);
    }
  }

  /* ========================= 🔔 NUEVO: NOTIFICATIONS (USER) ========================= */
  const [nqPage, setNqPage] = useState(1);
  const [nqLimit, setNqLimit] = useState(20);
  const [nqType, setNqType] = useState<NotifType | "">("");
  const [nqChannel, setNqChannel] = useState<NotifChannel | "">("");
  const [nqStatus, setNqStatus] = useState<NotifStatus | "">("");
  const [nqUnread, setNqUnread] = useState(false);

  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [notifsTotal, setNotifsTotal] = useState(0);
  const [notifsPages, setNotifsPages] = useState(1);
  const [notifsUnreadCount, setNotifsUnreadCount] = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [notifsErr, setNotifsErr] = useState<string | null>(null);

  const [stats, setStats] = useState<Awaited<ReturnType<typeof getNotificationStats>> | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsErr, setStatsErr] = useState<string | null>(null);

  async function loadNotifs() {
    setNotifsErr(null);
    setNotifsLoading(true);
    try {
      const r = await getNotifications({
        page: nqPage,
        limit: nqLimit,
        type: nqType || undefined,
        channel: nqChannel || undefined,
        status: nqStatus || undefined,
        unreadOnly: nqUnread || undefined,
      });
      setNotifs(r.notifications || []);
      setNotifsTotal(r.total ?? 0);
      setNotifsPages(r.totalPages ?? 1);
      setNotifsUnreadCount(r.unreadCount ?? 0);
    } catch (e: any) {
      const m = String(e?.message || "No se pudieron cargar las notificaciones");
      if (/no autenticado|token|401|403/i.test(m)) {
        window.location.href = "/auth?redirectTo=/perfil";
        return;
      }
      setNotifsErr(m);
    } finally {
      setNotifsLoading(false);
    }
  }

  async function loadStats() {
    setStatsErr(null);
    setStatsLoading(true);
    try {
      const r = await getNotificationStats();
      setStats(r);
    } catch (e: any) {
      const m = String(e?.message || "No se pudieron cargar las estadísticas");
      if (/no autenticado|token|401|403/i.test(m)) {
        window.location.href = "/auth?redirectTo=/perfil";
        return;
      }
      setStatsErr(m);
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    // carga inicial
    void loadNotifs();
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // recargar cuando cambian filtros/paginación
    void loadNotifs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nqPage, nqLimit, nqType, nqChannel, nqStatus, nqUnread]);

  /* ========================= 🔔 NUEVO: PREFERENCIAS (USER) ========================= */
  const [pref, setPref] = useState<PreferencesResponse | null>(null);
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefErr, setPrefErr] = useState<string | null>(null);
  const [prefMsg, setPrefMsg] = useState<string | null>(null);

  async function loadPreferences() {
    setPrefErr(null);
    setPrefLoading(true);
    try {
      const r = await getNotificationPreferences();
      setPref(r);
    } catch (e: any) {
      const m = String(e?.message || "No se pudieron cargar las preferencias");
      if (/no autenticado|token|401|403/i.test(m)) {
        window.location.href = "/auth?redirectTo=/perfil";
        return;
      }
      setPrefErr(m);
    } finally {
      setPrefLoading(false);
    }
  }

  useEffect(() => {
    void loadPreferences();
  }, []);

  function togglePref(t: NotifType, ch: NotifChannel) {
    if (!pref) return;
    const current = !!pref.preferences?.[t]?.[ch];
    const next = { ...pref };
    next.preferences = { ...(next.preferences || {}) };
    next.preferences[t] = { ...(next.preferences[t] || {}) };
    next.preferences[t]![ch] = !current;
    setPref(next);
  }

  async function savePreferences() {
    if (!pref) return;
    setPrefMsg(null);
    try {
      const payload: PreferencesPayload = {
        preferences: pref.preferences,
        globalSettings: pref.globalSettings,
      };
      const r = await updateNotificationPreferences(payload);
      setPrefMsg(r?.message || "Preferencias actualizadas ✅");
    } catch (e: any) {
      const m = String(e?.message || "No se pudieron actualizar las preferencias");
      if (/no autenticado|token|401|403/i.test(m)) {
        window.location.href = "/auth?redirectTo=/perfil";
        return;
      }
      setPrefMsg(m);
    }
  }

  /* ========================= 🔔 NUEVO: ADMIN NOTIFICATIONS ========================= */
  // Crear única
  const [admUserId, setAdmUserId] = useState("");
  const [admType, setAdmType] = useState<NotifType>("PROMOTION");
  const [admChannel, setAdmChannel] = useState<NotifChannel>("EMAIL");
  const [admTitle, setAdmTitle] = useState("");
  const [admContent, setAdmContent] = useState("");
  const [admTemplateId, setAdmTemplateId] = useState("");
  const [admTemplateData, setAdmTemplateData] = useState("{}");
  const [admScheduledFor, setAdmScheduledFor] = useState("");
  const [admMsg, setAdmMsg] = useState<string | null>(null);
  const [admBusy, setAdmBusy] = useState(false);

  // Bulk
  const [admBulkUserIds, setAdmBulkUserIds] = useState("");
  const [admBulkMsg, setAdmBulkMsg] = useState<string | null>(null);
  const [admBulkBusy, setAdmBulkBusy] = useState(false);

  // Segment
  const [admSegCriteria, setAdmSegCriteria] = useState('{"totalOrders":{"$gte":3},"lastOrderDate":{"$gte":"2025-01-01"}}');
  const [admSegMsg, setAdmSegMsg] = useState<string | null>(null);
  const [admSegBusy, setAdmSegBusy] = useState(false);

  // Admin stats
  const [admStats, setAdmStats] = useState<Awaited<ReturnType<typeof adminGetNotificationsStats>> | null>(null);
  const [admStatsBusy, setAdmStatsBusy] = useState(false);
  const [admStatsErr, setAdmStatsErr] = useState<string | null>(null);

  async function runAdminStats() {
    setAdmStatsErr(null);
    setAdmStatsBusy(true);
    try {
      const r = await adminGetNotificationsStats({});
      setAdmStats(r);
    } catch (e: any) {
      setAdmStatsErr(String(e?.message || "No se pudieron cargar las estadísticas admin"));
    } finally {
      setAdmStatsBusy(false);
    }
  }

  /* ================================== RENDER ================================== */

  return (
    <main className={s.page}>
      <div className={s.container}>
        {/* Header */}
        <header className={s.headerRow}>
          <h1 className={s.h1}>Mi perfil</h1>
          <Link href="/" className={s.backLink}>Volver al inicio</Link>
        </header>

        {/* Panel 1: perfil + acciones */}
        <section className={s.card}>
          <div className={s.btnRow}>
            <button
              type="button"
              onClick={loadProfile}
              className={`${s.btn} ${loading ? s.btnDisabled : s.btnGhost}`}
              title="Actualizar perfil"
            >
              {loading ? "Cargando…" : "Actualizar"}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className={`${s.btn} ${s.btnDanger}`}
              title="Cerrar sesión"
            >
              Cerrar sesión
            </button>
          </div>

          {err && <p className={s.msgErr}>{err}</p>}
          {!err && loading && <p> Cargando perfil…</p>}

          {!err && !loading && profile && (
            <div className={s.profileGrid}>
              {/* Izquierda: datos */}
              <div className={s.kv}>
                <div className={s.kvRow}>
                  <div className={s.kvKey}>ID</div><div className={s.kvVal}>{profile._id}</div>
                </div>
                <div className={s.kvRow}>
                  <div className={s.kvKey}>Email</div><div className={s.kvVal}>{profile.email}</div>
                </div>
                {fullName(profile) && (
                  <div className={s.kvRow}>
                    <div className={s.kvKey}>Nombre</div><div className={s.kvVal}>{fullName(profile)}</div>
                  </div>
                )}
                {profile.role && (
                  <div className={s.kvRow}>
                    <div className={s.kvKey}>Rol</div>
                    <div className={s.kvVal}><span className={s.badge}>{profile.role}</span></div>
                  </div>
                )}

                <div className={s.cardHeader} style={{ marginTop: 8 }}>
                  <h3 className={s.cardTitle}>Dirección</h3>
                </div>
                {profile.address ? (
                  <div className={s.kv}>
                    {profile.address.street && (
                      <div className={s.kvRow}><div className={s.kvKey}>Calle</div><div className={s.kvVal}>{profile.address.street}</div></div>
                    )}
                    {profile.address.city && (
                      <div className={s.kvRow}><div className={s.kvKey}>Ciudad</div><div className={s.kvVal}>{profile.address.city}</div></div>
                    )}
                    {profile.address.zip && (
                      <div className={s.kvRow}><div className={s.kvKey}>CP</div><div className={s.kvVal}>{profile.address.zip}</div></div>
                    )}
                    {profile.address.country && (
                      <div className={s.kvRow}><div className={s.kvKey}>País</div><div className={s.kvVal}>{profile.address.country}</div></div>
                    )}
                  </div>
                ) : (
                  <p className={s.userMeta}>Sin dirección cargada.</p>
                )}
              </div>

              {/* Derecha: acciones rápidas (placeholder) */}
              <div></div>
            </div>
          )}
        </section>

        {/* Panel 2: editar perfil */}
        <section className={s.card}>
          <div className={s.cardHeader}>
            <h2 className={s.cardTitle}>Editar datos del perfil</h2>
          </div>

          <form onSubmit={handleSave} className={s.form}>
            <label className={s.label}>
              <span>Nombre</span>
              <input className={s.input} value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Juan Pérez" />
            </label>

            <div className={s.row2}>
              <label className={s.label}>
                <span>Calle</span>
                <input className={s.input} value={formStreet} onChange={(e) => setFormStreet(e.target.value)} placeholder="Calle 123" />
              </label>
              <label className={s.label}>
                <span>Ciudad</span>
                <input className={s.input} value={formCity} onChange={(e) => setFormCity(e.target.value)} placeholder="Ciudad" />
              </label>
            </div>

            <div className={s.row2}>
              <label className={s.label}>
                <span>Código postal</span>
                <input className={s.input} value={formZip} onChange={(e) => setFormZip(e.target.value)} placeholder="1111" />
              </label>
              <label className={s.label}>
                <span>País</span>
                <input className={s.input} value={formCountry} onChange={(e) => setFormCountry(e.target.value)} placeholder="Argentina" />
              </label>
            </div>

            <div className={s.actions}>
              <button
                type="submit"
                className={`${s.btn} ${s.btnPrimary}`}
                disabled={saving}
                title="Guardar cambios"
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.btnGhost}`}
                onClick={resetFormFromProfile}
                disabled={saving}
              >
                Restablecer
              </button>
              {saveMsg && <span className={saveMsg.includes("✅") ? s.msgOk : s.msgErr}>{saveMsg}</span>}
            </div>
          </form>
        </section>

        {/* ==================== 🔔 Panel 3: Notificaciones (usuario) ==================== */}
        <section className={s.card}>
          <div className={s.cardHeader}>
            <h2 className={s.cardTitle}>Mis notificaciones</h2>
            <div className={s.btnRow} style={{ marginLeft: "auto", gap: 8 }}>
              <button
                type="button"
                className={`${s.btn} ${notifsLoading ? s.btnDisabled : s.btnGhost}`}
                onClick={loadNotifs}
              >
                {notifsLoading ? "Cargando…" : "Actualizar"}
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.btnGhost}`}
               onClick={async () => {
  try {
    const r = await markAllNotificationsRead(); // 👈 ahora devuelve { success, markedCount }
    setNqUnread(false);
    setNqPage(1);
    await loadNotifs();
    await loadStats();
    if (typeof r?.markedCount === "number") {
      alert(`Se marcaron ${r.markedCount} notificaciones como leídas ✅`);
    }
  } catch (e: any) {
    alert(e?.message || "No se pudo marcar todo como leído");
  }
}}
                title="Marcar todas como leídas"
              >
                Marcar todo como leído
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className={s.row2} style={{ gap: 8, marginBottom: 8 }}>
            <label className={s.label}>
              <span>Tipo</span>
              <input className={s.input} placeholder="ORDER, PROMOTION…" value={nqType} onChange={e=>setNqType(e.target.value as NotifType)} />
            </label>
            <label className={s.label}>
              <span>Canal</span>
              <input className={s.input} placeholder="EMAIL, SMS, PUSH, IN_APP" value={nqChannel} onChange={e=>setNqChannel(e.target.value as NotifChannel)} />
            </label>
          </div>
          <div className={s.row2} style={{ gap: 8, marginBottom: 8 }}>
            <label className={s.label}>
              <span>Estado</span>
              <input className={s.input} placeholder="SENT, DELIVERED, READ, FAILED" value={nqStatus} onChange={e=>setNqStatus(e.target.value as NotifStatus)} />
            </label>
            <label className={s.label}>
              <span>Solo no leídas</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <input type="checkbox" checked={nqUnread} onChange={e=>{ setNqUnread(e.target.checked); setNqPage(1); }} />
                <span className={s.userMeta}>({notifsUnreadCount} sin leer)</span>
              </div>
            </label>
          </div>

          {notifsErr && <p className={s.msgErr}>{notifsErr}</p>}

          {!notifsErr && (
            <>
              {/* Stats mini */}
              <div className={s.userMeta} style={{ marginBottom: 8 }}>
                {statsLoading ? "Cargando estadísticas…" :
                  statsErr ? <span className={s.msgErr}>{statsErr}</span> :
                  stats ? (
                    <>
                      Total: <b>{stats.totalNotifications}</b> • No leídas: <b>{stats.unreadCount}</b> • Leídas: <b>{stats.readCount}</b>
                    </>
                  ) : null}
              </div>

              {/* Listado */}
              {notifsLoading && <p>Cargando notificaciones…</p>}
              {!notifsLoading && notifs.length === 0 && <p className={s.userMeta}>No hay notificaciones.</p>}
              {!notifsLoading && notifs.length > 0 && (
                <div className={s.usersList}>
                  {notifs.map(n => (
                    <article key={n._id} className={s.userItem}>
                      <div className={s.userTop}>
                        <strong>{n.title}</strong>
                        <span className={s.userMeta}>• <b>Tipo:</b> {n.type}</span>
                        <span className={s.userMeta}>• <b>Canal:</b> {n.channel}</span>
                        <span className={s.userMeta}>• <b>Estado:</b> <span className={s.badge}>{n.status}</span></span>
                        {n.isRead === false && <span className={s.badge} style={{ marginLeft: 6 }}>unread</span>}
                      </div>
                      {n.content && <div className={s.userMeta}>{n.content}</div>}
                      {n.metadata && n.metadata.orderNumber && (
                        <div className={s.userMeta}><b>Pedido:</b> {n.metadata.orderNumber}</div>
                      )}
                      <div className={s.userActions}>
                        <button
                          type="button"
                          className={`${s.btn} ${s.btnGhost}`}
                          onClick={async ()=>{
                            try {
                              await markNotificationRead(n._id);
                              await loadNotifs();
                              await loadStats();
                            } catch (e:any) {
                              alert(e?.message || "No se pudo marcar como leída");
                            }
                          }}
                          disabled={n.isRead}
                        >
                          {n.isRead ? "Leída" : "Marcar como leída"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {/* Paginación */}
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <label className={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>Items</span>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={nqLimit}
                    onChange={e=>{ setNqLimit(Math.max(5, Math.min(100, parseInt(e.target.value || "20",10)))); setNqPage(1); }}
                    className={s.input}
                    style={{ width: 90 }}
                  />
                </label>
                <div className={s.btnRow}>
                  {Array.from({ length: notifsPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`${s.btn} ${nqPage === i+1 ? s.btnPrimary : s.btnGhost}`}
                      onClick={()=>setNqPage(i+1)}
                    >
                      {i+1}
                    </button>
                  ))}
                </div>
                <span className={s.userMeta}>Total: {notifsTotal}</span>
              </div>
            </>
          )}
        </section>

        {/* ==================== 🔔 Panel 4: Preferencias (usuario) ==================== */}
        <section className={s.card}>
          <div className={s.cardHeader}>
            <h2 className={s.cardTitle}>Preferencias de notificación</h2>
            <div className={s.btnRow} style={{ marginLeft: "auto" }}>
              <button type="button" className={`${s.btn} ${prefLoading ? s.btnDisabled : s.btnGhost}`} onClick={loadPreferences}>
                {prefLoading ? "Cargando…" : "Actualizar"}
              </button>
            </div>
          </div>

          {prefErr && <p className={s.msgErr}>{prefErr}</p>}
          {!prefErr && !pref && <p className={s.userMeta}>Cargando…</p>}
          {pref && (
            <>
              {pref.globalSettings && (
                <div className={s.kv} style={{ marginBottom: 8 }}>
                  <div className={s.kvRow}><div className={s.kvKey}>Marketing</div><div className={s.kvVal}>{String(pref.globalSettings.allowMarketing)}</div></div>
                  <div className={s.kvRow}><div className={s.kvKey}>Promociones</div><div className={s.kvVal}>{String(pref.globalSettings.allowPromotional)}</div></div>
                  <div className={s.kvRow}><div className={s.kvKey}>Ordenes</div><div className={s.kvVal}>{String(pref.globalSettings.allowOrderUpdates)}</div></div>
                  <div className={s.kvRow}><div className={s.kvKey}>Envíos</div><div className={s.kvVal}>{String(pref.globalSettings.allowShippingUpdates)}</div></div>
                </div>
              )}

              {/* Matriz simple editable por toggle */}
              <div className={s.usersList}>
                {Object.keys(pref.preferences || {}).map((t) => {
                  const row = pref.preferences[t as NotifType] || {};
                  const channels: NotifChannel[] = ["EMAIL","SMS","PUSH","IN_APP"];
                  return (
                    <article key={t} className={s.userItem}>
                      <div className={s.userTop}>
                        <strong>{t}</strong>
                      </div>
                      <div className={s.userActions} style={{ flexWrap: "wrap", gap: 12 }}>
                        {channels.map(ch => (
                          <label key={ch} className={s.userMeta} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={!!row[ch]}
                              onChange={() => togglePref(t as NotifType, ch)}
                            />
                            <span>{ch}</span>
                          </label>
                        ))}
                      </div>
                    </article>
                  );
                })}
                {Object.keys(pref.preferences || {}).length === 0 && (
                  <p className={s.userMeta}>No hay preferencias definidas.</p>
                )}
              </div>

              <div className={s.actions} style={{ marginTop: 12 }}>
                <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={savePreferences}>
                  Guardar preferencias
                </button>
                {prefMsg && (
                  <span className={prefMsg.includes("✅") ? s.msgOk : s.msgErr} style={{ marginLeft: 8 }}>
                    {prefMsg}
                  </span>
                )}
              </div>
            </>
          )}
        </section>

        {/* ==================== 🔔 Panel 5: Admin (notificaciones) ==================== */}
        {isAdmin && (
          <section className={s.card}>
            <div className={s.cardHeader}>
              <h2 className={s.cardTitle}>Notificaciones (admin)</h2>
            </div>

            {/* Crear 1 */}
            <div className={s.cardHeader}><h3 className={s.cardTitle}>Crear notificación</h3></div>
            <div className={s.form}>
              <div className={s.row2}>
                <label className={s.label}><span>User ID</span><input className={s.input} value={admUserId} onChange={e=>setAdmUserId(e.target.value)} placeholder="user_001" /></label>
                <label className={s.label}><span>Tipo</span><input className={s.input} value={admType} onChange={e=>setAdmType(e.target.value as NotifType)} placeholder="PROMOTION" /></label>
              </div>
              <div className={s.row2}>
                <label className={s.label}><span>Canal</span><input className={s.input} value={admChannel} onChange={e=>setAdmChannel(e.target.value as NotifChannel)} placeholder="EMAIL" /></label>
                <label className={s.label}><span>Título</span><input className={s.input} value={admTitle} onChange={e=>setAdmTitle(e.target.value)} placeholder="Special Offer" /></label>
              </div>
              <label className={s.label}><span>Contenido</span><textarea className={s.textarea ?? s.input} rows={3} value={admContent} onChange={e=>setAdmContent(e.target.value)} placeholder="Get 20% off..." /></label>
              <div className={s.row2}>
                <label className={s.label}><span>Template ID</span><input className={s.input} value={admTemplateId} onChange={e=>setAdmTemplateId(e.target.value)} placeholder="promotion_template" /></label>
                <label className={s.label}><span>Template Data (JSON)</span><input className={s.input} value={admTemplateData} onChange={e=>setAdmTemplateData(e.target.value)} placeholder='{"discount":"20%"}' /></label>
              </div>
              <label className={s.label}><span>Programar (ISO)</span><input className={s.input} value={admScheduledFor} onChange={e=>setAdmScheduledFor(e.target.value)} placeholder="2025-01-21T18:00:00.000Z" /></label>
              <div className={s.actions}>
                <button
                  type="button"
                  className={`${s.btn} ${admBusy ? s.btnDisabled : s.btnGhost}`}
                  disabled={admBusy}
                  onClick={async ()=>{
                    setAdmMsg(null);
                    setAdmBusy(true);
                    try {
                      const data = JSON.parse(admTemplateData || "{}");
                      await adminCreateNotification({
                        userId: admUserId.trim(),
                        type: admType,
                        channel: admChannel,
                        title: admTitle.trim(),
                        content: admContent.trim() || undefined,
                        templateId: admTemplateId.trim() || undefined,
                        templateData: data,
                        scheduledFor: admScheduledFor.trim() || undefined,
                      });
                      setAdmMsg("Notificación creada ✅");
                    } catch (e:any) {
                      setAdmMsg(e?.message || "Error al crear notificación");
                    } finally {
                      setAdmBusy(false);
                    }
                  }}
                >
                  {admBusy ? "Enviando…" : "Crear"}
                </button>
                {admMsg && <span className={admMsg.includes("✅") ? s.msgOk : s.msgErr}>{admMsg}</span>}
              </div>
            </div>

            {/* Bulk */}
            <div className={s.cardHeader}><h3 className={s.cardTitle}>Bulk</h3></div>
            <div className={s.form}>
              <label className={s.label}><span>User IDs (CSV)</span><input className={s.input} value={admBulkUserIds} onChange={e=>setAdmBulkUserIds(e.target.value)} placeholder="user_001,user_002" /></label>
              <div className={s.row2}>
                <label className={s.label}><span>Tipo</span><input className={s.input} value={admType} onChange={e=>setAdmType(e.target.value as NotifType)} /></label>
                <label className={s.label}><span>Canal</span><input className={s.input} value={admChannel} onChange={e=>setAdmChannel(e.target.value as NotifChannel)} /></label>
              </div>
              <label className={s.label}><span>Título</span><input className={s.input} value={admTitle} onChange={e=>setAdmTitle(e.target.value)} /></label>
              <label className={s.label}><span>Contenido</span><textarea className={s.textarea ?? s.input} rows={3} value={admContent} onChange={e=>setAdmContent(e.target.value)} /></label>
              <div className={s.actions}>
                <button
                  type="button"
                  className={`${s.btn} ${admBulkBusy ? s.btnDisabled : s.btnGhost}`}
                  disabled={admBulkBusy}
                  onClick={async ()=>{
                    setAdmBulkMsg(null);
                    setAdmBulkBusy(true);
                    try {
                      const ids = admBulkUserIds.split(/[,\s]+/).map(x=>x.trim()).filter(Boolean);
                      await adminBulkNotifications({
                        userIds: ids,
                        type: admType,
                        channel: admChannel,
                        title: admTitle.trim(),
                        content: admContent.trim() || undefined,
                      });
                      setAdmBulkMsg("Bulk enviado ✅");
                    } catch (e:any) {
                      setAdmBulkMsg(e?.message || "Error en bulk");
                    } finally {
                      setAdmBulkBusy(false);
                    }
                  }}
                >
                  {admBulkBusy ? "Enviando…" : "Enviar bulk"}
                </button>
                {admBulkMsg && <span className={admBulkMsg.includes("✅") ? s.msgOk : s.msgErr}>{admBulkMsg}</span>}
              </div>
            </div>

            {/* Segment */}
            <div className={s.cardHeader}><h3 className={s.cardTitle}>Segmento</h3></div>
            <div className={s.form}>
              <label className={s.label}><span>Criteria (JSON)</span><textarea className={s.textarea ?? s.input} rows={3} value={admSegCriteria} onChange={e=>setAdmSegCriteria(e.target.value)} /></label>
              <div className={s.row2}>
                <label className={s.label}><span>Tipo</span><input className={s.input} value={admType} onChange={e=>setAdmType(e.target.value as NotifType)} /></label>
                <label className={s.label}><span>Canal</span><input className={s.input} value={admChannel} onChange={e=>setAdmChannel(e.target.value as NotifChannel)} /></label>
              </div>
              <label className={s.label}><span>Título</span><input className={s.input} value={admTitle} onChange={e=>setAdmTitle(e.target.value)} /></label>
              <label className={s.label}><span>Contenido</span><textarea className={s.textarea ?? s.input} rows={3} value={admContent} onChange={e=>setAdmContent(e.target.value)} /></label>
              <div className={s.actions}>
                <button
                  type="button"
                  className={`${s.btn} ${admSegBusy ? s.btnDisabled : s.btnGhost}`}
                  disabled={admSegBusy}
                  onClick={async ()=>{
  setAdmSegMsg(null);
  setAdmSegBusy(true);
  try {
    const criteria = JSON.parse(admSegCriteria || "{}");
    const r = await adminSegmentNotifications({
      segment: { type: "USER_ATTRIBUTES", criteria },
      type: admType,
      channel: admChannel,
      title: admTitle.trim(),
      content: admContent.trim() || undefined,
    });
    // 👇 Ahora r tiene { success, count, notificationIds }
    setAdmSegMsg(`Segmento enviado ✅ (${r.count} usuarios)`); 
  } catch (e:any) {
    setAdmSegMsg(e?.message || "Error en segmento");
  } finally {
    setAdmSegBusy(false);
  }
}}
                >
                  {admSegBusy ? "Enviando…" : "Enviar por segmento"}
                </button>
                {admSegMsg && <span className={admSegMsg.includes("✅") ? s.msgOk : s.msgErr}>{admSegMsg}</span>}
              </div>
            </div>

            {/* Admin Stats + Tests */}
            <div className={s.cardHeader}><h3 className={s.cardTitle}>Estadísticas (admin)</h3></div>
            <div className={s.btnRow} style={{ marginBottom: 8 }}>
              <button type="button" className={`${s.btn} ${admStatsBusy ? s.btnDisabled : s.btnGhost}`} onClick={runAdminStats}>
                {admStatsBusy ? "Cargando…" : "Actualizar estadísticas"}
              </button>
            </div>
            {admStatsErr && <p className={s.msgErr}>{admStatsErr}</p>}
            {admStats && (
              <div className={s.kv}>
                <div className={s.kvRow}><div className={s.kvKey}>Total</div><div className={s.kvVal}>{admStats.totalNotifications}</div></div>
                <div className={s.kvRow}><div className={s.kvKey}>Delivery</div><div className={s.kvVal}>
                  sent={admStats.deliveryStats.sent} • delivered={admStats.deliveryStats.delivered} • failed={admStats.deliveryStats.failed} • rate={admStats.deliveryStats.deliveryRate}%
                </div></div>
                {admStats.performance && (
                  <div className={s.kvRow}><div className={s.kvKey}>Performance</div><div className={s.kvVal}>
                    avg={admStats.performance.averageDeliveryTime} • peak={admStats.performance.peakHours?.join(", ")} • best={admStats.performance.bestPerformingType}
                  </div></div>
                )}
              </div>
            )}

            <div className={s.cardHeader}><h3 className={s.cardTitle}>Testing</h3></div>
            <div className={s.btnRow} style={{ gap: 8 }}>
              <button
                type="button"
                className={`${s.btn} ${s.btnGhost}`}
                onClick={async ()=>{
                  try {
                    await adminTestSend({
                      userId: admUserId.trim() || "user_001",
                      type: "WELCOME",
                      channel: "EMAIL",
                      title: "Test Notification",
                      content: "This is a test notification",
                    });
                    alert("Test send OK ✅");
                  } catch (e:any) {
                    alert(e?.message || "Error test send");
                  }
                }}
              >
                Test /send
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.btnGhost}`}
                onClick={async ()=>{
                  try {
                    const data = JSON.parse(admTemplateData || '{"userName":"John Doe"}');
                    await adminTestTemplate({
                      userId: admUserId.trim() || "user_001",
                      templateId: admTemplateId.trim() || "welcome_template",
                      channel: "EMAIL",
                      templateData: data,
                    });
                    alert("Test template OK ✅");
                  } catch (e:any) {
                    alert(e?.message || "Error test template");
                  }
                }}
              >
                Test /template
              </button>
            </div>
          </section>
        )}

        {/* Panel (ya existente) 6: Admin usuarios */}
        {isAdmin && (
          <section className={s.card}>
            <div className={s.cardHeader}>
              <h2 className={s.cardTitle}>Usuarios (admin)</h2>
              <div className={s.btnRow} style={{ marginLeft: "auto" }}>
                <button
                  type="button"
                  onClick={loadAllUsers}
                  className={`${s.btn} ${usersLoading ? s.btnDisabled : s.btnGhost}`}
                >
                  {usersLoading ? "Cargando…" : "Actualizar lista"}
                </button>
              </div>
            </div>

            {usersErr && <p className={s.msgErr}>{usersErr}</p>}
            {roleMsg && <p className={roleMsg.includes("✅") ? s.msgOk : s.msgErr}>{roleMsg}</p>}
            {deleteMsg && <p className={deleteMsg.includes("🗑️") ? s.msgOk : s.msgErr}>{deleteMsg}</p>}

            {!usersErr && users.length > 0 && (
              <div className={s.usersList}>
                {users.map((u) => (
                  <article key={u._id} className={s.userItem}>
                    <div className={s.userTop}>
                      <strong>{u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || "(Sin nombre)"}</strong>
                      <span className={s.userMeta}>• <b>Email:</b> {u.email}</span>
                      <span className={s.userMeta}>• <b>Rol actual:</b> <span className={s.badge}>{u.role || "user"}</span></span>
                    </div>

                    {u.address && (
                      <div className={s.userMeta}>
                        <b>Dir:</b>{" "}
                        {[u.address.street, u.address.city && `(${u.address.city})`, u.address.zip, u.address.country]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    )}

                    <div className={s.userMeta}><b>ID:</b> {u._id}</div>

                    <div className={s.userActions}>
                      <label className={s.userMeta}>Nuevo rol:</label>
                      <select
                        value={roleDraft[u._id] ?? (u.role as any) ?? "user"}
                        onChange={(e) => setRoleDraft((s2) => ({ ...s2, [u._id]: e.target.value as any }))}
                        disabled={roleSavingId === u._id}
                        className={s.select}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>

                      <button
                        type="button"
                        className={`${s.btn} ${roleSavingId === u._id ? s.btnDisabled : s.btnGhost}`}
                        onClick={() => handleUpdateUserRole(u._id)}
                        disabled={roleSavingId === u._id}
                      >
                        {roleSavingId === u._id ? "Guardando…" : "Actualizar rol"}
                      </button>

                      <button
                        type="button"
                        className={`${s.btn} ${s.btnDanger}`}
                        onClick={() => handleDeleteUser(u._id)}
                        disabled={deletingUserId === u._id || profile?._id === u._id}
                        title={profile?._id === u._id ? "No podés eliminar tu propia cuenta" : "Eliminar usuario"}
                      >
                        {deletingUserId === u._id ? "Eliminando…" : "Eliminar usuario"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {!usersErr && !usersLoading && users.length === 0 && (
              <p className={s.userMeta}>Aún no cargaste la lista.</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
