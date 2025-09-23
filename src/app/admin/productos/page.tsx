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
  [k: string]: any;
};

type CreateResponse =
  | { success: true; data: ProductOut; message?: string }
  | { success: false; message: string };

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

  // UI state
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [created, setCreated] = useState<ProductOut | null>(null);

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

  function parseCsvToArray(input: string): string[] {
    return (input || "")
      .split(/[,\n]/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCreated(null);

    // Validaciones mínimas
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
    };

    setCreating(true);
    try {
      // POST /products (requiere token admin)
      const r = await apiFetch<CreateResponse>("/products", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!("success" in r) || !r.success) {
        throw new Error(("message" in r && r.message) || "No se pudo crear el producto");
      }

      setCreated(r.data);
      setMsg("Producto creado ✅");

      // Opcional: limpiar formulario manteniendo flags
      setName("");
      setDescription("");
      setPrice("");
      setCategory("");
      setSizesText("");
      setImagesText("");
      setStock("");
    } catch (err: any) {
      // Errores esperados:
      // 400: "Datos inválidos en el formulario"
      // 403: "Se requiere rol de administrador"
      const m = err?.message || "No se pudo crear el producto";
      setMsg(m);
      if (m.toLowerCase().includes("no autenticado") || m.toLowerCase().includes("credenciales")) {
        window.location.href = "/auth?redirectTo=/admin/productos/nuevo";
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Crear producto</h1>
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
        <form
          onSubmit={handleSubmit}
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
          </div>

          {msg && (
            <p style={{ marginTop: 0, color: msg.includes("✅") ? "green" : "crimson" }}>{msg}</p>
          )}
        </form>
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
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Producto creado</div>
          <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
            <div><strong>ID:</strong> {created._id}</div>
            <div><strong>Nombre:</strong> {created.name}</div>
            <div><strong>Precio:</strong> {created.price}</div>
            <div><strong>Categoría:</strong> {created.category}</div>
            <div><strong>Stock:</strong> {created.stock}</div>
            <div><strong>Sizes:</strong> {created.sizes?.join(", ")}</div>
            {!!created.images?.length && (
              <div><strong>Imágenes:</strong> {created.images.join(", ")}</div>
            )}
            <div>
              <strong>Flags:</strong> preorder={String(created.isPreorder)} • featured={String(created.isFeatured)}
            </div>
          </div>

          {/* Si ya tenés la página de detalle */}
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
