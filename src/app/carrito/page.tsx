"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
// import { getShippingServices,getDoctorEnvioRates, fetchDrenvioRatesDirect } from "@/lib/shippingApi";
import { getShippingServices, fetchDrenvioRatesDirect } from "@/lib/shippingApi";


import { useRouter } from "next/navigation";
import s from "./Cart.module.css";
import { createMercadoPagoCheckoutV2 } from "@/lib/paymentsApi";
import { setCartBadgeCount, computeItemsCount } from "@/lib/cartBadge";


/* ===== Tipos base ===== */
type CartProduct = {
  _id?: string;
  name?: string;
  [k: string]: any;
};

type CartItem = {
  _id: string;              // id del item en el carrito
  product: CartProduct;     // producto (id+name si viene en plano)
  quantity: number;
  size?: string | null;
  color?: string | null;
  price?: number;           // unitario (si viene en API)
  subtotal?: number;        // si viene en API
};

type CartData = {
  _id?: string;             // cartId
  userId?: string;
  items: CartItem[];
  total?: number;
  totalItems?: number;
  discounts?: { type: string; amount: number; description?: string }[];
  finalTotal?: number;
};

/* Formatos de respuesta posibles */
type CartResponseWrapped = { success: boolean; data: any; message?: string };
type CartResponseFlat = {
  items: any[];
  total?: number;
  totalItems?: number;
  discounts?: { type: string; amount: number; description?: string }[];
  finalTotal?: number;
  _id?: string;
  userId?: string;
};
type CartResponse = CartResponseWrapped | CartResponseFlat;

/* === NUEVO: contrato /cart/add (201) === */
type AddToCartResponse = {
  message: string;
  cartItem: { _id: string; productId: string; quantity: number; price: number; subtotal: number; };
  cartTotal: number;
};
type UpdateCartItemResponse = {
  message: string;
  cartItem: { _id: string; quantity: number; subtotal: number; };
  cartTotal: number;
};
type DeleteCartItemResponse = { message: string; cartTotal: number; };
// 🆕 limpiar carrito
type ClearCartResponse = {
  success: boolean;
  data: { _id: string; items: any[]; userId: string; createdAt: string; updatedAt: string; __v?: number; };
  message?: string;
};
type RemoveCartItemResponse = {
  success: boolean;
  data: { _id: string; items: any[]; userId: string; createdAt: string; updatedAt: string; __v?: number; };
  message?: string;
};

type SummaryItem = {
  _id: string; productId: string; productName: string; quantity: number;
  originalPrice: number; discountedPrice: number; subtotal: number;
};

// === /cart/summary-with-discounts (envuelve igual que apply-coupon) ===
type ApplyCouponCartItem = {
  _id: string;
  product: { _id: string; name: string; price: number; images?: string[]; [k: string]: any };
  quantity: number;
  size?: string;
  itemTotal: number;
};
type ApplyCouponCartSummary = {
  items: ApplyCouponCartItem[];
  totalItems: number;
  totalQuantity: number;
  subtotal: number;
  estimatedTax?: number;
  estimatedTotal: number;
  currency?: string;
  originalTotal?: number;
};
type ApplyCouponDiscounts = {
  success: boolean;
  appliedPromotions: any[];
  totalDiscount: number;
  originalTotal: number;
  finalTotal: number;
  savings: number;
  errors?: string[];
};
type ApplyCouponResponse = {
  success: boolean;
  data: { cartSummary: ApplyCouponCartSummary; discounts: ApplyCouponDiscounts; finalTotal: number; };
  message?: string;
};
type CartSummaryWithDiscountsData = {
  cartSummary: ApplyCouponCartSummary;
  discounts: ApplyCouponDiscounts;
  finalTotal: number;
};
type CartSummaryWithDiscountsWrapped = { success: boolean; data: CartSummaryWithDiscountsData; message?: string; };
type CartSummaryWithDiscountsResponse = CartSummaryWithDiscountsWrapped | CartSummaryWithDiscountsData;

/* ===== Pedido ===== */
type OrderItemOut = { product: string; quantity: number; size?: string; price: number };
type OrderOut = {
  _id: string;
  items: OrderItemOut[];
  userId: string;
  cartId: string;
  total: number;
  status: "pending" | "paid" | "cancelled" | string;
  shippingAddress: { street: string; city: string; zip: string; country: string };
};
type CreateOrderBody = {
  items: { itemId: string; quantity: number }[];
  cartId: string;
  shippingAddress: { street: string; city: string; zip: string; country: string };
};
type CreateOrderResponse =
  | { success: true; data: OrderOut; message?: string }
  | { success: false; message: string };

/* 🔹 NUEVO: tipos para Promos */
type Promotion = {
  _id: string;
  name: string;
  type: "percentage" | "fixed_amount" | "buy_x_get_y" | "free_shipping" | string;
  description?: string;
  discountPercentage?: number;
  startDate?: string;
  endDate?: string;
  conditions?: { categories?: string[]; minimumPurchaseAmount?: number; [k: string]: any; };
  isActive?: boolean;
};
type PromotionType = { id: string; name: string; description: string; };
type ApplyDiscountsRequestItem = {
  productId: string; cartItemId: string; productName?: string; category?: string;
  quantity: number; price: number; size?: string | null;
};
type ApplyDiscountsResponse = {
  discounts: { promotionId: string; promotionName: string; type: string; discountAmount: number; appliedToItems: string[]; description?: string; }[];
  totalDiscount: number; originalAmount: number; finalAmount: number;
};
type ValidateCouponResponse =
  | { valid: true; coupon: { code: string; discountPercentage?: number; validUntil?: string; usageLimit?: number; usedCount?: number }; message?: string; }
  | { valid: false; message?: string; error?: string };

/* === Shipping address en carrito === */
type SaveShippingAddressBody = {
  fullName: string; phone: string; addressLine: string; city: string; postalCode: string; province?: string; notes?: string;
};
type SaveShippingAddressResponse = {
  success: boolean;
  data?: { success: boolean; shippingAddress: { country?: string; postal_code?: string; city?: string; contact?: { name?: string; phone?: string; email?: string } } };
  message?: string;
};

/* === /cart/summary (resumen plano) === */
type CartSummaryPlainItem = { _id?: string; productId?: string; productName?: string; quantity: number; price?: number; itemTotal?: number; };
type CartSummaryPlain = {
  items: CartSummaryPlainItem[];
  totalItems: number; totalQuantity: number; subtotal: number; estimatedTax: number; estimatedTotal: number; currency?: string;
};
type CartSummaryPlainWrapped = { success: boolean; data: CartSummaryPlain; message?: string };

/* ====== NUEVO: Tipos para GET /cart/total ====== */
type CartTotalItem = { _id: string; product: { _id: string; name: string; price: number; images?: string[]; [k: string]: any }; quantity: number; size?: string; itemTotal: number; };
type CartTotalData = { items: CartTotalItem[]; totalItems: number; totalQuantity: number; subtotal: number; estimatedTax?: number; estimatedTotal: number; currency?: string; };
type CartTotalWrapped = { success: boolean; data: CartTotalData; message?: string };
type CartTotalResponse = CartTotalWrapped | CartTotalData;

type CartValidateData = { valid: boolean; errors: string[]; warnings: string[]; };
type CartValidateWrapped = { success: boolean; data: CartValidateData; message?: string };
type CartValidateResponse = CartValidateWrapped | CartValidateData;

/* ====== NUEVO: GET /cart/with-shipping ====== */
type ShippingRate = { id: string; carrier: string; service: string; price: number; currency?: string; days?: string; serviceId?: string; metadata?: any; };
type WithShippingAddress = { country?: string; postal_code?: string; city?: string; contact?: { name?: string; phone?: string; email?: string }; };
type WithShippingData = {
  cart: { _id: string; items: { _id: string; product: { _id: string; name: string; price?: number; images?: string[]; stock?: number; isPreorder?: boolean }; quantity: number; size?: string }[]; userId: string; createdAt?: string; updatedAt?: string; shippingAddress?: WithShippingAddress; };
  summary: CartTotalData;
  shipping: { rates: ShippingRate[]; address?: WithShippingAddress; };
};
type WithShippingWrapped = { success: boolean; data: WithShippingData; message?: string };
type WithShippingResponse = WithShippingWrapped | WithShippingData;

/* ===== Helper fetch (con Bearer) ===== */
async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
  const token = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
  const headers = new Headers(init.headers || {});
  const isFormData = typeof FormData !== "undefined" && (init as any).body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  // ✅ FIX: faltaban backticks
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const apiMsg =
      json?.message ||
      json?.error ||
      (Array.isArray(json?.errors) ? json.errors[0]?.message : undefined) ||
      (res.status === 401 ? "No autenticado" : "Error de red");
    throw new Error(apiMsg);
  }
  return json as T;
}

/* ===== Util ===== */
const currency = (n?: number) => typeof n === "number"
  ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n)
  : "";

/* ======== NUEVO: helper para normalizar la URL de redirección de MP ======== */
function getMpRedirectUrl(resp: any): string | undefined {
  // soportar varias variantes comunes
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
    d.pointOfInteraction?.transactionData?.ticket_url || // algunas integraciones
    undefined
  );
}



/* ===== Página ===== */
export default function CartPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const router = useRouter();

  // Totales (compatibles con el contrato)
  const [cartId, setCartId] = useState<string | null>(null);
  const [cartTotal, setCartTotal] = useState<number | null>(null);
  const [cartTotalItems, setCartTotalItems] = useState<number | null>(null);
  const [cartDiscounts, setCartDiscounts] = useState<CartData["discounts"]>([]);
  const [cartFinalTotal, setCartFinalTotal] = useState<number | null>(null);

  // Agregar
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState<number>(1);
  const [addSize, setAddSize] = useState<string>("");
  const [addColor, setAddColor] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  // Editar
  const [edits, setEdits] = useState<Record<string, { quantity: number; size: string }>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  // Eliminar
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeMsg, setRemoveMsg] = useState<string | null>(null);

  // 🆕 Vaciar carrito
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  // Envío / Pedido
  const [shipStreet, setShipStreet] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipZip, setShipZip] = useState("");
  const [shipCountry, setShipCountry] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);
  const [orderCreated, setOrderCreated] = useState<OrderOut | null>(null);

  // Cupones / summary con descuentos
  const [couponCode, setCouponCode] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [summaryV2, setSummaryV2] = useState<CartSummaryWithDiscountsData | null>(null);
  const [couponResult, setCouponResult] = useState<ApplyCouponResponse | null>(null);

  // Promos
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);
  const [promoTypes, setPromoTypes] = useState<PromotionType[]>([]);
  const [promosLoading, setPromosLoading] = useState<boolean>(false);
  const [promosErr, setPromosErr] = useState<string | null>(null);
  const [promoCalc, setPromoCalc] = useState<ApplyDiscountsResponse | null>(null);
  const [promoCalcLoading, setPromoCalcLoading] = useState<boolean>(false);
  const [promoCalcErr, setPromoCalcErr] = useState<string | null>(null);
  const [couponValidation, setCouponValidation] = useState<ValidateCouponResponse | null>(null);
  const [couponValidating, setCouponValidating] = useState<boolean>(false);

  // Envíos
  const [addressId, setAddressId] = useState<string>("");
  const [shipCalcLoading, setShipCalcLoading] = useState(false);
  const [shipOptions, setShipOptions] = useState<import("@/lib/shippingApi").ShippingOption[] | null>(null);
  const [shipCalcErr, setShipCalcErr] = useState<string | null>(null);

  // Guardar dirección
  const [addrFullName, setAddrFullName] = useState("Jane Doe");
  const [addrPhone, setAddrPhone] = useState("+54 11 5555-5555");
  const [addrLine, setAddrLine] = useState("Av. Siempre Viva 742");
  const [addrCity, setAddrCity] = useState("CABA");
  const [addrPostal, setAddrPostal] = useState("1405");
  const [addrProvince, setAddrProvince] = useState("Buenos Aires");
  const [addrNotes, setAddrNotes] = useState("Portería 2");
  const [savingAddr, setSavingAddr] = useState(false);
  const [saveAddrMsg, setSaveAddrMsg] = useState<string | null>(null);

  // /cart/summary
  const [plainSummary, setPlainSummary] = useState<CartSummaryPlain | null>(null);
  const [plainSummaryLoading, setPlainSummaryLoading] = useState(false);
  const [plainSummaryErr, setPlainSummaryErr] = useState<string | null>(null);

  // /cart/total
  const [cartTotalSummary, setCartTotalSummary] = useState<CartTotalData | null>(null);
  const [cartTotalLoading, setCartTotalLoading] = useState(false);
  const [cartTotalErr, setCartTotalErr] = useState<string | null>(null);

  // /cart/validate
  const [cartValidate, setCartValidate] = useState<CartValidateData | null>(null);
  const [cartValidateLoading, setCartValidateLoading] = useState(false);
  const [cartValidateErr, setCartValidateErr] = useState<string | null>(null);

  // /cart/with-shipping
  const [withShip, setWithShip] = useState<WithShippingData | null>(null);
  const [withShipLoading, setWithShipLoading] = useState(false);
  const [withShipErr, setWithShipErr] = useState<string | null>(null);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);

  // 🆕 MP: estado de pago
  const [payingMp, setPayingMp] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);


  // === MX: catálogos y validadores ===========================
const MX_STATES = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas",
  "Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Estado de México",
  "Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit",
  "Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí",
  "Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas"
];

// === MX: formulario previo al pago =========================
const [mxEmail, setMxEmail] = useState("");
const [mxName, setMxName]   = useState("");
const [mxLastname, setMxLastname] = useState("");
const [mxPhone, setMxPhone] = useState("");

const [mxState, setMxState] = useState("Ciudad de México");
const [mxCity, setMxCity]   = useState("Ciudad de México");
const [mxZip, setMxZip]     = useState("");
const [mxStreet, setMxStreet] = useState("");

const [mxSaveForNext, setMxSaveForNext] = useState(false);

const [mxFetchingRates, setMxFetchingRates] = useState(false);
const [mxFormErr, setMxFormErr] = useState<string | null>(null);

// Para habilitar MP solo si hay dirección MX válida + tarifa elegida
const isMxAddressValid =
  !!mxStreet.trim() && !!mxCity.trim() && !!mxZip.trim() && MX_STATES.includes(mxState);

  

  function buildApplyDiscountsPayload(items: CartItem[]): { cartItems: ApplyDiscountsRequestItem[]; totalAmount: number } {
    const cartItems: ApplyDiscountsRequestItem[] = items.map((it) => {
      const unitPrice =
        typeof it.price === "number"
          ? it.price
          : (typeof it.subtotal === "number" && it.quantity > 0 ? it.subtotal / it.quantity : 0);
      return {
        productId: String(it.product?._id || ""),
        cartItemId: String(it._id),
        productName: it.product?.name || undefined,
        category: (it.product as any)?.category || undefined,
        quantity: Number(it.quantity) || 1,
        price: Number(unitPrice) || 0,
        size: it.size ?? undefined,
      };
    });
    const totalAmount = cartItems.reduce((acc, ci) => acc + ci.price * ci.quantity, 0);
    return { cartItems, totalAmount };
  }

  function buildShippingItems(items: CartItem[]): import("@/lib/shippingApi").ShipItem[] {
    return items.map((it) => {
      const p: any = it.product || {};
      const weight = typeof p.weight === "number" ? p.weight : 0.5;
      const dims = p.dimensions || p.package || {};
      const length = Number(dims.length ?? 20);
      const width = Number(dims.width ?? 15);
      const height = Number(dims.height ?? 10);
      return { productId: String(p._id || ""), quantity: Number(it.quantity) || 1, weight, dimensions: { length, width, height } };
    });
  }

  async function fetchActivePromotions(params?: { type?: string; category?: string }) {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.category) qs.set("category", params.category);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<{ promotions: Promotion[] }>(`/promotions/active${suffix}`, { method: "GET" });
  }
  async function fetchPromotionTypes() {
    return apiFetch<{ types: PromotionType[] }>(`/promotions/types`, { method: "GET" });
  }

 // Dejá SOLO esta versión del handler:


  async function handleCalculateShipping(e: React.FormEvent) {
    e.preventDefault();
    setShipOptions(null);
    setShipCalcErr(null);
    if (!addressId.trim()) { setShipCalcErr("Indicá un addressId (ej: addr_001)"); return; }
    if (items.length === 0) { setShipCalcErr("El carrito está vacío"); return; }
    setShipCalcLoading(true);
    try {
      const cartItems = buildShippingItems(items);
      const res = await calculateShipping({ addressId: addressId.trim(), cartItems });
      setShipOptions(res.options || []);
    } catch (e: any) {
      setShipOptions(null);
      setShipCalcErr(e?.message || "No se pudo calcular el envío");
    } finally { setShipCalcLoading(false); }
  }

  async function applyDiscounts(payload: { couponCode?: string; cartItems: ApplyDiscountsRequestItem[]; totalAmount: number }) {
    return apiFetch<ApplyDiscountsResponse>(`/promotions/apply-discounts`, { method: "POST", body: JSON.stringify(payload) });
  }
  async function validateCoupon(couponCode: string, userId?: string) {
    return apiFetch<ValidateCouponResponse>(`/promotions/validate-coupon`, { method: "POST", body: JSON.stringify({ couponCode, userId }) });
  }

  useEffect(() => {
    setPromoCalc(null);
    setCouponValidation(null);
    setCouponResult(null);
  }, [couponCode]);

  useEffect(() => {
    let abort = false;
    (async () => {
      setPromosLoading(true); setPromosErr(null);
      try {
        const [actives, types] = await Promise.all([fetchActivePromotions(), fetchPromotionTypes()]);
        if (!abort) {
          setActivePromos(Array.isArray(actives?.promotions) ? actives.promotions : []);
          setPromoTypes(Array.isArray(types?.types) ? types.types : []);
        }
      } catch (e: any) { if (!abort) setPromosErr(e?.message || "No se pudieron cargar las promociones"); }
      finally { if (!abort) setPromosLoading(false); }
    })();
    return () => { abort = true; };
  }, []);

  async function loadCartValidate() {
    setCartValidateLoading(true); setCartValidateErr(null);
    try {
      const r = await apiFetch<CartValidateResponse>(`/cart/validate`, { method: "GET" });
      const payload: CartValidateData =
        (r as CartValidateWrapped)?.success === true ? (r as CartValidateWrapped).data : (r as CartValidateData);
      if (typeof payload?.valid !== "boolean" || !Array.isArray(payload.errors) || !Array.isArray(payload.warnings)) {
        throw new Error("Formato inesperado en /cart/validate");
      }
      setCartValidate(payload);
    } catch (e: any) { setCartValidate(null); setCartValidateErr(e?.message || "No se pudo validar el carrito"); }
    finally { setCartValidateLoading(false); }
  }

  async function loadCartWithShipping() {
    setWithShipLoading(true); setWithShipErr(null);
    try {
      const r = await apiFetch<WithShippingResponse>(`/cart/with-shipping`, { method: "GET" });
      const payload: WithShippingData =
        (r as WithShippingWrapped)?.success === true ? (r as WithShippingWrapped).data : (r as WithShippingData);
      if (!payload?.summary || !payload?.shipping) throw new Error("Formato inesperado en /cart/with-shipping");
      setWithShip(payload);
      setSelectedRate(payload.shipping.rates?.[0] ?? null);
      if (payload.shipping.address) {
        setShipCity(payload.shipping.address.city ?? "");
        setShipZip(payload.shipping.address.postal_code ?? "");
        setShipCountry(payload.shipping.address.country ?? "");
      }
    } catch (e: any) { setWithShip(null); setSelectedRate(null); setWithShipErr(e?.message || "No se pudo obtener carrito con envío"); }
    finally { setWithShipLoading(false); }
  }

  async function handleValidateCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponValidation(null);
    if (!couponCode.trim()) return;
    setCouponValidating(true);
    try { const res = await validateCoupon(couponCode.trim()); setCouponValidation(res); }
    catch (e: any) { setCouponValidation({ valid: false, message: e?.message || "No se pudo validar el cupón" }); }
    finally { setCouponValidating(false); }
  }

  async function loadCartTotal() {
    setCartTotalLoading(true); setCartTotalErr(null);
    try {
      const r = await apiFetch<CartTotalResponse>(`/cart/total`, { method: "GET" });
      const payload: CartTotalData =
        (r as CartTotalWrapped)?.success === true ? (r as CartTotalWrapped).data : (r as CartTotalData);
      if (!payload || typeof payload.subtotal !== "number") throw new Error("Formato inesperado en /cart/total");
      setCartTotalSummary(payload);
    } catch (e: any) { setCartTotalSummary(null); setCartTotalErr(e?.message || "No se pudo obtener /cart/total"); }
    finally { setCartTotalLoading(false); }
  }

  async function handleApplyPromotions(e: React.FormEvent) {
    e.preventDefault();
    setPromoCalc(null); setPromoCalcErr(null); setPromoCalcLoading(true);
    try {
      const { cartItems, totalAmount } = buildApplyDiscountsPayload(items);
      const res = await applyDiscounts({ couponCode: couponCode.trim() || undefined, cartItems, totalAmount });
      setPromoCalc(res);
    } catch (e: any) { setPromoCalc(null); setPromoCalcErr(e?.message || "No se pudieron aplicar los descuentos"); }
    finally { setPromoCalcLoading(false); }
  }

  async function handleSaveShippingAddress(e: React.FormEvent) {
    e.preventDefault();
    setSaveAddrMsg(null);
    setSavingAddr(true);
    try {
      const body: SaveShippingAddressBody = {
        fullName: addrFullName.trim(),
        phone: addrPhone.trim(),
        addressLine: addrLine.trim(),
        city: addrCity.trim(),
        postalCode: addrPostal.trim(),
        province: addrProvince.trim(),
        notes: addrNotes.trim(),
      };
      const r = await apiFetch<SaveShippingAddressResponse>(`/cart/shipping/address`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const msg = r?.data?.message || (r as any)?.message || "Dirección de envío guardada ✅";
      setSaveAddrMsg(msg);
      setShipStreet(body.addressLine); setShipCity(body.city); setShipZip(body.postalCode);
      setShipCountry((r?.data as any)?.shippingAddress?.country || "MX");
    } catch (e: any) {
      const m = e?.message || "No se pudo guardar la dirección";
      setSaveAddrMsg(m);
      if (m.toLowerCase().includes("no autenticado")) { window.location.href = "/auth?redirectTo=/carrito"; }
    } finally { setSavingAddr(false); }
  }

  function money(n?: number, ccy?: string) {
    if (typeof n !== "number") return "";
    const code = ccy || "ARS";
    try { return new Intl.NumberFormat("es-AR", { style: "currency", currency: code }).format(n); }
    catch { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n); }
  }

  async function loadCartSummaryPlain() {
    setPlainSummaryLoading(true); setPlainSummaryErr(null);
    try {
      const r = await apiFetch<CartSummaryPlainWrapped | CartSummaryPlain>(`/cart/summary`, { method: "GET" });
      const payload: CartSummaryPlain =
        (r as CartSummaryPlainWrapped)?.success === true ? (r as CartSummaryPlainWrapped).data : (r as CartSummaryPlain);
      if (!payload || typeof payload.subtotal !== "number") throw new Error("Formato inesperado en /cart/summary");
      setPlainSummary(payload);
    } catch (e: any) { setPlainSummary(null); setPlainSummaryErr(e?.message || "No se pudo obtener el resumen"); }
    finally { setPlainSummaryLoading(false); }
  }

  function normalizeCart(resp: CartResponse): CartData {
    const payload: any = (resp as any)?.success === true ? (resp as any).data : resp;
    const summary = payload?.cartSummary || {};
    const rawItems: any[] = Array.isArray(summary.items) ? summary.items : (Array.isArray(payload?.items) ? payload.items : []);
    const normalizedItems: CartItem[] = rawItems.map((it: any) => {
      const itemId = it.cartItemId || it._id || it.id || it.itemId || "";
      const hasProductObject = !!it.product;
      const productObj: CartProduct = hasProductObject
        ? { _id: it.product._id ?? it.productId ?? undefined, name: it.product.name ?? it.productName ?? undefined, ...it.product }
        : { _id: it.productId, name: it.productName };
      const price = typeof it.price === "number" ? it.price : (typeof it.originalPrice === "number" ? it.originalPrice : undefined);
      const quantity = Number(it.quantity) || 1;
      const subtotal = typeof it.subtotal === "number" ? it.subtotal : (typeof price === "number" ? price * quantity : undefined);
      return { _id: String(itemId), product: productObj, quantity, size: it.size ?? null, color: it.color ?? null, price, subtotal };
    });
    const totalItems = typeof summary.totalItems === "number" ? summary.totalItems
      : (typeof payload?.totalItems === "number" ? payload.totalItems : undefined);
    const total = typeof summary.estimatedTotal === "number" ? summary.estimatedTotal
      : (typeof payload?.total === "number" ? payload.total : undefined);
    const finalTotal = typeof payload?.finalTotal === "number" ? payload.finalTotal
      : (typeof summary?.estimatedTotal === "number" ? summary.estimatedTotal : undefined);
    return { _id: payload?._id, userId: payload?.userId, items: normalizedItems, total, totalItems, discounts: Array.isArray(payload?.discounts) ? payload.discounts : undefined, finalTotal };
  }

 async function loadCart() {
  setLoading(true);
  setErr(null);
  try {
    const r = await apiFetch<CartResponse>("/cart", { method: "GET" });
    const cart = normalizeCart(r);

    setItems(cart.items || []);
    setCartId(cart._id ?? null);
    setCartTotal(cart.total ?? null);
    setCartTotalItems(cart.totalItems ?? null);
    setCartDiscounts(cart.discounts ?? []);
    setCartFinalTotal(cart.finalTotal ?? null);

    const next: Record<string, { quantity: number; size: string }> = {};
    (cart.items || []).forEach((it) => {
      next[it._id] = {
        quantity: Number(it.quantity) || 1,
        size: (it.size ?? "").toString(),
      };
    });
    setEdits(next);

    // ✅ NUEVO: sincronizar contador global del carrito
    const computedCount =
      typeof cart.totalItems === "number"
        ? cart.totalItems
        : (cart.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);

    try {
      localStorage.setItem("cart:count", String(computedCount));
    } catch {}

    // Eventos que ya escucha el Header
    try {
      window.dispatchEvent(new CustomEvent("cart:count", { detail: { count: computedCount } }));
      window.dispatchEvent(new CustomEvent("cart:changed", { detail: { count: computedCount, source: "loadCart" } }));
    } catch {}
  } catch (e: any) {
    const msg = e?.message || "Error al cargar el carrito";
    setErr(msg);
    if (msg.toLowerCase().includes("no autenticado") || msg.toLowerCase().includes("credenciales")) {
      window.location.href = "/auth?redirectTo=/carrito";
    }
  } finally {
    setLoading(false);
  }
}

  useEffect(() => { loadCart(); }, []);

  async function loadCartSummary(withCoupon?: string) {
    setSummaryLoading(true); setSummaryErr(null);
    try {
      const qs = withCoupon ? `?couponCode=${encodeURIComponent(withCoupon)}` : "";
      const r = await apiFetch<CartSummaryWithDiscountsResponse>(`/cart/summary-with-discounts${qs}`, { method: "GET" });
      const payload: CartSummaryWithDiscountsData =
        (r as CartSummaryWithDiscountsWrapped)?.success === true ? (r as CartSummaryWithDiscountsWrapped).data : (r as CartSummaryWithDiscountsData);
      if (!payload?.cartSummary) throw new Error("Formato inesperado en /cart/summary-with-discounts");
      setSummaryV2(payload);
      setSummary(null);
    } catch (e: any) { setSummaryV2(null); setSummaryErr(e?.message || "No se pudo obtener el resumen con descuentos"); }
    finally { setSummaryLoading(false); }
  }

  async function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setSummaryLoading(true); setSummaryErr(null); setCouponResult(null); setSummary(null);
    try {
      const body: Record<string, any> = {};
      if (couponCode.trim()) body.couponCode = couponCode.trim();
      const res = await apiFetch<ApplyCouponResponse>(`/cart/apply-coupon`, { method: "POST", body: JSON.stringify(body) });
      setCouponResult(res);
    } catch (err: any) {
      await loadCartSummary(couponCode.trim() || undefined);
      setSummaryErr((prev) => prev || err?.message || "No se pudo aplicar el cupón");
    } finally { setSummaryLoading(false); }
  }

  async function handleAddToCart(e: React.FormEvent) {
  e.preventDefault();
  setAddMsg(null);
  setAdding(true);

  try {
    const qty = Math.max(1, Number(addQty) || 1);
    const payload: Record<string, any> = {
      productId: addProductId.trim(),
      quantity: qty,
    };
    const s = addSize.trim();
    const c = addColor.trim();
    if (s) payload.size = s;
    if (c) payload.color = c;

    const r = await apiFetch<AddToCartResponse | CartResponse>("/cart/add", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Mensaje / total de $ si el backend lo devuelve
    if ((r as AddToCartResponse)?.cartTotal !== undefined) {
      const ar = r as AddToCartResponse;
      setCartTotal(ar.cartTotal);
      setAddMsg(ar.message || "Producto agregado 👍");
    } else {
      setAddMsg("Producto agregado 👍");
    }

    // ✅ NUEVO: actualización optimista del contador (badge)
    const currentCount =
      typeof cartTotalItems === "number"
        ? cartTotalItems
        : items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);

    const optimisticCount = currentCount + qty;

    try {
      localStorage.setItem("cart:count", String(optimisticCount));
      // si guardás también un totalItems en estado, lo reflejamos
      setCartTotalItems(optimisticCount);
    } catch {}

    try {
      window.dispatchEvent(
        new CustomEvent("cart:count", { detail: { count: optimisticCount } })
      );
      window.dispatchEvent(
        new CustomEvent("cart:changed", {
          detail: { count: optimisticCount, source: "add" },
        })
      );
    } catch {}

    // Refrescar estado real desde el backend
    await loadCart();

    // Reset de campos de form
    setAddQty(1);
    // opcional: si querés limpiar talle/color tras agregar
    // setAddSize(""); setAddColor("");
    // opcional: si querés limpiar productId en el form de prueba
    // setAddProductId("");
  } catch (e: any) {
    const msg = e?.message || "No se pudo agregar";
    setAddMsg(msg);

    if (/no autenticado|token|401|credenciales/i.test(String(msg))) {
      window.location.href = "/auth?redirectTo=/carrito";
      return;
    }
  } finally {
    setAdding(false);
  }
}

 async function handleUpdateItem(itemId: string) {
  setUpdateMsg(null);
  setUpdatingId(itemId);
  try {
    const current = edits[itemId] || { quantity: 1, size: "" };
    const q = Math.max(1, Math.floor(Number(current.quantity) || 1));
    const s = (current.size ?? "").toString().trim();

    // Validación en cliente para evitar 400
    const it = items.find(i => i._id === itemId);
    const allowedSizes: string[] = Array.isArray(it?.product?.sizes) ? it!.product!.sizes as string[] : [];
    if (s && allowedSizes.length && !allowedSizes.includes(s)) {
      throw new Error(`El talle ${s} no está disponible para "${it?.product?.name ?? "producto"}". Talles: ${allowedSizes.join(", ")}`);
    }

    // ✅ PUT al endpoint correcto
    const body: Record<string, any> = { quantity: q };
    if (s) body.size = s;

    const r = await apiFetch<UpdateCartItemResponse | CartResponse>(
      `/cart/update/${itemId}`,
      { method: "PUT", body: JSON.stringify(body) }
    );

    // Optimista + refresh
    if ((r as any)?.cartItem && (r as any)?.cartTotal !== undefined) {
      const ur = r as UpdateCartItemResponse;
      setCartTotal(ur.cartTotal);
      setItems(prev => prev.map(x =>
        x._id === ur.cartItem._id
          ? { ...x, quantity: ur.cartItem.quantity, subtotal: ur.cartItem.subtotal, size: s || x.size }
          : x
      ));
      setUpdateMsg((r as any).message || "Ítem actualizado ✅");
    } else {
      setUpdateMsg("Ítem actualizado ✅");
    }

    await loadCart();
    setCartBadgeCount(computeItemsCount(items));
  } catch (e: any) {
    setUpdateMsg(e?.message || "No se pudo actualizar el ítem");
  } finally {
    setUpdatingId(null);
  }
}


  // Ponelo una vez (arriba del archivo o en tus utils)
const computeItemsCount = (its: CartItem[] = []) =>
  its.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);

async function handleRemoveItem(itemId: string) {
  setRemoveMsg(null);
  setRemovingId(itemId);

  // ✅ OPTIMISTA: bajar el contador apenas el usuario hace click
  try {
    const toRemoveQty = items.find(i => i._id === itemId)?.quantity ?? 0;
    const currentCount =
      typeof cartTotalItems === "number" ? cartTotalItems : computeItemsCount(items);
    const optimistic = Math.max(0, currentCount - Number(toRemoveQty || 0));

    localStorage.setItem("cart:count", String(optimistic));
    setCartTotalItems(optimistic);

    window.dispatchEvent(new CustomEvent("cart:count", { detail: { count: optimistic } }));
    window.dispatchEvent(
      new CustomEvent("cart:changed", { detail: { count: optimistic, source: "remove", itemId } })
    );
  } catch {}

  try {
    const r = await apiFetch<RemoveCartItemResponse | CartResponse>(
      `/cart/remove/${itemId}`,
      { method: "DELETE" }
    );

    const cart = normalizeCart(r as any);

    setItems(cart.items || []);
    setCartId(cart._id ?? null);
    setCartTotal(cart.total ?? null);
    setCartDiscounts(cart.discounts ?? []);
    setCartFinalTotal(cart.finalTotal ?? null);

    // 🔢 Recalcular el total de ítems (servidor gana)
    const realCount =
      typeof cart.totalItems === "number"
        ? cart.totalItems
        : computeItemsCount(cart.items || []);
    setCartTotalItems(realCount);

    // 🔄 Persistir + notificar (servidor gana)
    try {
      localStorage.setItem("cart:count", String(realCount));
      window.dispatchEvent(new CustomEvent("cart:count", { detail: { count: realCount } }));
      window.dispatchEvent(
        new CustomEvent("cart:changed", { detail: { count: realCount, source: "remove:server", itemId } })
      );
    } catch {}

    // refrescar controles de edición
    const next: Record<string, { quantity: number; size: string }> = {};
    (cart.items || []).forEach((it) => {
      next[it._id] = {
        quantity: Number(it.quantity) || 1,
        size: (it.size ?? "").toString(),
      };
    });
    setEdits(next);

    setRemoveMsg(("message" in (r as any) && (r as any).message) || "Ítem eliminado 🗑️");
  } catch (e: any) {
    setRemoveMsg(e?.message || "No se pudo eliminar el ítem");
    // Revertir optimismo si falló
    try {
      const fallback =
        typeof cartTotalItems === "number" ? cartTotalItems : computeItemsCount(items);
      localStorage.setItem("cart:count", String(fallback));
      window.dispatchEvent(new CustomEvent("cart:count", { detail: { count: fallback } }));
      window.dispatchEvent(
        new CustomEvent("cart:changed", { detail: { count: fallback, source: "remove:error", itemId } })
      );
    } catch {}

    if (String(e?.message || "").toLowerCase().includes("no autenticado")) {
      window.location.href = "/auth?redirectTo=/carrito";
    }
  } finally {
    setRemovingId(null);
  }
}


  function buildSimpleShippingMX(): import("@/lib/paymentsApi").SimpleShipping {
  return {
    contact: {
      emailOrPhone: (mxEmail || mxPhone || "").trim() || undefined,
      firstName: (mxName || "").trim() || undefined,
      lastName: (mxLastname || "").trim() || undefined,
      phone: (mxPhone || "").trim() || undefined,
    },
    address: {
      country: "MX",
      state: mxState,
      city: mxCity.trim(),
      postalCode: mxZip.trim(),
      addressLine: mxStreet.trim(),
    },
  };
}

/** Normaliza distintos shapes de "rate" en la opción esperada por Doctor Envío */
function buildDoctorEnvioShippingOption(rate: any): import("@/lib/paymentsApi").DoctorEnvioShippingOption {
  const carrier = String(rate?.carrier ?? "").toLowerCase() || "desconocido";
  const service = String(rate?.service ?? rate?.name ?? "standard");
  const currency = String(rate?.currency ?? "MXN");
  const price = Number(rate?.price ?? rate?.cost ?? 0);
  const insurance = Number(rate?.insurance ?? 0);

  // Intentar obtener IDs desde varias fuentes comunes
  const ObjectId =
    String(rate?.ObjectId ?? rate?.objectId ?? rate?.id ?? "0");

  const ShippingId =
    String(rate?.ShippingId ?? rate?.serviceId ?? rate?.service_id ?? service);

  const service_id =
    String(
      rate?.service_id ??
      `${carrier}_mx_${ShippingId}_${service}`.replace(/\s+/g, "_").toLowerCase()
    );

  const days =
    String(rate?.days ?? (rate?.estimatedDays != null ? `${rate.estimatedDays} día${Number(rate.estimatedDays) === 1 ? "" : "s"}` : ""));

  return {
    ObjectId,
    ShippingId,
    carrier,
    service,
    currency,
    price,
    insurance,
    service_id,
    days,
  };
}

/** Sugerencia: no permitir pagar si falta la tarifa */
function canPayWithMP(): boolean {
  return (
    items.length > 0 &&
    isMxAddressValid &&
    (!!mxEmail.trim() || !!mxPhone.trim()) &&
    !!selectedRate
  );
}

  // 🆕 MP: pagar directo desde /carrito (crea preferencia y redirige)
async function handlePayWithMercadoPago() {
  setPayMsg(null);

  if (items.length === 0) { setPayMsg("El carrito está vacío"); return; }
  if (!isMxAddressValid) { setPayMsg("Completá calle, ciudad, CP y estado de México antes de pagar."); return; }
  if (!mxEmail.trim() && !mxPhone.trim()) { setPayMsg("Ingresá un email o teléfono de contacto."); return; }
  if (!selectedRate) { setPayMsg("Seleccioná un método de envío antes de pagar."); return; } // 👈 NUEVO

  try {
    setPayingMp(true);

    const simpleShipping = buildSimpleShippingMX();
    const shippingOption = buildDoctorEnvioShippingOption(selectedRate); // 👈 NUEVO

    const pref = await createMercadoPagoCheckoutV2({
      simpleShipping,
      shippingOption,                   // 👈 Enviamos datos de Dr. Envío
      // couponCode: couponCode?.trim() || undefined,
    });

    const redirectUrl = getMpRedirectUrl(pref);
    if (!redirectUrl) throw new Error("No se recibió la URL de pago");

    window.location.href = redirectUrl;
  } catch (e: any) {
    const m = String(e?.message || "No se pudo iniciar el pago con Mercado Pago");
    setPayMsg(m);
    if (/no autenticado|credenciales|401/i.test(m)) {
      router.push(`/auth?redirectTo=/carrito`);
    }
  } finally {
    setPayingMp(false);
  }
}


async function handleFetchMxShipping(e: React.FormEvent) {
  e.preventDefault();
  setMxFormErr(null);
  setShipOptions(null);
  setSelectedRate(null);

  if (!isMxAddressValid) {
    setMxFormErr("Completá calle, ciudad, CP y estado de México.");
    return;
  }

  setMxFetchingRates(true);
  try {
    // Puede venir como array directo o como { rates: [...] }
    const res = await fetchDrenvioRatesDirect({
      originZip: "64000",           // tu CP de origen (NL)
      destZip: mxZip.trim(),        // CP del cliente
      weightKg: 1,
    });

    const rawRates: any[] = Array.isArray(res) ? res : (res?.rates ?? []);

    // Si no hay nada, avisamos
    if (!Array.isArray(rawRates) || rawRates.length === 0) {
      setShipOptions([]);
      setMxFormErr("No hay métodos de envío disponibles para esa dirección.");
      return;
    }

    // Normalizamos los campos que usa el front
    const options = rawRates.map((r: any) => ({
      carrier: r.carrier,                            // "fedex" | "estafeta" | "dhl" | "ampm"
      service: r.service,                            // "ground" | "express" | ...
      price: Number(r.price ?? r.cost ?? 0),
      currency: r.currency || "MXN",
      days: r.days,                                  // "3 a 5 días", etc.
      serviceId: r.serviceId ?? r.service_id ?? "",  // 👈 clave: normalizamos service_id → serviceId
      ObjectId: r.ObjectId ?? r.objectId ?? r.id ?? ""
    }));

    setShipOptions(options as any[]);
    setSelectedRate(options[0] ?? null);

    if (options.length === 0) {
      setMxFormErr("No hay métodos de envío disponibles para esa dirección.");
    }
  } catch (e: any) {
    setMxFormErr(e?.message || "No se pudieron obtener los métodos de envío");
  } finally {
    setMxFetchingRates(false);
  }
}


  async function handleClearCart() {
    setClearMsg(null); setClearing(true);
    try {
      const r = await apiFetch<ClearCartResponse>(`/cart/clear`, { method: "DELETE" });
      setItems([]); setCartTotal(0); setCartTotalItems(0); setCartDiscounts([]); setCartFinalTotal(0);
      setCouponResult(null); setSummary(null); setPromoCalc(null); setSummaryErr(null);
      setClearMsg(r?.message ?? "Carrito vaciado 🧹");
    } catch (e: any) {
      setClearMsg(e?.message || "No se pudo vaciar el carrito");
      if (String(e?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/carrito";
      }
    } finally { setClearing(false); }
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setOrderMsg(null); setOrderCreated(null);
    if (!cartId) { setOrderMsg("No se encontró un carrito para el usuario"); return; }
    if (!items.length) { setOrderMsg("El carrito está vacío"); return; }
    if (!shipStreet.trim() || !shipCity.trim() || !shipZip.trim() || !shipCountry.trim()) {
      setOrderMsg("Completá la dirección de envío."); return;
    }
    const body: CreateOrderBody = {
      cartId,
      items: items.map((it) => ({ itemId: it._id, quantity: Math.max(1, Number(edits[it._id]?.quantity ?? it.quantity) || 1) })),
      shippingAddress: { street: shipStreet.trim(), city: shipCity.trim(), zip: shipZip.trim(), country: shipCountry.trim() },
    };
    setCreatingOrder(true);
    try {
      const r = await apiFetch<CreateOrderResponse>("/orders", { method: "POST", body: JSON.stringify(body) });
      if (!("success" in r) || !r.success) throw new Error(("message" in r && r.message) || "No se pudo crear el pedido");
      setOrderCreated(r.data); setOrderMsg("Pedido creado ✅");
      const newOrderId = (r as any)?.data?._id;
      router.push(newOrderId ? `/pedidos/${newOrderId}` : `/pedidos`);
      await loadCart();
    } catch (e: any) {
      setOrderMsg(e?.message || "No se pudo crear el pedido");
      if (String(e?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/carrito";
      }
    } finally { setCreatingOrder(false); }
  }

  const derivedTotalItems = useMemo(() => items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0), [items]);


  return (
    <main className={s.page} style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <header className={s.header} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 16 }}>
        <h1 className={s.title} style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Tu carrito</h1>

        {/* Mini form para probar /cart/add */}
        <form
          onSubmit={handleAddToCart}
          className={s.addForm}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px,1fr) 88px 96px 120px auto",
            gap: 8,
            alignItems: "center",
          }}
          title="Agregar producto al carrito (prueba de /cart/add)"
        >
          <input
            className={s.input}
            placeholder="productId (MongoID)"
            value={addProductId}
            onChange={(e) => setAddProductId(e.target.value)}
            required
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <input
            className={`${s.input} ${s.inputSm}`}
            type="number"
            min={1}
            value={addQty}
            onChange={(e) => setAddQty(parseInt(e.target.value || "1", 10))}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <input
            className={s.input}
            placeholder="Talle (opcional)"
            value={addSize}
            onChange={(e) => setAddSize(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
         
          <button
            type="submit"
            disabled={adding || !addProductId}
            className={s.btnPrimary}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: adding ? "#f3f3f3" : "white",
              cursor: adding ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            {adding ? "Agregando…" : "Agregar"}
          </button>
        </form>
      </header>

      {addMsg && (
        <p style={{ marginTop: -8, marginBottom: 8, color: addMsg.toLowerCase().includes("agregado") || addMsg.includes("👍") ? "green" : "crimson" }}>
          {addMsg}
        </p>
      )}
      {removeMsg && (
        <p style={{ marginTop: 0, color: removeMsg.includes("🗑️") ? "green" : "crimson" }}>{removeMsg}</p>
      )}

      {clearMsg && (
        <p style={{ marginTop: 0, color: clearMsg.includes("🧹") ? "green" : "crimson" }}>{clearMsg}</p>
      )}

      <div className={s.toolbar} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button
          onClick={loadCart}
          className={s.btn}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
          }}
        >
          Actualizar
        </button>

        <button
          onClick={handleClearCart}
          disabled={clearing || items.length === 0}
          className={s.btnDanger}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #f1c0c0",
            background: clearing ? "#f8eaea" : "white",
            color: "#b00020",
            cursor: clearing ? "default" : "pointer",
            fontWeight: 600,
          }}
          title="Vaciar carrito (POST /cart/clear)"
        >
          {clearing ? "Vaciando…" : "Vaciar carrito"}
        </button>

        <button
          onClick={loadCartSummaryPlain}
          disabled={plainSummaryLoading}
          className={s.btn}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: plainSummaryLoading ? "#f3f3f3" : "white",
            cursor: plainSummaryLoading ? "default" : "pointer",
            fontWeight: 600,
          }}
          title="Resumen sin descuentos (GET /cart/summary)"
        >
          {plainSummaryLoading ? "Resumiendo…" : "Resumen simple"}
        </button>
        {plainSummaryErr && <span style={{ color: "crimson" }}>{plainSummaryErr}</span>}

        <button
          onClick={loadCartValidate}
          disabled={cartValidateLoading}
          className={s.btn}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: cartValidateLoading ? "#f3f3f3" : "white",
            cursor: cartValidateLoading ? "default" : "pointer",
            fontWeight: 600,
          }}
          title="Validar carrito (GET /cart/validate)"
        >
          {cartValidateLoading ? "Validando…" : "Validar carrito"}
        </button>
        {cartValidateErr && <span style={{ color: "crimson" }}>{cartValidateErr}</span>}

        <button
          onClick={loadCartTotal}
          disabled={cartTotalLoading}
          className={s.btn}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: cartTotalLoading ? "#f3f3f3" : "white",
            cursor: cartTotalLoading ? "default" : "pointer",
            fontWeight: 600,
          }}
          title="Resumen total (GET /cart/total)"
        >
          {cartTotalLoading ? "Obteniendo…" : "Total (nuevo)"}
        </button>
        {cartTotalErr && <span style={{ color: "crimson" }}>{cartTotalErr}</span>}

        {/*<button
          onClick={loadCartWithShipping}
          disabled={withShipLoading}
          className={s.btn}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: withShipLoading ? "#f3f3f3" : "white",
            cursor: withShipLoading ? "default" : "pointer",
            fontWeight: 600,
          }}
          title="Carrito + tarifas de envío (GET /cart/with-shipping)"
        >
          {withShipLoading ? "Cargando…" : "Carrito + envío"}
        </button>
        */}
        {withShipErr && <span style={{ color: "crimson" }}>{withShipErr}</span>}

        {cartValidate && (
          <div
            style={{
              margin: "6px 0 10px",
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${cartValidate.valid ? "#cce6d2" : "#f1c0c0"}`,
              background: cartValidate.valid ? "#e9f9ee" : "#fde8e8",
              color: cartValidate.valid ? "#116329" : "#b00020",
              fontSize: 14
            }}
          >
            <strong>{cartValidate.valid ? "Carrito válido ✅" : "Hay problemas en tu carrito"}</strong>
            {!!cartValidate.errors.length && (
              <ul style={{ margin: "6px 0 0 18px" }}>
                {cartValidate.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            {!!cartValidate.warnings.length && (
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                <div style={{ fontWeight: 600 }}>Advertencias:</div>
                <ul style={{ margin: "4px 0 0 18px" }}>
                  {cartValidate.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className={s.toolbar} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <form onSubmit={handleApplyCoupon} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className={s.input}
              placeholder="Cupón (opcional)"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", width: 160 }}
            />
            <button
              type="submit"
              disabled={summaryLoading}
              className={s.btn}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: summaryLoading ? "#f3f3f3" : "white",
                cursor: summaryLoading ? "default" : "pointer",
                fontWeight: 600,
              }}
              title="Aplicar cupón (POST /cart/apply-coupon con fallback a GET /cart/summary-with-discounts)"
            >
              {summaryLoading ? "Aplicando…" : "Resumen carrito"}
            </button>
          </form>

          {/* 🔹 NUEVO: validar cupón (POST /promotions/validate-coupon) */}
          <form onSubmit={handleValidateCoupon}>
            <button
              type="submit"
              disabled={couponValidating || !couponCode.trim()}
              className={s.btn}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: couponValidating ? "#f3f3f3" : "white",
                cursor: couponValidating ? "default" : "pointer",
                fontWeight: 600,
              }}
              title="Validar cupón (POST /promotions/validate-coupon)"
            >
              {couponValidating ? "Validando…" : "Validar cupón"}
            </button>
          </form>

          {/* 🔹 NUEVO: aplicar descuentos usando Promos API */}
          <form onSubmit={handleApplyPromotions}>
            <button
              type="submit"
              disabled={promoCalcLoading || items.length === 0}
              className={s.btn}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: promoCalcLoading ? "#f3f3f3" : "white",
                cursor: promoCalcLoading ? "default" : "pointer",
                fontWeight: 600,
              }}
              title="Calcular descuentos (POST /promotions/apply-discounts)"
            >
              {promoCalcLoading ? "Calculando…" : "Calcular descuentos (Promos API)"}
            </button>
          </form>

          {/* 🔹 Feedback de validación de cupón */}
          {couponValidation && (
            <span
              className={couponValidation.valid ? s.badgeOk : s.badgeWarn}
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                background: couponValidation.valid ? "#e9f9ee" : "#fde8e8",
                color: couponValidation.valid ? "#116329" : "#b00020",
                fontSize: 13,
              }}
            >
              {couponValidation.valid
                ? (couponValidation.message || "Cupón válido ✅")
                : (couponValidation.message || "Cupón inválido")}
            </span>
          )}
        </div>

        <div style={{ opacity: 0.8 }}>
          Ítems: <strong>{cartTotalItems ?? derivedTotalItems}</strong>
        </div>

        {typeof cartTotal === "number" && (
          <div style={{ opacity: 0.8 }}>
            Total: <strong>{currency(cartTotal)}</strong>
          </div>
        )}

        {cartId && (
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
            cartId:&nbsp;<code>{cartId}</code>
          </div>
        )}
      </div>

      {updateMsg && <p style={{ marginTop: 0, color: updateMsg.includes("✅") ? "green" : "crimson" }}>{updateMsg}</p>}

      {loading && <p>Cargando carrito…</p>}
      {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}

      {!loading && !err && items.length === 0 && (
        <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
          <p style={{ margin: 0 }}>Tu carrito está vacío.</p>
          <p style={{ marginTop: 8 }}>
            <Link href="/catalogo">Ir al catálogo</Link>
          </p>
        </div>
      )}

      {/* 
      <section className={s.card}
        style={{
          margin: "8px 0 12px",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Promos activas</h3>
          {promosLoading && <span style={{ fontSize: 12, color: "#666" }}>Cargando…</span>}
          {!promosLoading && promosErr && <span style={{ fontSize: 12, color: "crimson" }}>{promosErr}</span>}
        </div>

        {!promosLoading && !promosErr && activePromos.length === 0 && (
          <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>No hay promociones activas ahora.</div>
        )}

        {!promosLoading && !promosErr && activePromos.length > 0 && (
          <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
            {activePromos.map((p) => (
              <li key={p._id} style={{ marginBottom: 4 }}>
                <strong>{p.name}</strong>
                {p.description ? ` — ${p.description}` : ""}
                {typeof p.discountPercentage === "number" ? ` (−${p.discountPercentage}% )` : ""}
                {p.conditions?.minimumPurchaseAmount ? ` · min ${currency(p.conditions.minimumPurchaseAmount)}` : ""}
                {p.conditions?.categories?.length ? ` · cat: ${p.conditions.categories.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
      🔹 NUEVO: listado simple de promos activas */}
 {/*
      <section className={s.card}
        style={{
          margin: "8px 0 12px",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
        }}
      >
       <h3 style={{ margin: 0, fontSize: 16, marginBottom: 8 }}>
          Dirección de envío (guardar en carrito)
        </h3>

        <form onSubmit={handleSaveShippingAddress} style={{ display: "grid", gap: 8 }}>
          <div className={s.grid2} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              className={s.input}
              placeholder="Nombre completo"
              value={addrFullName}
              onChange={(e) => setAddrFullName(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
              required
            />
            <input
              className={s.input}
              placeholder="Teléfono"
              value={addrPhone}
              onChange={(e) => setAddrPhone(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
              required
            />
          </div>

          <input
            className={s.input}
            placeholder="Calle y número"
            value={addrLine}
            onChange={(e) => setAddrLine(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
            required
          />

          <div className={s.grid3} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input
              className={s.input}
              placeholder="Ciudad"
              value={addrCity}
              onChange={(e) => setAddrCity(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
              required
            />
            <input
              className={s.input}
              placeholder="Código postal"
              value={addrPostal}
              onChange={(e) => setAddrPostal(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
              required
            />
            <input
              className={s.input}
              placeholder="Provincia"
              value={addrProvince}
              onChange={(e) => setAddrProvince(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
            />
          </div>

          <input
            className={s.input}
            placeholder="Notas (opcional)"
            value={addrNotes}
            onChange={(e) => setAddrNotes(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="submit"
              disabled={savingAddr}
              className={s.btn}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: savingAddr ? "#f3f3f3" : "white",
                cursor: savingAddr ? "default" : "pointer",
                fontWeight: 600,
              }}
              title="Guardar dirección en carrito (POST /cart/shipping/address)"
            >
              {savingAddr ? "Guardando…" : "Guardar dirección"}
            </button>

            {saveAddrMsg && (
              <span style={{ color: saveAddrMsg.includes("✅") || saveAddrMsg.toLowerCase().includes("success") ? "green" : "crimson" }}>
                {saveAddrMsg}
              </span>
            )}
          </div>
        </form>
      </section>
*/}
      {/* 
      <section className={s.card}
        style={{
          margin: "8px 0 12px",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, marginBottom: 8 }}>Estimá tu envío</h3>

        <form onSubmit={handleCalculateShipping} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className={s.input}
            placeholder="addressId (ej: addr_001)"
            value={addressId}
            onChange={(e) => setAddressId(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", width: 200 }}
          />
          <button
            type="submit"
            disabled={shipCalcLoading || items.length === 0}
            className={s.btn}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: shipCalcLoading ? "#f3f3f3" : "white",
              cursor: shipCalcLoading ? "default" : "pointer",
              fontWeight: 600,
            }}
            title="Calcular (POST /shipping/calculate)"
          >
            {shipCalcLoading ? "Calculando…" : "Calcular envío"}
          </button>

          {shipCalcErr && <span style={{ color: "crimson" }}>{shipCalcErr}</span>}
        </form>

        {shipOptions && (
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {shipOptions.length === 0 && <div style={{ color: "#666" }}>No hay opciones disponibles para la dirección indicada.</div>}
            {shipOptions.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <strong>{opt.name}</strong>
                <span>• {opt.description || opt.service}</span>
                <span>• ETA: {opt.estimatedDays} días</span>
                <span>• {opt.carrier ?? "Carrier"}</span>
                <span style={{ marginLeft: "auto" }}>{currency(opt.cost)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
🔹 NUEVO: Estimá tu envío */}
      {/* Lista de ítems */}
      {!loading && items.length > 0 && (
        <div className={s.items} style={{ display: "grid", gap: 12 }}>
          {items.map((it) => (
            <article
              key={it._id}
              className={s.item}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 8,
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 12,
                background: "white",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {it.product?.name ?? "(Producto)"} {it.size ? `• Talle ${it.size}` : ""}{" "}
                  {it.color ? `• Color ${it.color}` : ""}{" "}
                  {typeof it.price === "number" ? `• ${currency(it.price)}` : ""}
                </div>
                

                <div className={s.itemControls} style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, opacity: 0.8 }}>Cant.</span>
                    <input
                      className={`${s.input} ${s.inputSm}`}
                      type="number"
                      min={1}
                      value={edits[it._id]?.quantity ?? it.quantity}
                      onChange={(e) =>
                        setEdits((s) => ({
                          ...s,
                          [it._id]: {
                            quantity: Math.max(1, parseInt(e.target.value || "1", 10)),
                            size: s[it._id]?.size ?? (it.size ?? ""),
                          },
                        }))
                      }
                      style={{ width: 80, padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
                    />
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
  <span style={{ fontSize: 13, opacity: 0.8 }}>Talle</span>
  <select
  value={edits[it._id]?.size ?? (it.size ?? "")}
  onChange={(e) =>
    setEdits(s => ({
      ...s,
      [it._id]: { quantity: s[it._id]?.quantity ?? it.quantity, size: e.target.value }
    }))
  }
  style={{ width: 120, padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
>
  <option value="">(sin cambio)</option>
  {(Array.isArray(it.product?.sizes) ? it.product!.sizes as string[] : [it.size].filter(Boolean))
    .map(sz => <option key={sz} value={sz}>{sz}</option>)}
</select>
</label>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleUpdateItem(it._id)}
                      disabled={updatingId === it._id}
                      className={s.btn}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: updatingId === it._id ? "#f3f3f3" : "white",
                        cursor: updatingId === it._id ? "default" : "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {updatingId === it._id ? "Actualizando…" : "Actualizar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it._id)}
                      disabled={removingId === it._id}
                      className={s.btnDanger}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #f1c0c0",
                        background: removingId === it._id ? "#f8eaea" : "white",
                        color: "#b00020",
                        cursor: removingId === it._id ? "default" : "pointer",
                        fontWeight: 600,
                        borderRadius: 8,
                      }}
                      title="Eliminar ítem del carrito"
                    >
                      {removingId === it._id ? "Eliminando…" : "Eliminar"}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "right", fontWeight: 600 }}>
                x{it.quantity}
                {typeof it.subtotal === "number" && (
                  <div style={{ fontWeight: 400, opacity: 0.75 }}>{currency(it.subtotal)}</div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {withShip && (
        <section className={s.card}
          style={{
            margin: "8px 0 12px",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, marginBottom: 8 }}>Resumen + Envío</h3>

          <div style={{ display: "grid", gap: 6 }}>
            <div><strong>Moneda:</strong> {withShip.summary.currency || "ARS"}</div>
            <div><strong>Subtotal:</strong> {money(withShip.summary.subtotal, withShip.summary.currency)}</div>
            {typeof withShip.summary.estimatedTax === "number" && (
              <div><strong>Impuestos estimados:</strong> {money(withShip.summary.estimatedTax, withShip.summary.currency)}</div>
            )}
            <div>
              <strong>Total estimado (sin envío):</strong> {money(withShip.summary.estimatedTotal, withShip.summary.currency)}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Tarifas de envío disponibles</div>
            {withShip.shipping.rates.length === 0 && (
              <div style={{ color: "#666" }}>No hay tarifas disponibles para la dirección indicada.</div>
            )}
            {withShip.shipping.rates.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                {withShip.shipping.rates.map((r) => {
                  const checked = selectedRate?.serviceId === r.serviceId && selectedRate?.carrier === r.carrier && selectedRate?.service === r.service;
                  return (
                    <label key={`${r.carrier}_${r.service}_${r.serviceId}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="radio"
                        name="ship-rate"
                        checked={!!checked}
                        onChange={() => setSelectedRate(r)}
                      />
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <strong style={{ textTransform: "capitalize" }}>{r.carrier}</strong>
                        <span>• {r.service}</span>
                        {r.days && <span>• {r.days}</span>}
                        <span style={{ marginLeft: "auto" }}>
                          {money(r.price, r.currency || withShip.summary.currency)}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Total combinado (solo si hay misma moneda) */}
          {selectedRate && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #ddd", display: "grid", gap: 6 }}>
              {selectedRate.currency && withShip.summary.currency && selectedRate.currency !== withShip.summary.currency ? (
                <div style={{ color: "#b26b00" }}>
                  <strong>Nota:</strong> el carrito está en <strong>{withShip.summary.currency}</strong> y el envío en{" "}
                  <strong>{selectedRate.currency}</strong>. Mostramos ambos montos por separado.
                </div>
              ) : null}

              <div>
                <strong>Total + Envío:</strong>{" "}
                {selectedRate.currency && withShip.summary.currency && selectedRate.currency !== withShip.summary.currency
                  ? `${money(withShip.summary.estimatedTotal, withShip.summary.currency)} + ${money(selectedRate.price, selectedRate.currency)}`
                  : money((withShip.summary.estimatedTotal || 0) + (selectedRate.price || 0), withShip.summary.currency)}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 🔹 PRIORIDAD 0: resultado crudo de /cart/apply-coupon */}
      {couponResult ? (
        /* …TU BLOQUE EXISTENTE DE couponResult SIN CAMBIOS… */
        <div style={{ display: "grid", gap: 6 }}>
          {couponResult.data?.cartSummary && (
            <>
              <div><strong>Subtotal:</strong> {currency(couponResult.data.cartSummary.subtotal)}</div>
              {typeof couponResult.data.cartSummary.estimatedTax === "number" && (
                <div><strong>Impuestos estimados:</strong> {currency(couponResult.data.cartSummary.estimatedTax)}</div>
              )}
            </>
          )}
          {couponResult.data?.discounts && (
            <>
              <div>
                <strong>Descuentos:</strong> {currency(couponResult.data.discounts.totalDiscount)}
                {!couponResult.data.discounts.success && Array.isArray(couponResult.data.discounts.errors) && couponResult.data.discounts.errors.length > 0 && (
                  <span style={{ marginLeft: 8, color: "#b00020" }}>
                    {couponResult.data.discounts.errors[0]}
                  </span>
                )}
              </div>
            </>
          )}
          <div>
            <strong>Total a pagar:</strong> {currency(
              typeof couponResult.data?.finalTotal === "number"
                ? couponResult.data.finalTotal
                : couponResult.data?.cartSummary?.estimatedTotal ?? 0
            )}
          </div>
          {Array.isArray(couponResult.data?.cartSummary?.items) && couponResult.data.cartSummary.items.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Ítems:</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {couponResult.data.cartSummary.items.map((it) => (
                  <li key={it._id} style={{ marginBottom: 4 }}>
                    {it.product?.name ?? "Producto"} ×{it.quantity} • {currency(it.product?.price)}
                    <span style={{ marginLeft: 8, opacity: 0.8 }}>
                      Subtotal: {currency(it.itemTotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : cartTotalSummary ? (
        // 🔹 PRIORIDAD 1.5: resultado de GET /cart/total (sin descuentos)
        <div style={{ display: "grid", gap: 6 }}>
          <div><strong>Moneda:</strong> {cartTotalSummary.currency || "ARS"}</div>

          <div><strong>Subtotal:</strong> {money(cartTotalSummary.subtotal, cartTotalSummary.currency)}</div>

          {typeof cartTotalSummary.estimatedTax === "number" && (
            <div><strong>Impuestos estimados:</strong> {money(cartTotalSummary.estimatedTax, cartTotalSummary.currency)}</div>
          )}

          <div>
            <strong>Total estimado:</strong> {money(cartTotalSummary.estimatedTotal, cartTotalSummary.currency)}
          </div>

          {Array.isArray(cartTotalSummary.items) && cartTotalSummary.items.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Ítems:</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {cartTotalSummary.items.map((it) => (
                  <li key={it._id} style={{ marginBottom: 4 }}>
                    {it.product?.name ?? "Producto"} ×{it.quantity}
                    {typeof it.product?.price === "number" && <> • {money(it.product.price, cartTotalSummary.currency)}</>}
                    <span style={{ marginLeft: 8, opacity: 0.8 }}>
                      Subtotal: {money(it.itemTotal, cartTotalSummary.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )
        : summaryV2 ? (
          /* 🔹 PRIORIDAD 1: NUEVO summary de GET /cart/summary-with-discounts (wrapper) */
          <div style={{ display: "grid", gap: 6 }}>
            <div><strong>Moneda:</strong> {summaryV2.cartSummary.currency || "ARS"}</div>

            <div><strong>Subtotal:</strong> {money(summaryV2.cartSummary.subtotal, summaryV2.cartSummary.currency)}</div>

            {typeof summaryV2.cartSummary.estimatedTax === "number" && (
              <div><strong>Impuestos estimados:</strong> {money(summaryV2.cartSummary.estimatedTax, summaryV2.cartSummary.currency)}</div>
            )}

            <div>
              <strong>Descuentos:</strong> {money(summaryV2.discounts.totalDiscount, summaryV2.cartSummary.currency)}
            </div>

            {/* Mostramos ambos por claridad */}
            <div style={{ opacity: 0.85 }}>
              <strong>Total estimado (Subtotal+Tax):</strong> {money(summaryV2.cartSummary.estimatedTotal, summaryV2.cartSummary.currency)}
            </div>

            <div>
              <strong>Total a pagar:</strong> {money(summaryV2.finalTotal, summaryV2.cartSummary.currency)}
            </div>

            {Array.isArray(summaryV2.cartSummary.items) && summaryV2.cartSummary.items.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Ítems (con descuentos si aplican):</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {summaryV2.cartSummary.items.map((it) => (
                    <li key={it._id} style={{ marginBottom: 4 }}>
                      {it.product?.name ?? "Producto"} ×{it.quantity}
                      {typeof it.product?.price === "number" && <> • {money(it.product.price, summaryV2.cartSummary.currency)}</>}
                      {typeof it.itemTotal === "number" && (
                        <span style={{ marginLeft: 8, opacity: 0.8 }}>
                          Subtotal: {money(it.itemTotal, summaryV2.cartSummary.currency)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : promoCalc ? (
          /* 🔹 PRIORIDAD 2: resultado de /promotions/apply-discounts */
          <div style={{ display: "grid", gap: 6 }}>
            <div><strong>Subtotal:</strong> {currency(promoCalc.originalAmount)}</div>
            {Array.isArray(promoCalc.discounts) && promoCalc.discounts.length > 0 && (
              <div>
                <strong>Descuentos (Promos API):</strong>{" "}
                {promoCalc.discounts.map((d, i) => (
                  <span key={i} style={{ marginRight: 8 }}>
                    {d.description ? `${d.description} ` : d.promotionName} ({d.type})
                    &nbsp;−{currency(d.discountAmount)}
                  </span>
                ))}
              </div>
            )}
            <div><strong>Total descuento:</strong> {currency(promoCalc.totalDiscount)}</div>
            {summary && typeof summary.shipping === "number" && (
              <div><strong>Envío:</strong> {currency(summary.shipping)}</div>
            )}
            <div><strong>Total a pagar:</strong> {currency(promoCalc.finalAmount + (summary?.shipping || 0))}</div>
            {promoCalcErr && <div style={{ color: "crimson" }}>{promoCalcErr}</div>}
          </div>
        ) : summary ? (
          /* 🔹 PRIORIDAD 3: tu summary viejo (shape plano) */
          <div style={{ display: "grid", gap: 6 }}>
            <div><strong>Subtotal:</strong> {currency(summary.subtotal)}</div>
            {Array.isArray(summary.discounts) && summary.discounts.length > 0 && (
              <div>
                <strong>Descuentos:</strong>{" "}
                {summary.discounts.map((d, i) => (
                  <span key={i} style={{ marginRight: 8 }}>
                    {d.description ? `${d.description} ` : ""}({d.type})
                    &nbsp;−{currency(d.amount)}
                  </span>
                ))}
              </div>
            )}
            <div><strong>Total descuento:</strong> {currency(summary.totalDiscount)}</div>
            <div><strong>Envío:</strong> {currency(summary.shipping)}</div>
            <div><strong>Total a pagar:</strong> {currency(summary.finalTotal)}</div>
            {summary.items?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Ítems (con descuentos):</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {summary.items.map((it) => (
                    <li key={it._id} style={{ marginBottom: 4 }}>
                      {it.productName} ×{it.quantity} •{" "}
                      <span style={{ textDecoration: it.discountedPrice < it.originalPrice ? "line-through" : "none", opacity: 0.7 }}>
                        {currency(it.originalPrice)}
                      </span>{" "}
                      {it.discountedPrice < it.originalPrice && (
                        <strong style={{ marginLeft: 6 }}>{currency(it.discountedPrice)}</strong>
                      )}
                      <span style={{ marginLeft: 8, opacity: 0.8 }}>Subtotal: {currency(it.subtotal)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          /* 🔹 PRIORIDAD 4: fallback original */
          <div style={{ display: "grid", gap: 4 }}>
            <div><strong>Items:</strong> {cartTotalItems ?? derivedTotalItems}</div>
            {typeof cartTotal === "number" && (
              <div><strong>Total:</strong> {currency(cartTotal)}</div>
            )}
            {!!cartDiscounts?.length && (
              <div>
                <strong>Descuentos:</strong>{" "}
                {cartDiscounts.map((d, i) => (
                  <span key={i} style={{ marginRight: 8 }}>
                    {d.description ? `${d.description} ` : ""}({d.type}) −{currency(d.amount)}
                  </span>
                ))}
              </div>
            )}
            {typeof cartFinalTotal === "number" && (
              <div><strong>Total a pagar:</strong> {currency(cartFinalTotal)}</div>
            )}
          </div>
        )}

        {/* === PRE-PAGO: Información de contacto y envío (México) ================== */}
<section
  className={s.card}
  style={{
    marginTop: 12,
    padding: 12,
    border: "1px solid #eee",
    borderRadius: 12,
    background: "#fff",
  }}
>
  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
    <h3 style={{ margin: 0, fontSize: 16 }}>Información de contacto y entrega</h3>
    <span style={{ fontSize: 12, opacity: 0.7 }}>Solo envíos dentro de <strong>México</strong></span>
  </div>

  <form onSubmit={handleFetchMxShipping} style={{ display: "grid", gap: 8 }}>
    {/* Contacto */}
    <div className={s.grid3} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 8 }}>
      <input
        className={s.input}
        placeholder="Email o teléfono"
        value={mxEmail}
        onChange={(e)=>setMxEmail(e.target.value)}
        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
      />
      <input
        className={s.input}
        placeholder="Nombre"
        value={mxName}
        onChange={(e)=>setMxName(e.target.value)}
        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
      />
      <input
        className={s.input}
        placeholder="Apellidos (opcional)"
        value={mxLastname}
        onChange={(e)=>setMxLastname(e.target.value)}
        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
      />
    </div>

    {/* Dirección */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
      <div className={s.grid3} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {/* País fijo */}
        <input
          className={s.input}
          value="México"
          readOnly
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#f6f6f6" }}
        />
        <select
          className={s.input}
          value={mxState}
          onChange={(e)=>setMxState(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
        >
          {MX_STATES.map(st => <option key={st} value={st}>{st}</option>)}
        </select>
        <input
          className={s.input}
          placeholder="Ciudad"
          value={mxCity}
          onChange={(e)=>setMxCity(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
        />
      </div>

      <input
        className={s.input}
        placeholder="Calle, número, piso, depto"
        value={mxStreet}
        onChange={(e)=>setMxStreet(e.target.value)}
        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
      />

      <div className={s.grid3} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input
          className={s.input}
          placeholder="CP"
          value={mxZip}
          onChange={(e)=>setMxZip(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
        />
        <input
          className={s.input}
          placeholder="Teléfono (opcional)"
          value={mxPhone}
          onChange={(e)=>setMxPhone(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
        />
        {/*<label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={mxSaveForNext} onChange={()=>setMxSaveForNext(v=>!v)} />
          Guardar mi información para la próxima vez
        </label>*/}
      </div>
    </div>

    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="submit"
        disabled={mxFetchingRates}
        className={s.btn}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #ddd",
          background: mxFetchingRates ? "#f3f3f3" : "white",
          cursor: mxFetchingRates ? "default" : "pointer",
          fontWeight: 600,
        }}
      >
        {mxFetchingRates ? "Buscando métodos…" : "Ingresar dirección para ver métodos disponibles"}
      </button>
      {mxFormErr && <span style={{ color: "#b00020" }}>{mxFormErr}</span>}
    </div>
  </form>

  {/* Métodos de envío */}
  {!!shipOptions && (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Métodos disponibles</div>
      {shipOptions.length === 0 ? (
        <div style={{ color: "#666" }}>No hay opciones para esa dirección.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {shipOptions.map((r, i) => {
            const checked =
              selectedRate?.serviceId === r.serviceId &&
              selectedRate?.carrier === (r as any).carrier &&
              selectedRate?.service === r.service;
            return (
              <label key={`${r.carrier}_${r.service}_${r.serviceId || i}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="radio"
                  name="mx-ship-rate"
                  checked={!!checked}
                  onChange={() => setSelectedRate(r as any)}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong>{(r as any).carrier || "Carrier"}</strong>
                  <span>• {r.service}</span>
                  {r.days && <span>• {r.days}</span>}
                  <span style={{ marginLeft: "auto" }}>{money(r.price, r.currency || "ARS")}</span>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  )}

  {/* Total combinado si hay tarifa */}
  {selectedRate && (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #ddd", display: "grid", gap: 6 }}>
      <div><strong>Envío:</strong> {money(selectedRate.price, selectedRate.currency || cartTotalSummary?.currency || "ARS")}</div>
      <div style={{ fontSize: 15 }}>
        <strong>Total a pagar (productos + envío):</strong>{" "}
        {money(
          (typeof cartTotalSummary?.estimatedTotal === "number" ? cartTotalSummary.estimatedTotal
            : typeof summaryV2?.finalTotal === "number" ? summaryV2.finalTotal
            : typeof cartFinalTotal === "number" ? cartFinalTotal
            : typeof cartTotal === "number" ? cartTotal : 0)
          + (selectedRate.price || 0),
          selectedRate.currency || cartTotalSummary?.currency || summaryV2?.cartSummary?.currency || "ARS"
        )}
      </div>
    </div>
  )}
</section>


      {/* === CTA de Checkout / Pago === */}
      {!loading && !err && items.length > 0 && (
        <section
          className={s.card}
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "#fff",
            position: "sticky",
            bottom: 12,
            zIndex: 1,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
            {/* Total visible (elige el mejor número disponible) */}
            <div style={{ fontSize: 16 }}>
              <div style={{ opacity: 0.8 }}>Total a pagar</div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>
                {
                  // prioridad: couponResult > summaryV2 > cartTotalSummary > cartFinalTotal > cartTotal
                  typeof couponResult?.data?.finalTotal === "number" ? currency(couponResult.data.finalTotal) :
                  typeof summaryV2?.finalTotal === "number" ? money(summaryV2.finalTotal, summaryV2?.cartSummary?.currency) :
                  typeof cartTotalSummary?.estimatedTotal === "number" ? money(cartTotalSummary.estimatedTotal, cartTotalSummary.currency) :
                  typeof cartFinalTotal === "number" ? currency(cartFinalTotal) :
                  typeof cartTotal === "number" ? currency(cartTotal) :
                  "—"
                }
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {/* Ir al flujo /checkout (con métodos, dirección y cupón) */}
             

              {/* Pagar ahora con Mercado Pago (preferencia del carrito) */}
              <button
                type="button"
                onClick={handlePayWithMercadoPago}
                disabled={payingMp || items.length === 0}
                className={s.btnPrimary}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: payingMp ? "#080808ff" : "black",
                  fontWeight: 800,
                  cursor: payingMp ? "default" : "pointer",
                }}
                title="Pagar ahora con Mercado Pago"
              >
                {payingMp ? "Redirigiendo…" : "Pagar con Mercado Pago"}
              </button>
            </div>
          </div>

          {payMsg && (
            <div style={{ marginTop: 8, color: "#b00020" }}>
              {payMsg}
            </div>
          )}
        </section>
      )}

      {/* Checkout (POST /orders) */}
      {!loading && !err && items.length > 0 && (
        <section className={s.card}
          style={{
            marginTop: 20,
            padding: 16,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "#fff",
          }}
        >
      
          {orderCreated && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #e6f4ea",
                background: "#f3fbf6",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Pedido #{orderCreated._id}</div>
              <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
                <div><strong>Estado:</strong> {orderCreated.status}</div>
                <div><strong>Total:</strong> {currency(orderCreated.total)}</div>
                <div>
                  <strong>Envío:</strong> {orderCreated.shippingAddress.street}, {orderCreated.shippingAddress.city} ({orderCreated.shippingAddress.zip}), {orderCreated.shippingAddress.country}
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <Link href={`/pedidos/${orderCreated._id}`} style={{ textDecoration: "underline" }}>
                  Ver este pedido
                </Link>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
