"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

/* ========= Tipos (compatibles con tu página de pedidos) ========= */
type Product = { _id: string; name: string; price?: number; [k: string]: any };
type OrderItem = {
  product?: Product | null;
  productName?: string;
  quantity: number;
  size?: string;
  price: number;
};
type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";
type Order = {
  _id: string;
  items: OrderItem[];
  userId: string | { _id: string; email?: string };
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
};

type UsersOrdersResponse =
  | { success: true; data: { orders: Order[]; total: number; limit: number; offset: number }; message?: string }
  | { success: true; data: Order[]; message?: string } // fallback si el backend devuelve un array
  | { success: false; message: string };

type UpdateStatusResponse =
  | { success: true; data: Order; message?: string }
  | { success: false; message: string };

/* ========= Helpers auth ========= */
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
  const role = p?.role || p?.roles || p?.userRole || p?.["https://example.com/roles"];
  if (Array.isArray(role)) return role.map(String).some(r => r.toLowerCase() === "admin");
  if (typeof role === "string") return role.toLowerCase() === "admin";
  return false;
}

/* ========= Utils ========= */
const STATUS_OPTIONS: OrderStatus[] = ["pending", "paid", "shipped", "delivered", "cancelled"];
function money(n: number, currency = "USD") {
  try { return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(n); }
  catch { return `${currency} ${n}`; }
}
function itemName(it: OrderItem) {
  return it.product?.name ?? it.productName ?? "(Producto)";
}
function userEmail(u: Order["userId"]) {
  if (!u) return "—";
  if (typeof u === "string") return u;
  return (u as any)?.email || (u as any)?._id || "—";
}

/* ========= (Opcional) Tracking helper si usás tu endpoint de shipping ========= */
type TrackingEvent = { timestamp: string; status: string; description?: string; location?: string };
type TrackingResponse = {
  trackingNumber: string; status: string;
  estimatedDelivery?: string; currentLocation?: string; history?: TrackingEvent[];
};
async function trackShipment(trackingNumber: string): Promise<TrackingResponse> {
  return apiFetch<TrackingResponse>(`/shipping/tracking/${encodeURIComponent(trackingNumber)}`, { method: "GET" });
}

export default function AdminUserOrdersPage() {
  const params = useParams<{ userId: string }>();
  const search = useSearchParams();
  const [isAdmin, setIsAdmin] = useState(false);

  const userId = params.userId;

  // server pagination (si el backend la provee)
  const [limit, setLimit] = useState(Number(search.get("limit")) || 20);
  const [offset, setOffset] = useState(Number(search.get("offset")) || 0);

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);

  // edición de estado
  const [editing, setEditing] = useState<Record<string, OrderStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // tracking por pedido
  const [trkInput, setTrkInput] = useState<Record<string, string>>({});
  const [trkLoading, setTrkLoading] = useState<Record<string, boolean>>({});
  const [trkErr, setTrkErr] = useState<Record<string, string | null>>({});
  const [trkData, setTrkData] = useState<Record<string, TrackingResponse | null>>({});

  useEffect(() => { setIsAdmin(isAdminFromToken()); }, []);

  async function loadUserOrders(nextOffset = offset, nextLimit = limit) {
    if (!isAdmin) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch<UsersOrdersResponse>(`/admin/users/${userId}/orders?limit=${nextLimit}&offset=${nextOffset}`, { method: "GET" });

      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudieron obtener los pedidos del usuario");
      }

      const arr = Array.isArray(r.data) ? (r.data as Order[]) : r.data.orders;
      const tt  = Array.isArray(r.data) ? arr.length : r.data.total;
      const lo  = Array.isArray(r.data) ? nextLimit : (r.data as any).limit;
      const of  = Array.isArray(r.data) ? 0 : (r.data as any).offset;

      const sorted = [...(arr ?? [])].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      setOrders(sorted);
      setTotal(tt ?? sorted.length);
      setLimit(lo ?? nextLimit);
      setOffset(of ?? nextOffset);

      // precargar selects y tracking
      const draft: Record<string, OrderStatus> = {};
      const ti: Record<string, string> = {};
      sorted.forEach(o => {
        draft[o._id] = o.status;
        const tn = (o as any)?.trackingNumber || (o as any)?.shippingInfo?.trackingNumber || "";
        if (tn) ti[o._id] = String(tn);
      });
      setEditing(draft);
      setTrkInput(ti);
    } catch (e: any) {
      const m = e?.message || "No se pudieron obtener los pedidos del usuario";
      setErr(m);
      if (/(401|403|no autenticado|credenciales|unauthorized|forbidden)/i.test(m)) {
        window.location.href = `/auth?redirectTo=/admin/usuarios/${userId}/pedidos`;
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin && userId) loadUserOrders(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, userId]);

  const page = useMemo(() => Math.floor(offset / Math.max(1, limit)) + 1, [offset, limit]);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / Math.max(1, limit))), [total, limit]);
  const currencyGuess = orders.find(o => o.currency)?.currency || "USD";
  const totalSpent = useMemo(() => orders.reduce((acc, o) => acc + (o.total || 0), 0), [orders]);

  function goPrev() {
    const next = Math.max(0, offset - limit);
    if (next !== offset) loadUserOrders(next, limit);
  }
  function goNext() {
    const next = offset + limit;
    if (next < total) loadUserOrders(next, limit);
  }
  function changeLimit(newLimit: number) {
    const l = Number.isFinite(newLimit) && newLimit > 0 ? newLimit : 20;
    loadUserOrders(0, l);
  }

  function exportCsv(list: Order[]) {
    const rows = [
      ["orderId","status","createdAt","total","currency","itemsCount","shippingStreet","shippingCity","shippingZip","shippingCountry","paymentId"],
      ...list.map(o => [
        o._id,
        o.status,
        o.createdAt || "",
        String(o.total ?? ""),
        o.currency || "USD",
        String(o.items?.length ?? 0),
        o.shippingAddress?.street ?? "",
        o.shippingAddress?.city ?? "",
        o.shippingAddress?.zip ?? "",
        o.shippingAddress?.country ?? "",
        o.paymentId ?? ""
      ])
    ];
    const csv = rows.map(r => r.map(x => `"${String(x ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user_${userId}_orders_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpdateStatus(orderId: string) {
    setGlobalMsg(null);
    setSavingId(orderId);
    try {
      const desired = editing[orderId];
      if (!STATUS_OPTIONS.includes(desired)) throw new Error("Estado inválido");

      async function put(path: string) {
        return apiFetch<UpdateStatusResponse>(path, {
          method: "PUT",
          body: JSON.stringify({ status: desired }),
        });
      }

      // Primero admin; si tu backend exige el admin path, esto irá bien.
      let r = await put(`/admin/orders/${orderId}/status`);
      if (!("success" in r) || !r.success) {
        // Fallback opcional
        r = await put(`/orders/${orderId}/status`);
        if (!("success" in r) || !r.success) {
          throw new Error(("message" in r && r.message) || "No se pudo actualizar el estado");
        }
      }

      setOrders(prev => prev.map(o => (o._id === orderId ? r.data : o)));
      setEditing(s => ({ ...s, [orderId]: r.data.status }));
      setGlobalMsg("Estado actualizado ✅");
    } catch (e: any) {
      const m = e?.message || "No se pudo actualizar el estado";
      setGlobalMsg(m);
      if (/(401|403|no autenticado|credenciales|unauthorized|forbidden)/i.test(m)) {
        window.location.href = `/auth?redirectTo=/admin/usuarios/${userId}/pedidos`;
      }
    } finally {
      setSavingId(null);
    }
  }

  function resolveTrackingNumber(o: Order, orderId: string): string {
    return trkInput[orderId]?.trim() ||
           (o as any)?.trackingNumber ||
           (o as any)?.shippingInfo?.trackingNumber ||
           "";
  }

  async function handleTrack(orderId: string) {
    const order = orders.find(x => x._id === orderId);
    const tn = order ? resolveTrackingNumber(order, orderId) : "";
    if (!tn) {
      setTrkErr(s => ({ ...s, [orderId]: "No hay trackingNumber para consultar" }));
      return;
    }
    setTrkErr(s => ({ ...s, [orderId]: null }));
    setTrkLoading(s => ({ ...s, [orderId]: true }));
    try {
      const r = await trackShipment(tn);
      setTrkData(s => ({ ...s, [orderId]: r }));
    } catch (e: any) {
      setTrkData(s => ({ ...s, [orderId]: null }));
      setTrkErr(s => ({ ...s, [orderId]: e?.message || "No se pudo obtener el tracking" }));
    } finally {
      setTrkLoading(s => ({ ...s, [orderId]: false }));
    }
  }

  return (
    <main style={{ maxWidth: 1024, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Pedidos de usuario</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Link href="/admin/usuarios" style={{ opacity: 0.85 }}>Usuarios</Link>
          <Link href="/admin/pedidos" style={{ opacity: 0.85 }}>Todos los pedidos</Link>
          <Link href="/admin/dashboard" style={{ opacity: 0.85 }}>Dashboard</Link>
        </div>
      </header>

      {!isAdmin && (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff" }}>
          <p style={{ margin: 0 }}>Necesitás permisos de administrador.</p>
        </div>
      )}

      {isAdmin && (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              <strong>User ID:</strong> {userId}
            </div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label style={{ fontSize: 13, opacity: 0.8 }}>Por página:</label>
              <select
                value={limit}
                onChange={(e) => changeLimit(Number(e.target.value))}
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
              >
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>

              <div style={{ opacity: 0.85 }}>
                Página <strong>{Math.max(1, page)}</strong> de <strong>{pageCount}</strong> • Total: <strong>{total}</strong>
              </div>

              <button
                type="button"
                onClick={() => loadUserOrders(offset, limit)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "white", fontWeight: 600 }}
              >
                Actualizar
              </button>

              <button
                type="button"
                onClick={() => exportCsv(orders)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "white", fontWeight: 700 }}
              >
                Exportar CSV
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
                disabled={offset + limit >= total}
                style={{
                  padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd",
                  background: offset + limit >= total ? "#f3f3f3" : "white", cursor: offset + limit >= total ? "default" : "pointer", fontWeight: 600
                }}
                title="Siguiente"
              >
                ▶
              </button>
            </div>
          </div>

          {/* resumen del usuario */}
          <div style={{ marginBottom: 12, fontSize: 14, color: "#444" }}>
            <strong>Pedidos listados:</strong> {orders.length} &nbsp;•&nbsp; <strong>Total gastado (vista actual):</strong> {money(totalSpent, currencyGuess)}
          </div>

          {globalMsg && (
            <p style={{ marginTop: 0, color: globalMsg.includes("✅") ? "green" : "crimson" }}>{globalMsg}</p>
          )}

          {loading && <p>Cargando pedidos…</p>}
          {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}
          {!loading && !err && orders.length === 0 && (
            <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
              <p style={{ margin: 0 }}>Este usuario no tiene pedidos.</p>
            </div>
          )}

          {!loading && !err && orders.length > 0 && (
            <div style={{ display: "grid", gap: 12 }}>
              {orders.map((o) => (
                <article key={o._id}
                  style={{ display: "grid", gap: 8, padding: 12, border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div><strong>ID:</strong> {o._id}</div>
                    <div>
                      <strong>Estado:</strong> {o.status}
                      &nbsp;•&nbsp; <strong>Total:</strong> {money(o.total, o.currency)}
                      &nbsp;•&nbsp; <strong>Ítems:</strong> {o.items?.length ?? 0}
                      &nbsp;•&nbsp; <strong>Usuario:</strong> {userEmail(o.userId)}
                    </div>
                    <div>
                      <strong>Envío:</strong> {o.shippingAddress?.street ?? "—"}, {o.shippingAddress?.city ?? "—"} ({o.shippingAddress?.zip ?? "—"}), {o.shippingAddress?.country ?? "—"}
                    </div>
                    <div style={{ opacity: 0.9 }}>
                      {o.createdAt && <> <strong>Creado:</strong> {new Date(o.createdAt).toLocaleString("es-AR")} &nbsp;•&nbsp;</>}
                      {o.paymentId && <> <strong>Pago:</strong> {o.paymentId} &nbsp;•&nbsp;</>}
                      <strong>Moneda:</strong> {o.currency || "USD"}
                    </div>
                    <div style={{ opacity: 0.9 }}>
                      {typeof o.subtotal === "number" && <> <strong>Subtotal:</strong> {money(o.subtotal, o.currency)} &nbsp;•&nbsp;</>}
                      {typeof o.tax === "number" && <> <strong>Impuestos:</strong> {money(o.tax, o.currency)} &nbsp;•&nbsp;</>}
                      {typeof o.discount === "number" && o.discount > 0 && <> <strong>Descuento:</strong> {money(o.discount, o.currency)} &nbsp;•&nbsp;</>}
                      {typeof o.shippingCost === "number" && <> <strong>Envío:</strong> {money(o.shippingCost, o.currency)}</>}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    {(o.items ?? []).map((it, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 14 }}>
                        <span style={{ fontWeight: 600 }}>{itemName(it)}</span>
                        <span>• Cant: {it.quantity}</span>
                        <span>• Precio: {money(it.price, o.currency)}</span>
                        {it.size ? <span>• Talle: {it.size}</span> : null}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gap: 4, fontSize: 13, color: "#555" }}>
                    {(o.items ?? []).map((it, idx) => (
                      <div key={`m-${idx}`}>
                        <strong>{itemName(it)}</strong>: {money(it.price * it.quantity, o.currency)} ({money(it.price, o.currency)} c/u × {it.quantity})
                      </div>
                    ))}
                  </div>

                  {/* Acciones */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <Link href={`/pedidos/${o._id}`} style={{ textDecoration: "underline" }}>
                      Ver detalle
                    </Link>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <label style={{ fontSize: 13, opacity: 0.85 }}>Estado:</label>
                      <select
                        value={editing[o._id] ?? o.status}
                        onChange={(e) => setEditing(s => ({ ...s, [o._id]: e.target.value as OrderStatus }))}
                        disabled={savingId === o._id}
                        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
                        aria-label={`Cambiar estado del pedido ${o._id}`}
                      >
                        {STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(o._id)}
                        disabled={savingId === o._id}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                          background: savingId === o._id ? "#f3f3f3" : "white",
                          cursor: savingId === o._id ? "default" : "pointer",
                          fontWeight: 600,
                        }}
                        title="Actualizar estado"
                      >
                        {savingId === o._id ? "Guardando…" : "Actualizar estado"}
                      </button>
                    </div>
                  </div>

                  {/* Tracking */}
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #eee", display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <label style={{ fontSize: 13, opacity: 0.85 }}>Tracking:</label>
                      <input
                        value={trkInput[o._id] ?? ((o as any)?.trackingNumber || (o as any)?.shippingInfo?.trackingNumber || "")}
                        onChange={(e) => setTrkInput(s => ({ ...s, [o._id]: e.target.value }))}
                        placeholder="TRK123456789"
                        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", minWidth: 220 }}
                      />
                      <button
                        type="button"
                        onClick={() => handleTrack(o._id)}
                        disabled={!!trkLoading[o._id]}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                          background: trkLoading[o._id] ? "#f3f3f3" : "white",
                          cursor: trkLoading[o._id] ? "default" : "pointer",
                          fontWeight: 600,
                        }}
                        title="Consultar tracking"
                      >
                        {trkLoading[o._id] ? "Consultando…" : "Consultar tracking"}
                      </button>

                      {trkErr[o._id] && <span style={{ color: "crimson" }}>{trkErr[o._id]}</span>}
                    </div>

                    {trkData[o._id] && (
                      <div style={{ border: "1px solid #eef2ff", background: "#f8faff", borderRadius: 10, padding: 10, display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 700 }}>{trkData[o._id]?.trackingNumber}</div>
                        <div>
                          <strong>Estado:</strong> {trkData[o._id]?.status}
                          {trkData[o._id]?.currentLocation && <> &nbsp;•&nbsp; <strong>Ubicación:</strong> {trkData[o._id]?.currentLocation}</>}
                          {trkData[o._id]?.estimatedDelivery && <> &nbsp;•&nbsp; <strong>ETA:</strong> {new Date(trkData[o._id]!.estimatedDelivery!).toLocaleString("es-AR")}</>}
                        </div>
                        {Array.isArray(trkData[o._id]?.history) && trkData[o._id]!.history!.length > 0 && (
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>Historial</div>
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {trkData[o._id]!.history!.map((h, i) => (
                                <li key={i} style={{ marginBottom: 2 }}>
                                  <span style={{ opacity: 0.8 }}>{new Date(h.timestamp).toLocaleString("es-AR")}</span>
                                  {" — "}<strong>{h.status}</strong>
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
