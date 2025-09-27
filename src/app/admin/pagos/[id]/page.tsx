// src/app/admin/pagos/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPayment, type Payment, cancelPayment, CANCELLABLE_STATUSES } from "@/lib/paymentsApi";

function money(n: number, ccy = "ARS") {
  try { return new Intl.NumberFormat("es-AR", { style: "currency", currency: ccy }).format(n); }
  catch { return `${ccy} ${n}`; }
}

export default function AdminPaymentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [p, setP] = useState<Payment & { [k: string]: any } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await getPayment(id);
        setP(res);
      } catch (e: any) {
        setErr(e?.message || "No se pudo obtener el pago");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const isCancellable =
    !!p && CANCELLABLE_STATUSES.includes(String(p.status || "").toLowerCase());

  async function onCancel() {
    if (!p) return;
    setCancelMsg(null);

    if (!isCancellable) {
      setCancelMsg(`El estado actual "${p.status}" no permite cancelación.`);
      return;
    }

    const ok = window.confirm(
      `¿Confirmás cancelar el pago ${p._id}? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    setCancelLoading(true);
    try {
      await cancelPayment(p._id);
      // Refrescamos o actualizamos en memoria
      const refreshed = await getPayment(p._id).catch(() => null);
      if (refreshed) {
        setP(refreshed);
      } else {
        // fallback optimista
        setP({ ...p, status: "cancelled" });
      }
      setCancelMsg("Pago cancelado correctamente ✅");
    } catch (e: any) {
      setCancelMsg(e?.message || "Error al cancelar el pago");
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 920, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Pago</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <Link href="/admin/pagos" style={{ textDecoration: "underline" }}>Volver a pagos</Link>
        </div>
      </header>

      {loading && <p>Cargando pago…</p>}
      {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}
      {!loading && !err && !p && <p>No se encontró el pago.</p>}

      {!loading && p && (
        <section style={{ display: "grid", gap: 10, border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 700 }}>{p.provider?.toUpperCase()}</div>
            <div>• <strong>Estado:</strong> {p.status}</div>
            <div>• <strong>Monto:</strong> {money(p.amount, p.currency || "ARS")}</div>
            {p.createdAt && <div>• <strong>Fecha:</strong> {new Date(p.createdAt).toLocaleString("es-AR")}</div>}
          </div>

          <div style={{ fontSize: 13, color: "#555", display: "grid", gap: 4 }}>
            <div><strong>ID (DB):</strong> {p._id}</div>
            {p.externalId && <div><strong>ID PSP:</strong> {p.externalId}</div>}
            {p.orderId && (
              <div>
                <strong>Pedido:</strong> <Link href={`/pedidos/${p.orderId}`} style={{ textDecoration: "underline" }}>{p.orderId}</Link>
              </div>
            )}
            {/* Campos frecuentes según tu ejemplo */}
            {p.approvalUrl && (
              <div>
                <strong>Approval URL:</strong>{" "}
                <a href={p.approvalUrl} target="_blank" style={{ textDecoration: "underline" }} rel="noreferrer">
                  Abrir
                </a>
              </div>
            )}
            {p.providerPaymentId && <div><strong>providerPaymentId:</strong> {p.providerPaymentId}</div>}
            {p.captureId && <div><strong>captureId:</strong> {p.captureId}</div>}
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={!isCancellable || cancelLoading}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: isCancellable ? "#ffecec" : "#f3f3f3",
                color: isCancellable ? "#b00020" : "#888",
                fontWeight: 700,
                cursor: !isCancellable || cancelLoading ? "not-allowed" : "pointer",
              }}
              title={
                isCancellable
                  ? "Cancelar pago"
                  : `No cancelable (estado: ${p.status})`
              }
            >
              {cancelLoading ? "Cancelando…" : "Cancelar pago"}
            </button>
            {cancelMsg && <span style={{ fontSize: 13 }}>{cancelMsg}</span>}
          </div>

          {/* Dump opcional del resto del objeto */}
          <details>
            <summary style={{ cursor: "pointer" }}>Ver JSON completo</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(p, null, 2)}</pre>
          </details>
        </section>
      )}
    </main>
  );
}
