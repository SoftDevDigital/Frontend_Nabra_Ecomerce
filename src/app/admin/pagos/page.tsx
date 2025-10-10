// src/app/admin/pagos/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { listPayments, type Payment, cancelPayment, CANCELLABLE_STATUSES, getPayment } from "@/lib/paymentsApi";

function money(n: number, ccy = "ARS") {
  try { return new Intl.NumberFormat("es-AR", { style: "currency", currency: ccy }).format(n); }
  catch { return `${ccy} ${n}`; }
}

export default function AdminPaymentsPage() {
  const sp = useSearchParams();
  const focus = sp.get("focus") || "";
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Payment[]>([]);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const focusRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await listPayments({ limit, offset });
      setItems(res || []);
    } catch (e: any) {
      setErr(e?.message || "No se pudieron obtener los pagos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [limit, offset]);

  // scrollear al foco si existe
  useEffect(() => {
    if (!loading && focus && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, focus]);

  const total = useMemo(() => items.length, [items]);

  async function quickCancel(p: Payment) {
    const isCancellable = CANCELLABLE_STATUSES.includes(String(p.status || "").toLowerCase());
    if (!isCancellable) {
      alert(`No cancelable (estado: ${p.status})`);
      return;
    }
    const ok = confirm(`¿Cancelar el pago ${p._id}?`);
    if (!ok) return;
    try {
      await cancelPayment(p._id);
      // refrescamos solo ese item
      const fresh = await getPayment(p._id).catch(() => null);
      setItems((prev) =>
        prev.map((x) => (x._id === p._id ? (fresh ?? { ...x, status: "cancelled" }) : x))
      );
    } catch (e: any) {
      alert(e?.message || "Error al cancelar el pago");
    }
  }

  return (
    <main style={{ maxWidth: 1024, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Pagos (admin)</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <Link href="/admin/pedidos" style={{ textDecoration: "underline" }}>Pedidos</Link>
          <button
            type="button"
            onClick={load}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "white", fontWeight: 600 }}
          >
            Actualizar
          </button>
        </div>
      </header>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <label style={{ fontSize: 13, opacity: 0.8 }}>Por página:</label>
        <select
          value={limit}
          onChange={(e) => { setOffset(0); setLimit(Number(e.target.value)); }}
          style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
        >
          {[20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ opacity: 0.85 }}>Total (vista): <strong>{total}</strong></div>
      </div>

      {loading && <p>Cargando pagos…</p>}
      {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}
      {!loading && !err && items.length === 0 && (
        <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
          <p style={{ margin: 0 }}>No hay pagos.</p>
        </div>
      )}

      {!loading && !err && items.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((p) => {
            const isFocus = focus && (p._id === focus || p.externalId === focus);
            const isCancellable = CANCELLABLE_STATUSES.includes(String(p.status || "").toLowerCase());
            return (
              <article
                key={p._id}
                ref={isFocus ? focusRef : null}
                style={{
                  display: "grid",
                  gap: 6,
                  padding: 12,
                  border: isFocus ? "2px solid #99c2ff" : "1px solid #eee",
                  borderRadius: 12,
                  background: isFocus ? "#f4f9ff" : "#fff",
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700 }}>{p.provider.toUpperCase()}</div>
                  <div>• <strong>Estado:</strong> {p.status}</div>
                  <div>• <strong>Monto:</strong> {money(p.amount, p.currency || "ARS")}</div>
                  {p.createdAt && <div>• <strong>Fecha:</strong> {new Date(p.createdAt).toLocaleString("es-AR")}</div>}
                </div>

                <div style={{ fontSize: 13, color: "#555" }}>
                  <div><strong>ID (DB):</strong> {p._id}</div>
                  {p.externalId && <div><strong>ID PSP:</strong> {p.externalId}</div>}
                  {p.orderId && (
                    <div>
                      <strong>Pedido:</strong> <Link href={`/pedidos/${p.orderId}`} style={{ textDecoration: "underline" }}>{p.orderId}</Link>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <Link href={`/admin/pagos/${p._id}`} style={{ textDecoration: "underline" }}>
                    Ver detalle
                  </Link>
                  <button
                    type="button"
                    onClick={() => quickCancel(p)}
                    disabled={!isCancellable}
                    title={isCancellable ? "Cancelar pago" : `No cancelable (estado: ${p.status})`}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: isCancellable ? "#ffecec" : "#f3f3f3",
                      color: isCancellable ? "#b00020" : "#888",
                      fontWeight: 700,
                      cursor: isCancellable ? "pointer" : "not-allowed",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
