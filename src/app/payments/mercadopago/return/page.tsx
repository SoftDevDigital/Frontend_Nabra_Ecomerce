// src/app/payments/mercadopago/return/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, Suspense } from "react";

function statusLabel(s?: string) {
  const x = (s || "").toLowerCase();
  if (x === "approved") return "Pago aprobado ✅";
  if (x === "pending") return "Pago pendiente ⏳";
  if (x === "rejected") return "Pago rechazado ❌";
  return "Estado de pago desconocido";
}

function MpReturnPageInner() {
  const sp = useSearchParams();

  const info = useMemo(() => {
    const payment_id = sp.get("payment_id") || sp.get("paymentId") || "";
    const status = sp.get("status") || "";
    const merchant_order_id = sp.get("merchant_order_id") || "";
    const external_reference = sp.get("external_reference") || "";
    const source = sp.get("source") || ""; // "checkout" | "partial"
    return { payment_id, status, merchant_order_id, external_reference, source };
  }, [sp]);

  const label = statusLabel(info.status);

  return (
    <main style={{ maxWidth: 720, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Resultado del pago</h1>
      <p style={{ marginTop: 0 }}>{label}</p>

      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
        <div><strong>payment_id:</strong> {info.payment_id || "-"}</div>
        <div><strong>status:</strong> {info.status || "-"}</div>
        <div><strong>merchant_order_id:</strong> {info.merchant_order_id || "-"}</div>
        <div><strong>external_reference (cartId):</strong> {info.external_reference || "-"}</div>
        {!!info.source && <div><strong>flujo:</strong> {info.source}</div>}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <Link href="/pedidos" style={{ textDecoration: "underline" }}>
          Ir a mis pedidos
        </Link>
        <Link href="/carrito" style={{ textDecoration: "underline" }}>
          Volver al carrito
        </Link>
      </div>

      <p style={{ marginTop: 12, color: "#666" }}>
        Si el estado es <strong>pendiente</strong>, Mercado Pago puede tardar unos minutos en confirmarlo.
      </p>
    </main>
  );
}

export default function MpReturnPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Cargando información de pago...</main>}>
      <MpReturnPageInner />
    </Suspense>
  );
}
