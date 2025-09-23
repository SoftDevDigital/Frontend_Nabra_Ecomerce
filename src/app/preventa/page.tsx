// src/app/preventa/page.tsx
"use client";

import { useEffect, useState } from "react";

type Product = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  // cualquier otro campo que devuelva tu API
  [k: string]: any;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

export default function PreordersPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Product[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/products/preorders`, { cache: "no-store" });

      // La especificación dice: 200 = Array de Product (sin wrapper)
      // Pero por si tu backend usa wrapper {success, data}, contemplamos ambos formatos:
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok) {
        throw new Error("No se pudieron obtener los productos en preventa");
      }

      let list: Product[] = [];
      if (Array.isArray(json)) list = json;
      else if (json?.success === true && Array.isArray(json?.data)) list = json.data;
      else throw new Error("Formato de respuesta inesperado");

      setItems(list);
    } catch (e: any) {
      setErr(e?.message || "Error al cargar la preventa");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Preventa</h1>
        <button
          onClick={load}
          style={{
            marginLeft: "auto",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
          title="Actualizar preventa"
        >
          Actualizar
        </button>
      </header>

      {loading && <p>Cargando preventa…</p>}
      {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}

      {!loading && !err && items.length === 0 && (
        <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
          <p style={{ margin: 0 }}>No hay productos en preventa en este momento.</p>
        </div>
      )}

      {!loading && !err && items.length > 0 && (
        <section
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
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
                <div style={{ fontWeight: 600, fontSize: 14, opacity: 0.9 }}>Precio: {p.price}</div>
              )}
              {p.description && <p style={{ margin: 0, opacity: 0.9 }}>{p.description}</p>}
              {/* Si luego sumas detalle de producto, linkeá aquí */}
              {/* <Link href={`/producto/${p._id}`} style={{ textDecoration: "underline" }}>Ver detalle</Link> */}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
