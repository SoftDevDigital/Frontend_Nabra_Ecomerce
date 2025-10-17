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
  return process.env.NEXT_PUBLIC_API_BASE
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

  /* ⬇️⬇️⬇️ NUEVO: Crear media DESDE URL */
  const [urlType, setUrlType] = useState<"product" | "cover">("cover");
  const [imageUrl, setImageUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlMsg, setUrlMsg] = useState<string | null>(null);
  const [urlCreated, setUrlCreated] = useState<MediaDoc | null>(null);

  /* ⬇️⬇️⬇️ NUEVO: Consultar portada activa (URL) */
  const [activeCoverUrl, setActiveCoverUrl] = useState<string | null>(null);
  const [activeCoverMediaId, setActiveCoverMediaId] = useState<string | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeMsg, setActiveMsg] = useState<string | null>(null);

  // ⬇️⬇️⬇️ NUEVO: estado para desactivar la portada activa sin ID
  const [deactivatingActive, setDeactivatingActive] = useState(false);
  /* ⬆️⬆️⬆️ FIN nuevos estados */

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

      // Si es tipo 'cover', usar el endpoint directo set-cover
      if (type === "cover") {
        const r = await apiFetch<UploadResponse>("/media/set-cover", {
          method: "POST",
          body: form,
        });
        setResult(r);
        setMsg("Portada subida y activada ✅");
      } else {
        // Para productos, usar el endpoint normal
        form.append("type", type);
        const r = await apiFetch<UploadResponse>("/media/upload", {
          method: "POST",
          body: form,
        });
        setResult(r.data);
        setMsg(r.message || "Archivo subido ✅");
      }
    } catch (err: any) {
      setMsg(err?.message || "No se pudo subir el archivo");
      if (String(err?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/admin/media";
      }
    } finally {
      setLoading(false);
    }
  }

  /* 🔹🔹🔹 NUEVO: crear media DESDE URL usando el endpoint correcto POST /media/set-cover */
  async function handleUploadByUrl(e: React.FormEvent) {
    e.preventDefault();
    setUrlMsg(null);
    setUrlCreated(null);

    const src = imageUrl.trim();
    if (!src) {
      setUrlMsg("Ingresá la URL de la imagen.");
      return;
    }

    setUrlLoading(true);
    try {
      // Usar el endpoint correcto que maneja tanto archivo como URL
      const r = await apiFetch<UploadResponse>("/media/set-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: src }),
      });

      setUrlCreated(r);
      setUrlMsg("Portada creada y activada desde URL ✅");
    } catch (err: any) {
      setUrlMsg(err?.message || "No se pudo crear la portada desde la URL.");
      if (String(err?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/admin/media";
      }
    } finally {
      setUrlLoading(false);
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
          ...getAuthHeader(),
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
      await apiFetch<unknown>(`/media/${id}`, { method: "DELETE" });

      setDeleteMsg("Archivo eliminado 🗑️");
      setResult((prev) => (prev?._id === id ? null : prev));
      setLookupResult((prev) => (prev?._id === id ? null : prev));
      if (lookupId === id) setLookupId("");
    } catch (err: any) {
      setDeleteMsg(err?.message || "No se pudo eliminar el archivo");
      if (String(err?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/admin/media";
      }
    } finally {
      setDeletingId(null);
    }
  }

  // 🔹 AGREGADO: handler para POST /media/cover-image/:id (requiere token admin) — flujo viejo
  async function handleActivateCover(id: string) {
    if (!id) return;
    setActivateMsg(null);
    setActivatingId(id);
    try {
      const r = await apiFetch<UploadResponse>(`/media/cover-image/${id}`, {
        method: "POST",
      });

      const updated = r.data;
      setResult((prev) => (prev?._id === id ? updated : prev));
      setLookupResult((prev) => (prev?._id === id ? updated : prev));
      setUrlCreated((prev) => (prev?._id === id ? updated : prev));

      setActivateMsg("Imagen activada como portada ✅");
    } catch (err: any) {
      setActivateMsg(err?.message || "No se pudo activar como portada");
      if (String(err?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/admin/media";
      }
    } finally {
      setActivatingId(null);
    }
  }

  // 🔹 NUEVO: handler para POST /media/cover-image/:id/deactivate — flujo viejo
  async function handleDeactivateCover(id: string) {
    if (!id) return;
    setDeactivateMsg(null);
    setDeactivatingId(id);
    try {
      const r = await apiFetch<UploadResponse>(`/media/cover-image/${id}/deactivate`, {
        method: "POST",
      });

      const updated = r.data;
      setResult((prev) => (prev?._id === id ? updated : prev));
      setLookupResult((prev) => (prev?._id === id ? updated : prev));
      setUrlCreated((prev) => (prev?._id === id ? updated : prev));

      setDeactivateMsg("Imagen de portada desactivada ✅");
    } catch (err: any) {
      setDeactivateMsg(err?.message || "No se pudo desactivar la portada");
      if (String(err?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/admin/media";
      }
    } finally {
      setDeactivatingId(null);
    }
  }

  /* 🔹🔹🔹 NUEVO: Desactivar la portada activa SIN conocer el ID — flujo viejo */
  async function handleDeactivateActiveCover() {
    setDeactivateMsg(null);
    setActiveMsg(null);
    setDeactivatingActive(true);
    try {
      if (activeCoverMediaId) {
        await apiFetch<UploadResponse>(`/media/cover-image/${activeCoverMediaId}/deactivate`, {
          method: "POST",
        });
      } else {
        await apiFetch<UploadResponse>(`/media/cover-image/active/deactivate`, {
          method: "POST",
        });
      }

      // Limpiar UI
      setActiveCoverUrl(null);
      setActiveCoverMediaId(null);

      // Reflejar en tarjetas visibles
      setResult(prev => (prev && prev.active ? { ...prev, active: false } as MediaDoc : prev));
      setLookupResult(prev => (prev && prev.active ? { ...prev, active: false } as MediaDoc : prev));
      setUrlCreated(prev => (prev && prev.active ? { ...prev, active: false } as MediaDoc : prev));

      setDeactivateMsg("Imagen de portada desactivada ✅");
      setActiveMsg("No hay portada activa.");
    } catch (err:any) {
      setDeactivateMsg(err?.message || "No se pudo desactivar la portada activa");
      if (String(err?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/admin/media";
      }
    } finally {
      setDeactivatingActive(false);
    }
  }

  /* 🔹🔹🔹 NUEVO: GET /media/cover-image/active/url — flujo viejo */
  async function handleGetActiveCover() {
    setActiveMsg(null);
    setActiveCoverUrl(null);
    setActiveCoverMediaId(null);
    setActiveLoading(true);
    try {
      const res = await apiFetch<any>("/media/cover-image/active/url", { method: "GET" });
      // Soportar distintos formatos: string o { url, mediaId } o { data: ... }
      const data = (res as any)?.data ?? res;
      let url: string | null = null;
      let mid: string | null = null;

      if (typeof data === "string") {
        url = data;
      } else if (data?.url) {
        url = data.url;
        mid = data.mediaId || data._id || null;
      }

      if (!url) throw new Error("No se encontró portada activa.");
      setActiveCoverUrl(url);
      if (mid) setActiveCoverMediaId(mid);
      setActiveMsg("Portada activa encontrada ✅");
    } catch (err: any) {
      setActiveMsg(err?.message || "No se pudo obtener la portada activa.");
    } finally {
      setActiveLoading(false);
    }
  }

  const apiBase = getApiBase();
  const joinUrl = (u: string) => `${apiBase}/${u}`.replace(/([^:]\/)\/+/g, "$1");
  const toAbsolute = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : u ? joinUrl(u) : "");

  /* ===================== NUEVO: GALERÍAS y SET-COVER (endpoints nuevos) ===================== */
  type GalleryResponse = { success: true; data: MediaDoc[] };
  const [productGallery, setProductGallery] = useState<MediaDoc[]>([]);
  const [coverGallery, setCoverGallery] = useState<MediaDoc[]>([]);
  const [activeCoverNew, setActiveCoverNew] = useState<{ url: string; _id?: string } | null>(null);
  const [galleryMsg, setGalleryMsg] = useState<string | null>(null);
  const [settingCoverId, setSettingCoverId] = useState<string | null>(null);

  async function fetchGallery(kind: "products" | "covers"): Promise<GalleryResponse> {
    const path = kind === "products" ? "/media/gallery/products" : "/media/gallery/covers";
    return apiFetch<GalleryResponse>(path, { method: "GET" });
  }
  async function getActiveCoverNew() {
    // el back puede devolver string o { url, _id }
    const res = await apiFetch<any>("/media/cover/active", { method: "GET" });
    const data = (res as any)?.data ?? res;
    if (!data) return null;
    if (typeof data === "string") return { url: data } as { url: string };
    return data as { url: string; _id?: string };
  }
  async function setAsCoverNew(imageId: string) {
    return apiFetch<{ success: true; data: MediaDoc }>(`/media/${imageId}/set-cover`, { method: "POST" });
  }

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        setGalleryMsg(null);
        const [gp, gc, ac] = await Promise.all([
          fetchGallery("products"),
          fetchGallery("covers"),
          getActiveCoverNew(),
        ]);
        setProductGallery(gp.data || []);
        setCoverGallery(gc.data || []);
        setActiveCoverNew(ac);
      } catch (e: any) {
        setGalleryMsg(e?.message || "No se pudieron cargar las galerías");
      }
    })();
  }, [isAdmin]);

  async function handleSetCoverNew(id: string) {
    setSettingCoverId(id);
    try {
      await setAsCoverNew(id);
      const ac = await getActiveCoverNew();
      setActiveCoverNew(ac);
      setActivateMsg("Portada cambiada (nuevo endpoint) ✅");
    } catch (e: any) {
      setActivateMsg(e?.message || "No se pudo marcar como portada (nuevo endpoint)");
    } finally {
      setSettingCoverId(null);
    }
  }
  /* ================== FIN NUEVO: GALERÍAS y SET-COVER (endpoints nuevos) =================== */

  return (
    <main style={{ maxWidth: 720, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Subir medios</h1>
        <span style={{ marginLeft: "auto", opacity: 0.75, fontSize: 14 }}>
          <Link href="/">Volver al inicio</Link>
        </span>
      </header>

      {/* ==================== FORM SUBIR ARCHIVO (EXISTENTE) ==================== */}
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

      {/* ==================== NUEVO: SUBIR DESDE URL ==================== */}
      {isAdmin && (
        <section style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Crear media desde URL (POST /media/upload)</h2>
          <form
            onSubmit={handleUploadByUrl}
            style={{
              display: "grid",
              gap: 8,
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 12,
              background: "#fff",
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>URL de la imagen</span>
              <input
                placeholder="https://cdn.example.com/portada.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Tipo</span>
              <select
                value={urlType}
                onChange={(e) => setUrlType(e.target.value as any)}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
              >
                <option value="cover">cover</option>
                <option value="product">product</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={urlLoading || !imageUrl.trim()}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: urlLoading ? "#f3f3f3" : "white",
                cursor: urlLoading ? "default" : "pointer",
                fontWeight: 700,
                width: "fit-content",
              }}
            >
              {urlLoading ? "Creando…" : "Crear desde URL"}
            </button>

            {urlMsg && <p style={{ margin: 0, color: urlMsg.includes("✅") ? "green" : "crimson" }}>{urlMsg}</p>}
          </form>

          {urlCreated && (
            <div
              style={{
                marginTop: 8,
                display: "grid",
                gap: 8,
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
                background: "#fff",
              }}
            >
              <div><strong>_id:</strong> {urlCreated._id}</div>
              <div><strong>fileName:</strong> {urlCreated.fileName}</div>
              <div><strong>type:</strong> {urlCreated.type}</div>
              <div><strong>mimeType:</strong> {urlCreated.mimeType}</div>
              <div><strong>active:</strong> {String(urlCreated.active)}</div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <strong>url:</strong>
                <code style={{ background: "#f7f7f7", padding: "2px 6px", borderRadius: 6 }}>
                  {urlCreated.url}
                </code>
              </div>

              <div style={{ marginTop: 8 }}>
                <img
                  src={toAbsolute(urlCreated.url)}
                  alt={urlCreated.fileName}
                  style={{ maxWidth: 320, borderRadius: 8, border: "1px solid #eee" }}
                />
              </div>

              {isAdmin && urlCreated.type === "cover" && !urlCreated.active && (
                <button
                  type="button"
                  onClick={() => handleActivateCover(urlCreated._id)}
                  disabled={activatingId === urlCreated._id}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: activatingId === urlCreated._id ? "#f3f3f3" : "white",
                    cursor: activatingId === urlCreated._id ? "default" : "pointer",
                    fontWeight: 600,
                    width: "fit-content",
                  }}
                  title="Activar como portada"
                >
                  {activatingId === urlCreated._id ? "Activando…" : "Activar como portada"}
                </button>
              )}
            </div>
          )}
        </section>
      )}

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
                src={toAbsolute(result.url)}
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
                href={toAbsolute(result.url)}
                target="_blank" rel="noreferrer"
                style={{ textDecoration: "underline" }}
                title="Abrir archivo (url)"
              >
                Abrir archivo (url)
              </a>
            </div>

            {/* 🔹 AGREGADO: botones de acciones (SOLO ADMIN) */}
            {isAdmin && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* Activar como portada: solo si es "cover" (flujo viejo) */}
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

                {/* NUEVO: Desactivar portada (si es cover y está activa) — flujo viejo */}
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
            {/^\image\//.test(lookupResult.mimeType) && ( // 👈 (dejado como estaba)
              <div style={{ marginTop: 8 }}>
                <img
                  src={toAbsolute(lookupResult.url)}
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
                href={toAbsolute(lookupResult.url)}
                target="_blank" rel="noreferrer"
                style={{ textDecoration: "underline" }}
                title="Abrir archivo (url)"
              >
                Abrir archivo (url)
              </a>
            </div>

            {/* 🔹 AGREGADO: botones de acciones (SOLO ADMIN) */}
            {isAdmin && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* Activar como portada: solo si es "cover" (flujo viejo) */}
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

                {/* NUEVO: Desactivar portada (si es cover y está activa) — flujo viejo */}
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

      {/* ==================== NUEVO: BOTÓN PARA CONSULTAR PORTADA ACTIVA (flujo viejo) ==================== */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Portada activa (GET /media/cover-image/active/url)</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <button
            type="button"
            onClick={handleGetActiveCover}
            disabled={activeLoading}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: activeLoading ? "#f3f3f3" : "white",
              cursor: activeLoading ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            {activeLoading ? "Consultando…" : "Obtener portada activa"}
          </button>

          {/* NUEVO: Desactivar portada activa (sin ID) */}
          <button
            type="button"
            onClick={handleDeactivateActiveCover}
            disabled={deactivatingActive}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: deactivatingActive ? "#f3f3f3" : "white",
              cursor: deactivatingActive ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            {deactivatingActive ? "Desactivando…" : "Desactivar portada activa"}
          </button>

          {activeMsg && (
            <span style={{ color: activeMsg.includes("✅") ? "green" : "crimson" }}>{activeMsg}</span>
          )}
        </div>

        {activeCoverUrl && (
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
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong>URL:</strong>
              <code style={{ background: "#f7f7f7", padding: "2px 6px", borderRadius: 6 }}>{activeCoverUrl}</code>
              <a href={activeCoverUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                Abrir
              </a>
              {activeCoverMediaId && (
                <a
                  href={`${getApiBase()}/media/${activeCoverMediaId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "underline" }}
                  title="Ver JSON en backend"
                >
                  Ver JSON (mediaId: {activeCoverMediaId})
                </a>
              )}
            </div>
            <img
              src={activeCoverUrl}
              alt="Portada activa"
              style={{ maxWidth: 360, borderRadius: 8, border: "1px solid #eee" }}
            />

            {/* NUEVO: Botón duplicado dentro del panel (opcional UX) */}
            <div>
              <button
                type="button"
                onClick={handleDeactivateActiveCover}
                disabled={deactivatingActive}
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: deactivatingActive ? "#f3f3f3" : "white",
                  cursor: deactivatingActive ? "default" : "pointer",
                  fontWeight: 600,
                }}
              >
                {deactivatingActive ? "Desactivando…" : "Desactivar portada activa"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ==================== NUEVO: GALERÍAS + SET-COVER (endpoints nuevos) ==================== */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Galería de Portadas (GET /media/gallery/covers)</h2>
        {galleryMsg && <p style={{ color: "crimson", marginTop: 0 }}>{galleryMsg}</p>}
        {!coverGallery.length ? (
          <p>No hay portadas.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 10 }}>
            {coverGallery.map(m => (
              <article key={m._id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 8 }}>
                <img src={toAbsolute(m.url)} alt={m.fileName} style={{ width: "100%", borderRadius: 8 }} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => handleSetCoverNew(m._id)}
                    disabled={settingCoverId === m._id}
                    title="Marcar como portada activa (nuevo endpoint)"
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: settingCoverId === m._id ? "#f3f3f3" : "white",
                      cursor: settingCoverId === m._id ? "default" : "pointer",
                    }}
                  >
                    {settingCoverId === m._id ? "Marcando…" : "Marcar como portada"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <strong>Portada activa (nuevo endpoint): </strong>
          {activeCoverNew?.url ? (
            <>
              <code style={{ background:"#f7f7f7", padding:"2px 6px", borderRadius:6 }}>{activeCoverNew.url}</code>
              <div style={{ marginTop: 8 }}>
                <img src={activeCoverNew.url} alt="Portada activa" style={{ maxWidth: 360, borderRadius: 8, border: "1px solid #eee" }} />
              </div>
            </>
          ) : "No hay portada activa."}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Galería de Productos (GET /media/gallery/products)</h2>
        {!productGallery.length ? (
          <p>No hay imágenes.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 10 }}>
            {productGallery.map(m => (
              <article key={m._id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 8 }}>
                <img src={toAbsolute(m.url)} alt={m.fileName} style={{ width: "100%", borderRadius: 8 }} />
                <small style={{ display:"block", marginTop:6, opacity:.7 }}>{m.fileName}</small>
              </article>
            ))}
          </div>
        )}
      </section>
      {/* ================== FIN NUEVO: GALERÍAS + SET-COVER ================== */}

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
