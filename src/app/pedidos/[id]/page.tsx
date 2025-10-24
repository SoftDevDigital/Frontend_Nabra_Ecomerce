// src/app/pedidos/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { cancelOrder } from "@/lib/ordersApi"; // 👈 agregado
import { getMyOrderShippingStatus, ShippingStatus } from "@/lib/ordersApi"; // 👈 agregado (shipping status)

/* ===== Tipos (nuevo contrato + compat con el viejo) ===== */
type OrderItemNew = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal?: number;
};

type ShippingAddressNew = {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
};

type OrderNew = {
  _id: string;
  orderNumber?: string;
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled" | string;
  paymentStatus?: string;
  total: number;

  // 🔹 agregados para compat con respuesta vieja
  currency?: string;        // e.g. "USD"
  subtotal?: number;        // e.g. 100
  shippingCost?: number;    // e.g. 0
  tax?: number;             // e.g. 16
  discountAmount?: number;  // mapear desde "discount"

  items: OrderItemNew[];
  shippingAddress?: ShippingAddressNew;
  trackingNumber?: string;
  estimatedDelivery?: string;
  createdAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;

  shippingInfo?: {
    rateId: string;
    carrier: string;
    service: string;
    price: number;
    currency: string;
    days?: string;
    serviceId?: string;
    trackingNumber?: string;
    shipmentId?: string;
    status?: string;
    labelUrl?: string;
  };
};

/* ===== Tipos antiguos (para compat) ===== */
type ProductOld = { _id: string; name: string; price?: number };
type OrderItemOld = { product: ProductOld; quantity: number; size?: string; price: number };
type ShippingAddressOld = { street: string; city: string; zip: string; country: string };
type OrderOld = {
  _id: string;
  items: OrderItemOld[];
  userId: string;
  cartId: string;
  total: number;
  status: string;
  shippingAddress: ShippingAddressOld;
};

/* ===== Respuesta antigua con wrapper {success,data} ===== */
type OrderResponseOld =
  | { success: true; data: OrderOld; message?: string }
  | { success: false; message: string };

/* ===== Helpers ===== */
function currency(n?: number, code: string = "ARS") {
  return typeof n === "number"
    ? new Intl.NumberFormat("es-AR", { style: "currency", currency: code }).format(n)
    : "";
}
function formatDT(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch {
    return iso;
  }
}

/** Normaliza para que el componente siempre use OrderNew */
function normalizeOrder(input: any): OrderNew {
  // Caso nuevo contrato (ya viene flat)
  if (
    input &&
    typeof input === "object" &&
    Array.isArray(input.items) &&
    ("orderNumber" in input || "paymentStatus" in input || "shippingCost" in input || "cancelledAt" in input)
  ) {
    return input as OrderNew;
  }

  // Caso viejo: wrapper { success, data }
  if (input && typeof input === "object" && "success" in input) {
    if (!(input as any).success) throw new Error((input as any).message || "No se encontró el pedido");
    const o = (input as any).data as {
      _id: string;
      items: { product?: { _id: string; name: string; price?: number }; quantity: number; size?: string; price: number }[];
      userId: string;
      cartId: string;
      total: number;
      status: string;
      shippingAddress: { street?: string; city?: string; zip?: string; country?: string };
      // 🔹 campos extra del viejo
      currency?: string;
      shippingCost?: number;
      subtotal?: number;
      tax?: number;
      discount?: number;
      createdAt?: string;
      updatedAt?: string;
    };

    return {
      _id: o._id,
      status: o.status,
      total: o.total,

      // 🔹 compat
      currency: o.currency,
      subtotal: o.subtotal,
      shippingCost: o.shippingCost,
      tax: o.tax,
      discountAmount: o.discount,
      createdAt: o.createdAt,

      items: (o.items || []).map((it) => ({
        productId: it.product?._id,
        productName: it.product?.name ?? "(Producto)",
        quantity: it.quantity,
        price: it.price,
        subtotal: (Number(it.price) || 0) * (Number(it.quantity) || 0),
      })),
      shippingAddress: {
        street: o.shippingAddress?.street,
        city: o.shippingAddress?.city,
        zipCode: o.shippingAddress?.zip,   // 👈 zip → zipCode
        country: o.shippingAddress?.country,
      },
    };
  }

  throw new Error("Formato de respuesta inesperado");
}


export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const orderId = params.id;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderNew | null>(null);

  /* ===== Admin: PUT /orders/:id/status ===== */
  type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";
  const STATUS_OPTIONS: OrderStatus[] = ["pending", "paid", "shipped", "delivered", "cancelled"];

  function getJwtPayload(): any | null {
    try {
      const t = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
      if (!t) return null;
      const parts = t.split(".");
      if (parts.length !== 3) return null;
      const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(decodeURIComponent(escape(json)));
    } catch {
      return null;
    }
  }
  function isAdminFromToken(): boolean {
    const p = getJwtPayload();
    if (!p) return false;
    const role = p.role || p.roles || p.userRole || p["https://example.com/roles"];
    if (Array.isArray(role)) return role.map(String).some((r) => r.toLowerCase() === "admin");
    if (typeof role === "string") return role.toLowerCase() === "admin";
    return false;
  }

  const [isAdmin, setIsAdmin] = useState(false);
  const [statusDraft, setStatusDraft] = useState<OrderStatus>("pending");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // 👇 cancelación
  const [canceling, setCanceling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  // 👇 agregado: estado de shipping-status
  const [shipStatus, setShipStatus] = useState<ShippingStatus | null>(null);
  const [loadingShip, setLoadingShip] = useState(false);
  const [shipErr, setShipErr] = useState<string | null>(null);
  // 👆 agregado

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);
  useEffect(() => {
    if (order) setStatusDraft((order.status as OrderStatus) ?? "pending");
  }, [order]);

  async function updateStatus() {
    if (!order) return;
    setStatusMsg(null);
    setSaving(true);
    try {
      if (!STATUS_OPTIONS.includes(statusDraft)) throw new Error("Estado inválido");

      const r = await apiFetch<OrderResponseOld | OrderNew>(`/orders/${order._id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: statusDraft }),
      });

      const norm = normalizeOrder(r);
      setOrder(norm);
      setStatusDraft((norm.status as OrderStatus) ?? "pending");
      setStatusMsg("Estado actualizado ✅");
    } catch (e: any) {
      const m = e?.message || "No se pudo actualizar el estado";
      setStatusMsg(m);
      if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("credenciales")) {
        window.location.href = `/auth?redirectTo=/pedidos/${orderId}`;
      }
    } finally {
      setSaving(false);
    }
  }

  /* ===== Cancelar pedido (PUT /orders/:id/cancel) ===== */
  const canCancel =
    !!order && !["shipped", "delivered", "cancelled"].includes(String(order.status).toLowerCase());

  async function handleCancel() {
    if (!order) return;
    setCancelMsg(null);

    const ok = window.confirm("¿Seguro que querés cancelar este pedido?");
    if (!ok) return;

    setCanceling(true);
    try {
      const res = await cancelOrder(order._id); // llama a /orders/:id/cancel
      // sincronizar con lo que vuelve del backend
      setOrder((prev) =>
        prev ? { ...prev, status: res.order.status, cancelledAt: res.order.cancelledAt } : prev
      );
      setCancelMsg(res.message || "Pedido cancelado ✅");
    } catch (e: any) {
      const m = String(e?.message || "No se pudo cancelar el pedido");
      setCancelMsg(m);
      if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("credenciales")) {
        window.location.href = `/auth?redirectTo=/pedidos/${orderId}`;
      }
    } finally {
      setCanceling(false);
    }
  }

  // 👇 agregado: fetch de estado de envío
  async function loadShippingStatus() {
    setShipErr(null);
    setLoadingShip(true);
    try {
      const s = await getMyOrderShippingStatus(orderId);
      setShipStatus(s);
    } catch (e: any) {
      const m = String(e?.message || "No se pudo obtener el estado de envío");
      setShipErr(m);
      if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("credenciales")) {
        window.location.href = `/auth?redirectTo=/pedidos/${orderId}`;
      }
    } finally {
      setLoadingShip(false);
    }
  }
  // 👆 agregado

  /* ===== Carga GET /orders/:id (nuevo contrato) ===== */
 useEffect(() => {
  async function load() {
    setLoading(true);
    setErr(null);
    try {
      // 1) Intentar detalle del pedido del usuario autenticado
      let r = await apiFetch<OrderNew | OrderResponseOld>(`/orders/my-orders/${orderId}`, { method: "GET" });

      // 2) Si no vino objeto Order directo ni {success:true,data}, hacer fallback al endpoint general
      const isWrapperOk = !!r && typeof r === "object" && "success" in (r as any) && (r as any).success === true;
      const isPlainOrder = !!r && typeof r === "object" && Array.isArray((r as any).items);

      if (!isWrapperOk && !isPlainOrder) {
        r = await apiFetch<OrderNew | OrderResponseOld>(`/orders/${orderId}`, { method: "GET" });
      }

      const norm = normalizeOrder(r);
      setOrder(norm);
    } catch (e: any) {
      const msg = e?.message || "No se encontró un pedido con ese ID";
      setErr(msg);
      if (/(401|no autenticado|unauthorized|credenciales)/i.test(msg)) {
        window.location.href = `/auth?redirectTo=/pedidos/${orderId}`;
      }
    } finally {
      setLoading(false);
    }
  }
  load();
}, [orderId]);

  // 👇 agregado: auto-consultar shipping-status si hay shipment/tracking
  useEffect(() => {
    if (order && (order.shippingInfo?.shipmentId || order.shippingInfo?.trackingNumber || order.trackingNumber)) {
      loadShippingStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, order?.shippingInfo?.shipmentId, order?.shippingInfo?.trackingNumber, order?.trackingNumber]);
  // 👆 agregado

  return (
    <main style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Pedido</h1>
        <span style={{ marginLeft: "auto", opacity: 0.75, fontSize: 14 }}>
          <Link href="/">Volver al inicio</Link>
        </span>
      </header>

      {loading && <p>Cargando pedido…</p>}
      {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}
      {!loading && !err && !order && <p>No se encontró el pedido.</p>}

      {!loading && order && (
        <section
          style={{
            display: "grid",
            gap: 12,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          {/* Encabezado con totales y metadatos */}
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>
              {order.orderNumber ? order.orderNumber : `Pedido #${order._id}`}
            </div>

            <div>
  <strong>Estado:</strong> {order.status}
  {order.paymentStatus ? <> &nbsp;•&nbsp; <strong>Pago:</strong> {order.paymentStatus}</> : null}
  &nbsp;•&nbsp; <strong>Total:</strong> {currency(order.total, order.currency || "ARS")}
</div>

<div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 14 }}>
  {typeof order.subtotal === "number" && (
    <span>Subtotal: {currency(order.subtotal, order.currency || "ARS")}</span>
  )}
  {typeof order.discountAmount === "number" && (
    <span>Descuento: −{currency(order.discountAmount, order.currency || "ARS")}</span>
  )}
  {typeof order.shippingCost === "number" && (
    <span>Envío: {currency(order.shippingCost, order.currency || "ARS")}</span>
  )}
  {typeof order.tax === "number" && (
    <span>Impuestos: {currency(order.tax, order.currency || "ARS")}</span>
  )}
</div>

            <div style={{ color: "#666", fontSize: 14 }}>
              {order.createdAt && <>Creado: {formatDT(order.createdAt)}</>}
              {order.shippedAt && <> &nbsp;•&nbsp; Enviado: {formatDT(order.shippedAt)}</>}
              {order.deliveredAt && <> &nbsp;•&nbsp; Entregado: {formatDT(order.deliveredAt)}</>}
              {order.cancelledAt && <> &nbsp;•&nbsp; Cancelado: {formatDT(order.cancelledAt)}</>}
              {order.estimatedDelivery && <> &nbsp;•&nbsp; ETA: {formatDT(order.estimatedDelivery)}</>}
            </div>

            {order.trackingNumber && <div><strong>Tracking:</strong> {order.trackingNumber}</div>}

            {order.shippingAddress && (
              <div>
                <strong>Envío:</strong>{" "}
                {[
                  order.shippingAddress.street,
                  order.shippingAddress.city,
                  order.shippingAddress.state,
                  order.shippingAddress.zipCode,
                  order.shippingAddress.country,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}

            {/* ⬇️ agregado: bloque con shippingInfo detallado */}
           {order.shippingInfo && (
  <div style={{ marginTop: 4 }}>
    <strong>Envío (carrier):</strong> {order.shippingInfo.carrier} – {order.shippingInfo.service}
    {" • "}
    <strong>Costo:</strong>{" "}
    {currency(
      order.shippingInfo.price,
      order.shippingInfo.currency || order.currency || "ARS"
    )}
    {" • "}
    {order.shippingInfo.days && <span>{order.shippingInfo.days} • </span>}
    {order.shippingInfo.trackingNumber && (
      <span>
        <strong>Tracking:</strong> {order.shippingInfo.trackingNumber} •{" "}
      </span>
    )}
    {order.shippingInfo.labelUrl && (
      <a
        href={order.shippingInfo.labelUrl}
        target="_blank"
        style={{ textDecoration: "underline" }}
      >
        Descargar etiqueta
      </a>
    )}
  </div>
)}
            {/* ⬆️ agregado */}

            {/* ⬇️ agregado: UI de estado de envío (shipping-status) */}
            <div style={{ marginTop: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={loadShippingStatus}
                  disabled={loadingShip}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: loadingShip ? "#f3f3f3" : "white",
                    cursor: loadingShip ? "default" : "pointer",
                    fontWeight: 600,
                  }}
                  title="Consultar estado de envío"
                >
                  {loadingShip ? "Consultando envío…" : "Actualizar estado de envío"}
                </button>

                {shipErr && <span style={{ color: "crimson" }}>{shipErr}</span>}
              </div>

              {shipStatus && !shipErr && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 10,
                    border: "1px solid #eee",
                    borderRadius: 10,
                    background: "#fafafa",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div>
                    <strong>Estado de envío:</strong> {shipStatus.status}
                    {shipStatus.lastUpdate && <> &nbsp;•&nbsp; <strong>Última actualización:</strong> {formatDT(shipStatus.lastUpdate)}</>}
                  </div>
                  <div style={{ color: "#555" }}>
                    {shipStatus.carrier && <>Carrier: {shipStatus.carrier} &nbsp;•&nbsp;</>}
                    {shipStatus.service && <>Servicio: {shipStatus.service} &nbsp;•&nbsp;</>}
                    {shipStatus.trackingNumber && <>Tracking: {shipStatus.trackingNumber}</>}
                  </div>

                  {Array.isArray(shipStatus.trackingEvents) && shipStatus.trackingEvents.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Historial:</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {shipStatus.trackingEvents
                          .slice()
                          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
                          .map((ev, i) => (
                            <div key={`${ev.timestamp}-${i}`} style={{ borderLeft: "3px solid #e5e5e5", paddingLeft: 8 }}>
                              <div style={{ fontSize: 13, color: "#666" }}>{formatDT(ev.timestamp)}</div>
                              <div style={{ fontWeight: 600 }}>{ev.status}</div>
                              <div style={{ fontSize: 14 }}>
                                {ev.description || "—"}
                                {ev.location ? ` • ${ev.location}` : ""}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* ⬆️ agregado */}
          </div>

          {/* Acciones de usuario: Cancelar pedido */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleCancel}
              disabled={!canCancel || canceling}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: !canCancel || canceling ? "#f3f3f3" : "white",
                cursor: !canCancel || canceling ? "default" : "pointer",
                fontWeight: 600,
              }}
              title="Cancelar pedido (PUT /orders/:id/cancel)"
            >
              {canceling ? "Cancelando…" : "Cancelar pedido"}
            </button>
            {cancelMsg && <span style={{ color: cancelMsg.includes("✅") ? "green" : "crimson" }}>{cancelMsg}</span>}
          </div>

          {/* Admin: cambiar estado */}
          {isAdmin && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
              <label style={{ fontSize: 13, opacity: 0.8 }}>Cambiar estado:</label>
              <select
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value as OrderStatus)}
                disabled={saving}
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
                aria-label="Seleccionar nuevo estado del pedido"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={updateStatus}
                disabled={saving}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: saving ? "#f3f3f3" : "white",
                  cursor: saving ? "default" : "pointer",
                  fontWeight: 600,
                }}
                title="Actualizar estado (PUT /orders/:id/status)"
              >
                {saving ? "Guardando…" : "Actualizar estado"}
              </button>
              {statusMsg && <span style={{ color: statusMsg.includes("✅") ? "green" : "crimson" }}>{statusMsg}</span>}
            </div>
          )}

          {/* Ítems */}
          <div style={{ marginTop: 6 }}>
            <h2 style={{ fontSize: 18, margin: "4px 0 8px" }}>Ítems</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {order.items.map((it, idx) => {
                const lineSubtotal =
                  typeof it.subtotal === "number"
                    ? it.subtotal
                    : (Number(it.price) || 0) * (Number(it.quantity) || 0);

                return (
                  <article
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      padding: 10,
                      border: "1px solid #f1f1f1",
                      borderRadius: 10,
                      background: "#fafafa",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{it.productName}</div>
                      <div style={{ marginTop: 4, fontSize: 14, opacity: 0.9 }}>
                        <span>Precio: {currency(it.price)}</span> • <span>Cant: {it.quantity}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 700 }}>{currency(lineSubtotal)}</div>
                  </article>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/catalogo" style={{ textDecoration: "underline" }}>Seguir comprando</Link>
            <Link href="/carrito" style={{ textDecoration: "underline" }}>Ir al carrito</Link>
          </div>
        </section>
      )}
    </main>
  );
}
