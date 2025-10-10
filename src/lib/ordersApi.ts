// src/lib/ordersApi.ts
import { apiFetch } from "@/lib/api";

/* ===== Crear pedido (POST /orders) ===== */
export type CreateOrderBody = {
  shippingAddressId: string;
  paymentMethod: "paypal" | "stripe" | "mercadopago" | "cash" | string;
  couponCode?: string;
  shippingMethod?: "standard" | "express" | string;
};

export type CreateOrderResponse = {
  _id: string;
  orderNumber?: string;
  status: string; // pending, paid, etc
  total: number;
  paymentUrl?: string;
  createdAt?: string;
};

export async function createOrder(body: CreateOrderBody): Promise<CreateOrderResponse> {
  const res = await apiFetch<CreateOrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res || !("_id" in res)) {
    throw new Error("Formato de respuesta inesperado al crear el pedido");
  }
  return res;
}

/* ===== Cancelar pedido (PUT /orders/:id/cancel) ===== */
export type CancelOrderSuccess = {
  message: string; // "Order cancelled successfully"
  order: {
    _id: string;
    status: "cancelled" | string;
    cancelledAt?: string;
    // puede traer más campos, los dejamos abiertos
    [k: string]: any;
  };
};

export type CancelOrderError = {
  success: false;
  message: string;
  error?: string; // e.g. INVALID_ORDER_STATUS
};

export async function cancelOrder(orderId: string): Promise<CancelOrderSuccess> {
  const res = await apiFetch<CancelOrderSuccess | CancelOrderError>(`/orders/${orderId}/cancel`, {
    method: "PUT",
  });

  // Si backend responde con shape de error 400
  if (res && "success" in (res as any) && (res as CancelOrderError).success === false) {
    const errMsg = (res as CancelOrderError).message || "No se pudo cancelar el pedido";
    throw new Error(errMsg);
  }

  // Éxito (200)
  const ok = res as CancelOrderSuccess;
  if (!ok || !ok.order || ok.order.status !== "cancelled") {
    throw new Error("Formato de respuesta inesperado al cancelar el pedido");
  }
  return ok;
}

/* ===== Crear pedido con envío (POST /orders/with-shipping) ===== */
export type ShippingInfo = {
  rateId: string;
  carrier: string;
  service: string;
  price: number;
  currency: string;
  days?: string;
  serviceId?: string;
  trackingNumber?: string;
  shipmentId?: string;
  status?: string;
  labelUrl?: string;
};

export type OrderWithShipping = {
  _id: string;
  items: any[]; // si querés, tipalo como tus OrderItemNew
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  shippingInfo: ShippingInfo;
  status: string;
  createdAt?: string;
  // ...puede traer más campos (orderNumber, paymentStatus, etc.)
  [k: string]: any;
};

export type CreateOrderWithShippingBody = {
  notes?: string;
};

export type CreateOrderWithShippingResponse = {
  success: true;
  order: OrderWithShipping;
  message?: string;
};

export async function createOrderWithShipping(
  body: CreateOrderWithShippingBody
): Promise<CreateOrderWithShippingResponse> {
  const res = await apiFetch<CreateOrderWithShippingResponse>("/orders/with-shipping", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });

  if (!res || !res.success || !res.order?._id) {
    throw new Error("Formato de respuesta inesperado al crear el pedido con envío");
  }
  return res;
}

/* ===== Estado de envío (GET /orders/my-orders/:id/shipping-status) ===== */
export type TrackingEvent = {
  timestamp: string;
  status: string;
  description?: string;
  location?: string;
};

export type ShippingStatus = {
  orderId: string;
  shipmentId?: string;
  trackingNumber?: string;
  status: string; // e.g. "in_transit"
  carrier?: string;
  service?: string;
  lastUpdate?: string;
  trackingEvents?: TrackingEvent[];
};

export type ShippingStatusError = {
  success: false;
  message: string; // "No shipment information available for this order"
  error?: string;  // "BAD_REQUEST"
};

export async function getMyOrderShippingStatus(orderId: string): Promise<ShippingStatus> {
  const res = await apiFetch<ShippingStatus | ShippingStatusError>(
    `/orders/my-orders/${orderId}/shipping-status`,
    { method: "GET" }
  );

  if (res && "success" in (res as any) && (res as ShippingStatusError).success === false) {
    const msg = (res as ShippingStatusError).message || "No se pudo obtener el estado de envío";
    throw new Error(msg);
  }

  return res as ShippingStatus;
}
