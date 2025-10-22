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

  // ⬇️⬇️⬇️ NUEVO: Estados para alternar entre URL y archivo para portada
  const [coverInputMode, setCoverInputMode] = useState<"url" | "file">("url");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverFilePreview, setCoverFilePreview] = useState<string | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverMsg, setCoverMsg] = useState<string | null>(null);

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
      form.append("type", type);

      const r = await apiFetch<UploadResponse>("/media/upload", {
        method: "POST",
        body: form,
      });

      setResult(r.data);
      setMsg(r.message || "Archivo subido ✅");

      // 👇 si es cover, la activamos (flujo anterior conservado)
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

  /* 🔹🔹🔹 NUEVO: crear media DESDE URL (POST /media/upload con JSON) */
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
      const r = await apiFetch<UploadResponse>("/media/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: src, type: urlType }),
      });

      setUrlCreated(r.data);
      setUrlMsg("Imagen creada desde URL ✅");

      // Si fue subida como 'cover', activar inmediatamente (flujo anterior conservado)
      if (r.data.type === "cover") {
        try {
          const act = await apiFetch<UploadResponse>(`/media/cover-image/${r.data._id}`, {
            method: "POST",
          });
          setUrlCreated(act.data);
          setUrlMsg("Portada creada y activada ✅");
        } catch (err: any) {
          setUrlMsg("Imagen creada pero no se pudo activar como portada.");
        }
      }
    } catch (err: any) {
      setUrlMsg(err?.message || "No se pudo crear la imagen desde la URL.");
      if (String(err?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/admin/media";
      }
    } finally {
      setUrlLoading(false);
    }
  }

  // ⬇️⬇️⬇️ NUEVO: Funciones para la nueva sección de portada
  const handleCoverModeChange = (mode: "url" | "file") => {
    setCoverInputMode(mode);
    setCoverMsg(null);
    setImageUrl("");
    setCoverFile(null);
    setCoverFilePreview(null);
  };

  const handleCoverFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      setCoverMsg(null);
    }
  };

  const handleSetCover = async (e: React.FormEvent) => {
    e.preventDefault();
    setCoverLoading(true);
    setCoverMsg(null);

    try {
      let response: UploadResponse;

      if (coverInputMode === "url") {
        const src = imageUrl.trim();
        if (!src) {
          throw new Error("Por favor ingresa una URL de imagen");
        }

        // Usar el endpoint set-cover con URL
        response = await apiFetch<UploadResponse>("/media/set-cover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: src }),
        });
      } else {
        if (!coverFile) {
          throw new Error("Por favor selecciona un archivo de imagen");
        }

        // Validar tipo de archivo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(coverFile.type)) {
          throw new Error("Tipo de archivo no permitido. Solo se permiten JPEG, PNG, GIF y WebP.");
        }

        // Validar tamaño (25MB)
        if (coverFile.size > 25 * 1024 * 1024) {
          throw new Error("El archivo es demasiado grande. Máximo 25MB.");
        }

        // Crear FormData para archivo
        const formData = new FormData();
        formData.append("file", coverFile);

        // Usar el endpoint set-cover con archivo
        response = await apiFetch<UploadResponse>("/media/set-cover", {
          method: "POST",
          body: formData,
        });
      }

      setCoverMsg("✅ Imagen de portada actualizada exitosamente");
      
      // Recargar la imagen actual
      await handleGetActiveCover();
      
      // 🚀 FIX: Invalidar caché del navegador para forzar actualización
      try {
        // Limpiar caché del navegador para la imagen de portada
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        }
        
        // Forzar recarga de la página principal en una nueva pestaña para verificar
        setTimeout(() => {
          setCoverMsg("✅ Imagen actualizada. Abriendo página principal en nueva pestaña para verificar...");
          window.open('/', '_blank');
        }, 1500);
      } catch (error) {
        console.warn("No se pudo limpiar el caché:", error);
      }
      
      // Limpiar formulario
      if (coverInputMode === "url") {
        setImageUrl("");
      } else {
        setCoverFile(null);
        setCoverFilePreview(null);
        // Limpiar input file
        const fileInput = document.getElementById('cover-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (err: any) {
      setCoverMsg(err.message || "Error al actualizar la imagen de portada");
    } finally {
      setCoverLoading(false);
    }
  };

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
        await apiFetch<UploadResponse>(`/media/cover/active/deactivate`, {
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

  /* 🔹🔹🔹 NUEVO: GET /media/cover/active — flujo actual */
  async function handleGetActiveCover() {
    setActiveMsg(null);
    setActiveCoverUrl(null);
    setActiveCoverMediaId(null);
    setActiveLoading(true);
    try {
      // 🚀 FIX: Forzar invalidación de caché para obtener datos frescos
      const res = await apiFetch<any>("/media/cover/active", { 
        method: "GET",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
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
      
      // 🚀 FIX: Agregar cache busting para evitar caché del navegador
      const separator = url.includes('?') ? '&' : '?';
      const urlWithCacheBust = `${url}${separator}v=${Date.now()}`;
      
      setActiveCoverUrl(urlWithCacheBust);
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

      {/* ==================== NUEVO: GESTIÓN DE PORTADA MEJORADA ==================== */}
      {isAdmin && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>🖼️ Gestión de Imagen de Portada</h2>
          
          <form onSubmit={handleSetCover} style={{
            padding: "20px",
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            backgroundColor: "#fff",
            marginBottom: "20px"
          }}>
            {/* Selector de modo */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "10px", fontWeight: "600" }}>
                Método de entrada:
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="coverInputMode"
                    value="url"
                    checked={coverInputMode === "url"}
                    onChange={() => handleCoverModeChange("url")}
                  />
                  URL de imagen
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="coverInputMode"
                    value="file"
                    checked={coverInputMode === "file"}
                    onChange={() => handleCoverModeChange("file")}
                  />
                  Subir archivo
                </label>
              </div>
            </div>

            {/* Input de URL */}
            {coverInputMode === "url" && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  URL de la imagen:
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://ejemplo.com/imagen.jpg"
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    fontSize: "14px"
                  }}
                  disabled={coverLoading}
                />
                <p style={{ marginTop: "5px", fontSize: "12px", color: "#666" }}>
                  Ingresa una URL que apunte a una imagen (JPG, PNG, GIF, WebP)
                </p>
              </div>
            )}

            {/* Input de archivo */}
            {coverInputMode === "file" && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  Seleccionar archivo:
                </label>
                <input
                  id="cover-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleCoverFileSelect}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    fontSize: "14px"
                  }}
                  disabled={coverLoading}
                />
                <p style={{ marginTop: "5px", fontSize: "12px", color: "#666" }}>
                  Formatos permitidos: JPEG, PNG, GIF, WebP (máximo 25MB)
                </p>

                {/* Preview del archivo */}
                {coverFilePreview && (
                  <div style={{ marginTop: "15px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                      Vista previa:
                    </label>
                    <img 
                      src={coverFilePreview} 
                      alt="Preview" 
                      style={{ 
                        maxWidth: "200px", 
                        maxHeight: "150px", 
                        borderRadius: "8px",
                        border: "1px solid #ddd"
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={coverLoading || (coverInputMode === "url" ? !imageUrl.trim() : !coverFile)}
              style={{
                padding: "12px 24px",
                backgroundColor: coverLoading ? "#ccc" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: coverLoading ? "not-allowed" : "pointer",
                width: "100%",
                marginTop: "10px"
              }}
            >
              {coverLoading ? "Actualizando..." : "Actualizar Imagen de Portada"}
            </button>

            {/* Mensajes */}
            {coverMsg && (
              <div style={{
                marginTop: "15px",
                padding: "12px",
                backgroundColor: coverMsg.includes("✅") ? "#d4edda" : "#f8d7da",
                border: `1px solid ${coverMsg.includes("✅") ? "#c3e6cb" : "#f5c6cb"}`,
                borderRadius: "8px",
                color: coverMsg.includes("✅") ? "#155724" : "#721c24"
              }}>
                {coverMsg}
              </div>
            )}
          </form>

          {/* Información adicional */}
          <div style={{ 
            padding: "15px", 
            backgroundColor: "#f8f9fa", 
            borderRadius: "8px",
            fontSize: "14px",
            color: "#666"
          }}>
            <h3 style={{ marginBottom: "10px", color: "#333" }}>ℹ️ Información:</h3>
            <ul style={{ margin: 0, paddingLeft: "20px" }}>
              <li>La imagen de portada se mostrará en la página principal del sitio</li>
              <li>Al subir una nueva imagen, la anterior se desactivará automáticamente</li>
              <li>Se recomienda usar imágenes con buena resolución (mínimo 1200x600px)</li>
              <li>Los formatos soportados son: JPEG, PNG, GIF y WebP</li>
              <li>Tamaño máximo: 25MB</li>
            </ul>
          </div>
        </section>
      )}

      {/* ==================== NUEVO: BOTÓN PARA CONSULTAR PORTADA ACTIVA (flujo viejo) ==================== */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Portada activa (GET /media/cover/active)</h2>
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
