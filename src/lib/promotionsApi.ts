// src/lib/promotionsApi.ts
import { apiFetch } from "@/lib/api";
import type { ProductDto } from "@/lib/productsApi";

/* ===== Tipos normalizados que usa tu UI ===== */
export type PromotionBase = {
  _id?: string;
  name: string;
  productIds: string[];
  startDate?: string;
  endDate?: string;
  type: "percentage" | "fixed_amount" | "buy_x_get_y";
};

export type PercentagePromo = PromotionBase & { type: "percentage"; discountPercentage: number };
export type FixedAmountPromo = PromotionBase & { type: "fixed_amount"; discountAmount: number };
export type BuyXGetYPromo = PromotionBase & { type: "buy_x_get_y"; buyQuantity: number; getQuantity: number };
export type Promotion = PercentagePromo | FixedAmountPromo | BuyXGetYPromo;

/* ===== Tipos crudos del backend /promotions/active ===== */
type RawPromotionBase = {
  _id?: string;
  name: string;
  type: "percentage" | "fixed_amount" | "buy_x_get_y";
  target?: "specific_products" | "all_products" | string;
  startDate?: string;
  endDate?: string;
  status?: "active" | "expired" | "scheduled";
  isActive?: boolean;
  isAutomatic?: boolean;
  specificProducts?: string[];
  discountPercentage?: number;
  discountAmount?: number;
  buyQuantity?: number;
  getQuantity?: number;
};

type RawActiveResponse = {
  success: boolean;
  data: RawPromotionBase[];
  message?: string;
};

/* ===== Helpers ===== */
export function isActiveByDate(p: { startDate?: string; endDate?: string }, now = new Date()): boolean {
  const s = p.startDate ? new Date(p.startDate) : null;
  const e = p.endDate ? new Date(p.endDate) : null;
  if (s && now < s) return false;
  if (e && now > e) return false;
  return true;
}

/** Normaliza la promo cruda (con specificProducts) a Promotion (con productIds). */
function normalizeRawPromotion(r: RawPromotionBase): Promotion | null {
  const products =
    Array.isArray(r.specificProducts) && r.specificProducts.length > 0
      ? r.specificProducts
      : (r as any).productIds || [];

  const base = {
    _id: r._id,
    name: r.name,
    productIds: products,
    startDate: r.startDate,
    endDate: r.endDate,
    type: r.type,
  } as PromotionBase;

  if (r.type === "percentage") {
    const pct = Number(r.discountPercentage ?? 0);
    return { ...base, type: "percentage", discountPercentage: pct };
  }
  if (r.type === "fixed_amount") {
    const amt = Number(r.discountAmount ?? 0);
    return { ...base, type: "fixed_amount", discountAmount: amt };
  }
  if (r.type === "buy_x_get_y") {
    const buy = Number(r.buyQuantity ?? 0);
    const get = Number(r.getQuantity ?? 0);
    return { ...base, type: "buy_x_get_y", buyQuantity: buy, getQuantity: get };
  }
  return null;
}

function cleanPromosNormalized(list: (Promotion | null)[] = []) {
  return list.filter((p): p is Promotion => !!p).filter(isActiveByDate);
}

/* ===== Fetcher AJUSTADO al endpoint real ===== */
export async function fetchPromotionsActive(): Promise<Promotion[]> {
  const path = process.env.NEXT_PUBLIC_PROMOS_ENDPOINT || "/promotions/active";
  try {
    const r = await apiFetch<RawActiveResponse>(path, { method: "GET" });
    const raw = Array.isArray(r?.data) ? r.data : [];
    const onlyActive = raw.filter(x => (x.isActive !== false) && (x.status ? x.status === "active" : true));
    const normalized = onlyActive.map(normalizeRawPromotion);
    return cleanPromosNormalized(normalized);
  } catch {
    return [];
  }
}

/* ====== NUEVO: tipos de entrada/salida para crear promo ====== */
export type CreatePromotionIn =
  | {
      name: string;
      type: "percentage";
      productIds: string[];
      discountPercentage: number;
      startDate: string; // ISO
      endDate: string;   // ISO
    }
  | {
      name: string;
      type: "fixed_amount";
      productIds: string[];
      discountAmount: number;
      startDate: string;
      endDate: string;
    }
  | {
      name: string;
      type: "buy_x_get_y";
      productIds: string[];
      buyQuantity: number;
      getQuantity: number;
      startDate: string;
      endDate: string;
    };

export type CreatePromotionOut =
  | { success: true; data: any; message?: string }
  | { success: false; message: string };

/* ====== NUEVO: crea una promo (requiere Bearer admin) ====== */
export async function createPromotionAdmin(payload: CreatePromotionIn): Promise<CreatePromotionOut> {
  return apiFetch<CreatePromotionOut>("/promotions/admin/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(getBearer() ? { Authorization: `Bearer ${getBearer()}` } : {}),
    },
    body: JSON.stringify(payload),
  });
}

/* ====== NUEVO: utilidades JWT ====== */
function getBearer(): string | null {
  try { return typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null; }
  catch { return null; }
}

/* ====== NUEVO: helpers de fecha ====== */
export function toISOStartOfDay(dateStr: string) {
  const d = new Date(dateStr);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  return utc.toISOString();
}
export function toISOEndOfDay(dateStr: string) {
  const d = new Date(dateStr);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  return utc.toISOString();
}

/* ===== Resto de utilidades (sin cambios) ===== */
export async function fetchProductById(id: string): Promise<ProductDto | null> {
  try {
    const r = await apiFetch<{ success: boolean; data: ProductDto }>(`/products/${id}`, { method: "GET" });
    return r?.data ?? null;
  } catch {
    return null;
  }
}

export function formatMoney(n?: number) {
  if (typeof n !== "number") return "";
  const currency = process.env.NEXT_PUBLIC_CURRENCY || "ARS";
  const locale = process.env.NEXT_PUBLIC_LOCALE || "es-AR";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
}

export function computePromoPrice(promo: Promotion, price: number) {
  if (promo.type === "percentage") {
    const pct = Math.max(0, Math.min(100, (promo as PercentagePromo).discountPercentage));
    return {
      finalPrice: Math.max(0, Math.round((price * (100 - pct)) / 100)),
      badge: `-${pct}%`,
      sublabel: `Precio con ${pct}% OFF`,
      suggestQty: 1,
    };
  }
  if (promo.type === "fixed_amount") {
    const amount = Math.max(0, (promo as FixedAmountPromo).discountAmount);
    return {
      finalPrice: Math.max(0, price - amount),
      badge: `-${formatMoney(amount)}`,
      sublabel: `Ahorrás ${formatMoney(amount)}`,
      suggestQty: 1,
    };
  }
  const bxgy = promo as BuyXGetYPromo;
  const totalUnits = bxgy.buyQuantity + bxgy.getQuantity;
  const effectivePerUnit = totalUnits > 0 ? Math.round((bxgy.buyQuantity * price) / totalUnits) : price;
  const badge = bxgy.buyQuantity === 2 && bxgy.getQuantity === 1 ? "2x1" : `${bxgy.buyQuantity}+${bxgy.getQuantity}`;
  return {
    finalPrice: price, // unitario no cambia: beneficio en carrito
    badge,
    sublabel: `Llevando ${bxgy.buyQuantity}, te bonifican ${bxgy.getQuantity} (≈ ${formatMoney(effectivePerUnit)}/u)`,
    suggestQty: bxgy.buyQuantity,
  };
}

export function getPromosForProduct(promos: Promotion[], productId: string) {
  return promos.filter(p => (p.productIds || []).includes(productId) && isActiveByDate(p));
}

export function pickBestPromo(promos: Promotion[], price: number) {
  if (!promos.length) return null;
  const sorted = [...promos].sort((a, b) => {
    const aa = computePromoPrice(a, price).finalPrice ?? price;
    const bb = computePromoPrice(b, price).finalPrice ?? price;
    return aa - bb;
  });
  return sorted[0];
}
