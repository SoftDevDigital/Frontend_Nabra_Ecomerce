// src/app/pedidos/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Product = {
  _id: string;
  name: string;
  price?: number;
  [k: string]: any;
};

type OrderItem = {
  product: Product;              // ← poblado por el backend
  quantity: number;
  size?: string;
  price: number;                 // precio unitario en el momento del pedido
};

type Order = {
  _id: string;
  items: OrderItem[];
  userId: string;
  cartId: string;
  total: number;
  status: string;
  shippingAddress: { street: string; city: string; zip: string; country: string };
};

type OrderResponse =
  | { success: true; data: Order; message?: string }
  | { success: false; message: string };

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const orderId = params.id;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  // ⬇️⬇️⬇️ AGREGADO: soporte admin para PUT /orders/:id/status
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
      // Validación rápida en cliente
      if (!STATUS_OPTIONS.includes(statusDraft)) {
        throw new Error("Estado inválido");
      }

      const r = await apiFetch<{ success: boolean; data: Order; message?: string }>(
        `/orders/${order._id}/status`,
        { method: "PUT", body: JSON.stringify({ status: statusDraft }) }
      );

      if (!("success" in r) || !r.success) {
        throw new Error((r as any)?.message || "No se pudo actualizar el estado");
      }

      setOrder(r.data);
      setStatusDraft(r.data.status as OrderStatus);
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
  // ⬆️⬆️⬆️ FIN agregado admin

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const r = await apiFetch<OrderResponse>(`/orders/${orderId}`, { method: "GET" });
        if (!("success" in r) || !r.success) {
          throw new Error(("message" in r && r.message) || "No se encontró el pedido");
        }
        setOrder(r.data);
      } catch (e: any) {
        const msg = e?.message || "No se encontró un pedido con ID para el usuario";
        setErr(msg);
        // 401 → forzamos login
        if (msg.toLowerCase().includes("no autenticado") || msg.toLowerCase().includes("credenciales")) {
          window.location.href = `/auth?redirectTo=/pedidos/${orderId}`;
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orderId]);

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
          <div style={{ display: "grid", gap: 4 }}>
            <div><strong>ID:</strong> {order._id}</div>
            <div><strong>Estado:</strong> {order.status}</div>
            <div><strong>Total:</strong> {order.total}</div>
            <div>
              <strong>Envío:</strong>{" "}
              {order.shippingAddress.street}, {order.shippingAddress.city} ({order.shippingAddress.zip}), {order.shippingAddress.country}
            </div>
          </div>

          {/* ⬇️⬇️⬇️ AGREGADO: control admin para cambiar estado */}
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
              {statusMsg && (
                <span style={{ color: statusMsg.includes("✅") ? "green" : "crimson" }}>{statusMsg}</span>
              )}
            </div>
          )}
          {/* ⬆️⬆️⬆️ FIN agregado */}

          <div style={{ marginTop: 6 }}>
            <h2 style={{ fontSize: 18, margin: "4px 0 8px" }}>Ítems</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {order.items.map((it, idx) => {
                const lineTotal = (Number(it.price) || 0) * (Number(it.quantity) || 0);
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
                      <div style={{ fontWeight: 600 }}>
                        {it.product?.name ?? "(Producto)"} {it.size ? `• Talle ${it.size}` : ""}
                      </div>
                      <div style={{ opacity: 0.8, fontSize: 13 }}>
                        id: {it.product?._id ?? "—"}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 14, opacity: 0.9 }}>
                        <span>Precio: {it.price}</span> • <span>Cant: {it.quantity}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 700 }}>{lineTotal}</div>
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
