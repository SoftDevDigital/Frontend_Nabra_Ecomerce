// src/app/admin/products/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Product = {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  sizes: string[];
  images?: string[]; // puede venir vacío
  stock: number;
  isPreorder: boolean;
  isFeatured: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
};

type ProductsResponse =
  | { success: true; data: { products: Product[]; total: number; limit: number; offset: number }; message?: string }
  | { success: true; data: Product[]; message?: string } // ⬅️ para /admin/products/low-stock
  // ✅ NUEVO: por si alguna ruta (o bug) devuelve un único producto plano en data
  | { success: true; data: Product; message?: string }
  | { success: false; message: string };

/* ⬇️⬇️ NUEVO: tipos para promociones (según /admin/promotions) */
type Promotion = {
  _id: string;
  name?: string;
  description?: string;
  type?: string;               // porcentaje, fijo, etc. (opcional por si tu backend lo usa)
  discountPercent?: number;    // opcional
  discountAmount?: number;     // opcional
  startDate?: string;          // ISO
  endDate?: string;            // ISO
  active?: boolean;
  products?: string[] | Product[]; // ids o productos, depende del backend
  [k: string]: any;
};
type PromotionsResponse =
  | { success: true; data: { promotions: Promotion[]; total: number; limit: number; offset: number }; message?: string }
  | { success: false; message: string };
/* ⬆️⬆️ FIN tipos promociones */

/* ========= Helpers: detectar admin desde el JWT (mismo patrón que ya usás) ========== */
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

/* ========= Utils UI ========= */
// ✅ CAMBIO: base por defecto al puerto 3001 (tu API)
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.nabra.mx";

// ✅ NUEVO: heurística simple para filtrar URLs que no son imagen
function isLikelyImageUrl(u?: string) {
  if (!u) return false;
  if (!/^https?:\/\//i.test(u)) return true; // podría ser relativo a back de medios
  if (/\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(u)) return true;
  if (/[?&](width|height|format|v)=/i.test(u) && !/\.html?($|\?)/i.test(u)) return true;
  return !/\.html?($|\?)/i.test(u) && !/\.php($|\?)/i.test(u);
}

function absImageUrl(u?: string): string | null {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return isLikelyImageUrl(u) ? u : null;
  // si viene un path/ID relativo, lo resolvemos contra el API base
  const built = `${BASE}/${u}`.replace(/([^:]\/)\/+/g, "$1");
  return isLikelyImageUrl(built) ? built : null;
}

// ✅ CAMBIO: moneda y locale alineados a ARS
function fmtMoney(n: number, currency = (process.env.NEXT_PUBLIC_CURRENCY || "ARS")) {
  try {
    const locale = process.env.NEXT_PUBLIC_LOCALE || "es-AR";
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch { return iso; }
}

type Mode = "all" | "low" | "promos"; // ⬅️ AMPLIADO

export default function AdminProductsPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);   // default alineado al backend
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ⬇️ NUEVO: modo y pool para low-stock
  const [mode, setMode] = useState<Mode>("all");
  const [lowPool, setLowPool] = useState<Product[]>([]);

  // ⬇️⬇️ NUEVO: estado para promociones
  const [promos, setPromos] = useState<Promotion[]>([]);
  // usamos los mismos total/limit/offset para la paginación visual; sólo cambiamos su fuente según el modo
  /* ⬆️⬆️ FIN promos */

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

  // ✅ NUEVO: parser tolerante para distintas formas del payload
  function coerceAdminProductsPayload(r: ProductsResponse, fallbackLimit: number, fallbackOffset: number) {
    const data: any = (r as any).data;
    if (Array.isArray(data)) {
      return { products: data as Product[], total: data.length, limit: fallbackLimit, offset: fallbackOffset };
    }
    if (data && Array.isArray(data.products)) {
      const { products, total, limit, offset } = data;
      return {
        products: products as Product[],
        total: typeof total === "number" ? total : (products?.length ?? 0),
        limit: typeof limit === "number" ? limit : fallbackLimit,
        offset: typeof offset === "number" ? offset : fallbackOffset,
      };
    }
    // caso extraño: vino un solo producto plano en data
    if (data && typeof data === "object" && data._id && data.name) {
      return { products: [data as Product], total: 1, limit: fallbackLimit, offset: fallbackOffset };
    }
    // fallback
    return { products: [] as Product[], total: 0, limit: fallbackLimit, offset: fallbackOffset };
  }

  async function loadProducts(nextOffset = offset, nextLimit = limit) {
    if (!isAdmin) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch<ProductsResponse>(`/admin/products?limit=${nextLimit}&offset=${nextOffset}`, {
        method: "GET",
      });
      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudieron obtener los productos");
      }

      const coerced = coerceAdminProductsPayload(r, nextLimit, nextOffset);
      setProducts(coerced.products ?? []);
      setTotal(coerced.total ?? 0);
      setLimit(coerced.limit ?? nextLimit);
      setOffset(coerced.offset ?? nextOffset);
    } catch (e: any) {
      const m = e?.message || "No se pudieron obtener los productos";
      setErr(m);
      if (/(no autenticado|credenciales|401|unauthorized)/i.test(m)) {
        window.location.href = "/auth?redirectTo=/admin/products";
      }
    } finally {
      setLoading(false);
    }
  }

  // ⬇️ NUEVO: loader para low-stock (sin paginación de backend)
  async function loadLowStock() {
    if (!isAdmin) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch<ProductsResponse>(`/admin/products/low-stock`, { method: "GET" });
      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudo obtener el stock bajo");
      }
      const data: any = (r as any).data;
      const arr: Product[] = Array.isArray(data)
        ? data
        : (Array.isArray(data?.products) ? data.products : (data && data._id ? [data] : []));
      setLowPool(arr);
      setTotal(arr.length);
      setOffset(0);
      setProducts(arr.slice(0, limit)); // primera "página" client-side
    } catch (e: any) {
      const m = e?.message || "No se pudo obtener el stock bajo";
      setErr(m);
      if (/(no autenticado|credenciales|401|unauthorized)/i.test(m)) {
        window.location.href = "/auth?redirectTo=/admin/products";
      }
    } finally {
      setLoading(false);
    }
  }

  /* ⬇️⬇️ NUEVO: loader para /admin/promotions con paginación del backend */
  async function loadPromotions(nextOffset = 0, nextLimit = limit) {
    if (!isAdmin) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch<PromotionsResponse>(`/admin/promotions?limit=${nextLimit}&offset=${nextOffset}`, {
        method: "GET",
      });
      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudieron obtener las promociones");
      }
      const { promotions, total, limit: l, offset: o } = r.data;
      setPromos(promotions ?? []);
      setTotal(total ?? 0);
      setLimit(l ?? nextLimit);
      setOffset(o ?? nextOffset);
    } catch (e: any) {
      const m = e?.message || "No se pudieron obtener las promociones";
      setErr(m);
      if (/(no autenticado|credenciales|401|unauthorized)/i.test(m)) {
        window.location.href = "/auth?redirectTo=/admin/products";
      }
    } finally {
      setLoading(false);
    }
  }
  /* ⬆️⬆️ FIN promos */

  useEffect(() => {
    if (isAdmin) {
      // carga inicial según modo
      if (mode === "all") {
        loadProducts(0, limit);
      } else if (mode === "low") {
        loadLowStock();
      } else {
        loadPromotions(0, limit);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, mode]);

  // ⬇️ NUEVO: cuando estamos en modo "low", la paginación es client-side (slice al pool)
  useEffect(() => {
    if (mode === "low") {
      setProducts(lowPool.slice(offset, offset + limit));
    }
  }, [mode, lowPool, offset, limit]);

  const page = useMemo(() => Math.floor(offset / Math.max(1, limit)) + 1, [offset, limit]);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / Math.max(1, limit))), [total, limit]);

  function goPrev() {
    if (mode === "all") {
      const next = Math.max(0, offset - limit);
      if (next !== offset) loadProducts(next, limit);
    } else if (mode === "low") {
      const next = Math.max(0, offset - limit);
      setOffset(next);
    } else {
      const next = Math.max(0, offset - limit);
      if (next !== offset) loadPromotions(next, limit);
    }
  }
  function goNext() {
    if (mode === "all") {
      const next = offset + limit;
      if (next < total) loadProducts(next, limit);
    } else if (mode === "low") {
      const next = offset + limit;
      if (next < total) setOffset(next);
    } else {
      const next = offset + limit;
      if (next < total) loadPromotions(next, limit);
    }
  }
  function changeLimit(newLimit: number) {
    const l = Number.isFinite(newLimit) && newLimit > 0 ? newLimit : 20;
    if (mode === "all") {
      // resetear a primera página contra backend
      loadProducts(0, l);
    } else if (mode === "low") {
      // client-side
      setLimit(l);
      setOffset(0);
    } else {
      loadPromotions(0, l);
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Productos (admin)</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Link href="/admin/dashboard" style={{ opacity: 0.8 }}>Dashboard</Link>
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
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => (mode === "all" ? loadProducts(offset, limit) : mode === "low" ? loadLowStock() : loadPromotions(offset, limit))}
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

            {/* ⬇️ NUEVO: toggles de modo */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setMode("all")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: mode === "all" ? "#eef" : "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
                title="Ver todos los productos"
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setMode("low")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: mode === "low" ? "#eef" : "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
                title="Ver productos con stock bajo"
              >
                Stock bajo
              </button>
              {/* ⬇️⬇️ NUEVO: botón de promociones */}
              <button
                type="button"
                onClick={() => setMode("promos")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: mode === "promos" ? "#eef" : "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
                title="Ver promociones"
              >
                Promociones
              </button>
            </div>

            <div style={{ opacity: 0.85 }}>
              {mode === "low" ? "Total (stock bajo)" : mode === "promos" ? "Total (promos)" : "Total"}: <strong>{total}</strong>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 13, opacity: 0.8 }}>Por página:</label>
              <select
                value={limit}
                onChange={(e) => changeLimit(Number(e.target.value))}
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
              >
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>

              <div style={{ opacity: 0.8 }}>Página <strong>{page}</strong> de <strong>{pageCount}</strong></div>

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

              <Link
                href="/admin/productos/nuevo"
                style={{
                  marginLeft: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                  fontWeight: 700,
                }}
                title="Crear producto"
              >
                + Crear producto
              </Link>
            </div>
          </div>

          {loading && <p>Cargando…</p>}
          {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}

          {/* ===================== LISTA DE PROMOCIONES ===================== */}
          {mode === "promos" && !loading && !err && (
            <>
              {promos.length === 0 ? (
                <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
                  <p style={{ margin: 0 }}>No hay promociones.</p>
                </div>
              ) : (
                <section
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 12,
                  }}
                >
                  {promos.map((pm) => {
                    const active = pm.active ?? (pm.startDate && pm.endDate
                      ? Date.now() >= new Date(pm.startDate).getTime() && Date.now() <= new Date(pm.endDate).getTime()
                      : undefined);
                    const discount =
                      typeof pm.discountPercent === "number"
                        ? `${pm.discountPercent}%`
                        : (typeof pm.discountAmount === "number" ? fmtMoney(pm.discountAmount) : "—");
                    const productsCount = Array.isArray(pm.products) ? pm.products.length : 0;

                    return (
                      <article
                        key={pm._id}
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
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{pm.name || "(Promo)"}</div>
                          {typeof active === "boolean" && (
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 12,
                                background: active ? "#e8f7ee" : "#f7e8e8",
                                border: `1px solid ${active ? "#b8e2c4" : "#e2b8b8"}`,
                              }}
                              title={active ? "Activa" : "Inactiva"}
                            >
                              {active ? "Activa" : "Inactiva"}
                            </span>
                          )}
                        </div>

                        {pm.description && (
                          <div style={{ fontSize: 13, color: "#555" }}>{pm.description}</div>
                        )}

                        <div style={{ fontSize: 13, color: "#666" }}>
                          Tipo: <strong>{pm.type || "—"}</strong>
                          &nbsp;•&nbsp; Descuento: <strong>{discount}</strong>
                        </div>

                        <div style={{ fontSize: 12, color: "#666" }}>
                          Vigencia: {fmtDate(pm.startDate)} — {fmtDate(pm.endDate)}
                        </div>

                        <div style={{ fontSize: 12, color: "#666" }}>
                          Productos: <strong>{productsCount}</strong>
                        </div>

                        {/* acciones/links, ajustá rutas si tenés páginas de edición de promos */}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                          <Link href={`/admin/promociones/${pm._id}`} style={{ textDecoration: "underline" }}>
                            Ver/editar
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </section>
              )}
            </>
          )}
          {/* =================== FIN LISTA DE PROMOCIONES =================== */}

          {/* Productos: se muestran cuando NO estamos en modo promos */}
          {mode !== "promos" && !loading && !err && products.length === 0 && (
            <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
              <p style={{ margin: 0 }}>No hay productos.</p>
            </div>
          )}

          {mode !== "promos" && !loading && !err && products.length > 0 && (
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              {products.map((p) => {
                const firstImg = absImageUrl(p.images?.[0] || "");
                const lowStock = typeof p.stock === "number" && p.stock <= 5;
                return (
                  <article
                    key={p._id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 12,
                      background: "#fff",
                      padding: 12,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "4 / 3",
                        borderRadius: 10,
                        border: "1px solid #f0f0f0",
                        background: "#fafafa",
                        overflow: "hidden",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {firstImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstImg}
                          alt={p.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ fontSize: 12, color: "#999" }}>Sin imagen</div>
                      )}
                    </div>

                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                      <div style={{ fontSize: 13, color: "#666" }}>
                        Cat: <strong>{p.category}</strong>
                        &nbsp;•&nbsp; Precio: <strong>{fmtMoney(p.price)}</strong>
                      </div>
                      <div style={{ fontSize: 13, color: lowStock ? "#b00020" : "#666" }}>
                        Stock: <strong>{p.stock}</strong>{lowStock ? " (bajo)" : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        Talles: {p.sizes?.length ? p.sizes.join(", ") : "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        Flags: preorder=<strong>{String(p.isPreorder)}</strong> • featured=<strong>{String(p.isFeatured)}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        Creado: {fmtDate(p.createdAt)}{p.updatedAt ? ` • Editado: ${fmtDate(p.updatedAt)}` : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                      {/* Ajustá estas rutas si tu front usa otras paths */}
                      <Link href={`/producto/${p._id}`} style={{ textDecoration: "underline" }}>
                        Ver público
                      </Link>
                      <Link href={`/admin/productos/editar/${p._id}`} style={{ textDecoration: "underline" }}>
                        Editar
                      </Link>
                    </div>
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
