// src/app/producto/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation"; // 👈
import { resolveImageUrls } from "@/lib/resolveImageUrls";
import { addToCart } from "@/lib/cartClient"; // 👈
import { fetchProductReviews, createReview, deleteReview, likeReview, Review } from "@/lib/reviewsApi";

type RatingDistribution = {
  "1"?: number;
  "2"?: number;
  "3"?: number;
  "4"?: number;
  "5"?: number;
};

type ReviewStats = {
  totalReviews: number;
  averageRating: number;
  ratingDistribution?: RatingDistribution;
};

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
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
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
      if (!abort) {
        setReviews(r.reviews);
        setRevTotalPages(r.totalPages);
      }
    } catch (e:any) {
      if (!abort) setRevErr(e?.message || "No se pudieron cargar las reseñas");
    } finally {
      if (!abort) setRevLoading(false);
    }
  })();
  return () => { abort = true; };
}, [p?._id, revPage]);

async function handleAdd(e: React.FormEvent) {
  e.preventDefault();
  if (!p?._id) return;
  setAdding(true);
  setAddMsg(null);
  try {
    await addToCart({
      productId: p._id,
      quantity: qty,
      size: size || undefined,
      color: color || undefined,
    });
    setAddMsg("Producto agregado al carrito ✅");
    // opcional: redirigir automáticamente al carrito
    // router.push("/carrito");
  } catch (err: any) {
    const msg = String(err?.message || "No se pudo agregar");
    setAddMsg(msg);
    if (msg.toLowerCase().includes("no autenticado")) {
      router.push(`/auth?redirectTo=/producto/${p._id}`);
    }
  } finally {
    setAdding(false);
  }
}
  

  useEffect(() => {
    if (!id) return;

    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`${API_BASE}/products/${id}`, {
          cache: "no-store",
          signal: ac.signal,
        });

        const text = await res.text();
        const json = text ? JSON.parse(text) : null;

        if (res.status === 404) {
          // Respuesta de error según tu especificación
          const msg = json?.message || "Producto no encontrado";
          setErr(msg);
          setP(null);
          setImgs([]);
          return;
        }

        if (!res.ok) throw new Error(json?.message || "No se pudo obtener el producto");

        const data: Product = json?.data ?? json; // soporta {success,data} o plano
        setP(data);

        const urls = await resolveImageUrls(data?.images ?? []);
        setImgs(urls);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "Error");
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [id]);

  /* === NUEVO: autoseleccionar talle cuando el producto tiene solo 1 === */
  useEffect(() => {
    if (p?.sizes && p.sizes.length === 1) {
      setSize(p.sizes[0] ?? "");
    }
  }, [p?.sizes]);

  if (err) {
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "crimson", marginBottom: 8 }}>{err}</p>
        <a href="/catalogo" style={{ textDecoration: "underline" }}>Volver al catálogo</a>
      </main>
    );
  }

  if (loading || !p) {
    return (
      <main style={{ padding: 16 }}>
        <p>Cargando…</p>
      </main>
    );
  }

  const dist: RatingDistribution = p.reviewStats?.ratingDistribution ?? {};
  const totalReviews = p.reviewStats?.totalReviews ?? 0;
  const maxCount = Math.max(1, ...[1,2,3,4,5].map(k => dist[String(k) as keyof RatingDistribution] ?? 0));

  /* === NUEVO: helpers para validación visual === */
  const requiresSize = Array.isArray(p.sizes) && p.sizes.length > 0;
  const disableAdd = adding || (requiresSize && !size);

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

      {/* Info principal */}
      <section
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
          marginBottom: 16,
        }}
      >
        <p><strong>ID:</strong> {p._id}</p>
        {typeof p.price === "number" && <p><strong>Precio:</strong> {currency(p.price)}</p>}
        {p.category && <p><strong>Categoría:</strong> {p.category}</p>}
        {Array.isArray(p.sizes) && p.sizes.length > 0 && (
          <p><strong>Talles:</strong> {p.sizes.join(", ")}</p>
        )}
        {typeof p.stock === "number" && <p><strong>Stock:</strong> {p.stock}</p>}
        {(typeof p.isFeatured === "boolean" || typeof p.isPreorder === "boolean") && (
          <p>
            {p.isFeatured && <span style={{ padding: "2px 8px", border: "1px solid #ddd", borderRadius: 999, marginRight: 8 }}>Destacado</span>}
            {p.isPreorder && <span style={{ padding: "2px 8px", border: "1px solid #ddd", borderRadius: 999 }}>Preventa</span>}
          </p>
        )}
        {p.description && <p style={{ marginTop: 8 }}>{p.description}</p>}
      </section>

      {/* Review stats */}
      {p.reviewStats && (
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
            marginBottom: 16,
          }}
        >

{/* Agregar al carrito */}
<section
  style={{
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
    marginBottom: 16,
  }}
>
  <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Comprar</h2>
  <form onSubmit={handleAdd} style={{ display: "grid", gap: 8 }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 13, opacity: 0.8 }}>Cantidad</span>
        <input
          type="number"
          min={1}
          max={p.stock && p.stock > 0 ? p.stock : undefined} // 👈 NUEVO: limitar por stock si existe
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", width: 120 }}
        />
      </label>

      {/* Mostrar selector de talle solo si el producto tiene talles */}
      {Array.isArray(p.sizes) && p.sizes.length > 0 && (
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Talle</span>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            required
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", width: 160 }}
          >
            <option value="" disabled>Elegí un talle</option>
            {p.sizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      )}

      {/* Color opcional simple */}
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 13, opacity: 0.8 }}>Color (opcional)</span>
        <input
          value={color}
          onChange={(e) => setColor(e.target.value)}
          placeholder="Rojo, Azul…"
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", width: 180 }}
        />
      </label>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <button
        type="submit"
        disabled={disableAdd} // 👈 NUEVO: deshabilitar si falta talle
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: disableAdd ? "#f3f3f3" : "white",
          cursor: disableAdd ? "default" : "pointer",
          fontWeight: 700,
        }}
      >
        {adding ? "Agregando…" : "Agregar al carrito"}
      </button>

      <button
        type="button"
        onClick={() => router.push("/carrito")}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "white",
          fontWeight: 600,
        }}
      >
        Ver carrito
      </button>

      {addMsg && (
        <span style={{ color: addMsg.includes("✅") ? "green" : "crimson" }}>{addMsg}</span>
      )}
    </div>
  </form>
</section>


          <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>Opiniones</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {p.reviewStats.averageRating?.toFixed(1) ?? "0.0"}
            </div>
            <div aria-label="rating" style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: 5 }).map((_, i) => {
                const filled = (p.reviewStats?.averageRating ?? 0) >= i + 1;
                const half = (p.reviewStats?.averageRating ?? 0) > i && (p.reviewStats?.averageRating ?? 0) < i + 1;
                return (
                  <span key={i} title={`${i + 1} estrellas`} style={{ fontSize: 20, lineHeight: 1 }}>
                    {filled ? "★" : half ? "☆" : "☆"}
                  </span>
                );
              })}
            </div>
            <div style={{ color: "#666" }}>{totalReviews} reseña{totalReviews === 1 ? "" : "s"}</div>
          </div>


<section style={{ marginTop: 16 }}>
  <h3 style={{ marginBottom: 8 }}>Reseñas</h3>
  {revLoading && <p>Cargando reseñas…</p>}
  {revErr && <p style={{ color: "crimson" }}>{revErr}</p>}
  {!revLoading && !revErr && reviews.length === 0 && <p>No hay reseñas todavía.</p>}
  {!revLoading && !revErr && reviews.length > 0 && (
    <ul style={{ display: "grid", gap: 12, margin: 0, padding: 0, listStyle: "none" }}>
      {reviews.map((r) => (
        <li key={r._id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 600 }}>{r.userName || r.userId}</div>
          <div>{Array.from({ length: 5 }).map((_, i) => (
            <span key={i}>{i < r.rating ? "★" : "☆"}</span>
          ))}</div>
          <p style={{ margin: "6px 0" }}>{r.comment}</p>
          <small style={{ color: "#666" }}>
            {new Date(r.createdAt ?? "").toLocaleString("es-AR")}
          </small>
          <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
            <button
              onClick={() => likeReview(r._id, true)}
              style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
            >
              Útil ({r.helpfulVotes ?? 0}/{r.totalVotes ?? 0})
            </button>
          </div>
        </li>
      ))}
    </ul>
  )}
  <div style={{ marginTop: 12 }}>
    {Array.from({ length: revTotalPages }).map((_, i) => (
      <button
        key={i}
        onClick={() => setRevPage(i + 1)}
        style={{
          marginRight: 6,
          border: "1px solid #ddd",
          borderRadius: 4,
          padding: "4px 8px",
          background: revPage === i + 1 ? "#eee" : "white",
        }}
      >
        {i + 1}
      </button>
    ))}
  </div>
</section>


          {/* Distribución 5→1 */}
          <div style={{ display: "grid", gap: 6 }}>
            {[5,4,3,2,1].map((star) => {
              const count = dist[String(star) as keyof RatingDistribution] ?? 0;
              const pct = Math.round((count / Math.max(1, maxCount)) * 100);
              return (
                <div key={star} style={{ display: "grid", gridTemplateColumns: "36px 1fr 48px", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "#666" }}>{star}★</div>
                  <div style={{ background: "#f2f2f2", borderRadius: 6, overflow: "hidden", height: 10 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#111" }} />
                  </div>
                  <div style={{ fontSize: 12, textAlign: "right", color: "#666" }}>{count}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* === NUEVO: Duplicamos el bloque de “Agregar al carrito” cuando NO hay reviewStats
           para que SIEMPRE exista la opción de compra sin quitar nada del código anterior. === */}
      {!p.reviewStats && (
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Comprar</h2>
          <form onSubmit={handleAdd} style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Cantidad</span>
                <input
                  type="number"
                  min={1}
                  max={p.stock && p.stock > 0 ? p.stock : undefined}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", width: 120 }}
                />
              </label>

              {Array.isArray(p.sizes) && p.sizes.length > 0 && (
                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 13, opacity: 0.8 }}>Talle</span>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    required
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", width: 160 }}
                  >
                    <option value="" disabled>Elegí un talle</option>
                    {p.sizes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              )}

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Color (opcional)</span>
                <input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Rojo, Azul…"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", width: 180 }}
                />
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <button
                type="submit"
                disabled={disableAdd}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: disableAdd ? "#f3f3f3" : "white",
                  cursor: disableAdd ? "default" : "pointer",
                  fontWeight: 700,
                }}
              >
                {adding ? "Agregando…" : "Agregar al carrito"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/carrito")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  fontWeight: 600,
                }}
              >
                Ver carrito
              </button>

              {addMsg && (
                <span style={{ color: addMsg.includes("✅") ? "green" : "crimson" }}>{addMsg}</span>
              )}
            </div>
          </form>
        </section>
      )}

      {/* Metadatos */}
      {(p.createdAt || p.updatedAt) && (
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          {p.createdAt && <p style={{ margin: 0 }}><strong>Creado:</strong> {formatDate(p.createdAt)}</p>}
          {p.updatedAt && <p style={{ margin: 0 }}><strong>Actualizado:</strong> {formatDate(p.updatedAt)}</p>}
        </section>
      )}
    </main>
  );
}
