// src/app/catalogo/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

function currency(n?: number) {
  if (typeof n !== "number") return "";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}

export default function CatalogoPage() {
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
  const [colorById, setColorById] = useState<Record<string, string>>({});
  const [addMsgById, setAddMsgById] = useState<Record<string, string | null>>({});
  function setCardMsg(id: string, msg: string | null) {
    setAddMsgById((m) => ({ ...m, [id]: msg }));
  }

  // 🔎 Estado controlado para búsqueda en tiempo real
  const [searchTerm, setSearchTerm] = useState<string>(sp.get("search") ?? "");

  // Mantener input sincronizado si cambian los params (back/forward)
  useEffect(() => {
    const current = sp.get("search") ?? "";
    setSearchTerm((prev) => (prev === current ? prev : current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]); // leer sp, no agregar setters a deps

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

  // Productos
  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      setErr(null);
      setThumbs({});
      try {
        const res = await fetchProducts(query);
        if (abort) return;
        setData(res);

        const entries = await Promise.all(
          res.products.map(async (p) => {
            if (p.images?.length) {
              try {
                const urls = await resolveImageUrls(p.images);
                if (urls[0]) return [p._id, urls[0]] as const;
              } catch { /* ignore */ }
            }
            return [p._id, "/product-placeholder.jpg"] as const;
          })
        );
        if (!abort) setThumbs(Object.fromEntries(entries));
      } catch (e: any) {
        if (!abort) setErr(e?.message || "Error al cargar productos");
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [query]);

  // Categorías
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

  // Stats por categoría
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
      const colorToSend = (colorById[productId] || "").trim() || undefined;

      await addToCart({ productId, quantity: 1, size: sizeToSend, color: colorToSend });
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

  // Debounce 300ms para búsqueda en tiempo real
  useEffect(() => {
    const id = setTimeout(() => {
      // Actualiza la query string (dispara fetch) cuando el usuario dejó de tipear
      setParam("search", searchTerm || undefined);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const { products, total, page, totalPages } = data;
  const totalAll = cats.reduce((acc, c) => acc + (c.count || 0), 0);

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Catálogo</h1>
        <p className={s.subtitle}>{total} resultados</p>
      </header>

      {/* Chips de categorías */}
      <section className={s.chips}>
        <button
          onClick={() => setParam("category", undefined)}
          className={`${s.chip} ${!sp.get("category") ? s.chipActive : ""}`}
          title={`Todas${totalAll ? ` (${totalAll})` : ""}`}
        >
          {`Todas${totalAll ? ` · ${totalAll}` : ""}`}
        </button>

        {catsLoading && <span className={s.muted}>Cargando categorías…</span>}
        {!catsLoading && catsErr && <span className={s.error}>{catsErr}</span>}

        {!catsLoading && !catsErr && cats.map(c => {
          const active = sp.get("category") === c.category;
          return (
            <button
              key={c.category}
              onClick={() => setParam("category", c.category)}
              className={`${s.chip} ${active ? s.chipActive : ""}`}
              title={`${c.category} (${c.count})`}
            >
              {c.category} · {c.count}
            </button>
          );
        })}
      </section>

      {/* Stats de categoría seleccionada */}
      {sp.get("category") && (
        <section className={s.statsCard}>
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

      {/* Filtros */}
      <section className={s.filters}>
        {/* 🔎 Input de búsqueda en tiempo real */}
        <div className={s.searchWrap}>
          <input
            className={`${s.input} ${s.searchInput}`}
            placeholder="Buscar…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Fuerza búsqueda inmediata y quita el debounce
                setParam("search", searchTerm || undefined);
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
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

        <input className={s.input} placeholder="Categoría (sandalias…)" defaultValue={sp.get("category") ?? ""} onBlur={(e) => setParam("category", e.target.value)} />
        <input className={s.input} type="number" placeholder="Precio mín." defaultValue={sp.get("minPrice") ?? ""} onBlur={(e) => setParam("minPrice", e.target.value)} />
        <input className={s.input} type="number" placeholder="Precio máx." defaultValue={sp.get("maxPrice") ?? ""} onBlur={(e) => setParam("maxPrice", e.target.value)} />
        <input className={s.input} placeholder="Talle (38, 40…)" defaultValue={sp.get("size") ?? ""} onBlur={(e) => setParam("size", e.target.value)} />

        <select className={s.select} defaultValue={sp.get("sortBy") ?? ""} onChange={(e) => setParam("sortBy", e.target.value || undefined)}>
          <option value="">Ordenar por…</option>
          <option value="price">Precio</option>
          <option value="name">Nombre</option>
          <option value="createdAt">Recientes</option>
          <option value="relevance">Relevancia</option>
        </select>

        <select className={s.select} defaultValue={sp.get("sortOrder") ?? "asc"} onChange={(e) => setParam("sortOrder", e.target.value)}>
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>

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

        <select className={s.select} defaultValue={sp.get("limit") ?? "12"} onChange={(e) => setParam("limit", e.target.value)} title="Items por página">
          {[12, 24, 36, 48].map(n => <option key={n} value={n}>{n} / pág.</option>)}
        </select>
      </section>

      {/* Resultados */}
      {loading && <p>Cargando…</p>}
      {!loading && err && <p className={s.error}>{err}</p>}
      {!loading && !err && (
        <>
          <div className={s.grid}>
            {data.products.map(p => {
              const needsSizeSelection = Array.isArray(p.sizes) && p.sizes.length > 1;
              return (
                <article key={p._id} className={s.card}>
                  <a href={`/producto/${p._id}`} aria-label={p.name} className={s.thumbLink}>
                    <div className={s.thumbBox}>
                      <img
                        src={thumbs[p._id] || "/product-placeholder.jpg"}
                        alt={p.name}
                        className={s.thumbImg}
                        loading="lazy"
                      />
                    </div>
                  </a>

                  <h3 className={s.cardTitle}>{p.name}</h3>
                  <div className={s.cardPrice}>{currency(p.price)}</div>
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
                          <option value="">Elegí un talle</option>
                          {p.sizes!.map((sz) => (
                            <option key={sz} value={sz}>{sz}</option>
                          ))}
                        </select>
                      </label>

                      <label className={s.inlineField}>
                        <span className={s.inlineLabel}>Color</span>
                        <input
                          value={colorById[p._id] || ""}
                          onChange={(e) => setColorById((c) => ({ ...c, [p._id]: e.target.value }))}
                          placeholder="Rojo, Azul…"
                          className={s.inlineInput}
                        />
                      </label>
                    </div>
                  )}

                  <div className={s.cardActions}>
                    <a href={`/producto/${p._id}`} className={s.btn}>Ver detalle</a>
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
