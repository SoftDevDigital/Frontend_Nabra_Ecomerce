// src/app/carrito/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CartProduct = {
  _id: string;
  name: string;
  // podés agregar más campos si tu API los trae (price, images, etc.)
  [k: string]: any;
};

type CartItem = {
  _id: string;              // ← itemId del carrito (lo usa POST /orders)
  product: CartProduct;
  quantity: number;
  size?: string | null;
};

type CartData = {
  _id: string;              // ← cartId (MongoID) que pide POST /orders
  userId: string;
  items: CartItem[];
};

type CartResponse = {
  success: boolean;
  data: CartData;
  message?: string;
};

/* 🔹 NUEVO: tipado de respuesta de POST /orders */
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

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Usamos tu helper global, pero lo reimportamos de forma local para hacer este archivo autocontenible;
  // si preferís, importalo desde "@/lib/api".
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";
  const token = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;

  const headers = new Headers(init.headers || {});
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

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

export default function CartPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  /* 🔹 NUEVO: guardamos el cartId para POST /orders */
  const [cartId, setCartId] = useState<string | null>(null);

  // 🔹 NUEVO: estados para agregar ítems
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState<number>(1);
  const [addSize, setAddSize] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  // 🔹 NUEVO: edición por ítem (cantidad y talle)
  const [edits, setEdits] = useState<Record<string, { quantity: number; size: string }>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  // 🔹 NUEVO: eliminación de ítems
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeMsg, setRemoveMsg] = useState<string | null>(null);

  /* 🔹 NUEVO: formulario de dirección de envío (obligatorio para POST /orders) */
  const [shipStreet, setShipStreet] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipZip, setShipZip] = useState("");
  const [shipCountry, setShipCountry] = useState("");

  /* 🔹 NUEVO: crear pedido */
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);
  const [orderCreated, setOrderCreated] = useState<OrderOut | null>(null);

  async function loadCart() {
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch<CartResponse>("/cart", { method: "GET" });
      const its = r?.data?.items ?? [];
      setItems(its);
      setCartId(r?.data?._id || null);

      // inicializamos los valores de edición a partir de los ítems
      const next: Record<string, { quantity: number; size: string }> = {};
      its.forEach((it) => {
        next[it._id] = {
          quantity: Number(it.quantity) || 1,
          size: (it.size ?? "").toString(),
        };
      });
      setEdits(next);
    } catch (e: any) {
      // Si no está autenticado, redirigí a /auth con redirectTo
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

  // flujo POST /cart/add
  async function handleAddToCart(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg(null);
    setAdding(true);
    try {
      const payload = {
        productId: addProductId.trim(),
        quantity: Number(addQty) || 1,
        ...(addSize.trim() ? { size: addSize.trim() } : {}),
      };
      await apiFetch<CartResponse>("/cart/add", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAddMsg("Producto agregado 👍");
      await loadCart();
    } catch (e: any) {
      setAddMsg(e?.message || "No se pudo agregar");
    } finally {
      setAdding(false);
    }
  }

  // flujo PUT /cart/update/:itemId
  async function handleUpdateItem(itemId: string) {
    setUpdateMsg(null);
    setUpdatingId(itemId);
    try {
      const current = edits[itemId] || { quantity: 1, size: "" };
      const payload: Record<string, any> = {};

      const q = Math.max(1, Number(current.quantity) || 1);
      payload.quantity = q; // opcional en API; enviamos validado

      const s = (current.size || "").trim();
      if (s) payload.size = s; // sólo si hay talle

      await apiFetch<CartResponse>(`/cart/update/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setUpdateMsg("Ítem actualizado ✅");
      await loadCart();
    } catch (e: any) {
      setUpdateMsg(e?.message || "No se pudo actualizar el ítem");
    } finally {
      setUpdatingId(null);
    }
  }

  // 🔹 NUEVO: flujo DELETE /cart/remove/:itemId
  async function handleRemoveItem(itemId: string) {
    setRemoveMsg(null);
    setRemovingId(itemId);
    try {
      await apiFetch<CartResponse>(`/cart/remove/${itemId}`, {
        method: "DELETE",
      });
      setRemoveMsg("Ítem eliminado 🗑️");
      await loadCart();
    } catch (e: any) {
      // 404: “Ítem no encontrado en el carrito”
      setRemoveMsg(e?.message || "No se pudo eliminar el ítem");
    } finally {
      setRemovingId(null);
    }
  }

  /* 🔹 NUEVO: handler POST /orders */
  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setOrderMsg(null);
    setOrderCreated(null);

    // Validaciones mínimas en cliente
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

    // Construimos payload requerido por tu API
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

      // Opcional: recargar carrito (muchos backends vacían/cierran el carrito al crear pedido)
      await loadCart();
    } catch (e: any) {
      // Mensajes esperados por tu especificación:
      // 400: "El carrito está vacío", "El ID del carrito no coincide", "Producto no encontrado en el carrito".
      // 404: "No se encontró un carrito para el usuario".
      setOrderMsg(e?.message || "No se pudo crear el pedido");
      if (String(e?.message || "").toLowerCase().includes("no autenticado")) {
        window.location.href = "/auth?redirectTo=/carrito";
      }
    } finally {
      setCreatingOrder(false);
    }
  }

  const totalItems = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0),
    [items]
  );

  return (
    <main style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Tu carrito</h1>

        {/* mini-form para probar POST /cart/add */}
        <form
          onSubmit={handleAddToCart}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px,1fr) 88px 96px auto",
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
        <p style={{ marginTop: -8, marginBottom: 8, color: addMsg.includes("👍") ? "green" : "crimson" }}>
          {addMsg}
        </p>
      )}

      {/* 🔹 NUEVO: mensaje de eliminación */}
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
        <div style={{ opacity: 0.8 }}>
          Ítems: <strong>{totalItems}</strong>
        </div>
        {/* 🔹 NUEVO: mostramos cartId para depuración */}
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
                  {it.product?.name ?? "(Producto)"} {it.size ? `• Talle ${it.size}` : ""}
                </div>
                <div style={{ opacity: 0.8, fontSize: 14 }}>id: {it.product?._id ?? "-"}</div>

                {/* controles de edición (cantidad + talle) */}
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

                    {/* 🔹 NUEVO: botón eliminar */}
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

              <div style={{ textAlign: "right", fontWeight: 600 }}>x{it.quantity}</div>
            </article>
          ))}
        </div>
      )}

      {/* 🔹 NUEVO: Sección Checkout (POST /orders) */}
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

          {/* 🔹 NUEVO: cuadro de confirmación con datos mínimos del pedido */}
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
                <div><strong>Total:</strong> {orderCreated.total}</div>
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
