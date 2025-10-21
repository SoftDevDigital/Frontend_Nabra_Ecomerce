// src/lib/promotionsApi.ts
export type Promotion = {
  _id?: string;
  title?: string;
  message?: string;
  description?: string;
  bannerText?: string;
  linkUrl?: string;
  bgColor?: string;
  textColor?: string;
  startsAt?: string;
  endsAt?: string;
  active?: boolean;
  [k: string]: any;
};

type ApiResp<T> = { success?: boolean; data?: T; message?: string };

const PROMOS_URL = "https://api.nabra.mx/promotions/active";

/**
 * Trae promociones activas (no cacheado para que siempre esté fresco).
 * Si el API devuelve { success: true, data: [] } retorna [].
 */
export async function fetchActivePromotions(): Promise<Promotion[]> {
  const res = await fetch(PROMOS_URL, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Promotions API error ${res.status}`);
  }

  const json = (await res.json()) as ApiResp<Promotion[]>;
  if (json?.success === false) {
    throw new Error(json?.message || "Promotions API returned success=false");
  }
  return Array.isArray(json?.data) ? json!.data! : [];
}
