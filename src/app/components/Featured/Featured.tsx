// src/app/components/Featured/Featured.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./Featured.module.css";
import { resolveImageUrls } from "@/lib/resolveImageUrls";
import { fetchProducts, PRODUCTS_API_BASE, ProductDto } from "@/lib/productsApi";
import { addToCart } from "@/lib/cartClient";
import { useRouter } from "next/navigation";
/* 👇 NUEVO */
import { useFlyToCart } from "@/app/hooks/useFlyToCart";

type Product = ProductDto & {
  imageUrl?: string;
  coverUrl?: string;
  image?: { url?: string };
  media?: { url?: string } | Array<{ url?: string }>;
  [k: string]: any;
};

function mxn(n?: number) {
  if (typeof n !== "number") return "";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

/* ✅ NUEVO: helper de moneda configurable (no borro mxn, solo agrego) */
function formatMoney(n?: number) {
  if (typeof n !== "number") return "";
  const currency = process.env.NEXT_PUBLIC_CURRENCY || "ARS";
  const locale = process.env.NEXT_PUBLIC_LOCALE || "es-AR";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
}

function getProductImgDirect(p: Product): string | null {
  const candidate =
    p.imageUrl ||
    p.coverUrl ||
    p.image?.url ||
    (Array.isArray(p.media) ? p.media[0]?.url : (p.media as any)?.url);

  if (!candidate) return null;
  const abs = /^https?:\/\//i.test(candidate) ? candidate : `${PRODUCTS_API_BASE}/${candidate}`;
  return abs.replace(/([^:]\/)\/+/g, "$1");
}

/* ✅ NUEVO: heurística para detectar si una URL “parece” imagen */
function isLikelyImageUrl(u: string) {
  if (!/^https?:\/\//i.test(u)) return false;
  if (/\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(u)) return true;
  // Aceptar CDNs con querys de width/height/format, pero evitar .html
  if (/[?&](width|height|format|v)=/i.test(u) && !/\.html?($|\?)/i.test(u)) return true;
  return !/\.html?($|\?)/i.test(u) && !/\.php($|\?)/i.test(u);
}

/* 👇 NUEVO: helpers para sincronizar el badge del carrito */
async function fetchCartTotalCount(): Promise<number | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
    const token = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
    const res = await fetch(`${API_BASE}/cart/total`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const raw = await res.json();
    const data = raw?.success ? raw.data : raw;
    const count = typeof data?.totalQuantity === "number"
      ? data.totalQuantity
      : (typeof data?.totalItems === "number" ? data.totalItems : null);
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}
function emitCartCount(count: number) {
  try {
    localStorage.setItem("cart_count", String(count));
    window.dispatchEvent(new CustomEvent("cart:count", { detail: { count } }));
  } catch { /* noop */ }
}

export default function Featured() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const router = useRouter();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  /* === NUEVO: estados por tarjeta para variantes y feedback === */
  const [sizeById, setSizeById] = useState<Record<string, string>>({});
  const [colorById, setColorById] = useState<Record<string, string>>({});
  const [addMsgById, setAddMsgById] = useState<Record<string, string | null>>({});
  function setCardMsg(id: string, msg: string | null) {
    setAddMsgById((m) => ({ ...m, [id]: msg }));
  }

  /* 👇 NUEVO: hook de animación */
  const { fly, Portal } = useFlyToCart();

  async function load() {
    setLoading(true);
    setErr(null);
    setThumbs({});
    try {
      // ✅ usa el endpoint general con filtro isFeatured
      const { products } = await fetchProducts({ isFeatured: true, limit: 5, sortBy: "createdAt", sortOrder: "desc" });

      const list = (products ?? []).slice(0, 5) as Product[];
      setItems(list);

      const entries = await Promise.all(
        list.map(async (p) => {
          const direct = getProductImgDirect(p);
          if (direct && isLikelyImageUrl(direct)) return [p._id, direct] as const;

          if (Array.isArray(p.images) && p.images.length) {
            const first = String(p.images[0] || "");
            if (first && isLikelyImageUrl(first)) {
              return [p._id, first] as const;
            }
            try {
              const urls = await resolveImageUrls(p.images);
              if (urls[0] && isLikelyImageUrl(urls[0])) return [p._id, urls[0]] as const;
            } catch {
              /* ignore */
            }
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

  /* === MODIFICADO: quick add con soporte de talle/color + animación + badge === */
  async function handleQuickAdd(product: Product) {
    const productId = product._id;
    setAddingId(productId);
    setAddMsg(null);
    setCardMsg(productId, null);
    try {
      // Reglas para size:
      // - sin talles: no enviamos size
      // - 1 talle: lo usamos automáticamente
      // - >1 talles: requerimos selección en el select
      let sizeToSend: string | undefined;
      if (Array.isArray(product.sizes) && product.sizes.length > 0) {
        if (product.sizes.length === 1) {
          sizeToSend = product.sizes[0];
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

      /* 👇 NUEVO: FLY ANIMATION con “bump” del target para que se vea mejor */
      const imgEl = document.querySelector<HTMLImageElement>(`[data-product-img="${productId}"]`);
      const cartEl = document.querySelector<HTMLElement>("[data-cart-target]");
      if (imgEl && cartEl) {
        // fly admite (img, target [, options]). Si tu hook no soporta options, ignora el 3er arg sin romper.
        try { fly(imgEl, cartEl, { duration: 700, easing: "ease-out", shrinkTo: 0.2, shadow: true }); } catch { fly(imgEl, cartEl as any); }
        // micro-animación del icono de carrito (badge bump)
        cartEl.classList.add("cart-bump");
        setTimeout(() => cartEl.classList.remove("cart-bump"), 250);
      }

      // ✅ NUEVO: refrescar el contador del carrito (header) desde el servidor
      const newCount = await fetchCartTotalCount();
      if (typeof newCount === "number") emitCartCount(newCount);
      else {
        // fallback: si no pudimos traer del server, al menos incrementamos 1
        const prev = Number(localStorage.getItem("cart_count") || "0") || 0;
        emitCartCount(prev + 1);
      }

      setAddMsg("Producto agregado ✅"); // (global, lo dejo como estaba)
      setCardMsg(productId, "Producto agregado ✅"); // feedback por tarjeta
      // opcional: router.push("/carrito");
    } catch (e: any) {
      const msg = String(e?.message || "No se pudo agregar");
      setAddMsg(msg);
      setCardMsg(productId, msg);
      if (msg.toLowerCase().includes("no autenticado")) {
        router.push(`/auth?redirectTo=/catalogo`);
      }
    } finally {
      setAddingId(null);
      setTimeout(() => {
        setAddMsg(null);
        setCardMsg(productId, null);
      }, 2500); // limpiar feedback
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className={styles.wrap}>
      {/* 👇 NUEVO: portal de la animación */}
      <Portal />

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
              const needsSizeSelection = Array.isArray(p.sizes) && p.sizes.length > 1;
              const noStock = typeof p.stock === "number" && p.stock <= 0;
              return (
                <article key={p._id} className={styles.card}>
                  <Link href={`/producto/${p._id}`} className={styles.imgLink} aria-label={p.name}>
                    <div className={styles.imgBox}>
                      <img
                        src={img}
                        alt={p.name}
                        className={styles.img}
                        /* 👇 NUEVO: identificador para animación */
                        data-product-img={p._id}
                      />
                    </div>
                  </Link>

                  <div className={styles.cardBody}>
                    <h3 className={styles.title}>{p.name}</h3>
                    {/* ✅ usar formato ARS configurable */}
                    {typeof p.price === "number" && (
                      <div className={styles.price}>{formatMoney(p.price)}</div>
                    )}
                    {p.description && (
                      <p className={styles.desc}>
                        {p.description.length > 90 ? `${p.description.slice(0, 90)}…` : p.description}
                      </p>
                    )}

                    {/* === NUEVO: selección de talle/color en la card si corresponde === */}
                    {needsSizeSelection && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span style={{ fontSize: 12, opacity: 0.8 }}>Talle</span>
                          <select
                            value={sizeById[p._id] || ""}
                            onChange={(e) => setSizeById((s) => ({ ...s, [p._id]: e.target.value }))}
                            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", minWidth: 120 }}
                          >
                            <option value="">Elegí un talle</option>
                            {p.sizes!.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </label>

                      
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                      <Link href={`/producto/${p._id}`} className={styles.cta}>
                        Ver detalle
                      </Link>
                      <button
                        onClick={() => handleQuickAdd(p)}
                        disabled={
                          addingId === p._id ||
                          (needsSizeSelection && !(sizeById[p._id] || "").trim()) ||
                          noStock
                        }
                        className={styles.cta}
                        title={noStock ? "Sin stock" : "Agregar al carrito"}
                        style={{ background: "white", border: "1px solid #ddd", color: "#111" }}
                      >
                        {addingId === p._id ? "Agregando…" : noStock ? "Sin stock" : "Agregar"}
                      </button>
                    </div>

                    {/* Mensaje por tarjeta */}
                    {addMsgById[p._id] && (
                      <div
                        style={{
                          marginTop: 6,
                          color: addMsgById[p._id]?.includes("✅") ? "green" : "crimson",
                        }}
                      >
                        {addMsgById[p._id]}
                      </div>
                    )}

                    {/* (Se mantiene el mensaje global existente) */}
                    {addMsg && (
                      <div style={{ marginTop: 6, color: addMsg.includes("✅") ? "green" : "crimson" }}>
                        {addMsg}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
<div className={styles.moreRow}>
  <Link href="/catalogo" className={styles.moreCta} rel="noopener noreferrer">
    <span>Ver catálogo completo</span>
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={styles.moreIcon}>
      <path d="M5 12h13M12 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  </Link>
</div>
        </>
      )}
    </section>
  );
}
