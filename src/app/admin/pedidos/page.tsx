// src/app/admin/pedidos/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

/* ========= Tipos ========== */
type Product = {
  _id: string;
  name: string;
  price?: number;
  [k: string]: any;
};

type OrderItem = {
  product: Product;      // ← poblado por el backend
  quantity: number;
  size?: string;
  price: number;         // precio unitario tomado al crear el pedido
};

type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

type Order = {
  _id: string;
  items: OrderItem[];
  userId: string;
  cartId: string;
  total: number;
  status: OrderStatus;   // ← incluye shipped/delivered
  shippingAddress: { street: string; city: string; zip: string; country: string };
};

/* 🔹 NUEVO: tipos para tracking de envíos (GET /shipping/tracking/:trackingNumber) */
type TrackingEvent = {
  timestamp: string;
  status: string;
  description?: string;
  location?: string;
};
type TrackingResponse = {
  trackingNumber: string;
  status: string;
  estimatedDelivery?: string;
  currentLocation?: string;
  history?: TrackingEvent[];
};
/* 🔹 NUEVO: helper local para llamar al endpoint de tracking */
async function trackShipment(trackingNumber: string): Promise<TrackingResponse> {
  return apiFetch<TrackingResponse>(`/shipping/tracking/${encodeURIComponent(trackingNumber)}`, {
    method: "GET",
  });
}

type OrdersResponse =
  | { success: true; data: Order[]; message?: string }
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

/* ========= Constantes ========== */
const STATUS_OPTIONS: OrderStatus[] = ["pending", "paid", "shipped", "delivered", "cancelled"];

/* ========= Página ========== */
export default function AdminOrdersPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  // estados UI para actualizar estado
  const [editing, setEditing] = useState<Record<string, OrderStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);

  /* 🔹 NUEVO: estados UI por pedido para consultar tracking */
  const [trkInput, setTrkInput] = useState<Record<string, string>>({});
  const [trkLoading, setTrkLoading] = useState<Record<string, boolean>>({});
  const [trkErr, setTrkErr] = useState<Record<string, string | null>>({});
  const [trkData, setTrkData] = useState<Record<string, TrackingResponse | null>>({});

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

  async function loadOrders() {
    if (!isAdmin) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch<OrdersResponse>("/orders", { method: "GET" });
      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudieron obtener los pedidos");
      }
      setOrders(r.data);
      // precargar selects con el estado actual
      const draft: Record<string, OrderStatus> = {};
      r.data.forEach((o) => (draft[o._id] = o.status));
      setEditing(draft);

      // 🔹 precargar inputs de tracking si el pedido ya trae trackingNumber (directo o dentro de shippingInfo)
      const ti: Record<string, string> = {};
      r.data.forEach((o) => {
        const tn =
          (o as any)?.trackingNumber ||
          (o as any)?.shippingInfo?.trackingNumber ||
          "";
        if (tn) ti[o._id] = String(tn);
      });
      setTrkInput((s) => ({ ...ti, ...s }));
    } catch (e: any) {
      const msg = e?.message || "No se pudieron obtener los pedidos";
      setErr(msg);
      if (msg.toLowerCase().includes("no autenticado") || msg.toLowerCase().includes("credenciales")) {
        window.location.href = "/auth?redirectTo=/admin/pedidos";
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadOrders();
  }, [isAdmin]);

  async function handleUpdateStatus(orderId: string) {
    setGlobalMsg(null);
    setSavingId(orderId);
    try {
      const desired = editing[orderId];
      if (!STATUS_OPTIONS.includes(desired)) {
        throw new Error("Estado inválido");
      }
      const r = await apiFetch<UpdateStatusResponse>(`/orders/${orderId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: desired }),
      });
      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudo actualizar el estado");
      }

      // Actualiza el pedido en la lista con el objeto devuelto por el backend
      setOrders((prev) => prev.map((o) => (o._id === orderId ? r.data : o)));
      // Sincroniza el select con el valor confirmado por backend
      setEditing((s) => ({ ...s, [orderId]: r.data.status }));

      setGlobalMsg("Estado actualizado ✅");
    } catch (e: any) {
      // 400: "Estado inválido"
      // 403: "Se requiere rol de administrador"
      // 404: "No se encontró un pedido con ID "
      const msg = e?.message || "No se pudo actualizar el estado";
      setGlobalMsg(msg);
      if (msg.toLowerCase().includes("no autenticado") || msg.toLowerCase().includes("credenciales")) {
        window.location.href = "/auth?redirectTo=/admin/pedidos";
      }
    } finally {
      setSavingId(null);
    }
  }

  /* 🔹 NUEVO: resolver trackingNumber desde pedido o input */
  function resolveTrackingNumber(o: Order, orderId: string): string {
    return (
      trkInput[orderId]?.trim() ||
      (o as any)?.trackingNumber ||
      (o as any)?.shippingInfo?.trackingNumber ||
      ""
    );
  }

  /* 🔹 NUEVO: handler para consultar GET /shipping/tracking/:trackingNumber */
  async function handleTrack(orderId: string) {
    const order = orders.find((x) => x._id === orderId);
    const tn = order ? resolveTrackingNumber(order, orderId) : "";
    if (!tn) {
      setTrkErr((s) => ({ ...s, [orderId]: "No hay trackingNumber para consultar" }));
      return;
    }
    setTrkErr((s) => ({ ...s, [orderId]: null }));
    setTrkLoading((s) => ({ ...s, [orderId]: true }));
    try {
      const r = await trackShipment(tn);
      setTrkData((s) => ({ ...s, [orderId]: r }));
    } catch (e: any) {
      setTrkData((s) => ({ ...s, [orderId]: null }));
      setTrkErr((s) => ({ ...s, [orderId]: e?.message || "No se pudo obtener el tracking" }));
    } finally {
      setTrkLoading((s) => ({ ...s, [orderId]: false }));
    }
  }

  return (
    <main style={{ maxWidth: 1024, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Pedidos (admin)</h1>
        <span style={{ marginLeft: "auto", opacity: 0.75, fontSize: 14 }}>
          <Link href="/">Volver al inicio</Link>
        </span>
      </header>

      {!isAdmin && (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff" }}>
          <p style={{ margin: 0 }}>Para ver y editar pedidos necesitás permisos de administrador.</p>
        </div>
      )}

      {isAdmin && (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
            <button
              type="button"
              onClick={loadOrders}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Actualizar
            </button>
            <div style={{ opacity: 0.8 }}>
              Total pedidos: <strong>{orders.length}</strong>
            </div>
          </div>

          {globalMsg && (
            <p style={{ marginTop: 0, color: globalMsg.includes("✅") ? "green" : "crimson" }}>{globalMsg}</p>
          )}

          {loading && <p>Cargando pedidos…</p>}
          {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}
          {!loading && !err && orders.length === 0 && (
            <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
              <p style={{ margin: 0 }}>No hay pedidos.</p>
            </div>
          )}

          {!loading && !err && orders.length > 0 && (
            <div style={{ display: "grid", gap: 12 }}>
              {orders.map((o) => (
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
                  <div style={{ display: "grid", gap: 4 }}>
                    <div>
                      <strong>ID:</strong> {o._id}
                    </div>
                    <div>
                      <strong>Estado:</strong> {o.status} &nbsp;•&nbsp; <strong>Total:</strong> {o.total}
                      &nbsp;•&nbsp; <strong>Ítems:</strong> {o.items.length}
                    </div>
                    <div>
                      <strong>Envío:</strong> {o.shippingAddress.street}, {o.shippingAddress.city} ({o.shippingAddress.zip}), {o.shippingAddress.country}
                    </div>
                  </div>

                  {/* Resumen de ítems (product poblado) */}
                  <div style={{ display: "grid", gap: 6 }}>
                    {o.items.map((it, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 14 }}>
                        <span style={{ fontWeight: 600 }}>{it.product?.name ?? "(Producto)"}</span>
                        <span>• Cant: {it.quantity}</span>
                        <span>• Precio: {it.price}</span>
                        {it.size ? <span>• Talle: {it.size}</span> : null}
                      </div>
                    ))}
                  </div>

                  {/* Acciones */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <Link href={`/pedidos/${o._id}`} style={{ textDecoration: "underline" }}>
                      Ver detalle
                    </Link>

                    {/* --- Cambiar estado (solo admin) --- */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <label style={{ fontSize: 13, opacity: 0.85 }}>Estado:</label>
                      <select
                        value={editing[o._id] ?? o.status}
                        onChange={(e) =>
                          setEditing((s) => ({
                            ...s,
                            [o._id]: e.target.value as OrderStatus,
                          }))
                        }
                        disabled={savingId === o._id}
                        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
                        aria-label={`Cambiar estado del pedido ${o._id}`}
                      >
                        {STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
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

                  {/* 🔹 NUEVO: Bloque de tracking del envío */}
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: "1px dashed #eee",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <label style={{ fontSize: 13, opacity: 0.85 }}>Tracking:</label>
                      <input
                        value={trkInput[o._id] ?? ((o as any)?.trackingNumber || (o as any)?.shippingInfo?.trackingNumber || "")}
                        onChange={(e) =>
                          setTrkInput((s) => ({
                            ...s,
                            [o._id]: e.target.value,
                          }))
                        }
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
                        title="Consultar tracking (GET /shipping/tracking/:trackingNumber)"
                      >
                        {trkLoading[o._id] ? "Consultando…" : "Consultar tracking"}
                      </button>

                      {trkErr[o._id] && (
                        <span style={{ color: "crimson" }}>{trkErr[o._id]}</span>
                      )}
                    </div>

                    {/* Resultado del tracking */}
                    {trkData[o._id] && (
                      <div
                        style={{
                          border: "1px solid #eef2ff",
                          background: "#f8faff",
                          borderRadius: 10,
                          padding: 10,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {trkData[o._id]?.trackingNumber}
                        </div>
                        <div>
                          <strong>Estado:</strong> {trkData[o._id]?.status}
                          {trkData[o._id]?.currentLocation && (
                            <> &nbsp;•&nbsp; <strong>Ubicación:</strong> {trkData[o._id]?.currentLocation}</>
                          )}
                          {trkData[o._id]?.estimatedDelivery && (
                            <> &nbsp;•&nbsp; <strong>ETA:</strong> {new Date(trkData[o._id]!.estimatedDelivery!).toLocaleString("es-AR")}</>
                          )}
                        </div>

                        {Array.isArray(trkData[o._id]?.history) && trkData[o._id]!.history!.length > 0 && (
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>Historial</div>
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {trkData[o._id]!.history!.map((h, i) => (
                                <li key={i} style={{ marginBottom: 2 }}>
                                  <span style={{ opacity: 0.8 }}>
                                    {new Date(h.timestamp).toLocaleString("es-AR")}
                                  </span>
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
                  {/* 🔹 FIN tracking */}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
