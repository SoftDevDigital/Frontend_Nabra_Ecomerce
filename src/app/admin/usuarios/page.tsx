"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

/* ===== Tipos según /admin/users ===== */
type User = {
  _id: string;
  email: string;
  role: "user" | "admin" | string;
  name?: string;
  firstName?: string;
  lastName?: string;
  addresses?: any[];
  address?: { street?: string; city?: string; zip?: string; country?: string };
  preferredLanguage?: string;
  preferredShippingMethod?: string;
  allowWeekendDelivery?: boolean;
  allowEveningDelivery?: boolean;
  requiresInvoice?: boolean;
  emailNotifications?: boolean;
  orderNotifications?: boolean;
  shippingNotifications?: boolean;
  promotionNotifications?: boolean;
  smsNotifications?: boolean;
  allowDataProcessing?: boolean;
  allowMarketingEmails?: boolean;
  allowDataSharing?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
};

type UsersResponse =
  | {
      success: true;
      data: { users: User[]; total: number; limit: number; offset: number };
      message?: string;
    }
  | { success: false; message: string };

/* ===== Helpers: auth gating por token ===== */
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
  const role = p?.role || p?.roles || p?.userRole || p?.["https://example.com/roles"];
  if (Array.isArray(role)) return role.map(String).some((r) => r.toLowerCase() === "admin");
  if (typeof role === "string") return role.toLowerCase() === "admin";
  return false;
}

/* ===== Utils UI ===== */
function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}
function fullName(u: User) {
  if (u.name?.trim()) return u.name.trim();
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || "—";
}

export default function AdminUsersPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState(""); // búsqueda local (cliente)

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

  async function loadUsers(nextOffset = offset, nextLimit = limit) {
    if (!isAdmin) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch<UsersResponse>(
        `/admin/users?limit=${nextLimit}&offset=${nextOffset}`,
        { method: "GET" }
      );
      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudieron obtener los usuarios");
      }
      setUsers(r.data.users || []);
      setTotal(r.data.total ?? 0);
      setLimit(r.data.limit ?? nextLimit);
      setOffset(r.data.offset ?? nextOffset);
    } catch (e: any) {
      const m = e?.message || "No se pudieron obtener los usuarios";
      setErr(m);
      if (/(401|403|no autenticado|credenciales|unauthorized|forbidden)/i.test(m)) {
        window.location.href = "/auth?redirectTo=/admin/usuarios";
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadUsers(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const page = useMemo(() => Math.floor(offset / Math.max(1, limit)) + 1, [offset, limit]);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / Math.max(1, limit))), [total, limit]);

  /* Búsqueda local sobre el page actual que envió el backend */
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => {
      const haystack = [
        u.email,
        fullName(u),
        u.role,
        u.preferredLanguage,
        u.address?.city,
        u.address?.country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(s);
    });
  }, [q, users]);

  function goPrev() {
    const next = Math.max(0, offset - limit);
    if (next !== offset) loadUsers(next, limit);
  }
  function goNext() {
    const next = offset + limit;
    if (next < total) loadUsers(next, limit);
  }
  function changeLimit(newLimit: number) {
    const l = Number.isFinite(newLimit) && newLimit > 0 ? newLimit : 20;
    loadUsers(0, l);
  }

  function exportCsv(list: User[]) {
    const rows = [
      [
        "id",
        "email",
        "name",
        "role",
        "language",
        "city",
        "country",
        "createdAt",
        "updatedAt",
        "marketingEmails",
      ],
      ...list.map((u) => [
        u._id,
        u.email,
        fullName(u),
        u.role,
        u.preferredLanguage ?? "",
        u.address?.city ?? "",
        u.address?.country ?? "",
        u.createdAt ?? "",
        u.updatedAt ?? "",
        String(u.allowMarketingEmails ?? ""),
      ]),
    ];
    const csv = rows.map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ maxWidth: 1200, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Usuarios (admin)</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Link href="/admin/dashboard" style={{ opacity: 0.8 }}>Dashboard</Link>
          <Link href="/admin/products" style={{ opacity: 0.8 }}>Productos</Link>
          <Link href="/admin/pedidos" style={{ opacity: 0.8 }}>Pedidos</Link>
          <Link href="/admin/media" style={{ opacity: 0.8 }}>Medios</Link>
        </div>
      </header>

      {!isAdmin && (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff" }}>
          <p style={{ margin: 0 }}>Necesitás permisos de administrador.</p>
        </div>
      )}

      {isAdmin && (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => loadUsers(offset, limit)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Actualizar
            </button>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 13, opacity: 0.8 }}>Buscar:</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="email, nombre, rol, idioma…"
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", minWidth: 260 }}
              />
            </div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label style={{ fontSize: 13, opacity: 0.8 }}>Por página:</label>
              <select
                value={limit}
                onChange={(e) => changeLimit(Number(e.target.value))}
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>

              <div style={{ opacity: 0.8 }}>
                Página <strong>{page}</strong> de <strong>{pageCount}</strong> • Total: <strong>{total}</strong>
              </div>

              <button
                type="button"
                onClick={goPrev}
                disabled={offset <= 0}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: offset <= 0 ? "#f3f3f3" : "white",
                  cursor: offset <= 0 ? "default" : "pointer",
                  fontWeight: 600,
                }}
                title="Anterior"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={offset + limit >= total}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: offset + limit >= total ? "#f3f3f3" : "white",
                  cursor: offset + limit >= total ? "default" : "pointer",
                  fontWeight: 600,
                }}
                title="Siguiente"
              >
                ▶
              </button>

              <button
                type="button"
                onClick={() => exportCsv(filtered)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                  fontWeight: 700,
                }}
                title="Exportar CSV"
              >
                Exportar CSV
              </button>
            </div>
          </div>

          {loading && <p>Cargando…</p>}
          {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}

          {!loading && !err && filtered.length === 0 && (
            <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
              <p style={{ margin: 0 }}>No hay usuarios para mostrar.</p>
            </div>
          )}

          {!loading && !err && filtered.length > 0 && (
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 12,
              }}
            >
              {filtered.map((u) => {
                const addr =
                  u.address
                    ? [u.address.street, u.address.city, u.address.zip, u.address.country]
                        .filter(Boolean)
                        .join(", ")
                    : "—";
                return (
                  <article
                    key={u._id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 12,
                      background: "#fff",
                      padding: 12,
                      display: "grid",
                      gap: 8,
                    }}
                    
                  >
                    
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{fullName(u)}</div>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          background: u.role === "admin" ? "#e8f7ee" : "#f8f8f8",
                          border: `1px solid ${u.role === "admin" ? "#b8e2c4" : "#e0e0e0"}`,
                        }}
                        title={`Rol: ${u.role}`}
                      >
                        {u.role}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, color: "#555", wordBreak: "break-all" }}>
                      <strong>Email:</strong> {u.email}
                    </div>
                    <div style={{ fontSize: 13, color: "#555" }}>
                      <strong>Dirección:</strong> {addr}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      Idioma: <strong>{u.preferredLanguage ?? "—"}</strong>
                      &nbsp;•&nbsp; Envío: <strong>{u.preferredShippingMethod ?? "—"}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      Creado: {fmtDate(u.createdAt)}{u.updatedAt ? ` • Editado: ${fmtDate(u.updatedAt)}` : ""}
                    </div>

                    <details style={{ marginTop: 4 }}>
                      <summary style={{ cursor: "pointer" }}>Preferencias & permisos</summary>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 6, display: "grid", gap: 2 }}>
                        <div>Email notif: <strong>{String(u.emailNotifications)}</strong></div>
                        <div>Pedidos notif: <strong>{String(u.orderNotifications)}</strong></div>
                        <div>Envíos notif: <strong>{String(u.shippingNotifications)}</strong></div>
                        <div>Promos notif: <strong>{String(u.promotionNotifications)}</strong></div>
                        <div>SMS notif: <strong>{String(u.smsNotifications)}</strong></div>
                        <div>Marketing emails: <strong>{String(u.allowMarketingEmails)}</strong></div>
                        <div>Tratamiento datos: <strong>{String(u.allowDataProcessing)}</strong></div>
                        <div>Compartir datos: <strong>{String(u.allowDataSharing)}</strong></div>
                        <div>Factura requerida: <strong>{String(u.requiresInvoice)}</strong></div>
                        <div>Finde: <strong>{String(u.allowWeekendDelivery)}</strong> • Noche: <strong>{String(u.allowEveningDelivery)}</strong></div>
                      </div>
                    </details>
                     <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
    <Link
      href={`/admin/usuarios/${u._id}/pedidos`}
      style={{ textDecoration: "underline" }}
    >
      Ver pedidos
    </Link>
  </div>

                    {/* Aquí podrías agregar acciones (promover a admin, etc.)
                       Las dejo comentadas porque no conocemos los endpoints PUT exactos.
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                      <button ...>Hacer admin</button>
                      <button ...>Quitar admin</button>
                    </div>
                    */}
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </main>
  );
}
