// src/app/components/Featured/Featured.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Product = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  [k: string]: any;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

export default function Featured() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Product[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/products/featured`, { cache: "no-store" });

      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok) throw new Error("No se pudieron obtener los destacados");

      let list: Product[] = [];
      if (Array.isArray(json)) list = json;
      else if (json?.success === true && Array.isArray(json?.data)) list = json.data;
      else throw new Error("Formato de respuesta inesperado");

      setItems(list.slice(0, 5));
    } catch (e: any) {
      setErr(e?.message || "Error al cargar destacados");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <section style={{ padding: "24px 16px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Destacados</h2>
        <button
          onClick={load}
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13
          }}
          title="Actualizar destacados"
        >
          Actualizar
        </button>
      </div>

      {loading && <p>Cargando destacados…</p>}
      {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}

      {!loading && !err && items.length === 0 && (
        <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
          <p style={{ margin: 0 }}>No hay productos destacados por ahora.</p>
        </div>
      )}

      {!loading && !err && items.length > 0 && (
        <>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
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
                {p.description && (
                  <p style={{ margin: 0, opacity: 0.9 }}>{p.description}</p>
                )}
                <Link href={`/producto/${p._id}`} style={{ textDecoration: "underline" }}>
                  Ver detalle
                </Link>
              </article>
            ))}
          </div>

          <div style={{ textAlign: "right", marginTop: 10 }}>
            <Link href="/catalogo" style={{ textDecoration: "underline" }}>
              Ver catálogo completo
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
