// src/app/components/Search/SearchModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./SearchModal.module.css";

type Product = {
  _id: string;
  name: string;
  price?: number;
  images?: string[];
  imageUrl?: string; // por si tu API ya lo trae
  coverUrl?: string;
  [k: string]: any;
};

type SearchResponse =
  | { success: true; data: Product[]; message?: string }
  | { success: false; message: string }
  // Soportar otras formas comunes
  | { data?: { products?: Product[] } }
  | { products?: Product[] }
  | Product[];

/* ✅ usa el puerto del backend */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "MXN";
const LOCALE = process.env.NEXT_PUBLIC_LOCALE || "es-MX";
/* ✅ cuántos productos cargar al abrir el modal */
const INITIAL_LIMIT = Number(process.env.NEXT_PUBLIC_SEARCH_INITIAL_LIMIT ?? 48);

function money(n?: number) {
  if (typeof n !== "number") return "";
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(n);
}

/* Normaliza arrays de productos para distintos formatos de respuesta */
function normalizeProducts(json: SearchResponse): Product[] {
  if (Array.isArray(json)) return json as Product[];
  if ((json as any)?.success && Array.isArray((json as any).data)) return (json as any).data as Product[];
  if ((json as any)?.data?.products && Array.isArray((json as any).data.products)) return (json as any).data.products as Product[];
  if ((json as any)?.products && Array.isArray((json as any).products)) return (json as any).products as Product[];
  return [];
}

/* Hace absoluta una URL de imagen si viene relativa */
function absolutize(u?: string): string {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return `${API_BASE}/${u}`.replace(/([^:]\/)\/+/g, "$1");
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SearchModal({ open, onClose }: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<Product[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false); // 👈 para no recargar “todos” en loop
  const inputRef = useRef<HTMLInputElement>(null);

  // “visto recientemente”
  const [recent, setRecent] = useState<Product[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nabra_recent_products");
      setRecent(raw ? JSON.parse(raw) : []);
    } catch {}
  }, [open]);

  // al abrir: bloqueo scroll, foco, y reseteo estado para nueva sesión del modal
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    setErr(null);
    setResults([]);
    setQ("");
    setInitialLoaded(false);
    return () => { document.body.style.overflow = prev; clearTimeout(t); };
  }, [open]);

  // cerrar con ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* 🔶 CARGAR TODOS LOS PRODUCTOS AL ABRIR (una sola vez por apertura) */
  useEffect(() => {
    if (!open) return;
    if (q.trim() !== "") return;       // si el usuario ya tipea, no cargo el “todos”
    if (initialLoaded) return;

    (async () => {
      setLoading(true); setErr(null);
      try {
        const res = await fetch(
          `${API_BASE}/products?limit=${INITIAL_LIMIT}&sortBy=createdAt&sortOrder=desc`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as SearchResponse;
        const data = normalizeProducts(json);
        setResults(Array.isArray(data) ? data : []);
        setInitialLoaded(true);
      } catch (e: any) {
        setErr(e?.message || "No se pudieron cargar los productos");
        setResults([]);
      } finally { setLoading(false); }
    })();
  }, [open, q, initialLoaded]);

  /* 🔎 Buscador con debounce y con 3 intentos */
  useEffect(() => {
    if (!open) return;
    const term = q.trim();

    // si no hay término, dejo que se muestre la lista inicial (no limpio results)
    if (!term) return;

    const id = setTimeout(async () => {
      setLoading(true); setErr(null);
      try {
        // 1) endpoint dedicado
        let res = await fetch(`${API_BASE}/products/search?q=${encodeURIComponent(term)}`, { cache: "no-store" });
        let json = (await res.json()) as SearchResponse;
        let data = normalizeProducts(json);

        // 2) si viene vacío, probamos query genérica
        if (!Array.isArray(data) || data.length === 0) {
          res = await fetch(`${API_BASE}/products?search=${encodeURIComponent(term)}&limit=24`, { cache: "no-store" });
          json = (await res.json()) as SearchResponse;
          data = normalizeProducts(json);
        }

        // 3) último recurso: traigo varios y filtro en front
        if (!Array.isArray(data) || data.length === 0) {
          res = await fetch(`${API_BASE}/products?limit=200`, { cache: "no-store" });
          json = (await res.json()) as SearchResponse;
          const all = normalizeProducts(json);
          const t = term.toLowerCase();
          data = (all || []).filter(
            (p: any) =>
              String(p?.name || "").toLowerCase().includes(t) ||
              String(p?.description || "").toLowerCase().includes(t) ||
              String(p?.category || "").toLowerCase().includes(t)
          );
        }

        setResults(Array.isArray(data) ? data.slice(0, 24) : []);
      } catch (e: any) {
        setErr(e?.message || "No se pudo buscar");
        setResults([]);
      } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(id);
  }, [q, open]);

  function firstImg(p: Product) {
    const cand = p.imageUrl || p.coverUrl || p.images?.[0] || "";
    return absolutize(cand) || null; // No mostrar placeholder
  }

  function handlePick(p: Product) {
    // guardar en “visto recientemente”
    try {
      const cur: Product[] = JSON.parse(localStorage.getItem("nabra_recent_products") || "[]");
      const exists = new Map(cur.map(x => [x._id, x]));
      exists.set(p._id, { _id: p._id, name: p.name, price: p.price, imageUrl: firstImg(p) });
      const arr = Array.from(exists.values()).slice(-8); // mantengo 8 últimos
      localStorage.setItem("nabra_recent_products", JSON.stringify(arr));
    } catch {}
    onClose();
  }

  if (!open) return null;

  const showingAll = !q.trim();

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchRow}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" fill="none" strokeWidth="1.6" />
            <path d="M20 20l-3-3" stroke="currentColor" fill="none" strokeWidth="1.6" />
          </svg>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Buscar productos…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button className={styles.clear} onClick={() => setQ("")} aria-label="Limpiar">✕</button>
          )}
        </div>

        <div className={styles.content}>
          {/* Recientes */}
          {recent.length > 0 && (
            <section className={styles.section}>
              <header className={styles.sectionHead}>
                <h3>Visto recientemente</h3>
                <button
                  onClick={() => { localStorage.removeItem("nabra_recent_products"); setRecent([]); }}
                  className={styles.linkBtn}
                >
                  Borrar
                </button>
              </header>
              <div className={styles.grid}>
                {recent
                  .filter(p => absolutize(p.imageUrl) || firstImg(p)) // Solo productos con imágenes válidas
                  .map((p) => {
                    const imgSrc = absolutize(p.imageUrl) || firstImg(p);
                    if (!imgSrc) return null; // No mostrar si no hay imagen
                    
                    return (
                      <Link
                        key={`r-${p._id}`}
                        href={`/producto/${p._id}`}
                        className={styles.card}
                        onClick={() => handlePick(p)}
                      >
                        <div className={styles.thumbBox}>
                          <img src={imgSrc} alt={p.name} />
                        </div>
                        <div className={styles.cardName} title={p.name}>{p.name}</div>
                        {typeof p.price === "number" && <div className={styles.cardPrice}>{money(p.price)}</div>}
                      </Link>
                    );
                  })
                  .filter(Boolean)}
              </div>
            </section>
          )}

          {/* Resultados / Todos */}
          <section className={styles.section}>
            <header className={styles.sectionHead}>
              <h3>{showingAll ? "Todos los productos" : "Productos"}</h3>
            </header>

            {loading && <div className={styles.muted}>Cargando…</div>}
            {err && !loading && <div className={styles.error}>{err}</div>}

            {!loading && !err && results.length === 0 && (
              <div className={styles.muted}>
                {showingAll ? "No hay productos para mostrar." : `Sin resultados para “${q}”.`}
              </div>
            )}

            {!loading && !err && results.length > 0 && (
              <div className={styles.grid}>
                {results
                  .filter(p => firstImg(p)) // Solo productos con imágenes válidas
                  .map((p) => {
                    const imgSrc = firstImg(p);
                    if (!imgSrc) return null; // No mostrar si no hay imagen
                    
                    return (
                      <Link
                        key={p._id}
                        href={`/producto/${p._id}`}
                        className={styles.card}
                        onClick={() => handlePick(p)}
                      >
                        <div className={styles.thumbBox}>
                          <img src={imgSrc} alt={p.name} />
                        </div>
                        <div className={styles.cardName} title={p.name}>{p.name}</div>
                        {typeof p.price === "number" && <div className={styles.cardPrice}>{money(p.price)}</div>}
                      </Link>
                    );
                  })
                  .filter(Boolean)}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
