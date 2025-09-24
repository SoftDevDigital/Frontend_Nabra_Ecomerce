// src/app/catalogo/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  fetchProducts,
  ProductDto,
  fetchProductCategories,
  fetchCategoryStats, // 👈 agregado
  CategoryStats,      // 👈 agregado
} from "@/lib/productsApi"; // 👈 ahora importa stats
import { resolveImageUrls } from "@/lib/resolveImageUrls";
/* === NUEVO: para agregar al carrito === */
import { addToCart } from "@/lib/cartClient";

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
  const [data, setData] = useState<{ products: ProductDto[]; total: number; page: number; totalPages: number }>({
    products: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  // Estados para categorías
  const [cats, setCats] = useState<{ category: string; count: number }[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catsErr, setCatsErr] = useState<string | null>(null);

  // ✨ NUEVO: estados para stats de categoría
  const [catStats, setCatStats] = useState<CategoryStats | null>(null);
  const [catStatsLoading, setCatStatsLoading] = useState(false);
  const [catStatsErr, setCatStatsErr] = useState<string | null>(null);

  /* === NUEVO: estados para Quick Add === */
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addMsgGlobal, setAddMsgGlobal] = useState<string | null>(null);
  const [sizeById, setSizeById] = useState<Record<string, string>>({});
  const [colorById, setColorById] = useState<Record<string, string>>({});
  const [addMsgById, setAddMsgById] = useState<Record<string, string | null>>({});
  function setCardMsg(id: string, msg: string | null) {
    setAddMsgById((m) => ({ ...m, [id]: msg }));
  }

  // Lee filtros desde la URL
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

        // resolver imágenes
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

  // ✨ NUEVO: Stats por categoría (cuando hay category en la URL)
  useEffect(() => {
    let abort = false;
    const category = query.category;
    if (!category) {
      setCatStats(null);
      setCatStatsErr(null);
      setCatStatsLoading(false);
      return;
    }

    (async () => {
      setCatStatsLoading(true);
      setCatStatsErr(null);
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

  /* === NUEVO: Quick Add handler (talle/color) === */
  async function handleQuickAdd(p: ProductDto) {
    const productId = p._id;
    setAddingId(productId);
    setAddMsgGlobal(null);
    setCardMsg(productId, null);

    try {
      let sizeToSend: string | undefined;
      if (Array.isArray(p.sizes) && p.sizes.length > 0) {
        if (p.sizes.length === 1) {
          sizeToSend = p.sizes[0];
        } else {
          const chosen = (sizeById[productId] || "").trim();
          if (!chosen) {
            setCardMsg(productId, "Elegí un talle para agregar.");
            return;
          }
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
    // reset a la primera página al cambiar filtros (excepto si cambiamos page)
    if (name !== "page") usp.set("page", "1");
    router.replace(`${pathname}?${usp.toString()}`);
  }

  const { products, total, page, totalPages } = data;
  const totalAll = cats.reduce((acc, c) => acc + (c.count || 0), 0);

  return (
    <main style={{ maxWidth: 1200, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Catálogo</h1>

      {/* Chips de categorías */}
      <section style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 12px" }}>
        <button
          onClick={() => setParam("category", undefined)}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #ddd",
            background: !sp.get("category") ? "#111" : "#fff",
            color: !sp.get("category") ? "#fff" : "#111",
            cursor: "pointer"
          }}
          title={`Todas${totalAll ? ` (${totalAll})` : ""}`}
        >
          {`Todas${totalAll ? ` · ${totalAll}` : ""}`}
        </button>

        {catsLoading && <span style={{ fontSize: 12, color: "#666" }}>Cargando categorías…</span>}
        {!catsLoading && catsErr && <span style={{ fontSize: 12, color: "crimson" }}>{catsErr}</span>}

        {!catsLoading && !catsErr && cats.map(c => {
          const active = sp.get("category") === c.category;
          return (
            <button
              key={c.category}
              onClick={() => setParam("category", c.category)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: active ? "#111" : "#fff",
                color: active ? "#fff" : "#111",
                cursor: "pointer"
              }}
              title={`${c.category} (${c.count})`}
            >
              {c.category} · {c.count}
            </button>
          );
        })}
      </section>

      {/* ✨ NUEVO: Panel de estadísticas de la categoría seleccionada */}
      {sp.get("category") && (
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
            marginBottom: 16
          }}
        >
          {catStatsLoading && <p style={{ margin: 0 }}>Cargando estadísticas…</p>}
          {!catStatsLoading && catStatsErr && <p style={{ margin: 0, color: "crimson" }}>{catStatsErr}</p>}
          {!catStatsLoading && !catStatsErr && catStats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Categoría</div>
                <div style={{ fontWeight: 600 }}>{catStats.category}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Productos</div>
                <div style={{ fontWeight: 600 }}>{catStats.totalProducts}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Precio mín.</div>
                <div style={{ fontWeight: 600 }}>{currency(catStats.priceRange?.min)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Precio máx.</div>
                <div style={{ fontWeight: 600 }}>{currency(catStats.priceRange?.max)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Precio promedio</div>
                <div style={{ fontWeight: 600 }}>{currency(catStats.averagePrice)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Talles disp.</div>
                <div style={{ fontWeight: 600, lineHeight: 1.3 }}>
                  {Array.isArray(catStats.availableSizes) && catStats.availableSizes.length
                    ? catStats.availableSizes.join(", ")
                    : "-"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Destacados</div>
                <div style={{ fontWeight: 600 }}>{catStats.featuredProducts}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Preventa</div>
                <div style={{ fontWeight: 600 }}>{catStats.preorderProducts}</div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Controles de filtros */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
        gap: 12,
        marginBottom: 16,
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 12,
        background: "#fff"
      }}>
        <input placeholder="Buscar…" defaultValue={sp.get("search") ?? ""} onBlur={(e) => setParam("search", e.target.value)} />
        <input placeholder="Categoría (sandalias…)" defaultValue={sp.get("category") ?? ""} onBlur={(e) => setParam("category", e.target.value)} />
        <input type="number" placeholder="Precio mín." defaultValue={sp.get("minPrice") ?? ""} onBlur={(e) => setParam("minPrice", e.target.value)} />
        <input type="number" placeholder="Precio máx." defaultValue={sp.get("maxPrice") ?? ""} onBlur={(e) => setParam("maxPrice", e.target.value)} />
        <input placeholder="Talle (38, 40…)" defaultValue={sp.get("size") ?? ""} onBlur={(e) => setParam("size", e.target.value)} />

        <select defaultValue={sp.get("sortBy") ?? ""} onChange={(e) => setParam("sortBy", e.target.value || undefined)}>
          <option value="">Ordenar por…</option>
          <option value="price">Precio</option>
          <option value="name">Nombre</option>
          <option value="createdAt">Recientes</option>
          <option value="relevance">Relevancia</option>
        </select>

        <select defaultValue={sp.get("sortOrder") ?? "asc"} onChange={(e) => setParam("sortOrder", e.target.value)}>
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            defaultChecked={sp.get("isFeatured") === "true"}
            onChange={(e) => setParam("isFeatured", e.target.checked ? "true" : undefined)}
          />
          Destacados
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            defaultChecked={sp.get("isPreorder") === "true"}
            onChange={(e) => setParam("isPreorder", e.target.checked ? "true" : undefined)}
          />
          Preventa
        </label>

        <select
          defaultValue={sp.get("limit") ?? "12"}
          onChange={(e) => setParam("limit", e.target.value)}
          title="Items por página"
        >
          {[12, 24, 36, 48].map(n => <option key={n} value={n}>{n} / pág.</option>)}
        </select>
      </section>

      {/* Resultados */}
      {loading && <p>Cargando…</p>}
      {!loading && err && <p style={{ color: "crimson" }}>{err}</p>}
      {!loading && !err && (
        <>
          <p style={{ marginBottom: 8 }}>{total} resultados</p>
          <div style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
          }}>
            {products.map(p => {
              const needsSizeSelection = Array.isArray(p.sizes) && p.sizes.length > 1;
              return (
                <article key={p._id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <a href={`/producto/${p._id}`} aria-label={p.name} style={{ display: "block", marginBottom: 8 }}>
                    <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", borderRadius: 8, border: "1px solid #f0f0f0" }}>
                      <img
                        src={thumbs[p._id] || "/product-placeholder.jpg"}
                        alt={p.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        loading="lazy"
                      />
                    </div>
                  </a>
                  <h3 style={{ fontSize: 16, margin: "8px 0 4px" }}>{p.name}</h3>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{currency(p.price)}</div>
                  {p.category && <div style={{ fontSize: 12, color: "#666" }}>{p.category}</div>}

                  {/* === NUEVO: selector de talle/color por tarjeta cuando hay varias talles === */}
                  {needsSizeSelection && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <label style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontSize: 12, color: "#666" }}>Talle</span>
                        <select
                          value={sizeById[p._id] || ""}
                          onChange={(e) => setSizeById((s) => ({ ...s, [p._id]: e.target.value }))}
                          style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", minWidth: 120 }}
                        >
                          <option value="">Elegí un talle</option>
                          {p.sizes!.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontSize: 12, color: "#666" }}>Color (opcional)</span>
                        <input
                          value={colorById[p._id] || ""}
                          onChange={(e) => setColorById((c) => ({ ...c, [p._id]: e.target.value }))}
                          placeholder="Rojo, Azul…"
                          style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", minWidth: 120 }}
                        />
                      </label>
                    </div>
                  )}

                  {/* Botones acción */}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <a
                      href={`/producto/${p._id}`}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        background: "#fff",
                        fontWeight: 600
                      }}
                    >
                      Ver detalle
                    </a>
                    <button
                      onClick={() => handleQuickAdd(p)}
                      disabled={
                        addingId === p._id ||
                        (needsSizeSelection && !(sizeById[p._id] || "").trim())
                      }
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        background: "#fff",
                        fontWeight: 600,
                        cursor: addingId === p._id ? "default" : "pointer"
                      }}
                      title="Agregar al carrito"
                    >
                      {addingId === p._id ? "Agregando…" : "Agregar"}
                    </button>
                  </div>

                  {/* Mensaje feedback tarjeta */}
                  {addMsgById[p._id] && (
                    <div style={{ marginTop: 6, color: addMsgById[p._id]?.includes("✅") ? "green" : "crimson" }}>
                      {addMsgById[p._id]}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Paginación */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
            <button disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>Anterior</button>
            <span style={{ alignSelf: "center" }}>Página {page} de {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setParam("page", String(page + 1))}>Siguiente</button>
          </div>

          {/* Mensaje global (opcional) */}
          {addMsgGlobal && (
            <p style={{ textAlign: "center", marginTop: 12, color: addMsgGlobal.includes("✅") ? "green" : "crimson" }}>
              {addMsgGlobal}
            </p>
          )}
        </>
      )}
    </main>
  );
}
