// src/app/producto/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { resolveImageUrls } from "@/lib/resolveImageUrls";

type Product = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  images?: string[];
  [k: string]: any;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

export default function ProductDetail() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [p, setP] = useState<Product | null>(null);
  const [imgs, setImgs] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const ac = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/products/${id}`, {
          cache: "no-store",
          signal: ac.signal,
        });

        const text = await res.text();
        const json = text ? JSON.parse(text) : null;

        if (!res.ok) throw new Error("No se pudo obtener el producto");

        const data: Product = json?.data ?? json; // soporta {success,data} o plano
        setP(data);

        const urls = await resolveImageUrls(data?.images ?? []);
        setImgs(urls);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "Error");
      }
    })();

    return () => ac.abort();
  }, [id]);

  if (err) return <main style={{ padding: 16 }}><p style={{ color: "crimson" }}>{err}</p></main>;
  if (!p) return <main style={{ padding: 16 }}><p>Cargando…</p></main>;

  return (
    <main style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 32, margin: "0 0 16px" }}>{p.name}</h1>

      {!!imgs.length && (
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
            marginBottom: 16,
          }}
        >
          {imgs.map((src, i) => (
            <img
              key={src + i}
              src={src}
              alt={`${p.name} ${i + 1}`}
              style={{
                width: "100%",
                aspectRatio: "1/1",
                objectFit: "cover",
                borderRadius: 12,
                border: "1px solid #eee",
              }}
              loading="lazy"
            />
          ))}
        </div>
      )}

      <section
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <p><strong>ID:</strong> {p._id}</p>
        {typeof p.price !== "undefined" && <p><strong>Precio:</strong> {p.price}</p>}
        {p.category && <p><strong>Categoría:</strong> {p.category}</p>}
        {p.description && <p style={{ marginTop: 8 }}>{p.description}</p>}
      </section>
    </main>
  );
}
