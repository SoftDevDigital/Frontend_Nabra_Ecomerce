// src/app/buscar/page.tsx
"use client";

import { useEffect, useMemo, useState, Suspense } from "react"; // 👈 agregamos Suspense
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Product = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  [k: string]: any;
};

type SearchResponse =
  | { success: true; data: Product[]; message?: string }
  | { success: false; message: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

// 👇 Mover tu lógica a un componente interno
function SearchProductsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQ = useMemo(() => (searchParams.get("q") || "").trim(), [searchParams]);
  const [q, setQ] = useState(initialQ);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<Product[]>([]);

  useEffect(() => {
    const term = (searchParams.get("q") || "").trim();
    setQ(term);
    if (!term) {
      setResults([]);
      setErr(null);
      return;
    }

    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(
          `${API_BASE}/products/search?q=${encodeURIComponent(term)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as SearchResponse;
        if (!res.ok || !("success" in json) || !json.success) {
          throw new Error(("message" in json && json.message) || "Error en la búsqueda");
        }
        setResults(json.data || []);
      } catch (e: any) {
        setErr(e?.message || "No se pudo buscar productos");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = (q || "").trim();
    router.push(`/buscar${term ? `?q=${encodeURIComponent(term)}` : ""}`);
  }

  return (
    <main style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Buscar productos</h1>
      </header>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px,1fr) auto",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
        role="search"
        aria-label="Buscar productos"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o descripción…"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          aria-label="Término de búsqueda"
        />
        <button
          type="submit"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Buscar
        </button>
      </form>

      {loading && <p>Cargando resultados…</p>}
      {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}

      {!loading && !err && !q && (
        <p style={{ opacity: 0.8 }}>Escribí un término en la caja de búsqueda y presioná “Buscar”.</p>
      )}

      {!loading && !err && q && results.length === 0 && (
        <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
          <p style={{ margin: 0 }}>
            No encontramos productos para <strong>“{q}”</strong>.
          </p>
        </div>
      )}

      {!loading && !err && results.length > 0 && (
        <section style={{ display: "grid", gap: 12 }}>
          <div style={{ opacity: 0.8 }}>
            Resultados para <strong>“{q}”</strong>: <strong>{results.length}</strong>
          </div>

          {results.map((p) => (
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
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                {typeof p.price !== "undefined" && (
                  <div style={{ fontWeight: 600, fontSize: 14, opacity: 0.9 }}>
                    Precio: {p.price}
                  </div>
                )}
              </div>
              {p.description && (
                <p style={{ margin: 0, opacity: 0.9 }}>{p.description}</p>
              )}

              <Link href={`/producto/${p._id}`} style={{ textDecoration: "underline" }}>
                Ver detalle
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

// 👇 Este wrapper evita el error de build
export default function SearchProductsPage() {
  return (
    <Suspense fallback={<p>Cargando búsqueda...</p>}>
      <SearchProductsPageInner />
    </Suspense>
  );
}
