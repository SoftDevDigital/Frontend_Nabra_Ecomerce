// src/app/pedidos/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

/* ========= Tipos compatibles con tu backend ========= */
type Product = { _id: string; name: string; price?: number; [k: string]: any };
type OrderItem = {
  product?: Product | null;
  productName?: string;   // compat
  quantity: number;
  size?: string;
  price: number;          // unitario
};
type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled" | string;

type ShippingContact = { name?: string; phone?: string; email?: string };

type Order = {
  _id: string;
  orderNumber?: string;
  items: OrderItem[];
  userId: string | { _id: string; email?: string };
  cartId?: string;

  /* Totales */
  subtotal?: number;
  discount?: number;        // backend viejo
  discountAmount?: number;  // alias local
  tax?: number;
  shippingCost?: number;
  total: number;
  currency?: string;        // "USD" | "ARS" | etc.

  /* Estados */
  status: OrderStatus;
  paymentStatus?: string;   // e.g. approved
  paymentMethod?: string;   // e.g. mercadopago
  paymentId?: string | null;

  /* Cliente */
  customerEmail?: string;
  customerName?: string;
  source?: string;   // web, app, etc.
  priority?: string; // normal, high, etc.

  /* Fechas */
  paymentDate?: string;
  createdAt?: string;
  updatedAt?: string;

  /* Envío */
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    contact?: ShippingContact;
  };
};

type OrdersWrapped = { success: true; data: Order[]; message?: string };
type OrdersWrappedPaged = {
  success: true;
  data: { orders: Order[]; total?: number; limit?: number; offset?: number };
  message?: string;
};
type OrdersError = { success: false; message: string };
type OrdersResponse = OrdersWrapped | OrdersWrappedPaged | OrdersError | Order[];

/* === NUEVO resumen === */
type MyOrdersSummary =
  | { success: true; data: { totalOrders: number; paidOrders: number; pendingOrders: number; totalSpent: number; currency?: string }; message?: string }
  | { success: false; message: string };

/* ========= Utils ========= */
function money(n?: number, ccy?: string) {
  if (typeof n !== "number") return "—";
  const code = ccy || "USD";
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: code }).format(n);
  } catch {
    return `${code} ${n}`;
  }
}
function itemName(it: OrderItem) {
  return it.product?.name ?? it.productName ?? "(Producto)";
}
function dt(iso?: string) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/* ========= Página: Mis pedidos (usuario) ========= */
export default function MyOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  // (opcional) si tu backend soporta paginación server-side:
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);

  /* === resumen === */
  const [summary, setSummary] = useState<{ totalOrders: number; paidOrders: number; pendingOrders: number; totalSpent: number; currency?: string } | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);

  async function loadOrders(nextOffset = offset, nextLimit = limit) {
    setLoading(true);
    setErr(null);
    try {
      // 1) Intentar el endpoint autenticado del usuario
      let r = await apiFetch<OrdersResponse>(`/orders/my-orders?limit=${nextLimit}&offset=${nextOffset}`, { method: "GET" });

      // 2) Fallback al endpoint general
      if (!Array.isArray(r) && (!("success" in r) || r.success !== true)) {
        r = await apiFetch<OrdersResponse>(`/orders?limit=${nextLimit}&offset=${nextOffset}`, { method: "GET" });
      }

      const takeArray = (resp: OrdersResponse): Order[] => {
        if (Array.isArray(resp)) return resp;
        if ("success" in resp && resp.success === true) {
          const data: any = (resp as any).data;
          return Array.isArray(data) ? data : (data?.orders ?? []);
        }
        return [];
      };

      const arr = takeArray(r).map((o) => ({
        ...o,
        discountAmount: typeof o.discountAmount === "number" ? o.discountAmount : (typeof (o as any).discount === "number" ? (o as any).discount : undefined),
      }));

      const sorted = [...arr].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      // totales para paginación si vienen
      let tt = arr.length, lo = nextLimit, of = nextOffset;
      if (!Array.isArray(r) && "success" in r && r.success === true) {
        const data: any = (r as any).data;
        tt = Array.isArray(data) ? arr.length : (data?.total ?? arr.length);
        lo = Array.isArray(data) ? nextLimit   : (data?.limit ?? nextLimit);
        of = Array.isArray(data) ? 0           : (data?.offset ?? nextOffset);
      }

      setOrders(sorted);
      setTotal(tt);
      setLimit(lo);
      setOffset(of);
    } catch (e: any) {
      const m = e?.message || "No se pudieron obtener tus pedidos";
      setErr(m);
      if (/(401|no autenticado|unauthorized|credenciales)/i.test(m)) {
        window.location.href = "/auth?redirectTo=/pedidos";
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    setSummaryErr(null);
    setLoadingSummary(true);
    try {
      const r = await apiFetch<MyOrdersSummary>(`/orders/my-orders/summary`, { method: "GET" });
      if ("success" in r && r.success) setSummary(r.data);
      else throw new Error(("message" in r && r.message) || "No se pudo obtener el resumen");
    } catch (e: any) {
      const m = e?.message || "No se pudo obtener el resumen";
      setSummaryErr(m);
      if (/(401|no autenticado|unauthorized|credenciales)/i.test(m)) {
        window.location.href = "/auth?redirectTo=/pedidos";
      }
    } finally {
      setLoadingSummary(false);
    }
  }

  useEffect(() => {
    loadOrders(0, limit);
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const page = useMemo(() => Math.floor(offset / Math.max(1, limit)) + 1, [offset, limit]);
  const pageCount = useMemo(
    () => Math.max(1, Math.ceil((total ?? orders.length) / Math.max(1, limit))),
    [total, orders.length, limit]
  );

  function goPrev() {
    const next = Math.max(0, offset - limit);
    if (next !== offset) loadOrders(next, limit);
  }
  function goNext() {
    const next = offset + limit;
    if (total == null || next < total) loadOrders(next, limit);
  }
  function changeLimit(newLimit: number) {
    const l = Number.isFinite(newLimit) && newLimit > 0 ? newLimit : 20;
    loadOrders(0, l);
  }

  const summaryCcy = summary?.currency || "USD";

  return (
    <main style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Mis pedidos</h1>
        <div style={{ marginLeft: "auto" }}>
          <Link href="/" style={{ opacity: 0.85 }}>Inicio</Link>
        </div>
      </header>

      {/* Resumen */}
      <section
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
          marginBottom: 12,
        }}
      >
        {loadingSummary ? (
          <div style={{ opacity: 0.8 }}>Cargando resumen…</div>
        ) : summaryErr ? (
          <div style={{ color: "crimson" }}>{summaryErr}</div>
        ) : (
          <>
            <div><strong>Pedidos totales:</strong> {summary?.totalOrders ?? "—"}</div>
            <div><strong>Pagados:</strong> {summary?.paidOrders ?? "—"}</div>
            <div><strong>Pendientes:</strong> {summary?.pendingOrders ?? "—"}</div>
            <div><strong>Gastado:</strong> {money(summary?.totalSpent ?? 0, summaryCcy)}</div>
          </>
        )}
      </section>

      {/* Controles */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, opacity: 0.8 }}>Por página:</label>
        <select
          value={limit}
          onChange={(e) => changeLimit(Number(e.target.value))}
          style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
        >
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <div style={{ opacity: 0.85 }}>
          Página <strong>{page}</strong> de <strong>{pageCount}</strong>
          {typeof total === "number" && <> • Total: <strong>{total}</strong></>}
        </div>

        <button
          type="button"
          onClick={() => { loadOrders(offset, limit); loadSummary(); }}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "white", fontWeight: 600 }}
        >
          Actualizar
        </button>

        <button
          type="button"
          onClick={goPrev}
          disabled={offset <= 0}
          style={{
            padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd",
            background: offset <= 0 ? "#f3f3f3" : "white", cursor: offset <= 0 ? "default" : "pointer", fontWeight: 600
          }}
          title="Anterior"
        >
          ◀
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={total !== null && offset + limit >= total}
          style={{
            padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd",
            background: total !== null && offset + limit >= total ? "#f3f3f3" : "white",
            cursor: total !== null && offset + limit >= total ? "default" : "pointer",
            fontWeight: 600
          }}
          title="Siguiente"
        >
          ▶
        </button>
      </div>

      {loading && <p>Cargando pedidos…</p>}
      {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}

      {!loading && !err && orders.length === 0 && (
        <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
          <p style={{ margin: 0 }}>No tenés pedidos todavía.</p>
          <p style={{ marginTop: 8 }}>
            <Link href="/catalogo">Ir al catálogo</Link>
          </p>
        </div>
      )}

      {!loading && !err && orders.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {orders.map((o) => {
            const discount = typeof o.discountAmount === "number" ? o.discountAmount : (typeof o.discount === "number" ? o.discount : undefined);
            const ccy = o.currency || "ARS";
            return (
              <article
                key={o._id}
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 12,
                  border: "1px solid #eee",
                  borderRadius: 12,
                  background: "#fff",
                }}
              >
                {/* Encabezado */}
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 700 }}>
                    {o.orderNumber ? o.orderNumber : `Pedido #${o._id}`}
                  </div>
                  <div>
                    <strong>Estado:</strong> {o.status}
                    {o.paymentStatus ? <> &nbsp;•&nbsp; <strong>Pago:</strong> {o.paymentStatus}</> : null}
                    {o.paymentMethod ? <> &nbsp;•&nbsp; <strong>Método:</strong> {String(o.paymentMethod).toUpperCase()}</> : null}
                  </div>

                  {/* Totales */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 14 }}>
                    {typeof o.subtotal === "number" && <span>Subtotal: {money(o.subtotal, ccy)}</span>}
                    {typeof discount === "number" && <span>Descuento: −{money(discount, ccy)}</span>}
                    {typeof o.tax === "number" && <span>Impuestos: {money(o.tax, ccy)}</span>}
                    {typeof o.shippingCost === "number" && <span>Envío: {money(o.shippingCost, ccy)}</span>}
                    <span><strong>Total:</strong> {money(o.total, ccy)}</span>
                  </div>

                  {/* Fechas */}
                  <div style={{ color: "#666", fontSize: 14 }}>
                    {o.createdAt && <>Creado: {dt(o.createdAt)}</>}
                    {o.paymentDate && <> &nbsp;•&nbsp; Pago: {dt(o.paymentDate)}</>}
                  </div>

                  {/* Cliente */}
                  {(o.customerName || o.customerEmail) && (
                    <div style={{ color: "#444", fontSize: 14 }}>
                      <strong>Cliente:</strong> {o.customerName ?? "—"} {o.customerEmail ? `• ${o.customerEmail}` : ""}
                    </div>
                  )}

                  {/* Envío */}
                  {o.shippingAddress && (
                    <div style={{ opacity: 0.95 }}>
                      <strong>Envío:</strong>{" "}
                      {[
                        o.shippingAddress.street,
                        o.shippingAddress.city,
                        o.shippingAddress.state,
                        o.shippingAddress.zip,
                        o.shippingAddress.country,
                      ].filter(Boolean).join(", ")}
                      {o.shippingAddress.contact && (
                        <>
                          {" • "}
                          {[
                            o.shippingAddress.contact.name,
                            o.shippingAddress.contact.phone,
                            o.shippingAddress.contact.email,
                          ].filter(Boolean).join(" | ")}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Ítems resumidos */}
                <div style={{ display: "grid", gap: 6 }}>
                  {(o.items ?? []).map((it, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 14 }}>
                      <span style={{ fontWeight: 600 }}>{itemName(it)}</span>
                      <span>• Cant: {it.quantity}</span>
                      {it.size ? <span>• Talle: {it.size}</span> : null}
                      <span>• Precio: {money(it.price, ccy)}</span>
                      <span>• Subtotal: {money(it.price * it.quantity, ccy)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <Link href={`/pedidos/${o._id}`} style={{ textDecoration: "underline" }}>
                    Ver detalle
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
