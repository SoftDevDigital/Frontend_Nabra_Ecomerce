// src/app/admin/pedidos/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import s from "./AdminOrders.module.css";

/* ========= Tipos ========== */
type Product = {
  _id: string;
  name: string;
  price?: number;
  [k: string]: any;
};

type OrderItem = {
  product?: Product | null;
  quantity: number;
  size?: string;
  price: number;              // precio unitario tomado al crear el pedido
  productName?: string;       // compat cuando no viene poblado
};

type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

type Order = {
  _id: string;
  items: OrderItem[];
  userId: string;
  cartId: string;
  total: number;
  status: OrderStatus;
  shippingAddress: { street: string; city: string; zip: string; country: string };

  currency?: string;
  shippingCost?: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  paymentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  userIdObj?: { _id: string; email?: string } | null;

  trackingNumber?: string;
  shippingInfo?: { trackingNumber?: string } | null;
};

/* Tracking */
type TrackingEvent = { timestamp: string; status: string; description?: string; location?: string };
type TrackingResponse = {
  trackingNumber: string;
  status: string;
  estimatedDelivery?: string;
  currentLocation?: string;
  history?: TrackingEvent[];
};
async function trackShipment(trackingNumber: string): Promise<TrackingResponse> {
  return apiFetch<TrackingResponse>(`/shipping/tracking/${encodeURIComponent(trackingNumber)}`, { method: "GET" });
}

/* API responses */
type OrdersResponse =
  | { success: true; data: Order[]; message?: string }
  | { success: true; data: { orders: Order[]; total?: number; limit?: number; offset?: number } }
  | { success: false; message: string };

type UpdateStatusResponse =
  | { success: true; data: Order; message?: string }
  | { success: false; message: string };

/* ========= Helpers: detectar admin desde el JWT ========== */
function getJwtPayload(): any | null {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}
function isAdminFromToken(): boolean {
  const p = getJwtPayload();
  if (!p) return false;
  const role = p.role || p.roles || p.userRole || p["https://example.com/roles"];
  if (Array.isArray(role)) return role.map(String).some((r) => r.toLowerCase() === "admin");
  if (typeof role === "string") return role.toLowerCase() === "admin";
  return false;
}

/* ========= Constantes/formatos ========== */
const STATUS_OPTIONS: OrderStatus[] = ["pending", "paid", "shipped", "delivered", "cancelled"];

function money(n: number, currency?: string) {
  const cur = currency || "USD";
  try { return new Intl.NumberFormat("es-AR", { style: "currency", currency: cur }).format(n); }
  catch { return `${cur} ${n}`; }
}
function itemName(it: OrderItem) {
  return it.product?.name ?? it.productName ?? "(Producto)";
}
function userEmail(u: Order["userId"] | { _id: string; email?: string } | string | null | undefined) {
  if (!u) return "—";
  if (typeof u === "string") return u;
  return (u as any)?.email || (u as any)?._id || "—";
}

/* ========= Página ========== */
export default function AdminOrdersPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const [editing, setEditing] = useState<Record<string, OrderStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);

  const [trkInput, setTrkInput] = useState<Record<string, string>>({});
  const [trkLoading, setTrkLoading] = useState<Record<string, boolean>>({});
  const [trkErr, setTrkErr] = useState<Record<string, string | null>>({});
  const [trkData, setTrkData] = useState<Record<string, TrackingResponse | null>>({});

  useEffect(() => { setIsAdmin(isAdminFromToken()); }, []);

  async function loadOrders() {
    if (!isAdmin) return;
    setLoading(true); setErr(null);
    try {
      let r = await apiFetch<OrdersResponse>("/admin/orders?limit=50&offset=0", { method: "GET" });
      if (!("success" in r) || !r.success) {
        r = await apiFetch<OrdersResponse>("/orders", { method: "GET" });
        if (!("success" in r) || !r.success) throw new Error(("message" in r && r.message) || "No se pudieron obtener los pedidos");
      }
      const list: Order[] = Array.isArray((r as any).data) ? ((r as any).data as Order[]) : ((r as any).data?.orders ?? []);
      list.sort((a, b) => (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
      setOrders(list);

      const draft: Record<string, OrderStatus> = {}; list.forEach((o) => (draft[o._id] = o.status)); setEditing(draft);
      const ti: Record<string, string> = {};
      list.forEach((o) => {
        const tn = (o as any)?.trackingNumber || (o as any)?.shippingInfo?.trackingNumber || "";
        if (tn) ti[o._id] = String(tn);
      });
      setTrkInput((s) => ({ ...ti, ...s }));
    } catch (e: any) {
      const msg = e?.message || "No se pudieron obtener los pedidos";
      setErr(msg);
      if (msg.toLowerCase().includes("no autenticado") || msg.toLowerCase().includes("credenciales")) {
        window.location.href = "/auth?redirectTo=/admin/pedidos";
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { if (isAdmin) loadOrders(); }, [isAdmin]);

  async function handleUpdateStatus(orderId: string) {
    setGlobalMsg(null); setSavingId(orderId);
    try {
      const desired = editing[orderId];
      if (!STATUS_OPTIONS.includes(desired)) throw new Error("Estado inválido");
      const put = (path: string) => apiFetch<UpdateStatusResponse>(path, { method: "PUT", body: JSON.stringify({ status: desired }) });
      let r = await put(`/admin/orders/${orderId}/status`);
      if (!("success" in r) || !r.success) {
        r = await put(`/orders/${orderId}/status`);
        if (!("success" in r) || !r.success) throw new Error(("message" in r && r.message) || "No se pudo actualizar el estado");
      }
      setOrders((prev) => prev.map((o) => (o._id === orderId ? r.data : o)));
      setEditing((s) => ({ ...s, [orderId]: r.data.status }));
      setGlobalMsg("Estado actualizado ✅");
    } catch (e: any) {
      const msg = e?.message || "No se pudo actualizar el estado";
      setGlobalMsg(msg);
      if (msg.toLowerCase().includes("no autenticado") || msg.toLowerCase().includes("credenciales")) {
        window.location.href = "/auth?redirectTo=/admin/pedidos";
      }
    } finally { setSavingId(null); }
  }

  function resolveTrackingNumber(o: Order, orderId: string): string {
    return trkInput[orderId]?.trim() || (o as any)?.trackingNumber || (o as any)?.shippingInfo?.trackingNumber || "";
  }

  async function handleTrack(orderId: string) {
    const order = orders.find((x) => x._id === orderId);
    const tn = order ? resolveTrackingNumber(order, orderId) : "";
    if (!tn) { setTrkErr((s) => ({ ...s, [orderId]: "No hay trackingNumber para consultar" })); return; }
    setTrkErr((s) => ({ ...s, [orderId]: null })); setTrkLoading((s) => ({ ...s, [orderId]: true }));
    try { const r = await trackShipment(tn); setTrkData((s) => ({ ...s, [orderId]: r })); }
    catch (e: any) { setTrkData((s) => ({ ...s, [orderId]: null })); setTrkErr((s) => ({ ...s, [orderId]: e?.message || "No se pudo obtener el tracking" })); }
    finally { setTrkLoading((s) => ({ ...s, [orderId]: false })); }
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Pedidos (admin)</h1>
        <Link href="/" className={s.back}>Volver al inicio</Link>
      </header>

      {!isAdmin && (
        <div className={s.notice}><p className={s.m0}>Para ver y editar pedidos necesitás permisos de administrador.</p></div>
      )}

      {isAdmin && (
        <>
          <div className={s.toolbar}>
            <button type="button" onClick={loadOrders} className={s.btn}>Actualizar</button>
            <div className={s.counter}>Total pedidos: <strong>{orders.length}</strong></div>
          </div>

          {globalMsg && <p className={globalMsg.includes("✅") ? s.ok : s.error}>{globalMsg}</p>}
          {loading && <p className={s.muted}>Cargando pedidos…</p>}
          {err && !loading && <p className={s.error}>{err}</p>}

          {!loading && !err && orders.length === 0 && (
            <div className={s.empty}><p className={s.m0}>No hay pedidos.</p></div>
          )}

          {!loading && !err && orders.length > 0 && (
            <div className={s.list}>
              {orders.map((o) => (
                <article key={o._id} className={s.card}>
                  <div className={s.meta}>
                    <div><strong>ID:</strong> {o._id}</div>
                    <div><strong>Estado:</strong> {o.status} • <strong>Total:</strong> {o.total} • <strong>Ítems:</strong> {o.items?.length ?? 0}</div>
                    <div>
                      <strong>Envío:</strong> {o.shippingAddress?.street ?? "—"}, {o.shippingAddress?.city ?? "—"} ({o.shippingAddress?.zip ?? "—"}), {o.shippingAddress?.country ?? "—"}
                    </div>

                    <div className={s.metaLine}>
                      {o.createdAt && (<><strong>Creado:</strong> {new Date(o.createdAt).toLocaleString("es-AR")} • </>)}
                      {o.paymentId && (
                        <>
                          <strong>Pago:</strong> {o.paymentId} •{" "}
                          <Link href={`/admin/pagos?focus=${encodeURIComponent(o.paymentId)}`} className={s.link}>Ver pago</Link> •{" "}
                        </>
                      )}
                      <strong>Moneda:</strong> {o.currency || "USD"}
                    </div>

                    <div className={s.metaLine}>
                      {typeof o.subtotal === "number" && (<><strong>Subtotal:</strong> {money(o.subtotal, o.currency)} • </>)}
                      {typeof o.tax === "number" && (<><strong>Impuestos:</strong> {money(o.tax, o.currency)} • </>)}
                      {typeof o.discount === "number" && o.discount > 0 && (<><strong>Descuento:</strong> {money(o.discount, o.currency)} • </>)}
                      {typeof o.shippingCost === "number" && (<><strong>Envío:</strong> {money(o.shippingCost, o.currency)}</>)}
                    </div>

                    <div className={s.metaLine}>
                      <strong>Total (formateado):</strong> {money(o.total, o.currency)} • <strong>Usuario:</strong>{" "}
                      {userEmail((o as any)?.userId?.email ? (o as any).userId : o.userId)}
                    </div>
                  </div>

                  {/* Items */}
                  <div className={s.itemsCompact}>
                    {(o.items ?? []).map((it, idx) => (
                      <div key={idx} className={s.itemRow}>
                        <span className={s.itemName}>{itemName(it)}</span>
                        <span>• Cant: {it.quantity}</span>
                        <span>• Precio: {it.price}</span>
                        {it.size ? <span>• Talle: {it.size}</span> : null}
                      </div>
                    ))}
                  </div>

                  {/* Totales por ítem */}
                  <div className={s.itemsTotals}>
                    {(o.items ?? []).map((it, idx) => (
                      <div key={`m-${idx}`}>
                        <strong>{itemName(it)}</strong>: {money(it.price * it.quantity, o.currency)} ({money(it.price, o.currency)} c/u × {it.quantity})
                      </div>
                    ))}
                  </div>

                  {/* Acciones */}
                  <div className={s.actions}>
                    <Link href={`/pedidos/${o._id}`} className={s.link}>Ver detalle</Link>

                    <div className={s.statusWrap}>
                      <label className={s.lbl}>Estado:</label>
                      <select
                        value={editing[o._id] ?? o.status}
                        onChange={(e) => setEditing((s) => ({ ...s, [o._id]: e.target.value as OrderStatus }))}
                        disabled={savingId === o._id}
                        className={s.select}
                        aria-label={`Cambiar estado del pedido ${o._id}`}
                      >
                        {STATUS_OPTIONS.map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(o._id)}
                        disabled={savingId === o._id}
                        className={s.btn}
                        title="Actualizar estado"
                      >
                        {savingId === o._id ? "Guardando…" : "Actualizar estado"}
                      </button>
                    </div>
                  </div>

                  {/* Tracking */}
                  <div className={s.tracking}>
                    <div className={s.trkControls}>
                      <label className={s.lbl}>Tracking:</label>
                      <input
                        value={trkInput[o._id] ?? ((o as any)?.trackingNumber || (o as any)?.shippingInfo?.trackingNumber || "")}
                        onChange={(e) => setTrkInput((s) => ({ ...s, [o._id]: e.target.value }))}
                        placeholder="TRK123456789"
                        className={s.input}
                      />
                      <button
                        type="button"
                        onClick={() => handleTrack(o._id)}
                        disabled={!!trkLoading[o._id]}
                        className={s.btn}
                        title="Consultar tracking"
                      >
                        {trkLoading[o._id] ? "Consultando…" : "Consultar tracking"}
                      </button>

                      {trkErr[o._id] && <span className={s.error}>{trkErr[o._id]}</span>}
                    </div>

                    {trkData[o._id] && (
                      <div className={s.trkPanel}>
                        <div className={s.trkHead}>{trkData[o._id]?.trackingNumber}</div>
                        <div>
                          <strong>Estado:</strong> {trkData[o._id]?.status}
                          {trkData[o._id]?.currentLocation && (<> • <strong>Ubicación:</strong> {trkData[o._id]?.currentLocation}</>)}
                          {trkData[o._id]?.estimatedDelivery && (<> • <strong>ETA:</strong> {new Date(trkData[o._id]!.estimatedDelivery!).toLocaleString("es-AR")}</>)}
                        </div>

                        {Array.isArray(trkData[o._id]?.history) && trkData[o._id]!.history!.length > 0 && (
                          <div>
                            <div className={s.trkHistTitle}>Historial</div>
                            <ul className={s.trkList}>
                              {trkData[o._id]!.history!.map((h, i) => (
                                <li key={i} className={s.trkItem}>
                                  <span className={s.trkTs}>{new Date(h.timestamp).toLocaleString("es-AR")}</span>
                                  {" — "}
                                  <strong>{h.status}</strong>
                                  {h.description ? `: ${h.description}` : ""}
                                  {h.location ? ` · ${h.location}` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
