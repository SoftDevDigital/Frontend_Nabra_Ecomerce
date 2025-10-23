// src/app/catalogo/page.tsx
"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  fetchProducts,
  ProductDto,
  fetchProductCategories,
  fetchCategoryStats,
  CategoryStats,
} from "@/lib/productsApi";
import { resolveImageUrls } from "@/lib/resolveImageUrls";
import { addToCart } from "@/lib/cartClient";
import s from "./Catalogo.module.css";
import { useFlyToCart } from "@/app/hooks/useFlyToCart";

function currency(n?: number) {
  if (typeof n !== "number") return "";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}

/* ----- helpers precio ----- */
function hasDiscount(p: ProductDto) {
  const fp = (p as any).finalPrice as number | undefined;
  const base = typeof p.price === "number" ? p.price : (p as any).originalPrice;
  return typeof fp === "number" && typeof base === "number" && fp < base;
}
function basePrice(p: ProductDto) {
  return typeof p.price === "number" ? p.price : (p as any).originalPrice;
}
function displayPrice(p: ProductDto) {
  const fp = (p as any).finalPrice as number | undefined;
  if (hasDiscount(p) && typeof fp === "number") return fp;
  return basePrice(p);
}
function discountPercent(p: ProductDto) {
  const b = basePrice(p);
  const f = (p as any).finalPrice as number | undefined;
  if (typeof b === "number" && typeof f === "number" && f < b) {
    return Math.round((1 - f / b) * 100);
  }
  return 0;
}

/* ----- contador carrito ----- */
async function fetchCartTotalCount(): Promise<number | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
    const token = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
    const res = await fetch(`${API_BASE}/cart/total`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const raw = await res.json();
    const data = raw?.success ? raw.data : raw;
    const count =
      typeof data?.totalQuantity === "number"
        ? data.totalQuantity
        : (typeof data?.totalItems === "number" ? data.totalItems : null);
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}
function emitCartCount(count: number) {
  try {
    localStorage.setItem("cart_count", String(count));
    window.dispatchEvent(new CustomEvent("cart:count", { detail: { count } }));
  } catch {}
}

/* =========================
   WRAPPER con <Suspense>
   ========================= */
export default function CatalogoPage() {
  return (
    <Suspense fallback={<p>Cargando catálogo...</p>}>
      <CatalogoPageInner />
    </Suspense>
  );
}

/* ========================================================= */
function CatalogoPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<{ products: ProductDto[]; total: number; page: number; totalPages: number }>(
    { products: [], total: 0, page: 1, totalPages: 1 }
  );
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const [cats, setCats] = useState<{ category: string; count: number }[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catsErr, setCatsErr] = useState<string | null>(null);

  const [catStats, setCatStats] = useState<CategoryStats | null>(null);
  const [catStatsLoading, setCatStatsLoading] = useState(false);
  const [catStatsErr, setCatStatsErr] = useState<string | null>(null);

  const [addingId, setAddingId] = useState<string | null>(null);
  const [addMsgGlobal, setAddMsgGlobal] = useState<string | null>(null);
  const [sizeById, setSizeById] = useState<Record<string, string>>({});
  const [addMsgById, setAddMsgById] = useState<Record<string, string | null>>({});
  function setCardMsg(id: string, msg: string | null) {
    setAddMsgById((m) => ({ ...m, [id]: msg }));
  }

  /* estado controlado (search/category/size) */
  const [searchTerm, setSearchTerm] = useState<string>(sp.get("search") ?? "");
  const [categoryTerm, setCategoryTerm] = useState<string>(sp.get("category") ?? "");
  const [sizeTerm, setSizeTerm] = useState<string>(sp.get("size") ?? "");

  /* animación */
  const { fly, Portal } = useFlyToCart();

  /* toolbar mobile */
  const [openFilters, setOpenFilters] = useState(false);
  const [openSort, setOpenSort] = useState(false);

  /* sincronizar inputs si cambian los params */
  useEffect(() => {
    const currentSearch = sp.get("search") ?? "";
    setSearchTerm((prev) => (prev === currentSearch ? prev : currentSearch));

    const currentCategory = sp.get("category") ?? "";
    setCategoryTerm((prev) => (prev === currentCategory ? prev : currentCategory));

    const currentSize = sp.get("size") ?? "";
    setSizeTerm((prev) => (prev === currentSize ? prev : currentSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const query = useMemo(() => {
    const page = Number(sp.get("page") || "1");
    const limit = Number(sp.get("limit") || "12");
    const category = sp.get("category") || undefined;
    const search = sp.get("search") || undefined;
    const minPrice = sp.get("minPrice") ? Number(sp.get("minPrice")) : undefined;
    const maxPrice = sp.get("maxPrice") ? Number(sp.get("maxPrice")) : undefined;
    const sortBy = (sp.get("sortBy") as any) || undefined;
    const sortOrder = (sp.get("sortOrder") as any) || undefined;
    const isFeatured = sp.get("isFeatured") ? sp.get("isFeatured") === "true" : undefined;
    const isPreorder = sp.get("isPreorder") ? sp.get("isPreorder") === "true" : undefined;
    const size = sp.get("size") || undefined;
    return { page, limit, category, search, minPrice, maxPrice, sortBy, sortOrder, isFeatured, isPreorder, size };
  }, [sp]);

  /* 👇 FIX #1: forzar un orden estable si el usuario no eligió uno */
  const queryForFetch = useMemo(() => {
    return {
      ...query,
      sortBy: query.sortBy || "createdAt",
      sortOrder: query.sortOrder || "desc",
    };
  }, [query]);

  /* ----- Productos ----- */
  useEffect(() => {
    let abort = false;

    /* 👇 FIX #2: de-duplicar por _id (defensivo) */
    const dedupeById = (arr: ProductDto[]) => {
      const map = new Map<string, ProductDto>();
      for (const p of arr) {
        if (p && p._id) map.set(p._id, p);
      }
      return Array.from(map.values());
    };

    (async () => {
      setLoading(true);
      setErr(null);
      setThumbs({});
      try {
        const res = await fetchProducts(queryForFetch);
        if (abort) return;

        const uniqueProducts = dedupeById(res.products);

        setData({ ...res, products: uniqueProducts });

        const entries = await Promise.all(
          uniqueProducts.map(async (p) => {
            if (p.images?.length) {
              try {
                const urls = await resolveImageUrls(p.images);
                if (urls[0]) return [p._id, urls[0]] as const;
              } catch {}
            }
            return null;
          })
        );

        const validEntries = entries.filter((e): e is [string, string] => e !== null);
        if (!abort) setThumbs(Object.fromEntries(validEntries));
      } catch (e: any) {
        if (!abort) setErr(e?.message || "Error al cargar productos");
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => { abort = true; };
  }, [queryForFetch]);

  /* ----- Categorías ----- */
  useEffect(() => {
    let abort = false;
    (async () => {
      setCatsLoading(true);
      setCatsErr(null);
      try {
        const data = await fetchProductCategories();
        if (!abort) setCats(data);
      } catch (e: any) {
        if (!abort) setCatsErr(e?.message || "Error al cargar categorías");
      } finally {
        if (!abort) setCatsLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  /* ----- Stats por categoría ----- */
  useEffect(() => {
    let abort = false;
    const category = query.category;
    if (!category) {
      setCatStats(null); setCatStatsErr(null); setCatStatsLoading(false);
      return;
    }
    (async () => {
      setCatStatsLoading(true); setCatStatsErr(null);
      try {
        const stats = await fetchCategoryStats(category);
        if (!abort) setCatStats(stats);
      } catch (e: any) {
        if (!abort) setCatStatsErr(e?.message || "Error al cargar estadísticas de la categoría");
      } finally {
        if (!abort) setCatStatsLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [query.category]);

  /* ----- Add rápido ----- */
  async function handleQuickAdd(p: ProductDto) {
    const productId = p._id;
    setAddingId(productId);
    setAddMsgGlobal(null);
    setCardMsg(productId, null);

    try {
      let sizeToSend: string | undefined;
      if (Array.isArray(p.sizes) && p.sizes.length > 0) {
        if (p.sizes.length === 1) sizeToSend = p.sizes[0];
        else {
          const chosen = (sizeById[productId] || "").trim();
          if (!chosen) { setCardMsg(productId, "Elegí un talle para agregar."); return; }
          sizeToSend = chosen;
        }
      }

      await addToCart({ productId, quantity: 1, size: sizeToSend });

      const imgEl = document.querySelector<HTMLImageElement>(`[data-product-img="${productId}"]`);
      const cartEl = document.querySelector<HTMLElement>("[data-cart-target]");
      if (imgEl && cartEl) {
        try {
          // @ts-expect-error opciones opcionales
          fly(imgEl, cartEl, { duration: 700, easing: "ease-out", shrinkTo: 0.2, shadow: true });
        } catch {
          // @ts-ignore
          fly(imgEl, cartEl);
        }
      }

      const newCount = await fetchCartTotalCount();
      if (typeof newCount === "number") emitCartCount(newCount);
      else {
        const prev = Number(localStorage.getItem("cart_count") || "0") || 0;
        emitCartCount(prev + 1);
      }

      setAddMsgGlobal("Producto agregado ✅");
      setCardMsg(productId, "Producto agregado ✅");
    } catch (e: any) {
      const msg = String(e?.message || "No se pudo agregar");
      setAddMsgGlobal(msg);
      setCardMsg(productId, msg);
      if (msg.toLowerCase().includes("no autenticado")) {
        router.push(`/auth?redirectTo=/catalogo`);
      }
    } finally {
      setAddingId(null);
      setTimeout(() => {
        setAddMsgGlobal(null);
        setCardMsg(productId, null);
      }, 2500);
    }
  }

  function setParam(name: string, value?: string) {
    const usp = new URLSearchParams(sp.toString());
    if (value === undefined || value === "") usp.delete(name);
    else usp.set(name, value);
    if (name !== "page") usp.set("page", "1");
    router.replace(`${pathname}?${usp.toString()}`);
  }

  /* Debounces */
  useEffect(() => {
    const id = setTimeout(() => {
      const sanitized = searchTerm.trim();
      setParam("search", sanitized || undefined);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  useEffect(() => {
    const id = setTimeout(() => {
      const sanitized = categoryTerm.trim();
      setParam("category", sanitized || undefined);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryTerm]);

  useEffect(() => {
    const id = setTimeout(() => {
      const sanitized = sizeTerm.trim();
      setParam("size", sanitized || undefined);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeTerm]);

  const { products, total, page, totalPages } = data;
  const totalAll = cats.reduce((acc, c) => acc + (c.count || 0), 0);

  const visibleProducts = data.products;
  const shownCount = data.total;

  return (
    <main className={s.page}>
      <Portal />

      <header className={s.header}>
        <h1 className={s.title}>Catálogo</h1>
        <p className={s.subtitle}>
          {loading ? "Cargando..." : `${visibleProducts.length} de ${shownCount} resultados`}
        </p>
      </header>

      {/* Toolbar mobile */}
      <section className={s.mobileToolbar}>
        <button
          type="button"
          className={s.toolbarBtn}
          onClick={() => { setOpenFilters(v => !v); setOpenSort(false); }}
          aria-expanded={openFilters}
        >
          Filtros <span className={s.chev} aria-hidden>▾</span>
        </button>
        <button
          type="button"
          className={s.toolbarBtn}
          onClick={() => { setOpenSort(v => !v); setOpenFilters(false); }}
          aria-expanded={openSort}
        >
          Ordenar por <span className={s.chev} aria-hidden>▾</span>
        </button>
      </section>

      {openFilters && (
        <section className={s.mobilePanel}>
          <div className={s.searchWrap}>
            <input
              className={`${s.input} ${s.searchInput}`}
              placeholder="Buscar…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {!!searchTerm && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                className={s.clearBtn}
                onClick={() => setSearchTerm("")}
              >
                ✕
              </button>
            )}
          </div>

          <input
            className={s.input}
            placeholder="Categoría (sandalias…)"
            value={categoryTerm}
            onChange={(e) => setCategoryTerm(e.target.value)}
          />

          <input
            className={s.input}
            placeholder="Talle (38, 40…)"
            value={sizeTerm}
            onChange={(e) => setSizeTerm(e.target.value)}
          />

          <div className={s.mobileGrid2}>
            <input
              className={s.input}
              type="number"
              placeholder="Precio mín."
              defaultValue={sp.get("minPrice") ?? ""}
              onBlur={(e) => setParam("minPrice", e.target.value)}
            />
            <input
              className={s.input}
              type="number"
              placeholder="Precio máx."
              defaultValue={sp.get("maxPrice") ?? ""}
              onBlur={(e) => setParam("maxPrice", e.target.value)}
            />
          </div>

          <label className={s.check}>
            <input
              type="checkbox"
              defaultChecked={sp.get("isFeatured") === "true"}
              onChange={(e) => setParam("isFeatured", e.target.checked ? "true" : undefined)}
            />
            Destacados
          </label>

          <label className={s.check}>
            <input
              type="checkbox"
              defaultChecked={sp.get("isPreorder") === "true"}
              onChange={(e) => setParam("isPreorder", e.target.checked ? "true" : undefined)}
            />
            Preventa
          </label>

          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary} ${s.fullW}`}
            onClick={() => setOpenFilters(false)}
          >
            Aplicar
          </button>
        </section>
      )}

      {openSort && (
        <section className={s.mobilePanel}>
          <select
            className={s.select}
            defaultValue={sp.get("sortBy") ?? ""}
            onChange={(e) => setParam("sortBy", e.target.value || undefined)}
          >
            <option value="">Ordenar por…</option>
            <option value="price">Precio</option>
            <option value="name">Nombre</option>
            <option value="createdAt">Recientes</option>
            <option value="relevance">Relevancia</option>
          </select>

          <select
            className={s.select}
            defaultValue={sp.get("sortOrder") ?? "asc"}
            onChange={(e) => setParam("sortOrder", e.target.value)}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>

          <select
            className={s.select}
            defaultValue={sp.get("limit") ?? "12"}
            onChange={(e) => setParam("limit", e.target.value)}
            title="Items por página"
          >
            {[12, 24, 36, 48].map(n => <option key={n} value={n}>{n} / pág.</option>)}
          </select>

          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary} ${s.fullW}`}
            onClick={() => setOpenSort(false)}
          >
            Aplicar
          </button>
        </section>
      )}

      {/* Chips categorías */}
      <section className={s.chips}>
        <button
          onClick={() => { setCategoryTerm(""); setParam("category", undefined); }}
          className={`${s.chip} ${!sp.get("category") ? s.chipActive : ""}`}
          title={`Todas${cats.length ? "" : ""}`}
        >
          Todas
        </button>

        {catsLoading && <span className={s.muted}>Cargando categorías…</span>}
        {!catsLoading && catsErr && <span className={s.error}>{catsErr}</span>}

        {!catsLoading && !catsErr && cats.map(c => {
          const active = (sp.get("category") ?? "") === c.category;
          return (
            <button
              key={c.category}
              onClick={() => { setCategoryTerm(c.category); setParam("category", c.category); }}
              className={`${s.chip} ${active ? s.chipActive : ""}`}
              title={`${c.category} (${c.count})`}
            >
              {c.category} · {c.count}
            </button>
          );
        })}
      </section>

      {/* Stats de categoría (opcional) */}
      {sp.get("category") && (
        <section className={`${s.statsCard} ${s.hideCatStats}`}>
          {catStatsLoading && <p className={s.m0}>Cargando estadísticas…</p>}
          {!catStatsLoading && catStatsErr && <p className={`${s.m0} ${s.error}`}>{catStatsErr}</p>}
          {!catStatsLoading && !catStatsErr && catStats && (
            <div className={s.statsGrid}>
              <div><div className={s.k}>Categoría</div><div className={s.v}>{catStats.category}</div></div>
              <div><div className={s.k}>Productos</div><div className={s.v}>{catStats.totalProducts}</div></div>
              <div><div className={s.k}>Precio mín.</div><div className={s.v}>{currency(catStats.priceRange?.min)}</div></div>
              <div><div className={s.k}>Precio máx.</div><div className={s.v}>{currency(catStats.priceRange?.max)}</div></div>
              <div><div className={s.k}>Promedio</div><div className={s.v}>{currency(catStats.averagePrice)}</div></div>
              <div><div className={s.k}>Talles disp.</div>
                <div className={s.v}>
                  {Array.isArray(catStats.availableSizes) && catStats.availableSizes.length
                    ? catStats.availableSizes.join(", ") : "-"}
                </div>
              </div>
              <div><div className={s.k}>Destacados</div><div className={s.v}>{catStats.featuredProducts}</div></div>
              <div><div className={s.k}>Preventa</div><div className={s.v}>{catStats.preorderProducts}</div></div>
            </div>
          )}
        </section>
      )}

      {/* Resultados */}
      {loading && <p>Cargando…</p>}
      {!loading && err && <p className={s.error}>{err}</p>}
      {!loading && !err && (
        <>
          <div className={s.grid}>
            {visibleProducts
              .filter(p => thumbs[p._id])
              .map(p => {
                const needsSizeSelection = Array.isArray(p.sizes) && p.sizes.length > 1;
                const isOff = hasDiscount(p);
                const base = basePrice(p);
                const show = displayPrice(p);
                const off = discountPercent(p);

                return (
                  <article key={p._id} className={s.card}>
                    <a href={`/producto/${p._id}`} aria-label={p.name} className={s.thumbLink}>
                      <div className={s.thumbBox}>
                        <img
                          src={thumbs[p._id]}
                          alt={p.name}
                          className={s.thumbImg}
                          loading="lazy"
                          data-product-img={p._id}
                        />
                      </div>
                    </a>

                    <h3 className={s.cardTitle}>{p.name}</h3>

                    <div className={s.cardPrice}>
                      {isOff && typeof base === "number" ? (
                        <>
                          <span className={s.oldPrice}>{currency(base)}</span>
                          <span className={s.newPrice}>{currency(show)}</span>
                          {off > 0 && <span className={s.discountBadge}>-{off}%</span>}
                        </>
                      ) : (
                        <>{currency(show)}</>
                      )}
                    </div>

                    {p.category && <div className={s.cardCat}>{p.category}</div>}

                    {needsSizeSelection && (
                      <div className={s.inlineSelectors}>
                        <label className={s.inlineField}>
                          <span className={s.inlineLabel}>Talle</span>
                          <select
                            value={sizeById[p._id] || ""}
                            onChange={(e) => setSizeById((st) => ({ ...st, [p._id]: e.target.value }))}
                            className={s.inlineSelect}
                          >
                            <option value="">Elige una talla</option>
                            {p.sizes!.map((sz) => (
                              <option key={sz} value={sz}>{sz}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}

                    <div className={s.cardActions}>
                      <a
                        href={`/producto/${p._id}`}
                        className={`${s.btn} ${s.btnPrimary}`}
                      >
                        Ver detalle
                      </a>

                      <button
                        onClick={() => handleQuickAdd(p)}
                        disabled={addingId === p._id || (needsSizeSelection && !(sizeById[p._id] || "").trim())}
                        className={`${s.btn} ${s.btnPrimary} ${addingId === p._id ? s.btnDisabled : ""}`}
                        title="Agregar al carrito"
                      >
                        {addingId === p._id ? "Agregando…" : "Agregar"}
                      </button>
                    </div>

                    {addMsgById[p._id] && (
                      <div className={`${s.feedback} ${addMsgById[p._id]?.includes("✅") ? s.ok : s.err}`}>
                        {addMsgById[p._id]}
                      </div>
                    )}
                  </article>
                );
              })}
          </div>

          <div className={s.pagination}>
            <button className={s.pageBtn} disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>Anterior</button>
            <span className={s.pageInfo}>Página {page} de {totalPages}</span>
            <button className={s.pageBtn} disabled={page >= totalPages} onClick={() => setParam("page", String(page + 1))}>Siguiente</button>
          </div>

          {addMsgGlobal && (
            <p className={`${s.center} ${addMsgGlobal.includes("✅") ? s.ok : s.err}`}>{addMsgGlobal}</p>
          )}
        </>
      )}
    </main>
  );
}
