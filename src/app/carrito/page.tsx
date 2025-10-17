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

/* ===== API helpers ===== */
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
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

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [addSize, setAddSize] = useState("");

  // Cargar carrito
  useEffect(() => {
    loadCart();
  }, []);

 async function loadCart() {
  setLoading(true);
  setErr(null);
  try {
    const r = await apiFetch<CartResponse>("/cart", { method: "GET" });
    const cart = normalizeCart(r);
    setItems(cart.items || []);
      setCartBadgeCount(computeItemsCount(cart.items || []));
  } catch (e: any) {
      setErr(e?.message || "Error al cargar el carrito");
  } finally {
    setLoading(false);
  }
}

  function normalizeCart(r: CartResponse): CartData {
    const payload = (r as CartResponseWrapped)?.success === true ? (r as CartResponseWrapped).data : (r as CartResponseFlat);
    if (!payload || !Array.isArray(payload.items)) {
      throw new Error("Formato inesperado en /cart");
    }
    const normalizedItems: CartItem[] = payload.items.map((it: any) => {
      const productObj: CartProduct = typeof it.product === "object" && it.product !== null ? it.product : { _id: String(it.product || ""), name: it.productName || "Producto" };
      const price = typeof it.price === "number" ? it.price : (typeof it.subtotal === "number" ? it.subtotal / (Number(it.quantity) || 1) : 0);
      const subtotal = typeof it.subtotal === "number" ? it.subtotal : (price * (Number(it.quantity) || 1));
      return { _id: String(it._id || ""), product: productObj, quantity: Number(it.quantity) || 1, size: it.size ?? null, color: it.color ?? null, price, subtotal };
    });
    const totalItems = typeof payload.totalItems === "number" ? payload.totalItems : normalizedItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const total = typeof payload.total === "number" ? payload.total : normalizedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    const finalTotal = typeof payload.finalTotal === "number" ? payload.finalTotal : total;
    return { _id: payload._id, userId: payload.userId, items: normalizedItems, total, totalItems, discounts: Array.isArray(payload.discounts) ? payload.discounts : undefined, finalTotal };
  }

  // Agregar producto al carrito
  async function handleAddToCart(e: React.FormEvent) {
  e.preventDefault();
    if (!addProductId.trim()) return;
  setAdding(true);
    setAddMsg(null);
    try {
      const r = await apiFetch<{ success: boolean; message?: string }>("/cart/add", {
      method: "POST",
        body: JSON.stringify({
          productId: addProductId.trim(),
          quantity: addQty,
          size: addSize.trim() || undefined,
        }),
      });
      setAddMsg(r.message || "Producto agregado al carrito");
      setAddProductId("");
    setAddQty(1);
      setAddSize("");
      await loadCart();
  } catch (e: any) {
      setAddMsg(e?.message || "Error al agregar producto");
  } finally {
    setAdding(false);
  }
}

  // Eliminar item del carrito
  async function handleRemoveItem(itemId: string) {
    try {
      await apiFetch(`/cart/remove/${itemId}`, { method: "DELETE" });
    await loadCart();
  } catch (e: any) {
      setErr(e?.message || "Error al eliminar item");
    }
  }

  // Limpiar carrito
  async function handleClearCart() {
    try {
      await apiFetch("/cart/clear", { method: "DELETE" });
      setItems([]);
      setCartBadgeCount(0);
    } catch (e: any) {
      setErr(e?.message || "Error al limpiar carrito");
    }
  }

  // Actualizar cantidad
  async function handleUpdateQuantity(itemId: string, newQuantity: number) {
    if (newQuantity < 1) return;
    try {
      await apiFetch(`/cart/update/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({ quantity: newQuantity }),
      });
      await loadCart();
    } catch (e: any) {
      setErr(e?.message || "Error al actualizar cantidad");
      }
  }

  const derivedTotalItems = useMemo(() => items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0), [items]);
  const derivedTotal = useMemo(() => items.reduce((acc, it) => acc + (it.subtotal || 0), 0), [items]);

  if (loading) {
  return (
      <main className={s.page}>
        <div className={s.loading}>
          <div className={s.spinner}></div>
          Cargando carrito...
              </div>
      </main>
    );
  }

  if (err) {
    return (
      <main className={s.page}>
        <div className={s.error}>
          {err}
          <button onClick={loadCart} className={s.btnSecondary}>
            Reintentar
            </button>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className={s.page}>
        <div className={s.container}>
          <div className={s.header}>
            <h1 className={s.title}>Mi carrito</h1>
          </div>

          <div className={s.content}>
            <div className={s.empty}>
              <h2 className={s.emptyTitle}>Tu carrito está vacío</h2>
              <p className={s.emptyText}>
                Agrega algunos productos para comenzar tu compra
              </p>
              <Link href="/catalogo" className={s.btnPrimary}>
                Ver productos
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <div className={s.container}>
        {/* Header */}
        <div className={s.header}>
          <h1 className={s.title}>Mi carrito</h1>
          <button onClick={handleClearCart} className={s.clearBtn}>
            Limpiar carrito
          </button>
          </div>

        {/* Contenido principal */}
        <div className={s.content}>
          {/* Lista de items */}
          <div className={s.items}>
            {items.map((item) => (
              <div key={item._id} className={s.item}>
                {/* Imagen */}
                <div className={s.thumb}>
                  <img
                    src={item.product.images?.[0] || '/placeholder.jpg'}
                    alt={item.product.name}
            />
          </div>

                {/* Información */}
                <div className={s.info}>
                  <h3 className={s.name}>{item.product.name}</h3>
                  <div className={s.details}>
                    {item.size && <span className={s.size}>Talle: {item.size}</span>}
                    {item.color && <span>Color: {item.color}</span>}
          </div>
                  <div className={s.price}>{currency(item.price)}</div>
                </div>

                {/* Controles */}
                <div className={s.controls}>
                  <div className={s.quantity}>
          <button
                      className={s.qtyBtn}
                      onClick={() => handleUpdateQuantity(item._id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      −
          </button>
                    <input
                      type="number"
                      className={s.qtyInput}
                      value={item.quantity}
                      onChange={(e) => handleUpdateQuantity(item._id, parseInt(e.target.value) || 1)}
                    />
                    <button
                      className={s.qtyBtn}
                      onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>

                    <button
                    className={s.removeBtn}
                    onClick={() => handleRemoveItem(item._id)}
                  >
                    Eliminar
                    </button>
                  </div>
                </div>
          ))}
        </div>

          {/* Resumen */}
          <div className={s.summary}>
            <h2 className={s.summaryTitle}>Resumen del pedido</h2>
            
            <div className={s.summaryRow}>
              <span className={s.label}>Subtotal ({derivedTotalItems} items)</span>
              <span className={s.value}>{currency(derivedTotal)}</span>
          </div>

            <div className={s.summaryRow}>
              <span className={s.label}>Envío</span>
              <span className={s.value}>Se calcula al finalizar</span>
          </div>

            <div className={s.summaryRow}>
              <span className={s.label}>Total</span>
              <span className={s.total}>{currency(derivedTotal)}</span>
                </div>

            <div className={s.actions}>
      <button
                className={s.btnPrimary}
                onClick={() => alert('Funcionalidad de pago en desarrollo')}
              >
                <span className={s.mercadopagoIcon}></span>
                Pagar con MercadoPago
              </button>
              
              <Link href="/catalogo" className={s.btnSecondary}>
                Continuar comprando
              </Link>
            </div>
                </div>
              </div>
              </div>
    </main>
  );
}