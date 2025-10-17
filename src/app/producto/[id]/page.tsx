// src/app/producto/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { resolveImageUrls } from "@/lib/resolveImageUrls";
import { addToCart } from "@/lib/cartClient";
import { fetchProductReviews, createReview, deleteReview, likeReview, Review } from "@/lib/reviewsApi";
import s from "./ProductDetail.module.css"; // 👈 NUEVO

type RatingDistribution = { "1"?: number; "2"?: number; "3"?: number; "4"?: number; "5"?: number; };
type ReviewStats = { totalReviews: number; averageRating: number; ratingDistribution?: RatingDistribution; };

type Product = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  images?: string[];
  sizes?: string[];
  stock?: number;
  isPreorder?: boolean;
  isFeatured?: boolean;
  reviewStats?: ReviewStats;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

function currency(n?: number) {
  if (typeof n !== "number") return "";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}
function formatDate(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch { return iso; }
}

export default function ProductDetail() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [p, setP] = useState<Product | null>(null);
  const [imgs, setImgs] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const router = useRouter();
  const [qty, setQty] = useState<number>(1);
  const [size, setSize] = useState<string>("");
  const [color, setColor] = useState<string>("");
  const [adding, setAdding] = useState<boolean>(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [revPage, setRevPage] = useState(1);
  const [revTotalPages, setRevTotalPages] = useState(1);
  const [revLoading, setRevLoading] = useState(false);
  const [revErr, setRevErr] = useState<string|null>(null);

  useEffect(() => {
    if (!p?._id) return;
    let abort = false;
    (async () => {
      setRevLoading(true);
      try {
        const r = await fetchProductReviews(p._id, { page: revPage, limit: 5, sortBy: "date" });
        if (!abort) { setReviews(r.reviews); setRevTotalPages(r.totalPages); }
      } catch (e:any) {
        if (!abort) setRevErr(e?.message || "No se pudieron cargar las reseñas");
      } finally { if (!abort) setRevLoading(false); }
    })();
    return () => { abort = true; };
  }, [p?._id, revPage]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!p?._id) return;
    setAdding(true); setAddMsg(null);
    try {
      await addToCart({ productId: p._id, quantity: qty, size: size || undefined, color: color || undefined });
      setAddMsg("Producto agregado al carrito ✅");
      // router.push("/carrito");
    } catch (err: any) {
      const msg = String(err?.message || "No se pudo agregar");
      setAddMsg(msg);
      if (msg.toLowerCase().includes("no autenticado")) {
        router.push(`/auth?redirectTo=/producto/${p._id}`);
      }
    } finally { setAdding(false); }
  }

  useEffect(() => {
    if (!id) return;
    const ac = new AbortController();
    (async () => {
      setLoading(true); setErr(null);
      try {
        const res = await fetch(`${API_BASE}/products/${id}`, { cache: "no-store", signal: ac.signal });
        const text = await res.text();
        const json = text ? JSON.parse(text) : null;
        if (res.status === 404) { setErr(json?.message || "Producto no encontrado"); setP(null); setImgs([]); return; }
        if (!res.ok) throw new Error(json?.message || "No se pudo obtener el producto");
        const data: Product = json?.data ?? json;
        setP(data);
        const urls = await resolveImageUrls(data?.images ?? []);
        setImgs(urls);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "Error");
      } finally { setLoading(false); }
    })();
    return () => ac.abort();
  }, [id]);

  useEffect(() => { if (p?.sizes && p.sizes.length === 1) setSize(p.sizes[0] ?? ""); }, [p?.sizes]);

  if (err) {
    return (
      <main className={s.page}>
        <p className={s.error}>{err}</p>
        <a href="/catalogo" className={s.link}>Volver al catálogo</a>
      </main>
    );
  }
  if (loading || !p) {
    return (
      <main className={s.page}><p>Cargando…</p></main>
    );
  }

  const dist: RatingDistribution = p.reviewStats?.ratingDistribution ?? {};
  const totalReviews = p.reviewStats?.totalReviews ?? 0;
  const maxCount = Math.max(1, ...[1,2,3,4,5].map(k => dist[String(k) as keyof RatingDistribution] ?? 0));
  const requiresSize = Array.isArray(p.sizes) && p.sizes.length > 0;
  const noStock = typeof p.stock === "number" && p.stock <= 0;
  const disableAdd = adding || (requiresSize && !size) || noStock;

  return (
    <main className={s.page}>
      <div className={s.grid}>
        {/* Galería */}
      <section className={`${s.gallery} ${imgs.length === 1 ? s.gallerySingle : ""}`}>
  {!!imgs.length && imgs.map((src, i) => (
    <img
      key={src + i}
      src={src}
      alt={`${p.name} ${i + 1}`}
      className={s.galleryImg}
      loading="lazy"
    />
  ))}
</section>

        {/* Buy card (sticky en desktop) */}
        <aside className={s.buyCard}>
          <h1 className={s.title}>{p.name}</h1>

          <div className={s.priceRow}>
            {typeof p.price === "number" && <div className={s.price}>{currency(p.price)}</div>}
            <div className={s.badges}>
              {p.isFeatured && <span className={s.badge}>Destacado</span>}
              {p.isPreorder && <span className={s.badgeAlt}>Preventa</span>}
              {noStock && <span className={s.badgeWarn}>Sin stock</span>}
            </div>
          </div>

          {p.category && <div className={s.meta}><strong>Categoría:</strong> {p.category}</div>}
          {typeof p.stock === "number" && <div className={s.meta}><strong>Stock:</strong> {p.stock}</div>}
          {Array.isArray(p.sizes) && p.sizes.length > 0 && (
            <div className={s.meta}><strong>Talles:</strong> {p.sizes.join(", ")}</div>
          )}

          {p.description && <p className={s.desc}>{p.description}</p>}

          <div className={s.divider} />

          <h2 className={s.h2}>Comprar</h2>
          <form onSubmit={handleAdd} className={s.form}>
            <div className={s.formRow}>
              <label className={s.field}>
                <span className={s.label}>Cantidad</span>
                <input
                  type="number"
                  min={1}
                  max={p.stock && p.stock > 0 ? p.stock : undefined}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
                  className={s.input}
                  disabled={noStock}
                />
              </label>

              {Array.isArray(p.sizes) && p.sizes.length > 0 && (
                <label className={s.field}>
                  <span className={s.label}>Talle</span>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    required
                    className={s.select}
                    disabled={noStock}
                  >
                    <option value="" disabled>Elegí un talle</option>
                    {p.sizes.map((szz) => (
                      <option key={szz} value={szz}>{szz}</option>
                    ))}
                  </select>
                </label>
              )}

             
            </div>

            <div className={s.actions}>
              <button
                type="submit"
                disabled={disableAdd}
                className={`${s.btn} ${s.btnPrimary} ${disableAdd ? s.btnDisabled : ""}`}
                title={noStock ? "Sin stock" : "Agregar al carrito"}
              >
                {adding ? "Agregando…" : noStock ? "Sin stock" : "Agregar al carrito"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/carrito")}
                className={s.btn}
              >
                Ver carrito
              </button>

              {addMsg && (
                <span className={addMsg.includes("✅") ? s.msgOk : s.msgErr}>{addMsg}</span>
              )}
            </div>
          </form>

         
        </aside>
      </div>

      {/* Opiniones */}
      {p.reviewStats && (
        <section className={s.card}>
          <h2 className={s.h2}>Opiniones</h2>

          <div className={s.ratingHeader}>
            <div className={s.ratingBig}>{p.reviewStats.averageRating?.toFixed(1) ?? "0.0"}</div>
            <div aria-label="rating" className={s.stars}>
              {Array.from({ length: 5 }).map((_, i) => {
                const r = p.reviewStats?.averageRating ?? 0;
                const filled = r >= i + 1;
                const half = r > i && r < i + 1;
                return (
                  <span key={i} className={s.star} title={`${i + 1} estrellas`}>
                    {filled ? "★" : half ? "☆" : "☆"}
                  </span>
                );
              })}
            </div>
            <div className={s.muted}>{totalReviews} reseña{totalReviews === 1 ? "" : "s"}</div>
          </div>

          {/* Distribución 5→1 */}
          <div className={s.bars}>
            {[5,4,3,2,1].map((star) => {
              const count = dist[String(star) as keyof RatingDistribution] ?? 0;
              const pct = Math.round((count / Math.max(1, maxCount)) * 100);
              return (
                <div key={star} className={s.barRow}>
                  <div className={s.barLabel}>{star}★</div>
                  <div className={s.barTrack}>
                    <div className={s.barFill} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={s.barCount}>{count}</div>
                </div>
              );
            })}
          </div>

          {/* Lista reseñas */}
          <section className={s.reviews}>
            <h3 className={s.h3}>Reseñas</h3>
            {revLoading && <p>Cargando reseñas…</p>}
            {revErr && <p className={s.msgErr}>{revErr}</p>}
            {!revLoading && !revErr && reviews.length === 0 && <p>No hay reseñas todavía.</p>}
            {!revLoading && !revErr && reviews.length > 0 && (
              <ul className={s.reviewList}>
                {reviews.map((r) => (
                  <li key={r._id} className={s.reviewItem}>
                    <div className={s.reviewName}>{r.userName || r.userId}</div>
                    <div className={s.reviewStars}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i}>{i < r.rating ? "★" : "☆"}</span>
                      ))}
                    </div>
                    <p className={s.reviewText}>{r.comment}</p>
                    <small className={s.muted}>
                      {new Date(r.createdAt ?? "").toLocaleString("es-AR")}
                    </small>
                    <div className={s.reviewActions}>
                      <button onClick={() => likeReview(r._id, true)} className={s.btnSm}>
                        Útil ({r.helpfulVotes ?? 0}/{r.totalVotes ?? 0})
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className={s.pagination}>
              {Array.from({ length: revTotalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setRevPage(i + 1)}
                  className={`${s.pageBtn} ${revPage === i + 1 ? s.pageBtnActive : ""}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
