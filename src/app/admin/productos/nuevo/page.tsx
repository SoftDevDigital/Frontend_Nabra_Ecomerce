// src/app/admin/productos/nuevo/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type ProductIn = {
  name: string;
  description: string;
  price: number;
  category: string;
  sizes: string[];
  images?: string[];
  stock: number;
  isPreorder?: boolean;
  isFeatured?: boolean;
  isActive?: boolean; // 👈 agregado
};

type ProductOut = {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  sizes: string[];
  images?: string[];
  stock: number;
  isPreorder: boolean;
  isFeatured: boolean;
  isActive?: boolean;   // 👈 agregado
  updatedAt?: string;   // 👈 agregado (para mostrar luego)
  [k: string]: any;
};

type CreateResponse =
  | { success: true; data: ProductOut; message?: string }
  | { success: false; message: string };

// Para listar productos — ampliamos para cubrir más formatos
type ListResponse =
  | { success: true; data: ProductOut[]; message?: string }
  | { success: false; message: string }
  | { products?: ProductOut[]; total?: number; page?: number; totalPages?: number }
  | { data?: { products?: ProductOut[] } }
  | { items?: ProductOut[] }
  | ProductOut[]
  | any;

/* ===== Helpers para detectar admin desde el JWT (gateo UI) ===== */
function getJwtPayload(): any | null {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}
function isAdminFromToken(): boolean {
  const p = getJwtPayload();
  if (!p) return false;
  const role = p.role || p.roles || p.userRole || p["https://example.com/roles"];
  if (Array.isArray(role)) return role.map(String).some((r) => r.toLowerCase() === "admin");
  if (typeof role === "string") return role.toLowerCase() === "admin";
  return false;
}
function getBearer(): string | null {
  try {
    return typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
  } catch {
    return null;
  }
}
/* =============================================================== */

export default function AdminCreateProductPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [category, setCategory] = useState("");
  const [sizesText, setSizesText] = useState("");          // CSV -> array
  const [imagesText, setImagesText] = useState("");        // CSV opcional -> array
  const [stock, setStock] = useState<number | "">("");
  const [isPreorder, setIsPreorder] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(true); // 👈 NUEVO

  // UI state
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [created, setCreated] = useState<ProductOut | null>(null);

  // ====== Edición/actualización ======
  const [editId, setEditId] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [updating, setUpdating] = useState(false);

  // ====== Lista para el select ======
  const [allProducts, setAllProducts] = useState<ProductOut[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // ====== NUEVO: agregar imagen por URL a un producto ======
  const [addImageUrl, setAddImageUrl] = useState("");
  const [addingImg, setAddingImg] = useState(false);

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

  // Cuando sabemos que es admin, cargamos la lista
  useEffect(() => {
    if (isAdmin) {
      void loadAllProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  function parseCsvToArray(input: string): string[] {
    return (input || "")
      .split(/[,\n]/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function fillFormFromProduct(p: ProductOut) {
    setName(p.name || "");
    setDescription(p.description || "");
    setPrice(typeof p.price === "number" ? p.price : "");
    setCategory(p.category || "");
    setSizesText(Array.isArray(p.sizes) ? p.sizes.join(",") : "");
    setImagesText(Array.isArray(p.images) ? p.images.join(",") : "");
    setStock(typeof p.stock === "number" ? p.stock : "");
    setIsPreorder(Boolean(p.isPreorder));
    setIsFeatured(Boolean(p.isFeatured));
    setIsActive(typeof p.isActive === "boolean" ? p.isActive : true);
  }

  async function loadAllProducts() {
    try {
      setLoadingProducts(true);

      // 👇 pedimos muchos para el select
      const bearer = getBearer();
      const r = await apiFetch<ListResponse>("/products?limit=200&page=1", {
        method: "GET",
        headers: {
          "Accept": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
      });

      // 👇 normalizamos formatos comunes
      let arr: ProductOut[] = [];
      if (Array.isArray(r)) {
        arr = r as ProductOut[];
      } else if (Array.isArray((r as any)?.data)) {
        arr = (r as any).data;
      } else if (Array.isArray((r as any)?.items)) {
        arr = (r as any).items;
      } else if (Array.isArray((r as any)?.products)) {
        arr = (r as any).products;
      } else if (Array.isArray((r as any)?.data?.products)) {
        arr = (r as any).data.products;
      } else if ((r as any)?.success === false) {
        throw new Error((r as any)?.message || "Error al listar productos");
      } else {
        // último intento: si es objeto con una propiedad array cualquiera
        const maybeArray = Object.values(r || {}).find((v) => Array.isArray(v)) as ProductOut[] | undefined;
        if (Array.isArray(maybeArray)) arr = maybeArray;
      }

      setAllProducts(arr);
    } catch (e: any) {
      setMsg(e?.message || "No se pudo cargar la lista de productos");
      setAllProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCreated(null);

    const p = Number(price);
    const s = Number(stock);
    if (!name.trim() || !description.trim() || !category.trim()) {
      setMsg("Completá nombre, descripción y categoría.");
      return;
    }
    if (!Number.isFinite(p) || p <= 0) {
      setMsg("Precio inválido.");
      return;
    }
    if (!Number.isFinite(s) || s < 0) {
      setMsg("Stock inválido.");
      return;
    }
    const sizes = parseCsvToArray(sizesText);
    if (!sizes.length) {
      setMsg("Ingresá al menos un talle en “sizes”.");
      return;
    }
    const images = parseCsvToArray(imagesText);
    const body: ProductIn = {
      name: name.trim(),
      description: description.trim(),
      price: p,
      category: category.trim(),
      sizes,
      stock: s,
      ...(images.length ? { images } : {}),
      ...(isPreorder ? { isPreorder: true } : {}),
      ...(isFeatured ? { isFeatured: true } : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {}),
    };

    setCreating(true);
    try {
      const r = await apiFetch<CreateResponse>("/products", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudo crear el producto");
      }

      setCreated(r.data);
      setMsg("Producto creado ✅");

      // Limpio formulario
      setName("");
      setDescription("");
      setPrice("");
      setCategory("");
      setSizesText("");
      setImagesText("");
      setStock("");
      setEditing(false);
      setEditId("");

      // refresco el select
      void loadAllProducts();
    } catch (err: any) {
      const m = err?.message || "No se pudo crear el producto";
      setMsg(m);
      if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("credenciales")) {
        window.location.href = "/auth?redirectTo=/admin/productos/nuevo";
      }
    } finally {
      setCreating(false);
    }
  }

  // ahora acepta un id opcional (útil para onChange del select)
  async function handleLoadForEdit(idParam?: string) {
    setMsg(null);
    setCreated(null);

    const id = (idParam ?? editId ?? "").trim();
    if (!id) {
      setMsg("Seleccioná un producto para editar.");
      return;
    }

    setLoadingEdit(true);
    try {
      const bearer = getBearer();
      const r = await apiFetch<CreateResponse | ProductOut>(`/products/${id}`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
      });

      // tolerar plano o { success, data }
      let prod: ProductOut | null = null;
      if (typeof (r as any)?.success === "boolean") {
        const rr = r as CreateResponse;
        if (!rr.success) throw new Error(rr.message || "No se pudo cargar el producto");
        prod = rr.data;
      } else {
        const plain = r as ProductOut;
        if (plain && plain._id) prod = plain;
      }
      if (!prod) throw new Error("Respuesta inesperada del servidor");

      fillFormFromProduct(prod);
      setEditing(true);
      setMsg("Producto cargado para edición. Podés modificar y guardar.");
    } catch (err: any) {
      const m = err?.message || "No se pudo cargar el producto";
      setMsg(m);
    } finally {
      setLoadingEdit(false);
    }
  }

 async function handleUpdate(e: React.FormEvent) {
  e.preventDefault();

  setMsg(null);
  setCreated(null);

  const id = (editId || "").trim();
  if (!id) {
    setMsg("Falta seleccionar el producto para actualizar.");
    return;
  }

  const p = Number(price);
  const s = Number(stock);
  if (!Number.isFinite(p) || p <= 0) {
    setMsg("Precio inválido.");
    return;
  }
  if (!Number.isFinite(s) || s < 0) {
    setMsg("Stock inválido.");
    return;
  }

  const sizes = parseCsvToArray(sizesText);
  const images = parseCsvToArray(imagesText);

  // 🚫 IMPORTANTE: el backend NO acepta isActive en PUT, así que lo omitimos
  const bodyFull: Partial<ProductIn> = {
    price: p,
    stock: s,
    // isActive, // <- NO LO MANDAMOS EN PUT
    // Enviamos también el resto por idempotencia
    name: name.trim(),
    description: description.trim(),
    category: category.trim(),
    ...(sizes.length ? { sizes } : {}),
    ...(images.length ? { images } : { images: [] }),
    isPreorder,
    isFeatured,
  };

  setUpdating(true);
  try {
    const bearer = getBearer();
    const r = await apiFetch<CreateResponse | ProductOut>(`/products/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(bodyFull),
    });

    let updated: ProductOut | null = null;
    if (typeof (r as any)?.success === "boolean") {
      const rr = r as CreateResponse;
      if (!rr.success) throw new Error(rr.message || "No se pudo actualizar el producto");
      updated = rr.data;
    } else {
      const plain = r as ProductOut;
      if (plain && plain._id) updated = plain;
    }
    if (!updated) throw new Error("Respuesta inesperada del servidor");

    setCreated(updated);
    setMsg("Producto actualizado ✅");
    void loadAllProducts();
  } catch (err: any) {
    const m = err?.message || "No se pudo actualizar el producto";
    setMsg(m);
    if (/(401|403|no autenticado|credenciales|unauthorized|forbidden)/i.test(m)) {
      window.location.href = "/auth?redirectTo=/admin/productos/nuevo";
    }
  } finally {
    setUpdating(false);
  }
}


  // ====== NUEVO: POST /products/:id/images (agregar una imagen al producto) ======
  async function handleAddImageToProduct() {
    setMsg(null);

    const id = (editId || "").trim();
    const url = (addImageUrl || "").trim();

    if (!id) {
      setMsg("Seleccioná un producto para editar.");
      return;
    }
    if (!url) {
      setMsg("Ingresá la URL de la imagen.");
      return;
    }

    setAddingImg(true);
    try {
      const r = await apiFetch<CreateResponse>(`/products/${id}/images`, {
        method: "POST",
        body: JSON.stringify({ imageUrl: url }),
      });

      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudo adjuntar la imagen");
      }

      setMsg("Imagen agregada al producto ✅");
      setAddImageUrl("");

      await handleLoadForEdit(id);
      setImagesText((prev) => (prev ? `${prev},${url}` : url));
    } catch (err: any) {
      const m = err?.message || "No se pudo adjuntar la imagen";
      setMsg(m);
      if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("credenciales")) {
        window.location.href = "/auth?redirectTo=/admin/productos/nuevo";
      }
    } finally {
      setAddingImg(false);
    }
  }

  function resetEdit() {
    setEditing(false);
    setEditId("");
    setMsg(null);
    setCreated(null);
    setName("");
    setDescription("");
    setPrice("");
    setCategory("");
    setSizesText("");
    setImagesText("");
    setStock("");
    setIsPreorder(false);
    setIsFeatured(false);
    setIsActive(true);
  }

  return (
    <main style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {editing ? "Editar producto" : "Crear producto"}
        </h1>
        <span style={{ marginLeft: "auto", opacity: 0.75, fontSize: 14 }}>
          <Link href="/">Volver al inicio</Link>
        </span>
      </header>

      {!isAdmin && (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff" }}>
          <p style={{ margin: 0 }}>
            Para crear productos necesitás permisos de administrador.
          </p>
        </div>
      )}

      {isAdmin && (
        <>
          {/* ====== Selección por lista para editar ====== */}
          <section
            id="actualizar"
            style={{
              display: "grid",
              gap: 12,
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 16,
              background: "#fff",
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 700 }}>Actualizar producto existente</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={editId}
                onChange={(e) => {
                  const id = e.target.value;
                  setEditId(id);
                  if (id) handleLoadForEdit(id); // autocarga al seleccionar
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  minWidth: 280,
                  flex: 1,
                }}
                disabled={loadingProducts}
              >
                <option value="">
                  {loadingProducts ? "Cargando productos…" : (allProducts.length ? "Seleccioná un producto…" : "No hay productos cargados")}
                </option>
                {allProducts.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} — ${p.price} — stock {p.stock}
                  </option>
                ))}
              </select>

              <button
                onClick={() => loadAllProducts()}
                type="button"
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
                title="Recargar lista de productos"
                disabled={loadingProducts}
              >
                {loadingProducts ? "Actualizando…" : "Recargar lista"}
              </button>

              {editing && (
                <button
                  onClick={resetEdit}
                  type="button"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "white",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                  title="Salir de modo edición"
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <small style={{ opacity: 0.7 }}>
              Elegí un producto para prellenar el formulario y luego guardá con “Actualizar producto”.
            </small>
          </section>

          {/* ====== NUEVO: Agregar imagen al producto seleccionado ====== */}
          {editing && (
            <section
              style={{
                display: "grid",
                gap: 8,
                border: "1px dashed #ddd",
                borderRadius: 12,
                padding: 12,
                background: "#fff",
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 700 }}>Agregar imagen al producto</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={addImageUrl}
                  onChange={(e) => setAddImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", flex: 1, minWidth: 280 }}
                />
                <button
                  type="button"
                  onClick={handleAddImageToProduct}
                  disabled={addingImg || !addImageUrl.trim() || !editId}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: addingImg ? "#f3f3f3" : "white",
                    cursor: addingImg ? "default" : "pointer",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                  title="Adjuntar imagen (POST /products/:id/images)"
                >
                  {addingImg ? "Adjuntando…" : "Agregar imagen"}
                </button>
              </div>
              <small style={{ opacity: 0.7 }}>
                Pegá una URL absoluta (por ejemplo la que te da el módulo de medios) y se agregará a <code>images</code> del producto.
              </small>
            </section>
          )}

          <form
            onSubmit={editing ? handleUpdate : handleSubmit}
            style={{
              display: "grid",
              gap: 12,
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 16,
              background: "#fff",
            }}
          >
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Nombre *</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Zapatos"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Categoría *</span>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  placeholder="zapatos"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                />
              </label>
            </div>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Descripción *</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                placeholder="Cómodos, livianos, etc."
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd" }}
              />
            </label>

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Precio *</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  placeholder="50"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Stock *</span>
                <input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  placeholder="10"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Talles (CSV) *</span>
                <input
                  value={sizesText}
                  onChange={(e) => setSizesText(e.target.value)}
                  required
                  placeholder="35,36,37,38"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                />
              </label>
            </div>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Imágenes (CSV, opcional)</span>
              <input
                value={imagesText}
                onChange={(e) => setImagesText(e.target.value)}
                placeholder="id1,id2 o urls absolutas"
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
              />
              <small style={{ opacity: 0.7 }}>
                Acepta IDs de media o URLs completas. Dejar vacío si no aplica.
              </small>
            </label>

            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={isPreorder}
                  onChange={(e) => setIsPreorder(e.target.checked)}
                />
                <span>isPreorder</span>
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                />
                <span>isFeatured</span>
              </label>

              {/* 👇 NUEVO: activar/desactivar producto */}
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>isActive</span>
              </label>

              {!editing ? (
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: creating ? "#f3f3f3" : "white",
                    cursor: creating ? "default" : "pointer",
                    fontWeight: 700,
                    marginLeft: "auto",
                  }}
                  title="Crear producto (POST /products)"
                >
                  {creating ? "Creando…" : "Crear producto"}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={updating}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: updating ? "#f3f3f3" : "white",
                    cursor: updating ? "default" : "pointer",
                    fontWeight: 700,
                    marginLeft: "auto",
                  }}
                  title="Actualizar producto (PUT /products/:id)"
                >
                  {updating ? "Actualizando…" : "Actualizar producto"}
                </button>
              )}
            </div>

            {msg && (
              <p style={{ marginTop: 0, color: msg.includes("✅") ? "green" : "crimson" }}>{msg}</p>
            )}
          </form>
        </>
      )}

      {created && (
        <section
          style={{
            marginTop: 16,
            border: "1px solid #e6f4ea",
            background: "#f3fbf6",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {editing ? "Producto actualizado" : "Producto creado"}
          </div>
          <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
            <div><strong>ID:</strong> {created._id}</div>
            <div><strong>Nombre:</strong> {created.name}</div>
            <div><strong>Precio:</strong> {created.price}</div>
            <div><strong>Categoría:</strong> {created.category}</div>
            <div><strong>Stock:</strong> {created.stock}</div>
            <div><strong>Sizes:</strong> {created.sizes?.join(", ")}</div>
            {"isActive" in created && (
              <div><strong>Activo:</strong> {String(created.isActive)}</div>
            )}
            {"updatedAt" in created && created.updatedAt && (
              <div><strong>Actualizado:</strong> {new Date(created.updatedAt).toLocaleString("es-AR")}</div>
            )}
            {!!created.images?.length && (
              <div><strong>Imágenes:</strong> {created.images.join(", ")}</div>
            )}
            <div>
              <strong>Flags:</strong> preorder={String(created.isPreorder)} • featured={String(created.isFeatured)}
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <Link href={`/producto/${created._id}`} style={{ textDecoration: "underline" }}>
              Ver producto
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
