// src/app/components/Featured/Featured.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./Featured.module.css";
import { resolveImageUrls } from "@/lib/resolveImageUrls";  // 👈 importa

type Product = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  coverUrl?: string;
  image?: { url?: string };
  media?: { url?: string } | Array<{ url?: string }>;
  images?: string[]; // 👈 añade esto
  [k: string]: any;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

function mxn(n?: number) {
  if (typeof n !== "number") return "";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function getProductImgDirect(p: Product): string | null {
  const candidate =
    p.imageUrl ||
    p.coverUrl ||
    p.image?.url ||
    (Array.isArray(p.media) ? p.media[0]?.url : (p.media as any)?.url);

  if (!candidate) return null;
  const abs = /^https?:\/\//i.test(candidate) ? candidate : `${API_BASE}/${candidate}`;
  return abs.replace(/([^:]\/)\/+/g, "$1");
}

export default function Featured() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({}); // 👈

  async function load() {
    setLoading(true);
    setErr(null);
    setThumbs({});
    try {
      const res = await fetch(`${API_BASE}/products/featured`, { cache: "no-store" });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok) throw new Error("No se pudieron obtener los destacados");

      let list: Product[] = [];
      if (Array.isArray(json)) list = json;
      else if (json?.success === true && Array.isArray(json?.data)) list = json.data;
      else throw new Error("Formato de respuesta inesperado");

      list = list.slice(0, 5);
      setItems(list);

      // 👇 Resuelve thumbnails
      const entries = await Promise.all(
        list.map(async (p) => {
          const direct = getProductImgDirect(p);
          if (direct) return [p._id, direct] as const;

          if (Array.isArray(p.images) && p.images.length) {
            try {
              const urls = await resolveImageUrls(p.images);
              if (urls[0]) return [p._id, urls[0]] as const;
            } catch {/* ignore */}
          }
          return [p._id, "/product-placeholder.jpg"] as const;
        })
      );

      setThumbs(Object.fromEntries(entries));
    } catch (e: any) {
      setErr(e?.message || "Error al cargar destacados");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <section className={styles.wrap}>
      <div className={styles.headerRow}>
        <h2 className={styles.h2}>Destacados</h2>
        <button onClick={load} className={styles.refreshBtn} title="Actualizar destacados">
          Actualizar
        </button>
      </div>

      {loading && (
        <div className={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${styles.card} ${styles.skeleton}`}>
              <div className={styles.imgBox} />
              <div className={styles.titleSk} />
              <div className={styles.priceSk} />
              <div className={styles.btnSk} />
            </div>
          ))}
        </div>
      )}

      {!loading && err && <p className={styles.error}>{err}</p>}

      {!loading && !err && items.length === 0 && (
        <div className={styles.empty}>No hay productos destacados por ahora.</div>
      )}

      {!loading && !err && items.length > 0 && (
        <>
          <div className={styles.grid}>
            {items.map((p) => {
              const img = thumbs[p._id] || "/product-placeholder.jpg";
              return (
                <article key={p._id} className={styles.card}>
                  <Link href={`/producto/${p._id}`} className={styles.imgLink} aria-label={p.name}>
                    <div className={styles.imgBox}>
                      <img src={img} alt={p.name} className={styles.img} />
                    </div>
                  </Link>

                  <div className={styles.cardBody}>
                    <h3 className={styles.title}>{p.name}</h3>
                    {typeof p.price === "number" && <div className={styles.price}>{mxn(p.price)}</div>}
                    {p.description && (
                      <p className={styles.desc}>
                        {p.description.length > 90 ? `${p.description.slice(0, 90)}…` : p.description}
                      </p>
                    )}
                    <Link href={`/producto/${p._id}`} className={styles.cta}>
                      Ver detalle
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.moreRow}>
            <Link href="/catalogo" className={styles.moreLink}>
              Ver catálogo completo
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
