// src/app/perfil/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

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

/* ========= AGREGADO: helpers para detectar admin por el token ========= */
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

  /* ⬇️⬇️⬇️ AGREGADO: estado para editar y guardar perfil */
  const [formName, setFormName] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formZip, setFormZip] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  /* ⬆️⬆️⬆️ FIN agregado */

  /* ========= AGREGADO: admin + listado de usuarios (GET /users) ========= */
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersErr, setUsersErr] = useState<string | null>(null);
  

  // === NUEVO: edición de rol de usuario ===
  const ROLE_OPTIONS = ["user", "admin"] as const;
  type Role = typeof ROLE_OPTIONS[number];

  const [roleDraft, setRoleDraft] = useState<Record<string, Role>>({});
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);

  /* ⬇️⬇️⬇️ NUEVO: eliminación de usuario (DELETE /users/:id) */
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  /* ⬆️⬆️⬆️ FIN eliminación */

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
      // precargar selects con rol actual
      const draft: Record<string, Role> = {};
      list.forEach(u => draft[u._id] = ((u.role || "user") as Role));
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
  /* ========================================================================= */

  async function loadProfile() {
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch<ProfileResponse>("/users/profile", { method: "GET" });
      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudo obtener el perfil");
      }
      setProfile(r.data);

      /* ⬇️ AGREGADO: rellenar formulario con los datos actuales */
      const p = r.data;
      setFormName(p.name || [p.firstName, p.lastName].filter(Boolean).join(" "));
      setFormStreet(p.address?.street || "");
      setFormCity(p.address?.city || "");
      setFormZip(p.address?.zip || "");
      setFormCountry(p.address?.country || "");
      /* ⬆️ FIN agregado */
    } catch (e: any) {
      const msg = String(e?.message || "No se pudo obtener el perfil");
      if (msg.toLowerCase().includes("no autenticado") || msg.toLowerCase().includes("token")) {
        window.location.href = "/auth?redirectTo=/perfil";
        return;
      }
      setErr(
        msg.includes("404") || /no encontrado/i.test(msg)
          ? "Usuario no encontrado"
          : msg
      );
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
    window.location.href = "/"; // limpia y vuelve al inicio
  }

  /* ⬇️⬇️⬇️ AGREGADO: handler para PUT /users/profile */
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
      setSaveMsg(
        msg.includes("404") || /no encontrado/i.test(msg)
          ? "Usuario no encontrado"
          : msg
      );
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
  /* ⬆️⬆️⬆️ FIN agregado */

  /* ================== NUEVO: PUT /users/:id/role (solo admin) ================== */
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

      // sincronizar lista con el valor confirmado por backend
      setUsers(prev => prev.map(u => (u._id === userId ? { ...u, role: r.data.role } : u)));
      setRoleDraft(s => ({ ...s, [userId]: (r.data.role as Role) }));
      setRoleMsg(`Rol actualizado ✅ (${r.data.email}: ${r.data.role})`);
    } catch (e: any) {
      const m = String(e?.message || "No se pudo actualizar el rol");
      // 403 admin requerido / 404 usuario no encontrado / 401 sin token
      if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("token")) {
        window.location.href = "/auth?redirectTo=/perfil";
        return;
      }
      setRoleMsg(m);
    } finally {
      setRoleSavingId(null);
    }
  }
  /* ============================================================================ */

  /* ============== NUEVO: DELETE /users/:id (solo admin) ============== */
  async function handleDeleteUser(userId: string) {
    if (!userId) return;

    // Evitar que el admin se borre a sí mismo
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

      // 200 vacío -> removemos de la lista
      setUsers(prev => prev.filter(u => u._id !== userId));
      // limpiamos borradores si existían
      setRoleDraft(prev => {
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
      // 403 admin requerido / 404 usuario no encontrado
      setDeleteMsg(m);
    } finally {
      setDeletingUserId(null);
    }
  }
  /* ==================================================================== */

  return (
    <main style={{ maxWidth: 880, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Mi perfil</h1>
        <span style={{ marginLeft: "auto", opacity: 0.75, fontSize: 14 }}>
          <Link href="/">Volver al inicio</Link>
        </span>
      </header>

      <section
        style={{
          display: "grid",
          gap: 12,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={loadProfile}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: loading ? "#f3f3f3" : "white",
              cursor: loading ? "default" : "pointer",
              fontWeight: 600,
            }}
            title="Actualizar perfil (GET /users/profile)"
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #f1c0c0",
              background: "white",
              color: "#b00020",
              fontWeight: 600,
            }}
            title="Cerrar sesión"
          >
            Cerrar sesión
          </button>
        </div>

        {err && <p style={{ margin: 0, color: "crimson" }}>{err}</p>}

        {!err && loading && <p style={{ margin: 0 }}>Cargando perfil…</p>}

        {!err && !loading && profile && (
          <div style={{ display: "grid", gap: 8 }}>
            <div><strong>ID:</strong> {profile._id}</div>
            <div><strong>Email:</strong> {profile.email}</div>
            {fullName(profile) && <div><strong>Nombre:</strong> {fullName(profile)}</div>}
            {profile.role && <div><strong>Rol:</strong> {profile.role}</div>}

            <div style={{ marginTop: 6 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Dirección</div>
              {profile.address ? (
                <div style={{ display: "grid", gap: 2, fontSize: 14 }}>
                  {profile.address.street && <div><strong>Calle:</strong> {profile.address.street}</div>}
                  {profile.address.city && <div><strong>Ciudad:</strong> {profile.address.city}</div>}
                  {profile.address.zip && <div><strong>CP:</strong> {profile.address.zip}</div>}
                  {profile.address.country && <div><strong>País:</strong> {profile.address.country}</div>}
                </div>
              ) : (
                <div style={{ opacity: 0.7, fontSize: 14 }}>Sin dirección cargada.</div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ⬇️⬇️⬇️ Form para PUT /users/profile */}
      <section
        style={{
          marginTop: 16,
          display: "grid",
          gap: 12,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 700 }}>Editar datos del perfil</div>

        <form onSubmit={handleSave} style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, opacity: 0.8 }}>Nombre</span>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Juan Pérez"
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
            />
          </label>

          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Calle</span>
              <input
                value={formStreet}
                onChange={(e) => setFormStreet(e.target.value)}
                placeholder="Calle 123"
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Ciudad</span>
              <input
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="Ciudad"
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
              />
            </label>
          </div>

          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Código postal</span>
              <input
                value={formZip}
                onChange={(e) => setFormZip(e.target.value)}
                placeholder="1111"
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>País</span>
              <input
                value={formCountry}
                onChange={(e) => setFormCountry(e.target.value)}
                placeholder="Argentina"
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: saving ? "#f3f3f3" : "white",
                cursor: saving ? "default" : "pointer",
                fontWeight: 700,
              }}
              title="Guardar cambios (PUT /users/profile)"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>

            <button
              type="button"
              onClick={resetFormFromProfile}
              disabled={saving}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                fontWeight: 700,
              }}
              title="Restaurar valores actuales"
            >
              Restablecer
            </button>

            {saveMsg && (
              <p style={{ margin: 0, color: saveMsg.includes("✅") ? "green" : "crimson" }}>{saveMsg}</p>
            )}
          </div>
        </form>
      </section>
      {/* ⬆️⬆️⬆️ FIN PUT /users/profile */}

      {/* ===================== AGREGADO: Bloque ADMIN GET /users + cambiar rol ===================== */}
      {isAdmin && (
        <section
          style={{
            marginTop: 16,
            display: "grid",
            gap: 12,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Usuarios (admin)</h2>
            <button
              type="button"
              onClick={loadAllUsers}
              disabled={usersLoading}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: usersLoading ? "#f3f3f3" : "white",
                cursor: usersLoading ? "default" : "pointer",
                fontWeight: 600,
                marginLeft: "auto",
              }}
              title="Obtener todos los usuarios (GET /users)"
            >
              {usersLoading ? "Cargando…" : "Actualizar lista"}
            </button>
          </div>

          {usersErr && <p style={{ margin: 0, color: "crimson" }}>{usersErr}</p>}
          {roleMsg && <p style={{ margin: 0, color: roleMsg.includes("✅") ? "green" : "crimson" }}>{roleMsg}</p>}
          {deleteMsg && (
            <p style={{ margin: 0, color: deleteMsg.includes("🗑️") ? "green" : "crimson" }}>{deleteMsg}</p>
          )}

          {!usersErr && users.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ opacity: 0.8, fontSize: 14 }}>
                Total: <strong>{users.length}</strong>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {users.map((u) => (
                  <article
                    key={u._id}
                    style={{
                      display: "grid",
                      gap: 6,
                      padding: 10,
                      border: "1px solid #eee",
                      borderRadius: 10,
                      background: "#fff",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <strong>{u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || "(Sin nombre)"}</strong>
                      <span style={{ fontSize: 14, opacity: 0.9 }}>
                        • <strong>Email:</strong> {u.email}
                      </span>
                      <span style={{ fontSize: 14, opacity: 0.9 }}>
                        • <strong>Rol actual:</strong> {u.role || "user"}
                      </span>
                    </div>

                    {u.address && (
                      <div style={{ fontSize: 13, opacity: 0.85 }}>
                        <strong>Dir:</strong>{" "}
                        {[
                          u.address.street,
                          u.address.city && `(${u.address.city})`,
                          u.address.zip,
                          u.address.country,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    )}

                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      <strong>ID:</strong> {u._id}
                    </div>

                    {/* --- NUEVO: cambiar rol --- */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <label style={{ fontSize: 13, opacity: 0.85 }}>Nuevo rol:</label>
                      <select
                        value={roleDraft[u._id] ?? (u.role as Role) ?? "user"}
                        onChange={(e) =>
                          setRoleDraft((s) => ({ ...s, [u._id]: e.target.value as Role }))
                        }
                        disabled={roleSavingId === u._id}
                        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
                        aria-label={`Seleccionar rol para ${u.email}`}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleUpdateUserRole(u._id)}
                        disabled={roleSavingId === u._id}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                          background: roleSavingId === u._id ? "#f3f3f3" : "white",
                          cursor: roleSavingId === u._id ? "default" : "pointer",
                          fontWeight: 600,
                        }}
                        title="Actualizar rol (PUT /users/:id/role)"
                      >
                        {roleSavingId === u._id ? "Guardando…" : "Actualizar rol"}
                      </button>
                    </div>

                    {/* --- NUEVO: eliminar usuario (solo admin) --- */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u._id)}
                        disabled={deletingUserId === u._id || profile?._id === u._id}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #f1c0c0",
                          background: deletingUserId === u._id ? "#f8eaea" : "white",
                          color: "#b00020",
                          cursor: deletingUserId === u._id ? "default" : "pointer",
                          fontWeight: 600,
                        }}
                        title={profile?._id === u._id ? "No podés eliminar tu propia cuenta" : "Eliminar usuario (DELETE /users/:id)"}
                      >
                        {deletingUserId === u._id ? "Eliminando…" : "Eliminar usuario"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {!usersErr && !usersLoading && users.length === 0 && (
            <p style={{ margin: 0, opacity: 0.8 }}>Aún no cargaste la lista.</p>
          )}
        </section>
      )}
      {/* ===================== FIN bloque ADMIN GET /users + cambiar rol ===================== */}
    </main>
  );
}
