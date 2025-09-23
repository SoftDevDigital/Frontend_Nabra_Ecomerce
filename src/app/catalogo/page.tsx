"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Product = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  [k: string]: any;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

// Helpers
const toNum = (v: string | null, d: number) => {
  const n = Number(v ?? "");
  return Number.isFinite(n) && n > 0 ? n : d;
};

export default function CatalogPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Leer query actual de la URL
  const qp = useMemo(() => {
    const page = toNum(searchParams.get("page"), 1);
    const limit = toNum(searchParams.get("limit"), 10);
    const category = (searchParams.get("category") || "").trim();
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    return {
      page,
      limit,
      category,
      minPrice: minPrice && minPrice !== "" ? Number(minPrice) : undefined,
      maxPrice: maxPrice && maxPrice !== "" ? Number(maxPrice) : undefined,
    };
  }, [searchParams]);

  // Estado de filtros (controlados por el form)
  const [page, setPage] = useState(qp.page);
  const [limit, setLimit] = useState(qp.limit);
  const [category, setCategory] = useState(qp.category);
  const [minPrice, setMinPrice] = useState<string>(
    typeof qp.minPrice === "number" ? String(qp.minPrice) : ""
  );
  const [maxPrice, setMaxPrice] = useState<string>(
    typeof qp.maxPrice === "number" ? String(qp.maxPrice) : ""
  );

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Product[]>([]);

  // Sin total del backend, inferimos si hay "siguiente" por largo === limit
  const hasPrev = qp.page > 1;
  const hasNext = items.length === qp.limit; // si trae menos que limit, asumimos fin

  // Cuando cambian los searchParams de la URL, actualizamos estados controlados
  useEffect(() => {
    setPage(qp.page);
    setLimit(qp.limit);
    setCategory(qp.category);
    setMinPrice(typeof qp.minPrice === "number" ? String(qp.minPrice) : "");
    setMaxPrice(typeof qp.maxPrice === "number" ? String(qp.maxPrice) : "");
  }, [qp]);

  // Cargar productos al cambiar query params
  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const url = new URL(`${API_BASE}/products`);
        url.searchParams.set("page", String(qp.page));
        url.searchParams.set("limit", String(qp.limit));
        if (qp.category) url.searchParams.set("category", qp.category);
        if (typeof qp.minPrice === "number") url.searchParams.set("minPrice", String(qp.minPrice));
        if (typeof qp.maxPrice === "number") url.searchParams.set("maxPrice", String(qp.maxPrice));

        const res = await fetch(url.toString(), { cache: "no-store" });

        const text = await res.text();
        const json = text ? JSON.parse(text) : null;

        if (!res.ok) throw new Error("No se pudieron obtener los productos");

        let list: Product[] = [];
        if (Array.isArray(json)) list = json;
        else if (json?.success === true && Array.isArray(json?.data)) list = json.data;
        else throw new Error("Formato de respuesta inesperado");

        setItems(list);
      } catch (e: any) {
        setErr(e?.message || "Error al cargar productos");
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [qp.page, qp.limit, qp.category, qp.minPrice, qp.maxPrice]);

  // Enviar filtros (y resetear a page 1 cuando cambian filtros distintos de page)
  function applyFilters(e: React.FormEvent) {
    e.preventDefault();

    const min = minPrice.trim();
    const max = maxPrice.trim();
    if (min && max && Number(min) > Number(max)) {
      setErr("minPrice no puede ser mayor que maxPrice");
      return;
    }

    const params = new URLSearchParams();
    params.set("page", "1"); // reset page
    params.set("limit", String(Math.max(1, Number(limit) || 10)));
    if (category.trim()) params.set("category", category.trim());
    if (min) params.set("minPrice", String(Math.max(0, Number(min))));
    if (max) params.set("maxPrice", String(Math.max(0, Number(max))));

    router.push(`/catalogo?${params.toString()}`);
  }

  // Paginación
  function goTo(pageNum: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(Math.max(1, pageNum)));
    params.set("limit", String(Math.max(1, Number(params.get("limit")) || limit || 10)));
    router.push(`/catalogo?${params.toString()}`);
  }

  return (
    <main style={{ maxWidth: 1200, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Catálogo</h1>
      </header>

      {/* Filtros */}
      <form
        onSubmit={applyFilters}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
          gap: 8,
          alignItems: "end",
          marginBottom: 12,
        }}
        aria-label="Filtrar catálogo"
      >
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Categoría</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="zapatos"
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Precio mínimo</span>
          <input
            type="number"
            min={0}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="0"
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Precio máximo</span>
          <input
            type="number"
            min={0}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="1000"
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Por página</span>
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value || "10", 10)))}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontWeight: 700,
          }}
          title='Aplicar filtros (GET /products?page=&limit=&category=&minPrice=&maxPrice=)'
        >
          Aplicar
        </button>
      </form>

      {/* Estado de carga / error */}
      {loading && <p>Cargando productos…</p>}
      {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}

      {/* Lista */}
      {!loading && !err && items.length === 0 && (
        <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
          <p style={{ margin: 0 }}>No hay productos para los filtros seleccionados.</p>
        </div>
      )}

      {!loading && !err && items.length > 0 && (
        <>
          <section
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
              marginTop: 8,
            }}
          >
            {items.map((p) => (
              <article
                key={p._id}
                style={{
                  display: "grid",
                  gap: 6,
                  padding: 12,
                  border: "1px solid #eee",
                  borderRadius: 12,
                  background: "#fff",
                }}
              >
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                {typeof p.price !== "undefined" && (
                  <div style={{ fontWeight: 600, fontSize: 14, opacity: 0.9 }}>
                    Precio: {p.price}
                  </div>
                )}
                {p.category && (
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Categoría: {p.category}</div>
                )}
                {p.description && (
                  <p style={{ margin: 0, opacity: 0.9 }}>{p.description}</p>
                )}
              </article>
            ))}
          </section>

          {/* Paginación */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "flex-end",
              marginTop: 12,
            }}
          >
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => hasPrev && goTo(qp.page - 1)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: hasPrev ? "white" : "#f3f3f3",
                cursor: hasPrev ? "pointer" : "default",
                fontWeight: 600,
              }}
              title="Página anterior"
            >
              ← Anterior
            </button>

            <span style={{ fontSize: 14, opacity: 0.85 }}>
              Página <strong>{qp.page}</strong>
            </span>

            <button
              type="button"
              disabled={!hasNext}
              onClick={() => hasNext && goTo(qp.page + 1)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: hasNext ? "white" : "#f3f3f3",
                cursor: hasNext ? "pointer" : "default",
                fontWeight: 600,
              }}
              title="Página siguiente"
            >
              Siguiente →
            </button>
          </div>
        </>
      )}
    </main>
  );
}
