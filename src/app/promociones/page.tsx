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
  fetchPromotionsActive,
  fetchProductById,
  computePromoPrice,
  formatMoney,
} from "@/lib/promotionsApi";

type UIProduct = ProductDto & {
  _id: string;
  _thumb?: string | null;
};

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
        const list = await fetchPromotionsActive();
        setPromos(list);

        // Traemos y preparamos productos por promo
        const map: Record<string, UIProduct[]> = {};
        for (const promo of list) {
          const prods: UIProduct[] = [];
          // ⚠️ Simple y robusto: 1 request por id (si luego tenés batch endpoint, lo cambiamos fácil)
          const uniqueIds = Array.from(new Set(promo.productIds ?? [])).slice(0, 60);
          const fetched = await Promise.all(uniqueIds.map((id) => fetchProductById(id)));
          for (const p of fetched) {
            if (!p) continue;
            const ui: UIProduct = { ...(p as any), _id: (p as any)._id || (p as any).id || "" };

            // Thumbnail similar a Featured
            let thumb = getDirectImg(ui);
            if (!thumb && Array.isArray((ui as any).images) && (ui as any).images.length) {
              const first = String((ui as any).images[0] || "");
              if (first && likelyImage(first)) {
                thumb = first;
              } else {
                try {
                  const urls = await resolveImageUrls((ui as any).images);
                  if (urls[0] && likelyImage(urls[0])) thumb = urls[0];
                } catch {/* ignore */}
              }
            }
            ui._thumb = thumb ?? null;
            prods.push(ui);
          }
          // Filtramos productos sin imagen (para mantener estética)
          map[promo._id || promo.name] = prods.filter((p) => !!p._thumb);
        }
        setByPromoProducts(map);
      } catch (e: any) {
        setError(e?.message || "No se pudieron cargar las promociones.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
  console.log("Promos cargadas:", promos);
}, [promos]);

  const nonEmptyPromos = useMemo(
    () => promos.filter((pr) => (byPromoProducts[pr._id || pr.name] || []).length > 0),
    [promos, byPromoProducts]
  );

  async function handleAdd(product: UIProduct, promo: Promotion) {
    const productId = product._id;
    setAdding(productId);
    try {
      // size (si hay más de uno, requerimos selección)
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

      // (Opcional) feedback suave
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

      {!loading && !error && nonEmptyPromos.length === 0 && (
        <div className={styles.emptyBox}>
          <p>No hay promociones activas por ahora.</p>
          <Link href="/catalogo" className={styles.link}>Ver catálogo completo</Link>
        </div>
      )}

      {!loading && !error && nonEmptyPromos.length > 0 && (
        <div className={styles.promoCol}>
          {nonEmptyPromos.map((promo) => {
            const list = byPromoProducts[promo._id || promo.name] || [];
            return (
              <section key={promo._id || promo.name} className={styles.promoBlock}>
                <div className={styles.promoHeader}>
                  <h2 className={styles.h2}>{promo.name}</h2>
                  <span className={styles.badgeType}>
                    {promo.type === "percentage" && "Porcentaje"}
                    {promo.type === "fixed_amount" && "Monto fijo"}
                    {promo.type === "buy_x_get_y" && "2x1 / NXN"}
                  </span>
                </div>

                <div className={styles.grid}>
                  {list.map((p) => {
                    const basePrice = (p as any).price ?? 0;
                    const info = computePromoPrice(promo, basePrice);
                    const multipleSizes = Array.isArray((p as any).sizes) && (p as any).sizes.length > 1;

                    const showStrike =
                      promo.type === "percentage" || promo.type === "fixed_amount";

                    return (
                      <article key={p._id} className={styles.card}>
                        <Link href={`/producto/${p._id}`} className={styles.imgLink} aria-label={p.name}>
                          <div className={styles.imgBox}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p._thumb!} alt={p.name} className={styles.img} loading="lazy" />
                            <span className={styles.promoBadge}>{info.badge}</span>
                            {promo.type === "buy_x_get_y" && (
                              <span className={styles.nxnTag}>Promo NXN</span>
                            )}
                          </div>
                        </Link>

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
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
