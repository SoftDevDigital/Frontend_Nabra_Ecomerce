// src/app/admin/productos/eliminar/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

/* ===== Tipos ===== */
type Product = {
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

type ListResponse =
  | { success: true; data: Product[]; message?: string }
  | { success: false; message: string }
  | { products?: Product[]; total?: number; page?: number; totalPages?: number }
  | { data?: { products?: Product[] } }
  | { items?: Product[] }
  | Product[]
  | any;

/* ===== Helpers admin (gateo UI) ===== */
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

/* ===== Página ===== */
export default function AdminDeleteProductsPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setIsAdmin(isAdminFromToken());
  }, []);

  async function loadProducts() {
    if (!isAdmin) return;
    setLoading(true);
    setErr(null);
    setGlobalMsg(null);
    try {
      // 👇 pedimos muchos para alimentar el select/listado
      const bearer = getBearer();
      const r = await apiFetch<ListResponse>("/products?limit=200&page=1", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
      });

      // 👇 normalizamos formatos comunes
      let arr: Product[] = [];
      if (Array.isArray(r)) {
        arr = r as Product[];
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
        const maybeArray = Object.values(r || {}).find((v) => Array.isArray(v)) as Product[] | undefined;
        if (Array.isArray(maybeArray)) arr = maybeArray;
      }

      setProducts(arr);
    } catch (e: any) {
      const msg = e?.message || "No se pudieron obtener los productos";
      setErr(msg);
      if (msg.toLowerCase().includes("no autenticado") || msg.toLowerCase().includes("credenciales")) {
        window.location.href = "/auth?redirectTo=/admin/productos/eliminar";
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadProducts();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        String(p.price).includes(q)
    );
  }, [products, search]);

  async function handleDelete(id: string) {
    if (!id) return;
    const ok = window.confirm("¿Eliminar este producto de forma permanente?");
    if (!ok) return;

    setGlobalMsg(null);
    setDeletingId(id);
    try {
      const bearer = getBearer();
      // DELETE /products/:id -> puede devolver { message } o 200/204 sin body
      const res = await apiFetch<any>(`/products/${id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
      });

      // Quitamos de la lista local
      setProducts((prev) => prev.filter((p) => p._id !== id));

      const okMsg =
        (res && (res.message || res.msg || res.detail)) || "Product deleted successfully";
      setGlobalMsg(`${okMsg} 🗑️`);
    } catch (e: any) {
      // 403: "Se requiere rol de administrador"
      // 404: "Producto no encontrado"
      const msg = e?.message || "No se pudo eliminar el producto";
      setGlobalMsg(msg);
      if (String(msg).toLowerCase().includes("no autenticado") || String(msg).toLowerCase().includes("credenciales")) {
        window.location.href = "/auth?redirectTo=/admin/productos/eliminar";
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main style={{ maxWidth: 1024, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Eliminar productos (admin)</h1>
        <span style={{ marginLeft: "auto", opacity: 0.75, fontSize: 14 }}>
          <Link href="/">Volver al inicio</Link>
        </span>
      </header>

      {!isAdmin && (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff" }}>
          <p style={{ margin: 0 }}>Para eliminar productos necesitás permisos de administrador.</p>
        </div>
      )}

      {isAdmin && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <input
              placeholder="Buscar por nombre/categoría/precio…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", minWidth: 260 }}
            />
            <button
              type="button"
              onClick={loadProducts}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Recargar
            </button>
            <div style={{ opacity: 0.8 }}>Total: <strong>{products.length}</strong></div>
          </div>

          {globalMsg && (
            <p style={{ marginTop: 0, color: globalMsg.includes("🗑️") || globalMsg.includes("✅") ? "green" : "crimson" }}>
              {globalMsg}
            </p>
          )}

          {loading && <p>Cargando productos…</p>}
          {err && !loading && <p style={{ color: "crimson" }}>{err}</p>}

          {!loading && !err && filtered.length === 0 && (
            <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 16 }}>
              <p style={{ margin: 0 }}>No hay productos que coincidan con la búsqueda.</p>
            </div>
          )}

          {!loading && !err && filtered.length > 0 && (
            <div style={{ display: "grid", gap: 12 }}>
              {filtered.map((p) => (
                <article
                  key={p._id}
                  style={{
                    display: "grid",
                    gap: 8,
                    padding: 12,
                    border: "1px solid #eee",
                    borderRadius: 12,
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div><strong>{p.name}</strong> — ${p.price} — stock {p.stock}</div>
                      <div style={{ fontSize: 13, opacity: 0.8 }}>
                        <strong>Categoría:</strong> {p.category} • <strong>ID:</strong> {p._id}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Link href={`/admin/productos/nuevo`} style={{ textDecoration: "underline" }}>
                        Editar/crear
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(p._id)}
                        disabled={deletingId === p._id}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #f1c0c0",
                          background: deletingId === p._id ? "#f8eaea" : "white",
                          color: "#b00020",
                          cursor: deletingId === p._id ? "default" : "pointer",
                          fontWeight: 600,
                        }}
                        title="Eliminar producto (DELETE /products/:id)"
                        aria-label={`Eliminar producto ${p.name}`}
                      >
                        {deletingId === p._id ? "Eliminando…" : "Eliminar"}
                      </button>
                    </div>
                  </div>

                  {p.description && (
                    <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>{p.description}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
