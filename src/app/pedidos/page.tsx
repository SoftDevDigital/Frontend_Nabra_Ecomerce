// src/app/pedidos/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";

/* ===== Tipos según la especificación del endpoint ===== */
type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
};

type ShippingAddress = {
  street?: string;
  city?: string;
  zipCode?: string; // ← nota: la spec usa zipCode
};

type OrderRow = {
  _id: string;
  orderNumber?: string;
  status: string;
  total: number;
  items: OrderItem[];
  shippingAddress?: ShippingAddress;
  paymentStatus?: string;
  trackingNumber?: string;
  createdAt?: string;
  deliveredAt?: string;
};

type OrdersListResponse = {
  orders: OrderRow[];
  total: number;
  page: number;
  totalPages: number;
};

/* ===== Helpers ===== */
function currency(n?: number) {
  return typeof n === "number"
    ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n)
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

const STATUS_OPTIONS = ["", "pending", "paid", "shipped", "delivered", "cancelled"] as const;

export default function OrdersPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(sp.get("limit") || "10", 10));
  const status = sp.get("status") || "";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const qs = useMemo(() => {
    const u = new URLSearchParams();
    u.set("page", String(page));
    u.set("limit", String(limit));
    if (status) u.set("status", status);
    return `?${u.toString()}`;
  }, [page, limit, status]);

  function setParam(name: string, value?: string) {
    const u = new URLSearchParams(sp.toString());
    if (!value) u.delete(name);
    else u.set(name, value);
    // cada cambio resetea a página 1 salvo que el cambio sea justamente "page"
    if (name !== "page") u.set("page", "1");
    router.replace(`${pathname}?${u.toString()}`);
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch<OrdersListResponse>(`/orders${qs}`, { method: "GET" });
      // La spec no usa wrapper {success,data}
      if (!r || !Array.isArray(r.orders)) throw new Error("Formato de respuesta inesperado");
      setRows(r.orders);
      setTotal(r.total ?? r.orders.length);
      setTotalPages(Math.max(1, r.totalPages ?? 1));
    } catch (e: any) {
      const m = String(e?.message || "No se pudieron obtener tus pedidos");
      setErr(m);
      if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("credenciales")) {
        window.location.href = `/auth?redirectTo=/pedidos`;
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]); // recarga ante cambios de page/limit/status

  return (
    <main style={{ maxWidth: 1024, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Mis pedidos</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={status}
            onChange={(e) => setParam("status", e.target.value || undefined)}
            title="Filtrar por estado"
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? s : "Todos"}
              </option>
            ))}
          </select>

          <select
            value={String(limit)}
            onChange={(e) => setParam("limit", e.target.value)}
            title="Items por página"
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
          >
            {[5, 10, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n} / pág.
              </option>
            ))}
          </select>

          <button
            onClick={load}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
            title="Actualizar"
          >
            Actualizar
          </button>
        </div>
      </header>

      {loading && <p>Cargando pedidos…</p>}
      {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}

      {!loading && !err && rows.length === 0 && (
        <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16, background: "#fff" }}>
          <p style={{ margin: 0 }}>Aún no tenés pedidos.</p>
          <p style={{ marginTop: 8 }}>
            <Link href="/catalogo" style={{ textDecoration: "underline" }}>
              Ir al catálogo
            </Link>
          </p>
        </div>
      )}

      {!loading && !err && rows.length > 0 && (
        <section style={{ display: "grid", gap: 12 }}>
          {rows.map((o) => (
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
                  <strong>{o.orderNumber ? o.orderNumber : `Pedido #${o._id}`}</strong>
                </div>
                <div>
                  <strong>Estado:</strong> {o.status}
                  {o.paymentStatus ? <> &nbsp;•&nbsp; <strong>Pago:</strong> {o.paymentStatus}</> : null}
                  &nbsp;•&nbsp; <strong>Total:</strong> {currency(o.total)}
                </div>
                <div style={{ color: "#666" }}>
                  {o.createdAt && <>Creado: {formatDT(o.createdAt)}</>}
                  {o.deliveredAt && <> &nbsp;•&nbsp; Entregado: {formatDT(o.deliveredAt)}</>}
                </div>
                {o.shippingAddress && (
                  <div>
                    <strong>Envío:</strong>{" "}
                    {[o.shippingAddress.street, o.shippingAddress.city, o.shippingAddress.zipCode]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
              </div>

              {/* Resumen de ítems (nombre + cantidad) */}
              <div style={{ display: "grid", gap: 4 }}>
                {o.items.map((it, i) => (
                  <div key={i} style={{ fontSize: 14 }}>
                    {it.productName} • Cant: {it.quantity} • Precio: {currency(it.price)}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href={`/pedidos/${o._id}`} style={{ textDecoration: "underline" }}>
                  Ver detalle
                </Link>
                {o.trackingNumber && <span>• Tracking: {o.trackingNumber}</span>}
              </div>
            </article>
          ))}

          {/* Paginación */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
            <button
              onClick={() => setParam("page", String(Math.max(1, page - 1)))}
              disabled={page <= 1}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: page <= 1 ? "#f5f5f5" : "white",
                cursor: page <= 1 ? "default" : "pointer",
              }}
            >
              Anterior
            </button>
            <span style={{ alignSelf: "center" }}>
              Página {page} de {totalPages} • {total} pedidos
            </span>
            <button
              onClick={() => setParam("page", String(Math.min(totalPages, page + 1)))}
              disabled={page >= totalPages}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: page >= totalPages ? "#f5f5f5" : "white",
                cursor: page >= totalPages ? "default" : "pointer",
              }}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
