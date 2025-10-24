// src/app/promociones/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Promotions.module.css";
import Link from "next/link";
import { addToCart } from "@/lib/cartClient";
import { PRODUCTS_API_BASE, ProductDto } from "@/lib/productsApi";
import { resolveImageUrls } from "@/lib/resolveImageUrls";
import {
  Promotion,
  computePromoPrice,
  formatMoney,
} from "@/lib/promotionsApi";

type UIProduct = ProductDto & {
  _id: string;
  _thumb?: string | null;
};

/* =========================
   Utils de imagen
   ========================= */
function likelyImage(u?: string) {
  if (!u) return false;
  if (!/^https?:\/\//i.test(u)) return false;
  if (/\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(u)) return true;
  if (/[?&](width|height|format|v)=/i.test(u) && !/\.html?($|\?)/i.test(u)) return true;
  return !/\.html?($|\?)/i.test(u) && !/\.php($|\?)/i.test(u);
}
function getDirectImg(p: UIProduct) {
  const candidate =
    (p as any).imageUrl ||
    (p as any).coverUrl ||
    (p as any).image?.url ||
    (Array.isArray((p as any).media) ? (p as any).media[0]?.url : (p as any).media?.url);
  if (!candidate) return null;
  const abs = /^https?:\/\//i.test(candidate) ? candidate : `${PRODUCTS_API_BASE}/${candidate}`;
  return abs.replace(/([^:]\/)\/+/g, "$1");
}

/* =========================
   Helpers locales (sin filtros)
   ========================= */
type RawPromotion = {
  _id: string;
  name: string;
  type: "percentage" | "fixed_amount" | "buy_x_get_y";
  startDate?: string;
  endDate?: string;
  specificProducts?: string[];
  productIds?: string[];
  discountPercentage?: number;
  discountAmount?: number;
  buyQuantity?: number;
  getQuantity?: number;
};

function normalizeRaw(r: RawPromotion): Promotion {
  const productIds = Array.from(
    new Set([...(r.specificProducts ?? []), ...(r.productIds ?? [])])
  );

  if (r.type === "percentage") {
    return {
      _id: r._id,
      name: r.name,
      type: "percentage",
      productIds,
      startDate: r.startDate,
      endDate: r.endDate,
      discountPercentage: Number(r.discountPercentage ?? 0),
    };
  }
  if (r.type === "fixed_amount") {
    return {
      _id: r._id,
      name: r.name,
      type: "fixed_amount",
      productIds,
      startDate: r.startDate,
      endDate: r.endDate,
      discountAmount: Number(r.discountAmount ?? 0),
    };
  }
  return {
    _id: r._id,
    name: r.name,
    type: "buy_x_get_y",
    productIds,
    startDate: r.startDate,
    endDate: r.endDate,
    buyQuantity: Number(r.buyQuantity ?? 0),
    getQuantity: Number(r.getQuantity ?? 0),
  };
}

function getBearer(): string | null {
  try { return typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null; }
  catch { return null; }
}

/** 🚀 Trae promos directamente del endpoint, sin caché y sin filtrar por estado/fechas. */
async function fetchPromotionsActiveRaw(): Promise<Promotion[]> {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
  const url = `${API_BASE}/promotions/active`;
  const headers: HeadersInit = { Accept: "application/json" };
  const token = getBearer();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: "GET", cache: "no-store", headers });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  const normalized = (data as RawPromotion[]).map(normalizeRaw);
  return normalized;
}

/** GET /products/:id con caché suave + tolerante a errores */
async function fetchProductByIdSafe(id: string): Promise<ProductDto | null> {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
  try {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: "GET",
      cache: "force-cache",
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    const payload = json?.data ?? json;
    return payload && payload._id ? (payload as ProductDto) : null;
  } catch {
    return null;
  }
}

/* =========================
   UI helpers (meta & formato)
   ========================= */
function formatDateShort(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}
function daysLeft(iso?: string) {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return diff;
}
function typeLabel(t: Promotion["type"]) {
  if (t === "percentage") return "Descuento %";
  if (t === "fixed_amount") return "Monto fijo";
  return "2x1 / NXN";
}

export default function PromotionsPage() {
  const [loading, setLoading] = useState(true);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [byPromoProducts, setByPromoProducts] = useState<Record<string, UIProduct[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [sizeById, setSizeById] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchPromotionsActiveRaw();
        setPromos(list);

        const map: Record<string, UIProduct[]> = {};
        for (const promo of list) {
          const prods: UIProduct[] = [];
          const uniqueIds = Array.from(new Set(promo.productIds ?? [])).slice(0, 60);

          const fetched = await Promise.all(uniqueIds.map(async (id) => await fetchProductByIdSafe(id)));

          for (const p of fetched) {
            if (!p) continue;
            const ui: UIProduct = { ...(p as any), _id: (p as any)._id || (p as any).id || "" };

            let thumb = getDirectImg(ui);
            if (!thumb && Array.isArray((ui as any).images) && (ui as any).images.length) {
              const first = String((ui as any).images[0] || "");
              if (first && likelyImage(first)) {
                thumb = first;
              } else {
                try {
                  const urls = await resolveImageUrls((ui as any).images);
                  if (urls[0] && likelyImage(urls[0])) thumb = urls[0];
                } catch { /* ignore */ }
              }
            }
            ui._thumb = thumb ?? null;
            prods.push(ui);
          }

          map[promo._id || promo.name] = prods;
        }
        setByPromoProducts(map);
      } catch (e: any) {
        setError(e?.message || "No se pudieron cargar las promociones.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allPromos = useMemo(() => promos, [promos]);

  async function handleAdd(product: UIProduct, promo: Promotion) {
    const productId = product._id;
    setAdding(productId);
    try {
      let size: string | undefined;
      const sizes = (product as any).sizes as string[] | undefined;
      if (Array.isArray(sizes) && sizes.length > 0) {
        if (sizes.length === 1) size = sizes[0];
        else {
          const chosen = (sizeById[productId] || "").trim();
          if (!chosen) {
            alert("Elegí un talle para agregar este producto con promoción.");
            return;
          }
          size = chosen;
        }
      }
      const info = computePromoPrice(promo, (product as any).price || 0);
      const qty = promo.type === "buy_x_get_y" && info.suggestQty ? info.suggestQty : 1;
      await addToCart({ productId, quantity: qty, size });
      alert(qty > 1 ? `Agregamos ${qty} unidades (promo) ✅` : "Producto agregado ✅");
    } catch (e: any) {
      alert(e?.message || "No se pudo agregar al carrito.");
    } finally {
      setAdding(null);
    }
  }

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.pageEyebrow}>Special offers</div>
        <h1 className={styles.h1}>Promociones</h1>
        <p className={styles.sub}>
          Descuentos activos y beneficios como 2x1. Los precios finales se aplican automáticamente en el carrito.
        </p>
      </header>

      {loading && (
        <div className={styles.gridSkeleton}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${styles.card} ${styles.skeleton}`}>
              <div className={styles.imgSk} />
              <div className={styles.titleSk} />
              <div className={styles.priceSk} />
              <div className={styles.btnSk} />
            </div>
          ))}
        </div>
      )}

      {!loading && error && <p className={styles.error}>{error}</p>}

      {!loading && !error && allPromos.length === 0 && (
        <div className={styles.emptyBox}>
          <p>No hay promociones activas por ahora.</p>
          <Link href="/catalogo" className={styles.link}>Ver catálogo completo</Link>
        </div>
      )}

      {!loading && !error && allPromos.length > 0 && (
        <div className={styles.promoCol}>
          {allPromos.map((promo) => {
            const list = byPromoProducts[promo._id || promo.name] || [];
            const left = daysLeft(promo.endDate ?? undefined);
            return (
              <section key={promo._id || promo.name} className={styles.promoBlock}>
                <div className={styles.promoHeader}>
                  <div className={styles.promoTitleWrap}>
                    <span className={`${styles.typePill} ${
                      promo.type === "percentage" ? styles.typePct :
                      promo.type === "fixed_amount" ? styles.typeFixed : styles.typeNxn
                    }`}>
                      {typeLabel(promo.type)}
                    </span>
                    <h2 className={styles.h2}>{promo.name}</h2>
                  </div>

                  <div className={styles.promoMeta}>
                    {promo.endDate && (
                      <>
                        <span className={styles.metaDot} aria-hidden="true">•</span>
                        <span className={styles.until}>Hasta {formatDateShort(promo.endDate)}</span>
                      </>
                    )}
                    {typeof left === "number" && left >= 0 && (
                      <span className={styles.countdown}>
                        {left === 0 ? "¡Último día!" : `${left} ${left === 1 ? "día" : "días"} restantes`}
                      </span>
                    )}
                  </div>
                </div>

                {list.length === 0 ? (
                  <div className={styles.emptyBoxSm}>
                    <p>Estamos cargando los productos de esta promoción…</p>
                  </div>
                ) : (
                  <div className={styles.grid}>
                    {list.map((p) => {
                      const basePrice = (p as any).price ?? 0;
                      const info = computePromoPrice(promo, basePrice);
                      const multipleSizes =
                        Array.isArray((p as any).sizes) && (p as any).sizes.length > 1;
                      const showStrike =
                        promo.type === "percentage" || promo.type === "fixed_amount";

                      return (
                        <article key={p._id} className={styles.card}>
                          <div className={styles.cardMedia}>
                            <Link href={`/producto/${p._id}`} className={styles.imgLink} aria-label={p.name}>
                              <div className={styles.imgBox}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={p._thumb || "/placeholder-product.png"}
                                  alt={p.name}
                                  className={styles.img}
                                  loading="lazy"
                                />
                                <div className={styles.imgOverlay} />
                                <span className={styles.promoBadge}>{info.badge}</span>
                                {promo.type === "buy_x_get_y" && (
                                  <span className={styles.nxnTag}>Promo NXN</span>
                                )}
                              </div>
                            </Link>
                          </div>

                          <div className={styles.body}>
                            <h3 className={styles.title}>{p.name}</h3>

                            <div className={styles.priceRow}>
                              {showStrike && <span className={styles.strike}>{formatMoney(basePrice)}</span>}
                              <span className={styles.price}>
                                {formatMoney(info.finalPrice ?? basePrice)}
                              </span>
                            </div>

                            {info.sublabel && (
                              <div className={styles.sublabel}>{info.sublabel}</div>
                            )}

                            {multipleSizes && (
                              <label className={styles.sizeWrap}>
                                <span>Talle</span>
                                <select
                                  value={sizeById[p._id] || ""}
                                  onChange={(e) =>
                                    setSizeById((s) => ({ ...s, [p._id]: e.target.value }))
                                  }
                                >
                                  <option value="">Elegí un talle</option>
                                  {(p as any).sizes!.map((s: string) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </label>
                            )}

                            <div className={styles.ctaRow}>
                              <button
                                className={styles.cta}
                                disabled={adding === p._id}
                                onClick={() => handleAdd(p, promo)}
                              >
                                {adding === p._id
                                  ? "Agregando…"
                                  : promo.type === "buy_x_get_y"
                                    ? "Agregar promo"
                                    : "Agregar"}
                              </button>
                              <Link className={styles.link} href={`/producto/${p._id}`}>
                                Ver detalle
                              </Link>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
