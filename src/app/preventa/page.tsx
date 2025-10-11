// src/app/preventa/page.tsx
"use client";

import { useEffect, useState } from "react";
import s from "./Preventa.module.css";
import { resolveImageUrls } from "@/lib/resolveImageUrls"; // si alguna trae imágenes

type Product = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  images?: string[];
  stock?: number;        // si tu API lo manda, se muestra como “cupos”
  isPreorder?: boolean;  // opcional
  [k: string]: any;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

function currencyMXN(n?: number) {
  if (typeof n !== "number") return "";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

export default function PreordersPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/products`, { cache: "no-store" });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok) throw new Error("No se pudieron obtener los productos en preventa");

      let list: Product[] = [];
      if (Array.isArray(json)) list = json;
      else if (json?.success === true && Array.isArray(json?.data)) list = json.data;
      else throw new Error("Formato de respuesta inesperado");

      setItems(list);

      // thumbnails (si hay imágenes)
      const entries = await Promise.all(
        list.map(async (p) => {
          try {
            const urls = await resolveImageUrls(p.images ?? []);
            return [p._id, urls[0] || "/product-placeholder.jpg"] as const;
          } catch {
            return [p._id, "/product-placeholder.jpg"] as const;
          }
        })
      );
      setThumbs(Object.fromEntries(entries));
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
    <main className={s.page}>
      {/* Hero corto */}
      <section className={s.hero}>
        <div className={s.heroBadge}>Preventa</div>
        <h1 className={s.heroTitle}>Asegura tus pares antes de que vuelen</h1>
        <p className={s.heroText}>
          Reserva hoy y recibe primero. Cupos limitados en modelos seleccionados.
        </p>
        <button className={s.reload} onClick={load} title="Actualizar preventa">Actualizar</button>
      </section>

      {/* Estado de carga / error / vacío */}
      {loading && (
        <section className={s.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <article key={i} className={`${s.card} ${s.skeleton}`} />
          ))}
        </section>
      )}

      {!loading && err && <p className={s.error}>{err}</p>}

      {!loading && !err && items.length === 0 && (
        <div className={s.empty}>
          <h2 className={s.emptyTitle}>No hay preventas activas</h2>
          <p className={s.emptyText}>Volvé pronto: estamos preparando nuevos lanzamientos ✨</p>
        </div>
      )}

      {/* Listado */}
      {!loading && !err && items.length > 0 && (
        <section className={s.grid}>
          {items.map((p) => {
            const stock = typeof p.stock === "number" ? Math.max(0, p.stock) : undefined;
            // Simulá progreso si tu API no lo trae: menor stock = más “avanzado”
            const progress = stock !== undefined ? Math.min(100, Math.max(0, 100 - stock)) : undefined;

            return (
              <article key={p._id} className={s.card}>
                {/* Imagen */}
                <a href={`/producto/${p._id}`} className={s.thumbLink} aria-label={p.name}>
                  <div className={s.thumbBox}>
                    <img
                      src={thumbs[p._id] || "/product-placeholder.jpg"}
                      alt={p.name}
                      className={s.thumbImg}
                      loading="lazy"
                    />
                    <span className={s.tag}>Preventa</span>
                  </div>
                </a>

                {/* Texto */}
                <h3 className={s.name}>{p.name}</h3>
                {typeof p.price === "number" && (
                  <div className={s.price}>{currencyMXN(p.price)}</div>
                )}
                {p.description && <p className={s.desc}>{p.description}</p>}

                {/* Progreso / cupos (si hay stock) */}
                {stock !== undefined && (
                  <div className={s.progressWrap} title={`Cupos restantes: ${stock}`}>
                    <div className={s.progressBar}>
                      <div className={s.progressFill} style={{ width: `${progress ?? 0}%` }} />
                    </div>
                    <span className={s.progressText}>
                      {stock} {stock === 1 ? "cupo" : "cupos"} restantes
                    </span>
                  </div>
                )}

                {/* CTA */}
                <div className={s.actions}>
                  <a href={`/producto/${p._id}`} className={`${s.btn} ${s.btnPrimary}`}>
                    Reservar ahora
                  </a>
                  <a href={`/producto/${p._id}`} className={s.btn}>
                    Ver detalle
                  </a>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Nota */}
      <p className={s.note}>
        Los tiempos de entrega pueden variar por alta demanda. Recibirás actualizaciones por correo ✉️.
      </p>
    </main>
  );
}
