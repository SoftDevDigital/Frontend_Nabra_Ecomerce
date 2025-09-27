// src/app/admin/media/page.tsx
"use client";

import { useState, useEffect } from "react"; // ⬅️ AGREGADO useEffect
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type MediaDoc = {
  _id: string;
  url: string;
  fileName: string;
  type: "product" | "cover";
  mimeType: string;
  active: boolean;
};

type UploadResponse = {
  success: boolean;
  data: MediaDoc;
  message?: string;
};

/* ⬇️⬇️⬇️ AGREGADO: helpers para API base y Authorization */
function getApiBase() {
  // por defecto apuntamos a tu backend en 3001 (coincide con tu cURL)
  return process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
}
function getAuthHeader() {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}
/* ⬆️⬆️⬆️ FIN helpers */

/* ⬇️⬇️⬇️ AGREGADO: helpers para detectar si el token es admin (UI gating) */
function getJwtPayload(): any | null {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    // decodeURIComponent(escape(...)) para manejar UTF-8 en algunos navegadores
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}
function isAdminFromToken(): boolean {
  const p = getJwtPayload();
  if (!p) return false;
  const role = p.role || p.roles || p.userRole || p["https://example.com/roles"];
  if (Array.isArray(role)) return role.map(String).some(r => r.toLowerCase() === "admin");
  if (typeof role === "string") return role.toLowerCase() === "admin";
  return false;
}
/* ⬆️⬆️⬆️ FIN helpers */

export default function MediaUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<"product" | "cover">("product");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<MediaDoc | null>(null);

  // 🔹 AGREGADO: estados para buscar GET /media/:id
  const [lookupId, setLookupId] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<MediaDoc | null>(null);

  // 🔹 AGREGADO: estados para DELETE /media/:id
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  // 🔹 AGREGADO: estados para POST /media/cover-image/:id
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activateMsg, setActivateMsg] = useState<string | null>(null);

  // 🔹 NUEVO: estados para POST /media/cover-image/:id/deactivate
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deactivateMsg, setDeactivateMsg] = useState<string | null>(null);

  /* ⬇️⬇️⬇️ AGREGADO: estado admin y efecto para setearlo desde el JWT */
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);
  /* ⬆️⬆️⬆️ FIN agregado */

  async function handleUpload(e: React.FormEvent) {
  e.preventDefault();
  setMsg(null);
  setResult(null);

  if (!file) {
    setMsg("Seleccioná una imagen (JPEG/PNG).");
    return;
  }
  if (!/^image\/(jpeg|png)$/.test(file.type)) {
    setMsg("Solo se permiten imágenes JPEG/PNG.");
    return;
  }

  setLoading(true);
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);

    const r = await apiFetch<UploadResponse>("/media/upload", {
      method: "POST",
      body: form,
    });

    setResult(r.data);
    setMsg(r.message || "Archivo subido ✅");

    // 👇 si es cover, la activamos
    if (r.data.type === "cover") {
      try {
        const act = await apiFetch<UploadResponse>(`/media/cover-image/${r.data._id}`, {
          method: "POST",
        });
        setResult(act.data); // versión activa con active:true
        setMsg("Portada cambiada ✅");
      } catch (err:any) {
        setMsg("Imagen subida pero no se pudo activar como portada");
      }
    }

    // (dejamos tus líneas existentes tal cual, no borro nada)
    setResult(r.data);
    setMsg(r.message || "Archivo subido ✅");
  } catch (err: any) {
    setMsg(err?.message || "No se pudo subir el archivo");
    if (String(err?.message || "").toLowerCase().includes("no autenticado")) {
      window.location.href = "/auth?redirectTo=/admin/media";
    }
  } finally {
    setLoading(false);
  }
}


  // 🔹 AGREGADO: handler para GET /media/:id (ahora con Authorization si hay token)
  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupMsg(null);
    setLookupResult(null);

    const base = getApiBase();
    const id = lookupId.trim();
    if (!id) {
      setLookupMsg("Ingresá un ID de media.");
      return;
    }

    setLookupLoading(true);
    try {
      const res = await fetch(`${base}/media/${id}`, {
        cache: "no-store",
        headers: {
          accept: "application/json",
          ...getAuthHeader(), // ⬅️ si hay token, lo manda
        },
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Archivo no encontrado");
      }
      setLookupResult(json.data as MediaDoc);
      setLookupMsg("OK ✅");
    } catch (err: any) {
      setLookupMsg(err?.message || "Archivo no encontrado");
    } finally {
      setLookupLoading(false);
    }
  }

  // 🔹 AGREGADO: handler para DELETE /media/:id (requiere token admin)
  async function handleDelete(id: string) {
    if (!id) return;
    setDeleteMsg(null);
    setDeletingId(id);
    try {
      // Respuesta Exitosa (200): Vacío
      await apiFetch<unknown>(`/media/${id}`, { method: "DELETE" });

      setDeleteMsg("Archivo eliminado 🗑️");
      // Si el que borraste coincide con los mostrados, los limpiamos
      setResult((prev) => (prev?._id === id ? null : prev));
      setLookupResult((prev) => (prev?._id === id ? null : prev));
      // si estás viendo ese id en el input de búsqueda, opcionalmente lo limpiás:
      if (lookupId === id) setLookupId("");
    } catch (err: any) {
      // 403: “Se requiere rol de administrador”
      // 404: “Archivo no encontrado”
      // 401: sin token
      setDeleteMsg(err?.message || "No se pudo eliminar el archivo");
      if (String(err?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/admin/media";
      }
    } finally {
      setDeletingId(null);
    }
  }

  // 🔹 AGREGADO: handler para POST /media/cover-image/:id (requiere token admin)
  async function handleActivateCover(id: string) {
    if (!id) return;
    setActivateMsg(null);
    setActivatingId(id);
    try {
      // Respuesta Exitosa (200): Objeto Media actualizado
      const r = await apiFetch<UploadResponse>(`/media/cover-image/${id}`, {
        method: "POST",
      });

      const updated = r.data;
      // Si coincide con los mostrados, actualizamos su estado (active/etc.)
      setResult((prev) => (prev?._id === id ? updated : prev));
      setLookupResult((prev) => (prev?._id === id ? updated : prev));

      setActivateMsg("Imagen activada como portada ✅");
    } catch (err: any) {
      // 403: “Se requiere rol de administrador”
      // 404: “Imagen de portada inválida”
      // 401: sin token
      setActivateMsg(err?.message || "No se pudo activar como portada");
      if (String(err?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/admin/media";
      }
    } finally {
      setActivatingId(null);
    }
  }

  // 🔹 NUEVO: handler para POST /media/cover-image/:id/deactivate (requiere token admin)
  async function handleDeactivateCover(id: string) {
    if (!id) return;
    setDeactivateMsg(null);
    setDeactivatingId(id);
    try {
      // Respuesta Exitosa (200): Objeto Media actualizado
      const r = await apiFetch<UploadResponse>(`/media/cover-image/${id}/deactivate`, {
        method: "POST",
      });

      const updated = r.data;
      // Actualizamos si es el item que estamos mostrando
      setResult((prev) => (prev?._id === id ? updated : prev));
      setLookupResult((prev) => (prev?._id === id ? updated : prev));

      setDeactivateMsg("Imagen de portada desactivada ✅");
    } catch (err: any) {
      // 403: “Se requiere rol de administrador”
      // 404: “Imagen de portada inválida”
      // 401: sin token
      setDeactivateMsg(err?.message || "No se pudo desactivar la portada");
      if (String(err?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/admin/media";
      }
    } finally {
      setDeactivatingId(null);
    }
  }

  const apiBase = getApiBase();
  const joinUrl = (u: string) => `${apiBase}/${u}`.replace(/([^:]\/)\/+/g, "$1");

  return (
    <main style={{ maxWidth: 720, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Subir medios</h1>
        <span style={{ marginLeft: "auto", opacity: 0.75, fontSize: 14 }}>
          <Link href="/">Volver al inicio</Link>
        </span>
      </header>

      {/* ⬇️⬇️⬇️ AGREGADO: gateo del formulario por admin */}
      {isAdmin ? (
        <form
          onSubmit={handleUpload}
          style={{
            display: "grid",
            gap: 12,
            padding: 16,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Imagen (JPEG/PNG)</span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Tipo</span>
            <select value={type} onChange={(e) => setType(e.target.value as any)}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}>
              <option value="product">product</option>
              <option value="cover">cover</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={loading || !file}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: loading ? "#f3f3f3" : "white",
              cursor: loading ? "default" : "pointer",
              fontWeight: 700,
              width: "fit-content",
            }}
          >
            {loading ? "Subiendo…" : "Subir"}
          </button>

          {msg && (
            <p style={{ margin: 0, color: msg.includes("✅") ? "green" : "crimson" }}>{msg}</p>
          )}
        </form>
      ) : (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff" }}>
          <p style={{ margin: 0 }}>Para subir, activar/desactivar o eliminar medios necesitás permisos de administrador.</p>
        </div>
      )}
      {/* ⬆️⬆️⬆️ FIN gateo */}

      {result && (
        <section style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Resultado</h2>
          <div
            style={{
              display: "grid",
              gap: 8,
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
              background: "#fff",
            }}
          >
            <div><strong>_id:</strong> {result._id}</div>
            <div><strong>fileName:</strong> {result.fileName}</div>
            <div><strong>type:</strong> {result.type}</div>
            <div><strong>mimeType:</strong> {result.mimeType}</div>
            <div><strong>active:</strong> {String(result.active)}</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <strong>url:</strong>
              <code style={{ background: "#f7f7f7", padding: "2px 6px", borderRadius: 6 }}>
                {result.url}
              </code>
            </div>

            {/* Vista previa si es imagen */}
            <div style={{ marginTop: 8 }}>
              <img
                src={joinUrl(result.url)}
                alt={result.fileName}
                style={{ maxWidth: 320, borderRadius: 8, border: "1px solid #eee" }}
              />
            </div>

            {/* Link a la página pública GET /media/:id (tu front) */}
            <a
              href={`/media/${result._id}`}
              style={{ marginTop: 4, textDecoration: "underline" }}
              title="Ver público"
            >
              Ver público (/media/{result._id})
            </a>

            {/* ⬇️⬇️⬇️ AGREGADOS: enlaces directos al backend */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
              <a
                href={`${getApiBase()}/media/${result._id}`}
                target="_blank" rel="noreferrer"
                style={{ textDecoration: "underline" }}
                title="Ver JSON en backend"
              >
                Ver JSON en backend
              </a>
              <a
                href={joinUrl(result.url)}
                target="_blank" rel="noreferrer"
                style={{ textDecoration: "underline" }}
                title="Abrir archivo (url)"
              >
                Abrir archivo (url)
              </a>
            </div>
            {/* ⬆️⬆️⬆️ FIN agregados */}

            {/* 🔹 AGREGADO: botones de acciones (SOLO ADMIN) */}
            {isAdmin && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* Activar como portada: solo si es "cover" */}
                {result.type === "cover" && (
                  <button
                    type="button"
                    onClick={() => handleActivateCover(result._id)}
                    disabled={activatingId === result._id}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: activatingId === result._id ? "#f3f3f3" : "white",
                      cursor: activatingId === result._id ? "default" : "pointer",
                      fontWeight: 600,
                    }}
                    title="Activar como portada"
                  >
                    {activatingId === result._id ? "Activando…" : "Activar como portada"}
                  </button>
                )}

                {/* NUEVO: Desactivar portada (si es cover y está activa) */}
                {result.type === "cover" && result.active && (
                  <button
                    type="button"
                    onClick={() => handleDeactivateCover(result._id)}
                    disabled={deactivatingId === result._id}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: deactivatingId === result._id ? "#f3f3f3" : "white",
                      cursor: deactivatingId === result._id ? "default" : "pointer",
                      fontWeight: 600,
                    }}
                    title="Desactivar portada"
                  >
                    {deactivatingId === result._id ? "Desactivando…" : "Desactivar portada"}
                  </button>
                )}

                {/* Eliminar */}
                <button
                  type="button"
                  onClick={() => handleDelete(result._id)}
                  disabled={deletingId === result._id}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #f1c0c0",
                    background: deletingId === result._id ? "#f8eaea" : "white",
                    color: "#b00020",
                    cursor: deletingId === result._id ? "default" : "pointer",
                    fontWeight: 600,
                  }}
                  title="Eliminar este archivo"
                >
                  {deletingId === result._id ? "Eliminando…" : "Eliminar"}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 🔹 Bloque para buscar media por ID (GET /media/:id) */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Buscar media por ID (GET /media/:id)</h2>

        <form
          onSubmit={handleLookup}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px,1fr) auto",
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <input
            placeholder="mediaId (MongoID)"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <button
            type="submit"
            disabled={lookupLoading || !lookupId.trim()}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: lookupLoading ? "#f3f3f3" : "white",
              cursor: lookupLoading ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            {lookupLoading ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {lookupMsg && (
          <p style={{ marginTop: 0, color: lookupMsg.includes("✅") ? "green" : "crimson" }}>{lookupMsg}</p>
        )}

        {lookupResult && (
          <div
            style={{
              display: "grid",
              gap: 8,
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
              background: "#fff",
            }}
          >
            <div><strong>_id:</strong> {lookupResult._id}</div>
            <div><strong>fileName:</strong> {lookupResult.fileName}</div>
            <div><strong>type:</strong> {lookupResult.type}</div>
            <div><strong>mimeType:</strong> {lookupResult.mimeType}</div>
            <div><strong>active:</strong> {String(lookupResult.active)}</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <strong>url:</strong>
              <code style={{ background: "#f7f7f7", padding: "2px 6px", borderRadius: 6 }}>
                {lookupResult.url}
              </code>
            </div>

            {/* Vista previa si es imagen */}
            {/^\image\//.test(lookupResult.mimeType) && (
              <div style={{ marginTop: 8 }}>
                <img
                  src={joinUrl(lookupResult.url)}
                  alt={lookupResult.fileName}
                  style={{ maxWidth: 320, borderRadius: 8, border: "1px solid #eee" }}
                />
              </div>
            )}

            {/* Link a la página pública */}
            <a
              href={`/media/${lookupResult._id}`}
              style={{ marginTop: 4, textDecoration: "underline" }}
              title="Ver público"
            >
              Ver público (/media/{lookupResult._id})
            </a>

            {/* ⬇️⬇️⬇️ AGREGADOS: enlaces directos al backend */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
              <a
                href={`${getApiBase()}/media/${lookupResult._id}`}
                target="_blank" rel="noreferrer"
                style={{ textDecoration: "underline" }}
                title="Ver JSON en backend"
              >
                Ver JSON en backend
              </a>
              <a
                href={joinUrl(lookupResult.url)}
                target="_blank" rel="noreferrer"
                style={{ textDecoration: "underline" }}
                title="Abrir archivo (url)"
              >
                Abrir archivo (url)
              </a>
            </div>
            {/* ⬆️⬆️⬆️ FIN agregados */}

            {/* 🔹 AGREGADO: botones de acciones (SOLO ADMIN) */}
            {isAdmin && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* Activar como portada: solo si es "cover" */}
                {lookupResult.type === "cover" && (
                  <button
                    type="button"
                    onClick={() => handleActivateCover(lookupResult._id)}
                    disabled={activatingId === lookupResult._id}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: activatingId === lookupResult._id ? "#f3f3f3" : "white",
                      cursor: activatingId === lookupResult._id ? "default" : "pointer",
                      fontWeight: 600,
                    }}
                    title="Activar como portada"
                  >
                    {activatingId === lookupResult._id ? "Activando…" : "Activar como portada"}
                  </button>
                )}

                {/* NUEVO: Desactivar portada (si es cover y está activa) */}
                {lookupResult.type === "cover" && lookupResult.active && (
                  <button
                    type="button"
                    onClick={() => handleDeactivateCover(lookupResult._id)}
                    disabled={deactivatingId === lookupResult._id}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: deactivatingId === lookupResult._id ? "#f3f3f3" : "white",
                      cursor: deactivatingId === lookupResult._id ? "default" : "pointer",
                      fontWeight: 600,
                    }}
                    title="Desactivar portada"
                  >
                    {deactivatingId === lookupResult._id ? "Desactivando…" : "Desactivar portada"}
                  </button>
                )}

                {/* Eliminar */}
                <button
                  type="button"
                  onClick={() => handleDelete(lookupResult._id)}
                  disabled={deletingId === lookupResult._id}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #f1c0c0",
                    background: deletingId === lookupResult._id ? "#f8eaea" : "white",
                    color: "#b00020",
                    cursor: deletingId === lookupResult._id ? "default" : "pointer",
                    fontWeight: 600,
                  }}
                  title="Eliminar este archivo"
                >
                  {deletingId === lookupResult._id ? "Eliminando…" : "Eliminar"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 🔹 AGREGADO: mensajes globales */}
      {deleteMsg && (
        <p style={{ marginTop: 16, color: deleteMsg.includes("🗑️") ? "green" : "crimson" }}>{deleteMsg}</p>
      )}
      {activateMsg && (
        <p style={{ marginTop: 8, color: activateMsg.includes("✅") ? "green" : "crimson" }}>{activateMsg}</p>
      )}
      {deactivateMsg && (
        <p style={{ marginTop: 8, color: deactivateMsg.includes("✅") ? "green" : "crimson" }}>{deactivateMsg}</p>
      )}
    </main>
  );
}
