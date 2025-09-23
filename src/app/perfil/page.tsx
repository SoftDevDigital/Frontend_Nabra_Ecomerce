// src/app/perfil/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import s from "./Perfil.module.css";

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

        {/* Panel 3: Admin */}
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
