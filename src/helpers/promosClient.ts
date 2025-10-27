// src/helpers/promosClient.ts
import type { Promotion } from "@/lib/promotionsApi";

function getBearer(): string | null {
  try {
    return typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
  } catch {
    return null;
  }
}

export async function fetchActivePromotions(): Promise<Promotion[]> {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
  const url = `${API_BASE}/promotions/active`;
  const headers: HeadersInit = { Accept: "application/json" };
  const token = getBearer();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: "GET", cache: "no-store", headers });
  const json = await res.json().catch(() => null);

  const arr = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

  // normalizamos para garantizar productIds
  return (arr as any[]).map((r) => ({
    _id: r._id,
    name: r.name,
    type: r.type,
    productIds: Array.from(new Set([...(r.specificProducts ?? []), ...(r.productIds ?? [])])),
    startDate: r.startDate,
    endDate: r.endDate,
    discountPercentage: r.discountPercentage,
    discountAmount: r.discountAmount,
    buyQuantity: r.buyQuantity,
    getQuantity: r.getQuantity,
  })) as Promotion[];
}
