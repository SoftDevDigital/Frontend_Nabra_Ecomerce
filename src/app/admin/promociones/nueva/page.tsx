"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import s from "./AdminCreatePromotion.module.css";
import {
  createPromotionAdmin,
  toISOStartOfDay,
  toISOEndOfDay,
  type CreatePromotionIn,
} from "@/lib/promotionsApi";
/* 👇 NUEVO: traemos productos existentes */
import { fetchProducts, type ProductDto } from "@/lib/productsApi";

// ==== helpers jwt (mismo patrón que productos) ====
function getJwtPayload(): any | null {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("nabra_token") : null;
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}
function isAdminFromToken(): boolean {
  const p = getJwtPayload();
  if (!p) return false;
  const role = p.role || p.roles || p.userRole || p["https://example.com/roles"];
  if (Array.isArray(role)) return role.map(String).some(r => r.toLowerCase() === "admin");
  if (typeof role === "string") return role.toLowerCase() === "admin";
  return false;
}

type PromoType = "percentage" | "fixed_amount" | "buy_x_get_y";

export default function AdminCreatePromotionPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState<PromoType>("buy_x_get_y");
  const [productIdsText, setProductIdsText] = useState(""); // CSV de ids
  const [discountPercentage, setDiscountPercentage] = useState<number | "">("");
  const [discountAmount, setDiscountAmount] = useState<number | "">("");
  const [buyQuantity, setBuyQuantity] = useState<number | "">("");
  const [getQuantity, setGetQuantity] = useState<number | "">("");
  const [startDate, setStartDate] = useState(""); // yyyy-mm-dd
  const [endDate, setEndDate] = useState("");

  // UI
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  /* 👇 NUEVO: estado para selector de productos */
  const [allProducts, setAllProducts] = useState<ProductDto[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsErr, setProductsErr] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => { setIsAdmin(isAdminFromToken()); }, []);

  /* 👇 NUEVO: cargar productos existentes (primeras 200) */
  useEffect(() => {
    let abort = false;
    (async () => {
      if (!isAdmin) return;
      setProductsLoading(true);
      setProductsErr(null);
      try {
        const { products } = await fetchProducts({ limit: 200 });
        if (!abort) setAllProducts(products || []);
      } catch (e: any) {
        if (!abort) setProductsErr(e?.message || "No se pudieron cargar los productos");
      } finally {
        if (!abort) setProductsLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [isAdmin]);

  /* 👇 NUEVO: filtro local por búsqueda */
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p._id?.toLowerCase().includes(q)
    );
  }, [allProducts, productSearch]);

  /* 👇 NUEVO: handlers del selector */
  function onSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const opts = Array.from(e.target.selectedOptions).map(o => o.value);
    setSelectedIds(opts);
  }
  function toggleId(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function csvToArray(input: string) {
    return (input || "").split(/[,\s\n]+/g).map(s => s.trim()).filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setCreatedId(null);

    if (!isAdmin) { setMsg("Necesitás permisos de administrador."); return; }
    if (!name.trim()) { setMsg("Ingresá un nombre."); return; }

    /* 👇 NUEVO: priorizar selección; si no hay, usar CSV */
    const idsFromCsv = csvToArray(productIdsText);
    const ids = selectedIds.length ? selectedIds : idsFromCsv;
    if (!ids.length) { setMsg("Elegí al menos un producto (selector o CSV)."); return; }

    if (!startDate || !endDate) { setMsg("Elegí inicio y fin de la promoción."); return; }

    // construir payload según tipo
    let payload: CreatePromotionIn;
    if (type === "percentage") {
      const pct = Number(discountPercentage);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) { setMsg("Porcentaje inválido (1–100)."); return; }
      payload = {
        name: name.trim(),
        type: "percentage",
        productIds: ids,
        discountPercentage: pct,
        startDate: toISOStartOfDay(startDate),
        endDate: toISOEndOfDay(endDate),
      };
    } else if (type === "fixed_amount") {
      const amt = Number(discountAmount);
      if (!Number.isFinite(amt) || amt <= 0) { setMsg("Monto fijo inválido (> 0)."); return; }
      payload = {
        name: name.trim(),
        type: "fixed_amount",
        productIds: ids,
        discountAmount: amt,
        startDate: toISOStartOfDay(startDate),
        endDate: toISOEndOfDay(endDate),
      };
    } else {
      const buy = Number(buyQuantity);
      const get = Number(getQuantity);
      if (!Number.isFinite(buy) || buy <= 0) { setMsg("buyQuantity inválido (> 0)."); return; }
      if (!Number.isFinite(get) || get <= 0) { setMsg("getQuantity inválido (> 0)."); return; }
      payload = {
        name: name.trim(),
        type: "buy_x_get_y",
        productIds: ids,
        buyQuantity: buy,
        getQuantity: get,
        startDate: toISOStartOfDay(startDate),
        endDate: toISOEndOfDay(endDate),
      };
    }

    setCreating(true);
    try {
      const r = await createPromotionAdmin(payload);
      if (!("success" in r) || !r.success) throw new Error((r as any)?.message || "No se pudo crear la promoción");
      setMsg("Promoción creada ✅");
      setCreatedId(r.data?._id || null);
      // reset rápido (dejá fechas por conveniencia)
      // setName(""); setProductIdsText(""); setDiscountAmount(""); setDiscountPercentage(""); setBuyQuantity(""); setGetQuantity("");
    } catch (err:any) {
      setMsg(err?.message || "No se pudo crear la promoción");
      if (/(401|403|unauthorized|forbidden|no autenticado)/i.test(String(err?.message))) {
        window.location.href = "/auth?redirectTo=/admin/promociones/nueva";
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Nueva promoción</h1>
        <Link href="/promociones" className={s.back}>Ver página de promociones</Link>
      </header>

      {!isAdmin && (
        <div className={s.notice}>
          Necesitás permisos de administrador para crear promociones.
        </div>
      )}

      {isAdmin && (
        <form className={s.card} onSubmit={handleSubmit}>
          <div className={s.grid2}>
            <label className={s.field}>
              <span className={s.lbl}>Nombre *</span>
              <input className={s.input} value={name} onChange={e => setName(e.target.value)} required />
            </label>

            <label className={s.field}>
              <span className={s.lbl}>Tipo *</span>
              <select className={s.input} value={type} onChange={e => setType(e.target.value as PromoType)}>
                <option value="percentage">Porcentaje</option>
                <option value="fixed_amount">Monto fijo</option>
                <option value="buy_x_get_y">2x1 (Buy X Get Y)</option>
              </select>
            </label>
          </div>

          {/* 👇 NUEVO: selector de productos existentes (opcional) */}
          <div className={s.field}>
            <span className={s.lbl}>Seleccionar productos existentes</span>
            <input
              className={s.input}
              placeholder="Buscar por nombre / categoría / ID…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              disabled={productsLoading}
            />
            {productsErr && <p className={s.error}>{productsErr}</p>}
            {productsLoading && <p> Cargando productos…</p>}
            {!productsLoading && !productsErr && (
              <>
                <select
                  multiple
                  className={s.input}
                  size={8}
                  value={selectedIds}
                  onChange={onSelectChange}
                >
                  {filteredProducts.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.name} — ${p.price}{p.category ? ` — ${p.category}` : ""} — {p._id}
                    </option>
                  ))}
                </select>
                {!!selectedIds.length && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {selectedIds.map(id => {
                      const p = allProducts.find(x => x._id === id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleId(id)}
                          style={{
                            border: "1px solid #ddd",
                            background: "#f8f8f8",
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 12,
                            cursor: "pointer"
                          }}
                          title="Quitar"
                        >
                          {(p?.name ?? id)} ✕
                        </button>
                      );
                    })}
                  </div>
                )}
                <small>Podés seleccionar varios (Ctrl/Cmd + click). Si no usás este selector, podés pegar IDs abajo.</small>
              </>
            )}
          </div>

          <label className={s.field}>
            <span className={s.lbl}>Productos (IDs separados por coma) *</span>
            <input
              className={s.input}
              placeholder="68f8ddbe...,68f90d76..."
              value={productIdsText}
              onChange={e => setProductIdsText(e.target.value)}
              /* 👇 NUEVO: solo requerir CSV si no hay selección */
              required={!selectedIds.length}
            />
          </label>

          {type === "percentage" && (
            <label className={s.field}>
              <span className={s.lbl}>Descuento (%) *</span>
              <input className={s.input} type="number" min={1} max={100}
                value={discountPercentage}
                onChange={e => setDiscountPercentage(e.target.value === "" ? "" : Number(e.target.value))}
                required
              />
            </label>
          )}

          {type === "fixed_amount" && (
            <label className={s.field}>
              <span className={s.lbl}>Monto fijo *</span>
              <input className={s.input} type="number" min={1}
                value={discountAmount}
                onChange={e => setDiscountAmount(e.target.value === "" ? "" : Number(e.target.value))}
                required
              />
            </label>
          )}

          {type === "buy_x_get_y" && (
            <div className={s.grid2}>
              <label className={s.field}>
                <span className={s.lbl}>buyQuantity *</span>
                <input className={s.input} type="number" min={1}
                  value={buyQuantity}
                  onChange={e => setBuyQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
              </label>
              <label className={s.field}>
                <span className={s.lbl}>getQuantity *</span>
                <input className={s.input} type="number" min={1}
                  value={getQuantity}
                  onChange={e => setGetQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
              </label>
            </div>
          )}

          <div className={s.grid2}>
            <label className={s.field}>
              <span className={s.lbl}>Inicio *</span>
              <input className={s.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required/>
            </label>
            <label className={s.field}>
              <span className={s.lbl}>Fin *</span>
              <input className={s.input} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required/>
            </label>
          </div>

          {msg && <p className={msg.includes("✅") ? s.ok : s.error}>{msg}</p>}

          <div className={s.actions}>
            <button type="submit" className={s.btn} disabled={creating}>
              {creating ? "Creando…" : "Crear promoción"}
            </button>
            {createdId && <span className={s.small}>ID creada: {createdId}</span>}
          </div>
        </form>
      )}
    </main>
  );
}
