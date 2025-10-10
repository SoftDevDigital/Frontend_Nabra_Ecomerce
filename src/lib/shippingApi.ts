// src/lib/shippingApi.ts
import { apiFetch } from "@/lib/api";

/* ============ Tipos existentes ============ */
export type ShipDims = { length: number; width: number; height: number };
export type ShipItem = {
  productId: string;
  quantity: number;
  weight: number;         // kg
  dimensions: ShipDims;   // cm
};

export type ShippingOption = {
  service: string;        // "standard" | "express" | ...
  name: string;
  cost: number;
  estimatedDays: number;
  description?: string;
  carrier?: string;
};

export type CalculateShippingBody = {
  addressId: string;
  cartItems: ShipItem[];
};

export type CalculateShippingResponse = {
  options: ShippingOption[];
  freeShippingThreshold?: number;
  qualifiesForFreeShipping?: boolean;
};

export type ShippingService = {
  id: string; name: string; description?: string;
  features?: string[];
  maxWeight?: number;
  maxDimensions?: ShipDims;
  availableIn?: string[]; // ["CABA","GBA","INTERIOR"]
  baseRate?: number;
};

export type GetServicesResponse = { services: ShippingService[] };

export type TrackingEvent = {
  timestamp: string;
  status: string;
  description?: string;
  location?: string;
};
export type TrackingResponse = {
  trackingNumber: string;
  status: string;                 // "in_transit" | ...
  estimatedDelivery?: string;
  currentLocation?: string;
  history?: TrackingEvent[];
};

/* ============ Endpoints existentes ============ */
export async function calculateShipping(body: CalculateShippingBody) {
  return apiFetch<CalculateShippingResponse>(`/shipping/calculate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getShippingServices(zone?: "CABA" | "GBA" | "INTERIOR" | string) {
  const qs = zone ? `?zone=${encodeURIComponent(zone)}` : "";
  return apiFetch<GetServicesResponse>(`/shipping/services${qs}`, { method: "GET" });
}

export async function trackShipment(trackingNumber: string) {
  return apiFetch<TrackingResponse>(`/shipping/tracking/${encodeURIComponent(trackingNumber)}`, {
    method: "GET",
  });
}

/* ============ NUEVO: Doctor Envío / Drenvio ============ */

/** Parámetros para cotizar con Drenvio/Doctor Envío */
export type DoctorEnvioQuoteParams = {
  country: "MX";
  state: string;
  city: string;
  postalCode: string;
  addressLine: string;
  // opcional: si querés pasar items/medidas al backend
  items?: Array<{
    weightKg?: number;                   // peso en kg
    lengthCm?: number; widthCm?: number; heightCm?: number;
    quantity?: number;
  }>;
};

/** Respuesta normalizada para tu UI */
export type DoctorEnvioRate = {
  carrier: string;
  service: string;
  price: number;
  currency: string;   // "MXN"
  days?: string;      // "1 día" | "2-3 días"
  serviceId?: string; // id/slug del servicio
};

/**
 * POST a tu backend -> que a su vez llama a Drenvio.
 * No pongas el token de Drenvio en el front.
 *
 * IMPORTANTE:
 *  - Esta ruta NO debe chocar con GET /shipping/services (listado local).
 *  - Crea en tu backend POST /shipping/doctor-envio/rates que haga la cotización.
 */
export async function getDoctorEnvioRates(params: DoctorEnvioQuoteParams) {
  return apiFetch<{ rates: DoctorEnvioRate[]; address?: any }>(
    `/shipping/doctor-envio/rates`,     // ⬅️ NUEVA ruta POST para cotizar
    { method: "POST", body: JSON.stringify(params) }
  );
}

/** Llama directo a Drenvio (Doctor Envío) desde frontend */
export async function fetchDrenvioRatesDirect(input: {
  originZip: string;
  destZip: string;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  carriers?: string[];
}) {
  const body = {
    type: "National",
    origin: {
      country: "MX",
      postal_code: input.originZip,
    },
    destination: {
      country: "MX",
      postal_code: input.destZip,
    },
    packages: [
      {
        weight: input.weightKg ?? 1,
        height: input.heightCm ?? 10,
        width: input.widthCm ?? 10,
        length: input.lengthCm ?? 10,
        type: "box",
        main_weight: input.weightKg ?? 1,
      },
    ],
    carriers: input.carriers ?? ["fedex", "estafeta", "ampm", "dhl"],
    insurance: 0,
  };

  const res = await fetch("https://prod.api-drenvio.com/v2/shipments/rate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiYXV0aDB8NjMzZjk3NWM1MDMzYmZhY2E5YjZhNzJkIiwidmlwIjpmYWxzZSwibmFtZSI6ImJlcmVuaWNlIG5hcmNpem8iLCJlbWFpbCI6Im5hYnJhd29tYW5zbXhAZ21haWwuY29tIiwiaWF0IjoxNjY1MTgyNzAxfQ.ymW0N_E3SVUhPYizbOExZiiL_D2Z0zSKMaMcLtzE8GU`, // ⚠️ o directo el token hardcodeado
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
if (!res.ok) throw new Error(data?.message || "Error al cotizar en Drenvio");

// ✅ soportar también array en raíz
const rawRates = Array.isArray(data) ? data : (data?.rates || data?.data || []);

// Normalizá al shape que tu UI espera
const rates = rawRates.map((r: any) => ({
  carrier: r.carrier,
  service: r.service,
  price: r.price,
  currency: r.currency || "MXN",
  days: r.days || r.estimated_days,

  // ids robustos
  serviceId: r.serviceId ?? r.service_id ?? r.id ?? "",
  ObjectId: r.ObjectId ?? r.objectId ?? "",
  ShippingId: r.ShippingId ?? r.shippingId ?? "",
}));

return { rates };
}
