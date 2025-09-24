"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { resolveImageUrls } from "@/lib/resolveImageUrls";
import s from "./NuevoProducto.module.css";

type ProductIn = {
  name: string;
  description: string;
  price: number;
  category: string;
  sizes: string[];
  images?: string[];
  stock: number;
  isPreorder?: boolean;
  isFeatured?: boolean;
  specifications?: {
    brand?: string;
    model?: string;
    color?: string;
    [k: string]: any;
  };
};

type ProductOut = {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  sizes: string[];
  images?: string[];
  stock: number;
  isPreorder: boolean;
  isFeatured: boolean;
  isActive?: boolean;
  createdAt?: string;
  [k: string]: any;
};

type CreateResponse =
  | { success: true; data: ProductOut; message?: string }
  | { success: false; message: string }
  | ProductOut;

/* ===== Helpers para detectar admin desde el JWT (gateo UI) ===== */
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
function getBearer(): string | null {
  try {
    return typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
  } catch {
    return null;
  }
}
/* ======================= PROMOS: Types ======================== */
type PromotionType = { id: string; name: string; description: string };
/* =============================================================== */

export default function AdminCreateProductPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [category, setCategory] = useState("");
  const [sizesText, setSizesText] = useState("");          // CSV -> array
  const [imagesText, setImagesText] = useState("");        // CSV opcional -> array
  const [stock, setStock] = useState<number | "">("");
  const [isPreorder, setIsPreorder] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);

  // 🔹 NUEVO: specifications (según contrato)
  const [specBrand, setSpecBrand] = useState("");
  const [specModel, setSpecModel] = useState("");
  const [specColor, setSpecColor] = useState("");

  // UI state
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [created, setCreated] = useState<ProductOut | null>(null);
  const [createdImgs, setCreatedImgs] = useState<string[]>([]);

  // 🔹 NUEVO: tipos de promociones (GET /promotions/types)
  const [promoTypes, setPromoTypes] = useState<PromotionType[]>([]);
  const [promoTypesLoading, setPromoTypesLoading] = useState(false);
  const [promoTypesErr, setPromoTypesErr] = useState<string | null>(null);

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

  useEffect(() => {
    // Cargar tipos de promociones (público)
    let abort = false;
    (async () => {
      setPromoTypesLoading(true);
      setPromoTypesErr(null);
      try {
        const r = await apiFetch<{ types: PromotionType[] }>("/promotions/types", { method: "GET" });
        if (!abort) setPromoTypes(r.types || []);
      } catch (e: any) {
        if (!abort) setPromoTypesErr(e?.message || "No se pudieron cargar los tipos de promoción");
      } finally {
        if (!abort) setPromoTypesLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  function parseCsvToArray(input: string): string[] {
    return (input || "")
      .split(/[,\n]/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function formatDate(iso?: string) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(d);
    } catch {
      return iso || "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCreated(null);
    setCreatedImgs([]);

    // Validaciones mínimas
    const p = Number(price);
    const sN = Number(stock);
    if (!name.trim() || !description.trim() || !category.trim()) {
      setMsg("Completá nombre, descripción y categoría.");
      return;
    }
    if (!Number.isFinite(p) || p <= 0) {
      setMsg("Precio inválido.");
      return;
    }
    if (!Number.isFinite(sN) || sN < 0) {
      setMsg("Stock inválido.");
      return;
    }
    const sizes = parseCsvToArray(sizesText);
    if (!sizes.length) {
      setMsg("Ingresá al menos un talle en “sizes”.");
      return;
    }
    const images = parseCsvToArray(imagesText);

    // 🔹 NUEVO: armar specifications sólo si hay datos
    const specifications: ProductIn["specifications"] | undefined =
      specBrand || specModel || specColor
        ? {
            ...(specBrand ? { brand: specBrand.trim() } : {}),
            ...(specModel ? { model: specModel.trim() } : {}),
            ...(specColor ? { color: specColor.trim() } : {}),
          }
        : undefined;

    const body: ProductIn = {
      name: name.trim(),
      description: description.trim(),
      price: p,
      category: category.trim(),
      sizes,
      stock: sN,
      ...(images.length ? { images } : {}),
      ...(isPreorder ? { isPreorder: true } : {}),
      ...(isFeatured ? { isFeatured: true } : {}),
      ...(specifications ? { specifications } : {}),
    };

    setCreating(true);
    try {
      const bearer = getBearer();
      const r = await apiFetch<CreateResponse>("/products", {
        method: "POST",
        // 🔹 Headers para JSON + Auth (por si apiFetch no los agrega)
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(body),
      });

      // Soportar:
      // - { success: true, data: {...} }
      // - objeto plano con _id (201)
      // - { success: false, message: "..." }
      let createdData: ProductOut | null = null;
      if (typeof (r as any)?.success === "boolean") {
        const rr = r as Exclude<CreateResponse, ProductOut>;
        if (!rr.success) throw new Error(rr.message || "No se pudo crear el producto");
        createdData = rr.data;
      } else {
        const plain = r as ProductOut;
        if (plain && plain._id) {
          createdData = plain;
        } else {
          throw new Error("Respuesta inesperada del servidor");
        }
      }

      setCreated(createdData);
      setMsg("Producto creado ✅");

      try {
        const urls = await resolveImageUrls(createdData.images ?? []);
        setCreatedImgs(urls);
      } catch {
        // sin romper la UI
      }

      // limpiar formulario (mantengo flags y specs)
      setName("");
      setDescription("");
      setPrice("");
      setCategory("");
      setSizesText("");
      setImagesText("");
      setStock("");
    } catch (err: any) {
      const m = String(err?.message || "No se pudo crear el producto");
      setMsg(m);
      // redirigir en 401/403 si el backend devuelve ese texto
      if (/(401|403|no autenticado|credenciales|unauthorized|forbidden)/i.test(m)) {
        window.location.href = "/auth?redirectTo=/admin/productos/nuevo";
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className={s.page}>
      <div className={s.container}>
        <header className={s.headerRow}>
          <h1 className={s.h1}>Crear producto</h1>
          <Link href="/" className={s.backLink}>Volver al inicio</Link>
        </header>

        {!isAdmin && (
          <div className={s.guard}>
            <p className={s.p0}>Para crear productos necesitás permisos de administrador.</p>
          </div>
        )}

        {isAdmin && (
          <form onSubmit={handleSubmit} className={s.card}>
            <div className={s.row2}>
              <label className={s.label}>
                <span>Nombre *</span>
                <input
                  className={s.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Wireless Headphones"
                />
              </label>

              <label className={s.label}>
                <span>Categoría *</span>
                <input
                  className={s.input}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  placeholder="Electronics"
                />
              </label>
            </div>

            <label className={s.label}>
              <span>Descripción *</span>
              <textarea
                className={s.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                placeholder="High-quality wireless headphones with noise cancellation"
              />
            </label>

            <div className={s.row3}>
              <label className={s.label}>
                <span>Precio *</span>
                <input
                  className={s.input}
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  placeholder="1999.99"
                />
              </label>

              <label className={s.label}>
                <span>Stock *</span>
                <input
                  className={s.input}
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  placeholder="50"
                />
              </label>

              <label className={s.label}>
                <span>Talles (CSV) *</span>
                <input
                  className={s.input}
                  value={sizesText}
                  onChange={(e) => setSizesText(e.target.value)}
                  required
                  placeholder="35,36,37,38"
                />
              </label>
            </div>

            <label className={s.label}>
              <span>Imágenes (CSV, opcional)</span>
              <input
                className={s.input}
                value={imagesText}
                onChange={(e) => setImagesText(e.target.value)}
                placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
              />
              <small className={s.hint}>
                Acepta IDs de media o URLs completas. Dejar vacío si no aplica.
              </small>
            </label>

            {/* 🔹 NUEVO: specifications */}
            <fieldset className={s.fieldset}>
              <legend className={s.legend}>Specifications (opcional)</legend>
              <div className={s.row3}>
                <label className={s.label}>
                  <span>Brand</span>
                  <input
                    className={s.input}
                    value={specBrand}
                    onChange={(e) => setSpecBrand(e.target.value)}
                    placeholder="TechBrand"
                  />
                </label>
                <label className={s.label}>
                  <span>Model</span>
                  <input
                    className={s.input}
                    value={specModel}
                    onChange={(e) => setSpecModel(e.target.value)}
                    placeholder="WH-1000"
                  />
                </label>
                <label className={s.label}>
                  <span>Color</span>
                  <input
                    className={s.input}
                    value={specColor}
                    onChange={(e) => setSpecColor(e.target.value)}
                    placeholder="Black"
                  />
                </label>
              </div>
            </fieldset>

            <div className={s.flagsRow}>
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={isPreorder}
                  onChange={(e) => setIsPreorder(e.target.checked)}
                />
                <span>isPreorder</span>
              </label>

              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                />
                <span>isFeatured</span>
              </label>

              <button
                type="submit"
                disabled={creating}
                className={`${s.btn} ${creating ? s.btnDisabled : s.btnPrimary}`}
                title="Crear producto (POST /products)"
              >
                {creating ? "Creando…" : "Crear producto"}
              </button>
            </div>

            {msg && <p className={msg.includes("✅") ? s.msgOk : s.msgErr}>{msg}</p>}
          </form>
        )}

        {/* 🔹 NUEVO: Panel de tipos de promociones */}
        <section className={s.card} style={{ marginTop: 16 }}>
          <div className={s.sectionTitle}>Tipos de promociones (backend)</div>
          {promoTypesLoading && <p className={s.p0}>Cargando tipos…</p>}
          {!promoTypesLoading && promoTypesErr && <p className={s.msgErr}>{promoTypesErr}</p>}
          {!promoTypesLoading && !promoTypesErr && (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {promoTypes.map((t) => (
                <li key={t.id}>
                  <strong>{t.name}</strong> <code style={{ opacity: 0.7 }}>({t.id})</code>
                  <div style={{ fontSize: 13, color: "#666" }}>{t.description}</div>
                </li>
              ))}
              {promoTypes.length === 0 && <li>No hay tipos definidos.</li>}
            </ul>
          )}
        </section>

        {created && (
          <section className={s.successCard}>
            <div className={s.successTitle}>Producto creado</div>
            <div className={s.kv}>
              <div className={s.kvRow}><div className={s.kvKey}>ID</div><div className={s.kvVal}>{created._id}</div></div>
              <div className={s.kvRow}><div className={s.kvKey}>Nombre</div><div className={s.kvVal}>{created.name}</div></div>
              <div className={s.kvRow}><div className={s.kvKey}>Precio</div><div className={s.kvVal}>{created.price}</div></div>
              <div className={s.kvRow}><div className={s.kvKey}>Categoría</div><div className={s.kvVal}>{created.category}</div></div>
              <div className={s.kvRow}><div className={s.kvKey}>Stock</div><div className={s.kvVal}>{created.stock}</div></div>
              <div className={s.kvRow}><div className={s.kvKey}>Talles</div><div className={s.kvVal}>{created.sizes?.join(", ")}</div></div>
              {!!created.images?.length && (
                <div className={s.kvRow}><div className={s.kvKey}>Imágenes</div><div className={s.kvVal}>{created.images.join(", ")}</div></div>
              )}
              {"isActive" in created && (
                <div className={s.kvRow}><div className={s.kvKey}>Activo</div><div className={s.kvVal}>{String(created.isActive)}</div></div>
              )}
              {"createdAt" in created && created.createdAt && (
                <div className={s.kvRow}><div className={s.kvKey}>Creado</div><div className={s.kvVal}>{formatDate(created.createdAt)}</div></div>
              )}
              <div className={s.kvRow}><div className={s.kvKey}>Flags</div><div className={s.kvVal}>preorder={String(created.isPreorder)} • featured={String(created.isFeatured)}</div></div>
            </div>

            {!!createdImgs.length && (
              <div className={s.gallery}>
                {createdImgs.map((src, i) => (
                  <img key={src + i} src={src} alt={`${created.name} ${i + 1}`} className={s.thumb}/>
                ))}
              </div>
            )}

            <div className={s.viewRow}>
              <Link href={`/producto/${created._id}`} className={s.viewLink}>
                Ver producto
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
