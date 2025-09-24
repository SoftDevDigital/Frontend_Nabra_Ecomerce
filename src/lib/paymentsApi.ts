// src/lib/paymentsApi.ts
import { apiFetch } from "@/lib/api";

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
  const r = await apiFetch<MPCheckoutResponse>(path, { method: "POST", body: JSON.stringify({}) });
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
