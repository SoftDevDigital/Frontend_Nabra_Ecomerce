// src/lib/shippingApi.ts
import { apiFetch } from "@/lib/api";

/* ============ Tipos ============ */
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

/* ============ Endpoints ============ */
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
