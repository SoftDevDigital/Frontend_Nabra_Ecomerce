// src/lib/paymentsApi.ts
import { apiFetch } from "@/lib/api";

/* ==================== Mercado Pago: crear preferencias ==================== */

export type MPCheckoutResponse = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
};

/**
 * POST /payments/mercadopago/checkout
 * Crea preferencia por TODO el carrito del usuario autenticado.
 */
export async function createMercadoPagoCheckout(opts?: {
  successUrl?: string;
  failureUrl?: string;
  pendingUrl?: string;
}): Promise<MPCheckoutResponse> {
  const qs = new URLSearchParams();
  if (opts?.successUrl) qs.set("successUrl", opts.successUrl);
  if (opts?.failureUrl) qs.set("failureUrl", opts.failureUrl);
  if (opts?.pendingUrl) qs.set("pendingUrl", opts.pendingUrl);

  const path = `/payments/mercadopago/checkout${qs.toString() ? `?${qs.toString()}` : ""}`;
  const r = await apiFetch<MPCheckoutResponse>(path, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return r;
}

/**
 * POST /payments/mercadopago/partial-checkout
 * Crea preferencia SOLO para ítems seleccionados del carrito.
 */
export async function createMercadoPagoPartialCheckout(body: {
  selectedItems: { cartItemId: string; requestedQuantity: number }[];
  returnUrl?: string; // backend la llama returnUrl (success)
  cancelUrl?: string; // backend la llama cancelUrl (cancel)
}): Promise<MPCheckoutResponse> {
  const r = await apiFetch<MPCheckoutResponse>(`/payments/mercadopago/partial-checkout`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return r;
}

/* ==================== Listado / detalle / cancelación de pagos (admin) ==================== */

export type Payment = {
  _id: string;
  provider: "mercadopago" | "stripe" | "paypal" | string;
  status: string; // approved | pending | rejected | created | authorized | in_process | ...
  amount: number;
  currency?: string;
  orderId?: string;
  externalId?: string;          // id del PSP (MP payment_id, etc.)
  providerPaymentId?: string;   // alias común si lo devuelve así el backend
  approvalUrl?: string;
  captureId?: string;
  createdAt?: string;
  [k: string]: any;
};

/** Estados que típicamente sí permiten cancelación */
export const CANCELLABLE_STATUSES = [
  "pending",
  "authorized",
  "created",
  "in_process",
  "in_mediation",
];

/**
 * GET /payments
 * Devuelve el listado de pagos (puede venir vacío).
 * Normaliza respuestas {success,data:[...]} o arrays directos.
 */
export async function listPayments(params?: { limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  const path = `/payments${q.toString() ? `?${q.toString()}` : ""}`;

  const res = await apiFetch<any>(path, { method: "GET" });
  const data = Array.isArray(res) ? res : res?.data ?? [];
  return data as Payment[];
}

/**
 * GET /payments/:id
 * Devuelve un pago por id.
 * Normaliza respuestas {success,data:{...}} o el objeto directo.
 */
export async function getPayment(id: string) {
  const res = await apiFetch<any>(`/payments/${id}`, { method: "GET" });
  return (res?.data ?? res) as Payment;
}

/**
 * DELETE /payments/:id
 * Intenta cancelar un pago. Lanza Error con mensaje legible si el backend devuelve success:false.
 */
export async function cancelPayment(paymentId: string) {
  const res = await apiFetch<any>(`/payments/${paymentId}`, { method: "DELETE" });
  if (res?.success === false) {
    throw new Error(res?.message || "No fue posible cancelar el pago");
  }
  return res;
}

/* ==================== MP: checkout con envío en el body (V2) ==================== */

/** Estructura que tu backend espera bajo body.simpleShipping */
export type SimpleShipping = {
  contact: {
    emailOrPhone?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  address: {
    country: string;      // "MX"
    state: string;        // ej: "Ciudad de México"
    city: string;         // ej: "Ciudad de México"
    postalCode: string;   // ej: "01000"
    addressLine: string;  // ej: "Av. Siempre Viva 742, Dpto 4B"
  };
};

/** Args para la versión V2 (solo acepta campos válidos por backend) */
export type CreateMPCheckoutArgs = {
  simpleShipping?: SimpleShipping;
  couponCode?: string;
  currencyId?: string; // 👈 NUEVO: forzamos la moneda para MP (MXN)
};

/**
 * V2: POST /payments/mercadopago/checkout (solo con simpleShipping, couponCode, etc.)
 * No admite successUrl/failureUrl/pendingUrl en el body.
 */
export async function createMercadoPagoCheckoutV2(
  args: CreateMPCheckoutArgs
): Promise<MPCheckoutResponse> {
  const body: any = {};
  if (args.simpleShipping) body.simpleShipping = args.simpleShipping;
  if (args.couponCode) body.couponCode = args.couponCode;
  if (args.currencyId) body.currencyId = args.currencyId; // 👈 NUEVO

  const r = await apiFetch<MPCheckoutResponse>(`/payments/mercadopago/checkout`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return r;
}
