"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrder, CreateOrderBody } from "@/lib/ordersApi";
import { createOrderWithShipping } from "@/lib/ordersApi";
import { createMercadoPagoCheckout } from "@/lib/paymentsApi";
import { calculateShipping, type ShippingOption } from "@/lib/shippingApi";

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 13, opacity: 0.85 }}>{children}</span>;
}

/* ===== Helper para normalizar URL de redirección de MP ===== */
function getMpRedirectUrl(resp: any): string | undefined {
  const r = resp ?? {};
  const d = r.data ?? {};
  return (
    r.init_point ||
    r.sandbox_init_point ||
    r.approvalUrl ||
    r.paymentUrl ||
    d.init_point ||
    d.sandbox_init_point ||
    d.approvalUrl ||
    d.paymentUrl ||
    d.pointOfInteraction?.transactionData?.ticket_url ||
    undefined
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const [shippingAddressId, setShippingAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "stripe" | "mercadopago" | "cash" | string>("paypal");
  const [couponCode, setCouponCode] = useState("");
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express" | string>("standard");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submittingShipping, setSubmittingShipping] = useState(false);

  const [shipOpts, setShipOpts] = useState<ShippingOption[] | null>(null);
  const [shipCalcLoading, setShipCalcLoading] = useState(false);
  const [shipCalcErr, setShipCalcErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!shippingAddressId.trim()) { setMsg("Indicá una dirección de envío."); return; }
    if (!paymentMethod) { setMsg("Seleccioná un método de pago."); return; }

    if (paymentMethod === "mercadopago") {
      try {
        setSubmitting(true);
        const origin = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_BASE || "";
        const successUrl = `${origin}/payments/mercadopago/return?source=checkout`;
        const failureUrl = `${origin}/payments/mercadopago/return?source=checkout`;
        const pendingUrl = `${origin}/payments/mercadopago/return?source=checkout`;
        const pref = await createMercadoPagoCheckout({ successUrl, failureUrl, pendingUrl });

        console.debug("MP checkout resp (checkout):", pref);
        const redirectUrl = getMpRedirectUrl(pref);
        if (!redirectUrl) throw new Error("No se recibió la URL de checkout de Mercado Pago");

        window.location.href = redirectUrl;
        return;
      } catch (e: any) {
        const m = String(e?.message || "No se pudo iniciar el pago con Mercado Pago");
        setMsg(m);
        if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("credenciales")) {
          router.push(`/auth?redirectTo=/checkout`);
        }
      } finally { setSubmitting(false); }
      return;
    }

    // Resto de métodos
    const payload: CreateOrderBody = {
      shippingAddressId: shippingAddressId.trim(),
      paymentMethod,
      shippingMethod,
      couponCode: couponCode.trim() || undefined,
    };
    setSubmitting(true);
    try {
      const o = await createOrder(payload);
      if ((o as any)?.paymentUrl) { window.location.href = (o as any).paymentUrl; return; }
      router.push(`/pedidos/${(o as any)?._id}`);
    } catch (e: any) {
      const m = String(e?.message || "No se pudo crear el pedido");
      setMsg(m);
      if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("credenciales")) {
        router.push(`/auth?redirectTo=/checkout`);
      }
    } finally { setSubmitting(false); }
  }

  async function handleCalcAtCheckout(e: React.FormEvent) {
    e.preventDefault();
    setShipOpts(null); setShipCalcErr(null);
    if (!shippingAddressId.trim()) { setShipCalcErr("Indicá una dirección"); return; }
    setShipCalcLoading(true);
    try {
      const res = await calculateShipping({ addressId: shippingAddressId.trim(), cartItems: [] } as any);
      setShipOpts(res.options || []);
      if (res.options?.[0]?.service) setShippingMethod(res.options[0].service);
    } catch (e: any) { setShipOpts(null); setShipCalcErr(e?.message || "No se pudo calcular el envío"); }
    finally { setShipCalcLoading(false); }
  }


return (
<main style={{ maxWidth: 720, margin: "24px auto", padding: "0 16px" }}>
<header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
<h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Checkout</h1>
<button
onClick={() => router.back()}
style={{ marginLeft: "auto", border: "1px solid #ddd", padding: "8px 12px", borderRadius: 8, background: "white", cursor: "pointer" }}
>
Volver
</button>
</header>

  <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff" }}>
    <label style={{ display: "grid", gap: 6 }}>
      <Label>ID de dirección de envío</Label>
      <input
        value={shippingAddressId}
        onChange={(e) => setShippingAddressId(e.target.value)}
        placeholder="addr_001"
        required
        style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
      />
      <small style={{ color: "#666" }}>
        Usá el ID de una dirección guardada en el perfil / endpoint de direcciones.
      </small>
    </label>

    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
      <label style={{ display: "grid", gap: 6 }}>
  <Label>Método de envío</Label>

  {/* Acciones para calcular */}
  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
    <select
      value={shippingMethod}
      onChange={(e) => setShippingMethod(e.target.value)}
      style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", minWidth: 220 }}
    >
      {/* Si hay opciones dinámicas, las listamos; si no, dejamos las default */}
      {shipOpts && shipOpts.length > 0 ? (
        shipOpts.map((o) => (
          <option key={o.service} value={o.service}>
            {o.name} • {o.estimatedDays} días • {typeof o.cost === "number" ? o.cost.toFixed(2) : o.cost}
          </option>
        ))
      ) : (
        <>
          <option value="standard">standard</option>
          <option value="express">express</option>
        </>
      )}
    </select>

    <button
      type="button"
      onClick={(e) => handleCalcAtCheckout(e as any)}
      disabled={shipCalcLoading || !shippingAddressId.trim()}
      style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: shipCalcLoading ? "#f3f3f3" : "white" }}
      title="Calcular envío (POST /shipping/calculate)"
    >
      {shipCalcLoading ? "Calculando…" : "Calcular envío"}
    </button>

    {shipCalcErr && <span style={{ color: "crimson" }}>{shipCalcErr}</span>}
  </div>

  {/* Nota visual de las opciones */}
  {shipOpts && shipOpts.length > 0 && (
    <small style={{ color: "#666" }}>
      {shipOpts.length} opción{shipOpts.length > 1 ? "es" : ""} disponible{shipOpts.length > 1 ? "s" : ""}.
    </small>
  )}
</label>


      <label style={{ display: "grid", gap: 6 }}>
        <Label>Método de pago</Label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          <option value="paypal">paypal</option>
          <option value="stripe">stripe</option>
          <option value="mercadopago">mercadopago</option>
          <option value="cash">cash</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <Label>Cupón (opcional)</Label>
        <input
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          placeholder="SAVE20"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        />
      </label>
    </div>

    {/* ⬇️ agregado: notas para /orders/with-shipping */}
    <label style={{ display: "grid", gap: 6 }}>
      <Label>Notas para el envío (opcional)</Label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Please handle with care"
        style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", minHeight: 80 }}
      />
    </label>
    {/* ⬆️ agregado */}

    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: submitting ? "#f3f3f3" : "white",
          cursor: submitting ? "default" : "pointer",
          fontWeight: 700,
        }}
        title="Confirmar (crea pedido o te lleva a MP si lo elegiste)"
      >
        {submitting ? "Procesando…" : "Confirmar y pagar"}
      </button>

      {/* ⬇️ tu botón alternativo (lo dejo igual) */}
      <button
        type="button"
        disabled={submitting || submittingShipping}
        onClick={async () => {
          setMsg(null);
          setSubmittingShipping(true);
          try {
            const res = await createOrderWithShipping({ notes: notes.trim() || undefined });
            window.location.href = `/pedidos/${(res as any).order._id}`;
          } catch (e: any) {
            const m = String(e?.message || "No se pudo crear el pedido con envío");
            setMsg(m);
            if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("credenciales")) {
              router.push(`/auth?redirectTo=/checkout`);
            }
          } finally {
            setSubmittingShipping(false);
          }
        }}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: submittingShipping ? "#f3f3f3" : "white",
          cursor: submittingShipping ? "default" : "pointer",
          fontWeight: 700,
        }}
        title="Crear pedido con envío (POST /orders/with-shipping)"
      >
        {submittingShipping ? "Creando con envío…" : "Confirmar con envío"}
      </button>
      {/* ⬆️ agregado */}

      {msg && <span style={{ color: msg.toLowerCase().includes("✅") ? "green" : "crimson" }}>{msg}</span>}
    </div>
  </form>

  <p style={{ marginTop: 12, color: "#666" }}>
    Tip: si elegís <strong>mercadopago</strong>, vas directo al checkout de MP (preferencia por todo el carrito).
  </p>
</main>


);
}