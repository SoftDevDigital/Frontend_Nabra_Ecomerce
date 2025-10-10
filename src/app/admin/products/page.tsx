// src/app/admin/products/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import s from "./AdminProducts.module.css";

type Product = {
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
  updatedAt?: string;
  [k: string]: any;
};

type ProductsResponse =
  | { success: true; data: { products: Product[]; total: number; limit: number; offset: number }; message?: string }
  | { success: true; data: Product[]; message?: string }
  | { success: false; message: string };

type Promotion = {
  _id: string;
  name?: string;
  description?: string;
  type?: string;
  discountPercent?: number;
  discountAmount?: number;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  products?: string[] | Product[];
  [k: string]: any;
};
type PromotionsResponse =
  | { success: true; data: { promotions: Promotion[]; total: number; limit: number; offset: number }; message?: string }
  | { success: false; message: string };

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
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";
function absImageUrl(u?: string): string | null {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${BASE}/${u}`.replace(/([^:]\/)\/+/g, "$1");
}
function fmtMoney(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch {
    return iso!;
  }
}

type Mode = "all" | "low" | "promos";

export default function AdminProductsPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("all");
  const [lowPool, setLowPool] = useState<Product[]>([]);

  const [promos, setPromos] = useState<Promotion[]>([]);

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

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
      const { products, total, limit: l, offset: o } = (r as Extract<
        ProductsResponse,
        { success: true; data: { products: Product[]; total: number; limit: number; offset: number } }
      >).data;
      setProducts(products ?? []);
      setTotal(total ?? 0);
      setLimit(l ?? nextLimit);
      setOffset(o ?? nextOffset);
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

  async function loadLowStock() {
    if (!isAdmin) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch<ProductsResponse>(`/admin/products/low-stock`, { method: "GET" });
      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudo obtener el stock bajo");
      }
      const arr = Array.isArray(r.data) ? (r.data as Product[]) : (r as any).data?.products ?? [];
      setLowPool(arr);
      setTotal(arr.length);
      setOffset(0);
      setProducts(arr.slice(0, limit));
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

  useEffect(() => {
    if (!isAdmin) return;
    if (mode === "all") loadProducts(0, limit);
    else if (mode === "low") loadLowStock();
    else loadPromotions(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, mode]);

  useEffect(() => {
    if (mode === "low") setProducts(lowPool.slice(offset, offset + limit));
  }, [mode, lowPool, offset, limit]);

  const page = useMemo(() => Math.floor(offset / Math.max(1, limit)) + 1, [offset, limit]);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / Math.max(1, limit))), [total, limit]);

  function goPrev() {
    const next = Math.max(0, offset - limit);
    if (mode === "low") setOffset(next);
    else if (next !== offset) (mode === "all" ? loadProducts : loadPromotions)(next, limit);
  }
  function goNext() {
    const next = offset + limit;
    if (next >= total) return;
    if (mode === "low") setOffset(next);
    else (mode === "all" ? loadProducts : loadPromotions)(next, limit);
  }
  function changeLimit(newLimit: number) {
    const l = Number.isFinite(newLimit) && newLimit > 0 ? newLimit : 20;
    if (mode === "all") loadProducts(0, l);
    else if (mode === "low") {
      setLimit(l);
      setOffset(0);
    } else loadPromotions(0, l);
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Productos (admin)</h1>
        <nav className={s.headerLinks}>
          <Link href="/admin/dashboard">Dashboard</Link>
          <Link href="/admin/pedidos">Pedidos</Link>
          <Link href="/admin/media">Medios</Link>
        </nav>
      </header>

      {!isAdmin && (
        <div className={s.notice}>
          <p className={s.m0}>Necesitás permisos de administrador.</p>
        </div>
      )}

      {isAdmin && (
        <>
          <div className={s.toolbar}>
            <button
              type="button"
              onClick={() =>
                mode === "all" ? loadProducts(offset, limit) : mode === "low" ? loadLowStock() : loadPromotions(offset, limit)
              }
              className={s.btn}
            >
              Actualizar
            </button>

            <div className={s.toggles}>
              <button type="button" className={`${s.toggle} ${mode === "all" ? s.toggleActive : ""}`} onClick={() => setMode("all")}>
                Todos
              </button>
              <button type="button" className={`${s.toggle} ${mode === "low" ? s.toggleActive : ""}`} onClick={() => setMode("low")}>
                Stock bajo
              </button>
              <button type="button" className={`${s.toggle} ${mode === "promos" ? s.toggleActive : ""}`} onClick={() => setMode("promos")}>
                Promociones
              </button>
            </div>

            <div className={s.counter}>
              {mode === "low" ? "Total (stock bajo)" : mode === "promos" ? "Total (promos)" : "Total"}: <strong>{total}</strong>
            </div>

            <div className={s.pager}>
              <label className={s.pagerLabel}>Por página:</label>
              <select value={limit} onChange={(e) => changeLimit(Number(e.target.value))} className={s.select}>
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>

              <div className={s.pageInfo}>
                Página <strong>{page}</strong> de <strong>{pageCount}</strong>
              </div>

              <button type="button" onClick={goPrev} disabled={offset <= 0} className={s.btn}>
                ◀
              </button>
              <button type="button" onClick={goNext} disabled={offset + limit >= total} className={s.btn}>
                ▶
              </button>

              <Link href="/admin/productos/nuevo" className={`${s.btn} ${s.btnPrimary}`} title="Crear producto">
                + Crear producto
              </Link>
            </div>
          </div>

          {loading && <p className={s.muted}>Cargando…</p>}
          {err && !loading && <p className={s.error}>{err}</p>}

          {/* LISTA PROMOS */}
          {mode === "promos" && !loading && !err && (
            <>
              {promos.length === 0 ? (
                <div className={s.empty}>
                  <p className={s.m0}>No hay promociones.</p>
                </div>
              ) : (
                <section className={s.gridPromos}>
                  {promos.map((pm) => {
                    const active =
                      pm.active ??
                      (pm.startDate && pm.endDate
                        ? Date.now() >= new Date(pm.startDate).getTime() && Date.now() <= new Date(pm.endDate).getTime()
                        : undefined);
                    const discount =
                      typeof pm.discountPercent === "number"
                        ? `${pm.discountPercent}%`
                        : typeof pm.discountAmount === "number"
                        ? fmtMoney(pm.discountAmount, "USD")
                        : "—";
                    const productsCount = Array.isArray(pm.products) ? pm.products.length : 0;

                    return (
                      <article key={pm._id} className={s.card}>
                        <div className={s.cardHead}>
                          <div className={s.cardTitle}>{pm.name || "(Promo)"}</div>
                          {typeof active === "boolean" && (
                            <span className={`${s.badge} ${active ? s.badgeOk : s.badgeWarn}`}>{active ? "Activa" : "Inactiva"}</span>
                          )}
                        </div>

                        {pm.description && <div className={s.cardDesc}>{pm.description}</div>}

                        <div className={s.cardRow}>
                          Tipo: <strong>{pm.type || "—"}</strong> • Descuento: <strong>{discount}</strong>
                        </div>
                        <div className={s.cardSub}>Vigencia: {fmtDate(pm.startDate)} — {fmtDate(pm.endDate)}</div>
                        <div className={s.cardSub}>Productos: <strong>{productsCount}</strong></div>

                        <div className={s.cardActions}>
                          <Link href={`/admin/promociones/${pm._id}`} className={s.link}>
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

          {/* LISTA PRODUCTOS */}
          {mode !== "promos" && !loading && !err && products.length === 0 && (
            <div className={s.empty}>
              <p className={s.m0}>No hay productos.</p>
            </div>
          )}

          {mode !== "promos" && !loading && !err && products.length > 0 && (
            <section className={s.gridProducts}>
              {products.map((p) => {
                const firstImg = absImageUrl(p.images?.[0] || "");
                const lowStock = typeof p.stock === "number" && p.stock <= 5;
                return (
                  <article key={p._id} className={s.card}>
                    <div className={s.thumb}>
                      {firstImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={firstImg} alt={p.name} className={s.thumbImg} />
                      ) : (
                        <div className={s.thumbEmpty}>Sin imagen</div>
                      )}
                    </div>

                    <div className={s.cardBody}>
                      <div className={s.cardTitle}>{p.name}</div>
                      <div className={s.cardRow}>
                        Cat: <strong>{p.category}</strong> • Precio: <strong>{fmtMoney(p.price, "USD")}</strong>
                      </div>
                      <div className={`${s.cardRow} ${lowStock ? s.warn : ""}`}>
                        Stock: <strong>{p.stock}</strong> {lowStock ? "(bajo)" : ""}
                      </div>
                      <div className={s.cardSub}>Talles: {p.sizes?.length ? p.sizes.join(", ") : "—"}</div>
                      <div className={s.cardSub}>
                        Flags: preorder=<strong>{String(p.isPreorder)}</strong> • featured=<strong>{String(p.isFeatured)}</strong>
                      </div>
                      <div className={s.cardSub}>
                        Creado: {fmtDate(p.createdAt)} {p.updatedAt ? `• Editado: ${fmtDate(p.updatedAt)}` : ""}
                      </div>
                    </div>

                    <div className={s.cardActions}>
                      <Link href={`/producto/${p._id}`} className={s.link}>
                        Ver público
                      </Link>
                      <Link href={`/admin/productos/editar/${p._id}`} className={s.link}>
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
