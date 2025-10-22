// src/app/admin/productos/nuevo/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import s from "./AdminCreateProduct.module.css";

type ProductIn = {
  name: string;
  description: string;
  price: number;
  category: string;
  /** puede ser string CSV o array en UI, pero enviamos CSV al backend */
  sizes: string | string[];
  images?: string[];
  /** stock por talle */
  stockBySize?: Record<string, number>;
  isPreorder?: boolean;
  isFeatured?: boolean;
  // 👉 isActive *no* se envía porque el backend no lo admite
};

type ProductOut = {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  sizes: string[] | string;
  images?: string[];
  /** el backend puede devolverlo como objeto o string JSON */
  stockBySize?: Record<string, number> | string | null;
  isPreorder: boolean;
  isFeatured: boolean;
  isActive?: boolean;
  updatedAt?: string;
  createdAt?: string;
  [k: string]: any;
};

type CreateResponse =
  | { success: true; data: ProductOut; message?: string }
  | { success: false; message: string };

type ListResponse =
  | { success: true; data: ProductOut[]; message?: string }
  | { success: false; message: string }
  | { products?: ProductOut[]; total?: number; page?: number; totalPages?: number }
  | { data?: { products?: ProductOut[] } }
  | { items?: ProductOut[] }
  | ProductOut[]
  | any;

/* ===== Helpers JWT ===== */
function getJwtPayload(): any | null {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}
function isAdminFromToken(): boolean {
  const p = getJwtPayload();
  if (!p) return false;
  const role = p.role || p.roles || p.userRole || p["https://example.com/roles"];
  if (Array.isArray(role)) return role.map(String).some((r) => r.toLowerCase() === "admin");
  if (typeof role === "string") return role.toLowerCase() === "admin";
  return false;
}
function getBearer(): string | null {
  try { return typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null; }
  catch { return null; }
}

/* ===== helper local para multipart sin tocar lib/api.ts ===== */
async function apiFetchMultipart<T = any>(path: string, body: FormData, method: "POST" | "PUT" = "POST"): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
  const token = getBearer();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json && json.success === false)) {
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  return json as T;
}

/* ===== Helpers CSV / stockBySize ===== */
function csvToArray(input: string): string[] {
  return (input || "").split(/[,\n]/g).map((s) => s.trim()).filter(Boolean);
}
function arrayToCsv(arr: string[]): string {
  return arr.join(",");
}
function parseStockBySize(input: string): Record<string, number> {
  const out: Record<string, number> = {};
  (input || "")
    .split(/[,\n]/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [sz, qty] = pair.split(":").map((x) => x.trim());
      const n = Number(qty);
      if (!sz || !Number.isFinite(n) || n < 0) return;
      out[sz] = n;
    });
  return out;
}
/** normaliza lo que vuelve del backend (objeto o string JSON) */
function normalizeStockBySize(val: ProductOut["stockBySize"]): Record<string, number> | null {
  try {
    if (!val) return null;
    if (typeof val === "string") return JSON.parse(val);
    if (typeof val === "object") return val;
    return null;
  } catch { return null; }
}
function totalFromStockBySize(map: Record<string, number> | null): number {
  if (!map) return 0;
  return Object.values(map).reduce((a, b) => a + (Number.isFinite(b) ? Number(b) : 0), 0);
}

/* ===== chequeo de límite de subida (para evitar 413) ===== */
function getMaxUploadBytes(): number {
  const mb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? "1"); // default 1MB
  return Math.max(0.1, mb) * 1024 * 1024;
}
function checkFilesSize(files: FileList | null): { ok: boolean; msg?: string } {
  if (!files || !files.length) return { ok: true };
  const MAX = getMaxUploadBytes();
  let total = 0;
  for (const f of Array.from(files)) {
    total += f.size;
    if (f.size > MAX) {
      return {
        ok: false,
        msg: `Una imagen pesa ${(f.size / (1024*1024)).toFixed(2)}MB y supera el límite de ${(MAX / (1024*1024)).toFixed(2)}MB.`,
      };
    }
  }
  if (total > MAX) {
    return {
      ok: false,
      msg: `El total de imágenes es ${(total / (1024*1024)).toFixed(2)}MB y supera el límite de ${(MAX / (1024*1024)).toFixed(2)}MB.`,
    };
  }
  return { ok: true };
}

/* ===== NUEVO: helper para adjuntar URLs del CSV al producto ya creado (archivos + URLs) ===== */
async function attachCsvImagesToProduct(productId: string, csv: string) {
  const urls = csvToArray(csv).filter((u) => /^https?:\/\//i.test(u));
  if (!urls.length) return;

  const bearer = getBearer();
  for (const url of urls) {
    await apiFetch<CreateResponse>(`/products/${productId}/images`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify({ imageUrl: url }),
    });
  }
}

/* ===== NUEVO: helper para re-obtener el producto tras crear ===== */
async function fetchProductOutById(id: string): Promise<ProductOut> {
  const bearer = getBearer();
  const r = await apiFetch<CreateResponse | ProductOut>(`/products/${id}`, {
    method: "GET",
    headers: { Accept: "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
  });

  if (typeof (r as any)?.success === "boolean") {
    const rr = r as CreateResponse;
    if (!rr.success) throw new Error(rr.message || "No se pudo cargar el producto");
    return rr.data;
  }
  return r as ProductOut;
}

export default function AdminCreateProductPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [category, setCategory] = useState("");
  const [sizesText, setSizesText] = useState("");
  const [imagesText, setImagesText] = useState("");
  /** texto para mapear talle:cantidad */
  const [stockBySizeText, setStockBySizeText] = useState("");
  const [isPreorder, setIsPreorder] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(true); // UI solamente

  // UI
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [created, setCreated] = useState<ProductOut | null>(null);

  // Edición
  const [editId, setEditId] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Lista
  const [allProducts, setAllProducts] = useState<ProductOut[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Agregar imagen
  const [addImageUrl, setAddImageUrl] = useState("");
  const [addingImg, setAddingImg] = useState(false);

  // input de archivos
  const imagesInputRef = useRef<HTMLInputElement | null>(null);
  const [imageFiles, setImageFiles] = useState<FileList | null>(null);

  useEffect(() => { setIsAdmin(isAdminFromToken()); }, []);
  useEffect(() => { if (isAdmin) void loadAllProducts(); }, [isAdmin]);

  function parseCsvToArray(input: string): string[] {
    return (input || "").split(/[,\n]/g).map((s) => s.trim()).filter(Boolean);
  }

  function fillFormFromProduct(p: ProductOut) {
    setName(p.name || "");
    setDescription(p.description || "");
    setPrice(typeof p.price === "number" ? p.price : "");
    setCategory(p.category || "");
    if (Array.isArray(p.sizes)) setSizesText(p.sizes.join(","));
    else if (typeof p.sizes === "string") setSizesText(p.sizes);
    else setSizesText("");
    setImagesText(Array.isArray(p.images) ? p.images.join(",") : "");

    const norm = normalizeStockBySize(p.stockBySize);
    if (norm) {
      const txt = Object.entries(norm).map(([k, v]) => `${k}:${v}`).join(",");
      setStockBySizeText(txt);
    } else {
      setStockBySizeText("");
    }

    setIsPreorder(Boolean(p.isPreorder));
    setIsFeatured(Boolean(p.isFeatured));
    setIsActive(typeof p.isActive === "boolean" ? p.isActive : true); // UI
  }

  async function loadAllProducts() {
    try {
      setLoadingProducts(true);
      const bearer = getBearer();
      const r = await apiFetch<ListResponse>("/products?limit=200&page=1", {
        method: "GET",
        headers: { Accept: "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      });

      let arr: ProductOut[] = [];
      if (Array.isArray(r)) arr = r as ProductOut[];
      else if (Array.isArray((r as any)?.data)) arr = (r as any).data;
      else if (Array.isArray((r as any)?.items)) arr = (r as any).items;
      else if (Array.isArray((r as any)?.products)) arr = (r as any).products;
      else if (Array.isArray((r as any)?.data?.products)) arr = (r as any).data.products;
      else if ((r as any)?.success === false) throw new Error((r as any)?.message || "Error al listar productos");
      else if ((r as any)?.data && (r as any).data._id) arr = [(r as any).data as ProductOut];
      else {
        const maybe = Object.values(r || {}).find((v) => Array.isArray(v)) as ProductOut[] | undefined;
        if (Array.isArray(maybe)) arr = maybe;
      }
      setAllProducts(arr);
    } catch (e: any) {
      setMsg(e?.message || "No se pudo cargar la lista de productos");
      setAllProducts([]);
    } finally { setLoadingProducts(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setCreated(null);

    const p = Number(price);
    if (!name.trim() || !description.trim() || !category.trim()) { setMsg("Completá nombre, descripción y categoría."); return; }
    if (!Number.isFinite(p) || p < 0) { setMsg("Precio inválido."); return; }

    // sizes CSV y stockBySize
    const sizesArr = csvToArray(sizesText);
    if (!sizesArr.length) { setMsg("Ingresá al menos un talle en “sizes”."); return; }
    const sizesCsv = arrayToCsv(sizesArr);

    const stockBySize = parseStockBySize(stockBySizeText);
    if (!Object.keys(stockBySize).length) { setMsg("Cargá al menos un par talle:cantidad en stock por talle."); return; }

    const images = parseCsvToArray(imagesText);

    // multipart con archivos
    if (imageFiles && imageFiles.length) {
      const sized = checkFilesSize(imageFiles);
      if (!sized.ok) { setMsg(`${sized.msg} Reducí la imagen o usá “Imágenes (CSV)” con URLs.`); return; }

      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("description", description.trim());
      fd.append("price", String(p));
      fd.append("category", category.trim());
      fd.append("isPreorder", String(!!isPreorder));
      fd.append("isFeatured", String(!!isFeatured));
      fd.append("sizes", sizesCsv);

      // 🔴 ANTES: fd.append("stockBySize", JSON.stringify(stockBySize));
      // 🟢 AHORA: enviar campos anidados para que el backend lo tome como objeto
      Object.entries(stockBySize).forEach(([k, v]) => {
        fd.append(`stockBySize[${k}]`, String(v));
      });

      Array.from(imageFiles).forEach(f => fd.append("images", f));

      setCreating(true);
      try {
        const r = await apiFetchMultipart<CreateResponse>("/products", fd, "POST");
        if (!("success" in r) || !r.success) throw new Error(("message" in r && r.message) || "No se pudo crear el producto");

        // ✅ NUEVO: si además hay CSV/URLs, adjuntarlas al producto ya creado
        const createdId = r.data._id;
        if (createdId && imagesText.trim()) {
          await attachCsvImagesToProduct(createdId, imagesText);
        }

        // ✅ NUEVO: refrescar el producto ya con todas las imágenes
        const refreshed = await fetchProductOutById(createdId);

        setCreated(refreshed);
        setMsg("Producto creado ✅");

        // reset
        setName(""); setDescription(""); setPrice(""); setCategory("");
        setSizesText(""); setImagesText(""); setStockBySizeText("");
        setIsPreorder(false); setIsFeatured(false); setIsActive(true);
        if (imagesInputRef.current) imagesInputRef.current.value = "";
        setImageFiles(null);
        setEditing(false); setEditId("");
        void loadAllProducts();
      } catch (err: any) {
        const m = String(err?.message || "No se pudo crear el producto");
        if (/413|entity too large/i.test(m)) {
          setMsg(
            "El servidor rechazó el archivo (HTTP 413: demasiado grande). " +
            "Reducí el peso (≤ " + (getMaxUploadBytes()/(1024*1024)).toFixed(2) + "MB) o usá “Imágenes (CSV)” con URLs."
          );
        } else {
          setMsg(m);
          if (/(no autenticado|credenciales|401)/i.test(m)) window.location.href = "/auth?redirectTo=/admin/productos/nuevo";
        }
      } finally { setCreating(false); }
      return;
    }

    // JSON plano (sin archivos)
    const body: ProductIn = {
      name: name.trim(),
      description: description.trim(),
      price: p,
      category: category.trim(),
      sizes: sizesCsv,
      stockBySize,
      ...(images.length ? { images } : {}),
      ...(isPreorder ? { isPreorder: true } : {}),
      ...(isFeatured ? { isFeatured: true } : {}),
    };

    setCreating(true);
    try {
      const bearer = getBearer();
      const r = await apiFetch<CreateResponse>("/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!("success" in r) || !r.success) throw new Error(("message" in r && r.message) || "No se pudo crear el producto");

      // ✅ NUEVO: reforzar que las URLs del CSV queden registradas (algunos backends ignoran images en el POST JSON)
      const createdId = r.data._id;
      if (createdId && imagesText.trim()) {
        await attachCsvImagesToProduct(createdId, imagesText);
      }

      // ✅ NUEVO: refrescar el producto ya con imágenes
      const refreshed = await fetchProductOutById(createdId);

      setCreated(refreshed);
      setMsg("Producto creado ✅");

      // reset
      setName(""); setDescription(""); setPrice(""); setCategory("");
      setSizesText(""); setImagesText(""); setStockBySizeText("");
      setIsPreorder(false); setIsFeatured(false); setIsActive(true);
      setEditing(false); setEditId("");
      void loadAllProducts();
    } catch (err: any) {
      const m = err?.message || "No se pudo crear el producto";
      setMsg(m);
      if (/(no autenticado|credenciales|401)/i.test(m)) window.location.href = "/auth?redirectTo=/admin/productos/nuevo";
    } finally { setCreating(false); }
  }

  async function handleLoadForEdit(idParam?: string) {
    setMsg(null); setCreated(null);
    const id = (idParam ?? editId ?? "").trim();
    if (!id) { setMsg("Seleccioná un producto para editar."); return; }

    setLoadingEdit(true);
    try {
      const bearer = getBearer();
      const r = await apiFetch<CreateResponse | ProductOut>(`/products/${id}`, {
        method: "GET",
        headers: { Accept: "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      });

      let prod: ProductOut | null = null;
      if (typeof (r as any)?.success === "boolean") {
        const rr = r as CreateResponse;
        if (!rr.success) throw new Error(rr.message || "No se pudo cargar el producto");
        prod = rr.data;
      } else {
        const plain = r as ProductOut;
        if (plain && plain._id) prod = plain;
      }
      if (!prod) throw new Error("Respuesta inesperada del servidor");

      fillFormFromProduct(prod);
      setEditing(true);
      setMsg("Producto cargado para edición. Podés modificar y guardar.");
    } catch (err: any) {
      setMsg(err?.message || "No se pudo cargar el producto");
    } finally { setLoadingEdit(false); }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setCreated(null);

    const id = (editId || "").trim();
    if (!id) { setMsg("Falta seleccionar el producto para actualizar."); return; }

    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) { setMsg("Precio inválido."); return; }

    const sizesArr = csvToArray(sizesText);
    const images = parseCsvToArray(imagesText);
    const sizesCsv = arrayToCsv(sizesArr);
    const stockBySize = parseStockBySize(stockBySizeText);

    // PUT JSON (no manejo multipart en update acá, conservamos tu flujo)
    const bodyFull: Partial<ProductIn> = {
      price: p,
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      // 🔧 FIX: el backend exige array en UPDATE → "sizes must be an array"
      ...(sizesArr.length ? { sizes: sizesArr } : {}),
      ...(Object.keys(stockBySize).length ? { stockBySize } : {}),
      ...(images.length ? { images } : { images: [] }),
      isPreorder,
      isFeatured,
    };

    setUpdating(true);
    try {
      const bearer = getBearer();
      const r = await apiFetch<CreateResponse | ProductOut>(`/products/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(bodyFull),
      });

      let updated: ProductOut | null = null;
      if (typeof (r as any)?.success === "boolean") {
        const rr = r as CreateResponse;
        if (!rr.success) throw new Error(rr.message || "No se pudo actualizar el producto");
        updated = rr.data;
      } else {
        const plain = r as ProductOut;
        if (plain && plain._id) updated = plain;
      }
      if (!updated) throw new Error("Respuesta inesperada del servidor");

      setCreated(updated);
      setMsg("Producto actualizado ✅");
      void loadAllProducts();
    } catch (err: any) {
      const m = err?.message || "No se pudo actualizar el producto";
      setMsg(m);
      if (/(401|403|no autenticado|credenciales|unauthorized|forbidden)/i.test(m))
        window.location.href = "/auth?redirectTo=/admin/productos/nuevo";
    } finally { setUpdating(false); }
  }

  async function handleAddImageToProduct() {
    setMsg(null);
    const id = (editId || "").trim();
    const url = (addImageUrl || "").trim();
    if (!id) { setMsg("Seleccioná un producto para editar."); return; }
    if (!url) { setMsg("Ingresá la URL de la imagen."); return; }

    setAddingImg(true);
    try {
      const bearer = getBearer();
      const r = await apiFetch<CreateResponse>(`/products/${id}/images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({ imageUrl: url }),
      });
      if (!("success" in r) || !r.success) throw new Error(("message" in r && r.message) || "No se pudo adjuntar la imagen");

      setMsg("Imagen agregada al producto ✅");
      setAddImageUrl("");
      await handleLoadForEdit(id);
      setImagesText((prev) => (prev ? `${prev},${url}` : url));
    } catch (err: any) {
      const m = err?.message || "No se pudo adjuntar la imagen";
      setMsg(m);
      if (/(no autenticado|credenciales)/i.test(m)) window.location.href = "/auth?redirectTo=/admin/productos/nuevo";
    } finally { setAddingImg(false); }
  }

  function resetEdit() {
    setEditing(false); setEditId(""); setMsg(null); setCreated(null);
    setName(""); setDescription(""); setPrice(""); setCategory("");
    setSizesText(""); setImagesText(""); setStockBySizeText("");
    setIsPreorder(false); setIsFeatured(false); setIsActive(true);
    if (imagesInputRef.current) imagesInputRef.current.value = "";
    setImageFiles(null);
  }

  // stock total para UI (selector/resultados)
  function totalStockFromOut(p: ProductOut): number {
    return totalFromStockBySize(normalizeStockBySize(p.stockBySize));
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>{editing ? "Editar producto" : "Crear producto"}</h1>
        <Link href="/" className={s.back}>Volver al inicio</Link>
      </header>

      {!isAdmin && (
        <div className={s.notice}>
          <p className={s.m0}>Para crear productos necesitás permisos de administrador.</p>
        </div>
      )}

      {isAdmin && (
        <>
          {/* Selección para editar */}
          <section id="actualizar" className={s.card}>
            <div className={s.cardTitle}>Actualizar producto existente</div>

            <div className={s.inlineWrap}>
              <select
                value={editId}
                onChange={(e) => { const id = e.target.value; setEditId(id); if (id) handleLoadForEdit(id); }}
                className={s.select}
                disabled={loadingProducts}
              >
                <option value="">
                  {loadingProducts ? "Cargando productos…" : (allProducts.length ? "Seleccioná un producto…" : "No hay productos cargados")}
                </option>
                {allProducts.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} — ${p.price} — stock {totalStockFromOut(p)}
                  </option>
                ))}
              </select>

              <button onClick={() => loadAllProducts()} type="button" className={s.btn} disabled={loadingProducts}>
                {loadingProducts ? "Actualizando…" : "Recargar lista"}
              </button>

              {editing && (
                <button onClick={resetEdit} type="button" className={s.btnAlt}>Cancelar edición</button>
              )}
            </div>

            <small className={s.help}>
              Elegí un producto para prellenar el formulario y luego guardá con “Actualizar producto”.
            </small>
          </section>

          {/* Agregar imagen a producto */}
          {editing && (
            <section className={`${s.card} ${s.cardDashed}`}>
              <div className={s.cardTitle}>Agregar imagen al producto</div>
              <div className={s.inlineWrap}>
                <input
                  value={addImageUrl}
                  onChange={(e) => setAddImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className={s.input}
                />
                <button
                  type="button"
                  onClick={handleAddImageToProduct}
                  disabled={addingImg || !addImageUrl.trim() || !editId}
                  className={s.btn}
                  title="Adjuntar imagen (POST /products/:id/images)"
                >
                  {addingImg ? "Adjuntando…" : "Agregar imagen"}
                </button>
              </div>
              <small className={s.help}>
                Pegá una URL absoluta (por ejemplo la que te da el módulo de medios) y se agregará a <code>images</code>.
              </small>
            </section>
          )}

          {/* Formulario */}
          <form onSubmit={editing ? handleUpdate : handleSubmit} className={s.card}>
            <div className={s.grid2}>
              <label className={s.field}>
                <span className={s.lbl}>Nombre *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Zapatos" className={s.input}/>
              </label>

              <label className={s.field}>
                <span className={s.lbl}>Categoría *</span>
                <input value={category} onChange={(e) => setCategory(e.target.value)} required placeholder="zapatos" className={s.input}/>
              </label>
            </div>

            <label className={s.field}>
              <span className={s.lbl}>Descripción *</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} placeholder="Cómodos, livianos, etc." className={s.textarea}/>
            </label>

            <div className={s.grid3}>
              <label className={s.field}>
                <span className={s.lbl}>Precio *</span>
                <input type="number" min={0} step="0.01" value={price}
                  onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  required placeholder="50" className={s.input}/>
              </label>

              <label className={s.field}>
                <span className={s.lbl}>Talles (CSV) *</span>
                <input value={sizesText} onChange={(e) => setSizesText(e.target.value)} required placeholder="35,36,37,38" className={s.input}/>
              </label>

              <div />
            </div>

            {/* stock por talle */}
            <label className={s.field}>
              <span className={s.lbl}>Stock por talle (CSV “talle:cantidad”)</span>
              <textarea
                value={stockBySizeText}
                onChange={(e) => setStockBySizeText(e.target.value)}
                rows={3}
                placeholder="35:5,36:8,37:10"
                className={s.textarea}
              />
              <small className={s.help}>Ej.: 35:5,36:8,37:10 o uno por línea.</small>
            </label>

            {/* input de archivos */}
            <label className={s.field}>
              <span className={s.lbl}>Imágenes del producto (archivos)</span>
              <input
                ref={imagesInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setImageFiles(e.target.files)}
                className={s.input}
              />
              <small className={s.help}>
                Podés adjuntar varias. El backend generará URLs y completará <code>images[]</code>.
              </small>
            </label>

            <div className={s.switchRow}>
              <label className={s.switch}><input type="checkbox" checked={isPreorder} onChange={(e) => setIsPreorder(e.target.checked)}/><span>isPreorder</span></label>
              <label className={s.switch}><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)}/><span>isFeatured</span></label>
              <label className={s.switch}><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}/><span>isActive (UI)</span></label>

              {!editing ? (
                <button type="submit" disabled={creating} className={s.btnSubmit} title="Crear producto">
                  {creating ? "Creando…" : "Crear producto"}
                </button>
              ) : (
                <button type="submit" disabled={updating} className={s.btnSubmit} title="Actualizar producto">
                  {updating ? "Actualizando…" : "Actualizar producto"}
                </button>
              )}
            </div>

            {msg && <p className={msg.includes("✅") ? s.ok : s.error}>{msg}</p>}
          </form>
        </>
      )}

      {created && (
        <section className={s.result}>
          <div className={s.resultTitle}>{editing ? "Producto actualizado" : "Producto creado"}</div>
          <div className={s.resultGrid}>
            <div><strong>ID:</strong> {created._id}</div>
            <div><strong>Nombre:</strong> {created.name}</div>
            <div><strong>Precio:</strong> {created.price}</div>
            <div><strong>Categoría:</strong> {created.category}</div>
            {/* total desde stockBySize */}
            <div>
              <strong>Stock total:</strong>{" "}
              {totalFromStockBySize(normalizeStockBySize(created.stockBySize))}
            </div>
            <div>
              <strong>Sizes:</strong>{" "}
              {Array.isArray(created.sizes) ? created.sizes.join(", ") : String(created.sizes || "")}
            </div>
            {"stockBySize" in created && normalizeStockBySize(created.stockBySize) && (
              <div>
                <strong>Stock por talle:</strong>{" "}
                {Object.entries(normalizeStockBySize(created.stockBySize) as Record<string, number>)
                  .map(([k, v]) => `${k}:${v}`).join(", ")}
              </div>
            )}
            {!!created.images?.length && <div><strong>Imágenes:</strong> {created.images.join(", ")}</div>}
            {"isActive" in created && <div><strong>Activo:</strong> {String(created.isActive)}</div>}
            {"updatedAt" in created && created.updatedAt && <div><strong>Actualizado:</strong> {new Date(created.updatedAt).toLocaleString("es-AR")}</div>}
            <div><strong>Flags:</strong> preorder={String(created.isPreorder)} • featured={String(created.isFeatured)}</div>
          </div>
          <div className={s.resultLink}>
            <Link href={`/producto/${created._id}`} className={s.a}>Ver producto</Link>
          </div>
        </section>
      )}
    </main>
  );
}
