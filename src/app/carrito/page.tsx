// src/app/carrito/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { calculateShipping, getShippingServices } from "@/lib/shippingApi"; 
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
  cartItem: {
    _id: string;
    productId: string;
    quantity: number;
    price: number;
    subtotal: number;
  };
  cartTotal: number;
};

// debajo de AddToCartResponse
type UpdateCartItemResponse = {
  message: string;
  cartItem: {
    _id: string;
    quantity: number;
    subtotal: number;
  };
  cartTotal: number;
};

// debajo de UpdateCartItemResponse
type DeleteCartItemResponse = {
  message: string;
  cartTotal: number;
};

type SummaryItem = {
  _id: string;
  productId: string;
  productName: string;
  quantity: number;
  originalPrice: number;
  discountedPrice: number;
  subtotal: number;
};

type CartSummaryResponse = {
  items: SummaryItem[];
  subtotal: number;
  discounts: { type: string; amount: number; description?: string; promotionId?: string }[];
  totalDiscount: number;
  shipping: number;
  finalTotal: number;
};


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


  // 🔹 NUEVO: tipos para Promos
type Promotion = {
  _id: string;
  name: string;
  type: "percentage" | "fixed_amount" | "buy_x_get_y" | "free_shipping" | string;
  description?: string;
  discountPercentage?: number;
  startDate?: string;
  endDate?: string;
  conditions?: {
    categories?: string[];
    minimumPurchaseAmount?: number;
    [k: string]: any;
  };
  isActive?: boolean;
};

type PromotionType = {
  id: string;
  name: string;
  description: string;
};

type ApplyDiscountsRequestItem = {
  productId: string;
  cartItemId: string;
  productName?: string;
  category?: string;
  quantity: number;
  price: number;
  size?: string | null;
};

type ApplyDiscountsResponse = {
  discounts: {
    promotionId: string;
    promotionName: string;
    type: string;
    discountAmount: number;
    appliedToItems: string[]; // ids de producto o cartItem según backend
    description?: string;
  }[];
  totalDiscount: number;
  originalAmount: number;
  finalAmount: number;
};

type ValidateCouponResponse =
  | {
      valid: true;
      coupon: { code: string; discountPercentage?: number; validUntil?: string; usageLimit?: number; usedCount?: number };
      message?: string;
    }
  | { valid: false; message?: string; error?: string };


/* ===== Helper fetch (con Bearer) ===== */
async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001"; // 👈 3001
  const token = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;

  const headers = new Headers(init.headers || {});
  const isFormData = typeof FormData !== "undefined" && (init as any).body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
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
const currency = (n?: number) =>
  typeof n === "number" ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n) : "";

/* ===== Página ===== */
export default function CartPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

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
  const [addColor, setAddColor] = useState<string>(""); // 👈 NUEVO
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  // Editar
  const [edits, setEdits] = useState<Record<string, { quantity: number; size: string }>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  // Eliminar
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeMsg, setRemoveMsg] = useState<string | null>(null);

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
const [summaryErr,   setSummaryErr]   = useState<string | null>(null);
const [summary,      setSummary]      = useState<CartSummaryResponse | null>(null);

// 🔹 NUEVO: estado para promos activas y tipos
const [activePromos, setActivePromos] = useState<Promotion[]>([]);
const [promoTypes, setPromoTypes] = useState<PromotionType[]>([]);
const [promosLoading, setPromosLoading] = useState<boolean>(false);
const [promosErr, setPromosErr] = useState<string | null>(null);

// 🔹 NUEVO: estado para resultado de /promotions/apply-discounts
const [promoCalc, setPromoCalc] = useState<ApplyDiscountsResponse | null>(null);
const [promoCalcLoading, setPromoCalcLoading] = useState<boolean>(false);
const [promoCalcErr, setPromoCalcErr] = useState<string | null>(null);

// 🔹 NUEVO: estado para validar cupón
const [couponValidation, setCouponValidation] = useState<ValidateCouponResponse | null>(null);
const [couponValidating, setCouponValidating] = useState<boolean>(false);

// 🔹 NUEVO (envíos): estado para cálculo de envío
const [addressId, setAddressId] = useState<string>(""); // e.g. "addr_001"
const [shipCalcLoading, setShipCalcLoading] = useState(false);
const [shipOptions, setShipOptions] = useState<import("@/lib/shippingApi").ShippingOption[] | null>(null);
const [shipCalcErr, setShipCalcErr] = useState<string | null>(null);


function buildApplyDiscountsPayload(items: CartItem[]): { cartItems: ApplyDiscountsRequestItem[]; totalAmount: number } {
  const cartItems: ApplyDiscountsRequestItem[] = items.map((it) => {
    const unitPrice =
      typeof it.price === "number"
        ? it.price
        : // si no viene price unitario, intento derivarlo desde subtotal/cantidad
          (typeof it.subtotal === "number" && it.quantity > 0 ? it.subtotal / it.quantity : 0);

    return {
      productId: String(it.product?._id || ""),
      cartItemId: String(it._id),
      productName: it.product?.name || undefined,
      // si tu backend te puede mandar category anidada en product, la pasamos
      category: (it.product as any)?.category || undefined,
      quantity: Number(it.quantity) || 1,
      price: Number(unitPrice) || 0,
      size: it.size ?? undefined,
    };
  });

  // OriginalAmount: suma precio*cantidad (evita depender de subtotal)
  const totalAmount = cartItems.reduce((acc, ci) => acc + ci.price * ci.quantity, 0);

  return { cartItems, totalAmount };
}


// 🔹 NUEVO (envíos): construir items con peso/dimensiones
function buildShippingItems(items: CartItem[]): import("@/lib/shippingApi").ShipItem[] {
  return items.map((it) => {
    // Intentar tomar del producto si existe; si no, defaults sensatos
    const p: any = it.product || {};
    const weight = typeof p.weight === "number" ? p.weight : 0.5; // kg default
    const dims = p.dimensions || p.package || {};
    const length = Number(dims.length ?? 20);
    const width  = Number(dims.width  ?? 15);
    const height = Number(dims.height ?? 10);
    return {
      productId: String(p._id || ""),
      quantity: Number(it.quantity) || 1,
      weight,
      dimensions: { length, width, height },
    };
  });
}


// 🔹 NUEVO: fetch promos activas y tipos
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

async function handleCalculateShipping(e: React.FormEvent) {
  e.preventDefault();
  setShipOptions(null);
  setShipCalcErr(null);

  if (!addressId.trim()) {
    setShipCalcErr("Indicá un addressId (ej: addr_001)");
    return;
  }
  if (items.length === 0) {
    setShipCalcErr("El carrito está vacío");
    return;
  }

  setShipCalcLoading(true);
  try {
    const cartItems = buildShippingItems(items);
    const res = await calculateShipping({ addressId: addressId.trim(), cartItems });
    setShipOptions(res.options || []);
    // (opcional) si calificás a envío gratis, podrías “inyectar” una opción costo 0
    // if (res.qualifiesForFreeShipping) setShipOptions([{ service:"free", name:"Envío gratis", cost:0, estimatedDays: res?.options?.[0]?.estimatedDays ?? 3 }]);
  } catch (e: any) {
    setShipOptions(null);
    setShipCalcErr(e?.message || "No se pudo calcular el envío");
  } finally {
    setShipCalcLoading(false);
  }
}
// 🔹 NUEVO: aplicar descuentos (POST /promotions/apply-discounts)
async function applyDiscounts(payload: { couponCode?: string; cartItems: ApplyDiscountsRequestItem[]; totalAmount: number }) {
  return apiFetch<ApplyDiscountsResponse>(`/promotions/apply-discounts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 🔹 NUEVO: validar cupón (POST /promotions/validate-coupon)
async function validateCoupon(couponCode: string, userId?: string) {
  return apiFetch<ValidateCouponResponse>(`/promotions/validate-coupon`, {
    method: "POST",
    body: JSON.stringify({ couponCode, userId }),
  });
}
useEffect(() => {
  setPromoCalc(null);
  setCouponValidation(null);
}, [couponCode]);

// 🔹 NUEVO: cargar promos activas + tipos al montar
useEffect(() => {
  let abort = false;
  (async () => {
    setPromosLoading(true);
    setPromosErr(null);
    try {
      const [actives, types] = await Promise.all([fetchActivePromotions(), fetchPromotionTypes()]);
      if (!abort) {
        setActivePromos(Array.isArray(actives?.promotions) ? actives.promotions : []);
        setPromoTypes(Array.isArray(types?.types) ? types.types : []);
      }
    } catch (e: any) {
      if (!abort) setPromosErr(e?.message || "No se pudieron cargar las promociones");
    } finally {
      if (!abort) setPromosLoading(false);
    }
  })();
  return () => {
    abort = true;
  };
}, []);
// 🔹 NUEVO: validar cupón sin aplicarlo
async function handleValidateCoupon(e: React.FormEvent) {
  e.preventDefault();
  setCouponValidation(null);
  if (!couponCode.trim()) return;
  setCouponValidating(true);
  try {
    const res = await validateCoupon(couponCode.trim());
    setCouponValidation(res);
  } catch (e: any) {
    setCouponValidation({ valid: false, message: e?.message || "No se pudo validar el cupón" });
  } finally {
    setCouponValidating(false);
  }
}

// 🔹 NUEVO: calcular descuentos con /promotions/apply-discounts (sobre el carrito actual)
async function handleApplyPromotions(e: React.FormEvent) {
  e.preventDefault();
  setPromoCalc(null);
  setPromoCalcErr(null);
  setPromoCalcLoading(true);
  try {
    const { cartItems, totalAmount } = buildApplyDiscountsPayload(items);
    const res = await applyDiscounts({
      couponCode: couponCode.trim() || undefined,
      cartItems,
      totalAmount,
    });
    setPromoCalc(res);
  } catch (e: any) {
    setPromoCalc(null);
    setPromoCalcErr(e?.message || "No se pudieron aplicar los descuentos");
  } finally {
    setPromoCalcLoading(false);
  }
}



  function normalizeCart(resp: CartResponse): CartData {
    // Soportar {success,data} o plano
    const payload: any = (resp as any)?.success === true ? (resp as any).data : resp;

    const rawItems: any[] = Array.isArray(payload?.items) ? payload.items : [];
    const normalizedItems: CartItem[] = rawItems.map((it) => {
      // ID del cart item
      const itemId = it._id || it.id || it.itemId || "";
      // Si viene product anidado
      if (it.product) {
        return {
          _id: String(itemId),
          product: {
            _id: it.product._id ?? it.productId ?? undefined,
            name: it.product.name ?? it.productName ?? undefined,
            ...it.product,
          },
          quantity: Number(it.quantity) || 1,
          size: it.size ?? null,
          color: it.color ?? null,
          price: typeof it.price === "number" ? it.price : undefined,
          subtotal: typeof it.subtotal === "number" ? it.subtotal : undefined,
        };
      }
      // Si viene plano con productId/productName
      return {
        _id: String(itemId),
        product: { _id: it.productId, name: it.productName },
        quantity: Number(it.quantity) || 1,
        size: it.size ?? null,
        color: it.color ?? null,
        price: typeof it.price === "number" ? it.price : undefined,
        subtotal: typeof it.subtotal === "number" ? it.subtotal : undefined,
      };
    });

    return {
      _id: payload?._id,
      userId: payload?.userId,
      items: normalizedItems,
      total: typeof payload?.total === "number" ? payload.total : undefined,
      totalItems: typeof payload?.totalItems === "number" ? payload.totalItems : undefined,
      discounts: Array.isArray(payload?.discounts) ? payload.discounts : undefined,
      finalTotal: typeof payload?.finalTotal === "number" ? payload.finalTotal : undefined,
    };
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

      // Inicializar controles de edición
      const next: Record<string, { quantity: number; size: string }> = {};
      (cart.items || []).forEach((it) => {
        next[it._id] = {
          quantity: Number(it.quantity) || 1,
          size: (it.size ?? "").toString(),
        };
      });
      setEdits(next);
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

  

  useEffect(() => {
    loadCart();
  }, []);
async function loadCartSummary(withCoupon?: string) {
  setSummaryLoading(true);
  setSummaryErr(null);
  try {
    const qs = withCoupon ? `?couponCode=${encodeURIComponent(withCoupon)}` : "";
    const r = await apiFetch<CartSummaryResponse>(`/cart/summary-with-discounts${qs}`, { method: "GET" });
    setSummary(r);
  } catch (e: any) {
    setSummary(null);
    setSummaryErr(e?.message || "No se pudo obtener el resumen con descuentos");
  } finally {
    setSummaryLoading(false);
  }
}

async function handleApplyCoupon(e: React.FormEvent) {
  e.preventDefault();
  await loadCartSummary(couponCode.trim() || undefined);
}

  /* ===== Add / Update / Remove ===== */
  async function handleAddToCart(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg(null);
    setAdding(true);
    try {
      const payload: Record<string, any> = {
        productId: addProductId.trim(),
        quantity: Number(addQty) || 1,
      };
      const s = addSize.trim();
      const c = addColor.trim();
      if (s) payload.size = s;
      if (c) payload.color = c; // 👈 NUEVO: enviar color si se completó

      // Soportar respuesta 201 del contrato o backends que devuelven otra forma
      const r = await apiFetch<AddToCartResponse | CartResponse>("/cart/add", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Feedback inmediato si vino AddToCartResponse
      if ((r as AddToCartResponse)?.cartTotal !== undefined) {
        const ar = r as AddToCartResponse;
        setCartTotal(ar.cartTotal);
        setAddMsg(ar.message || "Producto agregado 👍");
      } else {
        setAddMsg("Producto agregado 👍");
      }

      // Refrescar carrito para ver ítems actualizados
      await loadCart();

      // Limpiar solo cantidad si querés seguir agregando mismo producto/variante
      // (dejamos productId/size/color por comodidad)
      setAddQty(1);
    } catch (e: any) {
      // Ej.: 400 -> { success:false, message:"Insufficient stock", error:"INSUFFICIENT_STOCK" }
      const msg = e?.message || "No se pudo agregar";
      setAddMsg(msg);
    } finally {
      setAdding(false);
    }
  }

 async function handleUpdateItem(itemId: string) {
  setUpdateMsg(null);
  setUpdatingId(itemId);
  try {
    const current = edits[itemId] || { quantity: 1, size: "" };
    // ✔ quantity >= 1, entero
    const q = Math.max(1, Math.floor(Number(current.quantity) || 1));

    // 🔁 Contrato correcto: PUT /cart/:itemId
    const r = await apiFetch<UpdateCartItemResponse | CartResponse>(`/cart/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({ quantity: q }), // ✔ solo quantity
    });

    // 👍 Si viene el contrato nuevo, actualizamos UI al instante
    if ((r as any)?.cartItem && (r as any)?.cartTotal !== undefined) {
      const ur = r as UpdateCartItemResponse;
      setCartTotal(ur.cartTotal);
      setItems((prev) =>
        prev.map((it) =>
          it._id === ur.cartItem._id
            ? { ...it, quantity: ur.cartItem.quantity, subtotal: ur.cartItem.subtotal }
            : it
        )
      );
      setUpdateMsg(ur.message || "Ítem actualizado ✅");
    } else {
      setUpdateMsg("Ítem actualizado ✅");
    }

    // 🔄 Igual sincronizamos todo con el backend
    await loadCart();
  } catch (e: any) {
    setUpdateMsg(e?.message || "No se pudo actualizar el ítem");
  } finally {
    setUpdatingId(null);
  }
}


 async function handleRemoveItem(itemId: string) {
  setRemoveMsg(null);
  setRemovingId(itemId);
  try {
    // ✔ Contrato correcto: DELETE /cart/:itemId
    const r = await apiFetch<DeleteCartItemResponse | CartResponse>(`/cart/${itemId}`, {
      method: "DELETE",
    });

    // ✅ Actualización optimista si viene el contrato nuevo
    if ((r as any)?.cartTotal !== undefined) {
      const dr = r as DeleteCartItemResponse;
      // sacamos el item localmente
      setItems((prev) => prev.filter((it) => it._id !== itemId));
      // actualizamos total del carrito
      setCartTotal(dr.cartTotal);
      // recalculamos conteo de ítems mostrado (fallback al derived)
      setCartTotalItems((prev) => (prev !== null ? Math.max(0, prev - 1) : prev));
      // si quedó vacío, limpiamos extras (opcional)
      if (dr.cartTotal === 0) {
        setCartDiscounts([]);
        setCartFinalTotal(null);
      }
      setRemoveMsg(dr.message || "Ítem eliminado 🗑️");
    } else {
      setRemoveMsg("Ítem eliminado 🗑️");
    }

    // 🔄 Sincronizamos con el backend para asegurar totales/ descuentos
    await loadCart();
  } catch (e: any) {
    setRemoveMsg(e?.message || "No se pudo eliminar el ítem");
  } finally {
    setRemovingId(null);
  }
}

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setOrderMsg(null);
    setOrderCreated(null);

    if (!cartId) {
      setOrderMsg("No se encontró un carrito para el usuario");
      return;
    }
    if (!items.length) {
      setOrderMsg("El carrito está vacío");
      return;
    }
    if (!shipStreet.trim() || !shipCity.trim() || !shipZip.trim() || !shipCountry.trim()) {
      setOrderMsg("Completá la dirección de envío.");
      return;
    }

    const body: CreateOrderBody = {
      cartId,
      items: items.map((it) => ({
        itemId: it._id,
        quantity: Math.max(1, Number(edits[it._id]?.quantity ?? it.quantity) || 1),
      })),
      shippingAddress: {
        street: shipStreet.trim(),
        city: shipCity.trim(),
        zip: shipZip.trim(),
        country: shipCountry.trim(),
      },
    };

    setCreatingOrder(true);
    try {
      const r = await apiFetch<CreateOrderResponse>("/orders", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudo crear el pedido");
      }

      setOrderCreated(r.data);
      setOrderMsg("Pedido creado ✅");
      await loadCart();
    } catch (e: any) {
      setOrderMsg(e?.message || "No se pudo crear el pedido");
      if (String(e?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/carrito";
      }
    } finally {
      setCreatingOrder(false);
    }
  }

  const derivedTotalItems = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0),
    [items]
  );

  return (
    <main style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Tu carrito</h1>

        {/* Mini form para probar /cart/add */}
        <form
          onSubmit={handleAddToCart}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px,1fr) 88px 96px 120px auto", // 👈 se sumó columna de color
            gap: 8,
            alignItems: "center",
          }}
          title="Agregar producto al carrito (prueba de /cart/add)"
        >
          <input
            placeholder="productId (MongoID)"
            value={addProductId}
            onChange={(e) => setAddProductId(e.target.value)}
            required
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <input
            type="number"
            min={1}
            value={addQty}
            onChange={(e) => setAddQty(parseInt(e.target.value || "1", 10))}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <input
            placeholder="Talle (opcional)"
            value={addSize}
            onChange={(e) => setAddSize(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <input
            placeholder="Color (opcional)" // 👈 NUEVO input color
            value={addColor}
            onChange={(e) => setAddColor(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <button
            type="submit"
            disabled={adding || !addProductId}
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

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button
          onClick={loadCart}
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

<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
  <form onSubmit={handleApplyCoupon} style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <input
      placeholder="Cupón (opcional)"
      value={couponCode}
      onChange={(e) => setCouponCode(e.target.value)}
      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", width: 160 }}
    />
    <button
      type="submit"
      disabled={summaryLoading}
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #ddd",
        background: summaryLoading ? "#f3f3f3" : "white",
        cursor: summaryLoading ? "default" : "pointer",
        fontWeight: 600,
      }}
      title="Aplicar cupón (GET /cart/summary-with-discounts)"
    >
      {summaryLoading ? "Aplicando…" : "Aplicar cupón (Resumen carrito)"}
    </button>
  </form>

  {/* 🔹 NUEVO: validar cupón (POST /promotions/validate-coupon) */}
  <form onSubmit={handleValidateCoupon}>
    <button
      type="submit"
      disabled={couponValidating || !couponCode.trim()}
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
{/* 🔹 NUEVO: listado simple de promos activas */}
<section
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

{/* 🔹 NUEVO: Estimá tu envío */}
<section
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
      placeholder="addressId (ej: addr_001)"
      value={addressId}
      onChange={(e) => setAddressId(e.target.value)}
      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", width: 200 }}
    />
    <button
      type="submit"
      disabled={shipCalcLoading || items.length === 0}
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

      {/* Lista de ítems */}
      {!loading && items.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((it) => (
            <article
              key={it._id}
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
                <div style={{ opacity: 0.8, fontSize: 14 }}>
                  prodId: {it.product?._id ?? "-"} • itemId: {it._id}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, opacity: 0.8 }}>Cant.</span>
                    <input
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
                    <input
                      placeholder="(opcional)"
                      value={edits[it._id]?.size ?? (it.size ?? "")}
                      onChange={(e) =>
                        setEdits((s) => ({
                          ...s,
                          [it._id]: {
                            quantity: s[it._id]?.quantity ?? it.quantity,
                            size: e.target.value,
                          },
                        }))
                      }
                      style={{ width: 120, padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleUpdateItem(it._id)}
                      disabled={updatingId === it._id}
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
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #f1c0c0",
                        background: removingId === it._id ? "#f8eaea" : "white",
                        color: "#b00020",
                        cursor: removingId === it._id ? "default" : "pointer",
                        fontWeight: 600,
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

   {/* Resumen de totales */}
{!loading && !err && items.length > 0 && (
  <section
    style={{
      marginTop: 16,
      padding: 16,
      border: "1px solid #eee",
      borderRadius: 12,
      background: "#fff",
    }}
  >
    <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 8 }}>
      Resumen {couponCode ? `(cupón: ${couponCode})` : ""}
    </h2>

    {/* 🔹 PRIORIDAD 1: resultado de /promotions/apply-discounts */}
    {promoCalc ? (
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
        {/* Mantenemos envío del summary si lo tenés; el apply-discounts no lo calcula */}
        {summary && typeof summary.shipping === "number" && (
          <div><strong>Envío:</strong> {currency(summary.shipping)}</div>
        )}
        <div><strong>Total a pagar:</strong> {currency(promoCalc.finalAmount + (summary?.shipping || 0))}</div>

        {promoCalcErr && <div style={{ color: "crimson" }}>{promoCalcErr}</div>}
      </div>
    ) : summary ? (
      /* 🔹 PRIORIDAD 2: tu summary de /cart/summary-with-discounts */
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
      /* 🔹 PRIORIDAD 3: tu fallback original */
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
  </section>
)}

      {/* Checkout (POST /orders) */}
      {!loading && !err && items.length > 0 && (
        <section
          style={{
            marginTop: 20,
            padding: 16,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 10 }}>Datos de envío</h2>

          <form onSubmit={handleCreateOrder} style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Calle</span>
                <input
                  value={shipStreet}
                  onChange={(e) => setShipStreet(e.target.value)}
                  required
                  placeholder="Calle 123"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Ciudad</span>
                <input
                  value={shipCity}
                  onChange={(e) => setShipCity(e.target.value)}
                  required
                  placeholder="CDMX"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Código Postal</span>
                <input
                  value={shipZip}
                  onChange={(e) => setShipZip(e.target.value)}
                  required
                  placeholder="12345"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>País</span>
                <input
                  value={shipCountry}
                  onChange={(e) => setShipCountry(e.target.value)}
                  required
                  placeholder="México"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={creatingOrder || !cartId}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: creatingOrder ? "#f3f3f3" : "white",
                  cursor: creatingOrder ? "default" : "pointer",
                  fontWeight: 700,
                }}
                title="Crear pedido (POST /orders)"
              >
                {creatingOrder ? "Creando pedido…" : "Confirmar pedido"}
              </button>

              {orderMsg && (
                <span style={{ color: orderMsg.includes("✅") ? "green" : "crimson" }}>{orderMsg}</span>
              )}
            </div>
          </form>

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
